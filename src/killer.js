import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function killProcessTree(pid) {
  const numericPid = Number.parseInt(pid, 10);
  if (!Number.isInteger(numericPid) || numericPid <= 0) {
    throw new Error("PID 无效，已拒绝终止。");
  }

  try {
    if (process.platform === "win32") {
      await terminateWindowsTree(numericPid);
      return;
    }

    await terminateUnixTree(numericPid);
  } catch (error) {
    throw new Error(formatKillError(error));
  }
}

async function terminateWindowsTree(pid) {
  try {
    await execFileAsync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  } catch (error) {
    if (!isPermissionError(error)) {
      throw error;
    }

    // 受限环境中 taskkill 可能被拒绝，改用 Windows 原生进程快照递归终止。
    await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      buildWindowsFallbackScript(pid)
    ], { windowsHide: true });
  }
}

async function terminateUnixTree(pid) {
  const children = await listUnixChildren(pid);
  for (const child of children) {
    await terminateUnixTree(child);
  }

  await terminateUnixProcess(pid);
}

async function terminateUnixProcess(pid) {
  try {
    process.kill(pid, "SIGTERM");
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
    return;
  }

  if (await waitForUnixExit(pid)) {
    return;
  }

  try {
    process.kill(pid, "SIGKILL");
  } catch (error) {
    if (error.code !== "ESRCH") {
      throw error;
    }
    return;
  }

  if (!(await waitForUnixExit(pid))) {
    throw new Error(`PID ${pid} 未能在终止后退出。`);
  }
}

async function listUnixChildren(pid) {
  try {
    const { stdout } = await execFileAsync("pgrep", ["-P", String(pid)]);
    return stdout.trim().split(/\s+/).filter(Boolean).map((value) => Number.parseInt(value, 10));
  } catch {
    return [];
  }
}

async function waitForUnixExit(pid, timeoutMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isUnixProcessRunning(pid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return !isUnixProcessRunning(pid);
}

function isUnixProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

function buildWindowsFallbackScript(pid) {
  return `
$ErrorActionPreference = "Stop"
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class LocalEnvGuardProcessSnapshot {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
  public struct PROCESSENTRY32 {
    public uint dwSize; public uint cntUsage; public uint th32ProcessID; public IntPtr th32DefaultHeapID;
    public uint th32ModuleID; public uint cntThreads; public uint th32ParentProcessID; public int pcPriClassBase;
    public uint dwFlags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile;
  }
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint processId);
  [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] static extern bool Process32First(IntPtr snapshot, ref PROCESSENTRY32 entry);
  [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] static extern bool Process32Next(IntPtr snapshot, ref PROCESSENTRY32 entry);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool CloseHandle(IntPtr handle);
  public static int[] Children(int parentId) {
    var result = new List<int>(); var snapshot = CreateToolhelp32Snapshot(2, 0);
    if (snapshot == new IntPtr(-1)) return result.ToArray();
    try { var entry = new PROCESSENTRY32(); entry.dwSize = (uint)Marshal.SizeOf(typeof(PROCESSENTRY32));
      if (Process32First(snapshot, ref entry)) { do { if (entry.th32ParentProcessID == parentId) result.Add((int)entry.th32ProcessID); } while (Process32Next(snapshot, ref entry)); }
    } finally { CloseHandle(snapshot); } return result.ToArray();
  }
}
'@
function Stop-LocalEnvGuardTree([int] $processId) {
  foreach ($childId in [LocalEnvGuardProcessSnapshot]::Children($processId)) {
    Stop-LocalEnvGuardTree $childId
  }
  $target = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($target) {
    Stop-Process -Id $processId -Force -ErrorAction Stop
  }
}
Stop-LocalEnvGuardTree ${pid}
`;
}

function formatKillError(error) {
  const message = `${error?.message ?? error}`;
  if (isPermissionError(error)) {
    return "当前权限不足，未能终止目标进程。请确认该进程是否属于管理员/root，必要时用 sudo 或管理员终端手动处理。";
  }
  return `终止进程失败：${message}`;
}

function isPermissionError(error) {
  return /access(?: is)? denied|operation not permitted|EPERM|拒绝访问/i.test(`${error?.message ?? error}`);
}
