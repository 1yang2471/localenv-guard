import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function getPortOwners(port) {
  try {
    return process.platform === "win32"
      ? await getPortOwnersWindows(port)
      : await getPortOwnersUnix(port);
  } catch {
    return [];
  }
}

async function getPortOwnersWindows(port) {
  const owners = await getPortOwnersWindowsPowerShell(port);
  if (owners.length > 0) {
    return owners;
  }

  const { stdout } = await execFileAsync("netstat.exe", ["-ano", "-p", "tcp"]);
  const pids = parseWindowsNetstat(stdout, port);
  return Promise.all(pids.map((pid) => enrichWindowsProcess(pid)));
}

async function getPortOwnersWindowsPowerShell(port) {
  const script = `
$pids = Get-NetTCPConnection -LocalPort ${Number(port)} -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
$items = @()
foreach ($pidValue in $pids) {
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $pidValue" -ErrorAction SilentlyContinue
  if ($proc) {
    $items += [pscustomobject]@{
      pid = [int]$proc.ProcessId
      name = [string]$proc.Name
      command = [string]$proc.CommandLine
      cwd = ""
      startedAt = [string]$proc.CreationDate
      user = ""
    }
  }
}
$items | ConvertTo-Json -Depth 3
`;
  const { stdout } = await execFileAsync("powershell.exe", [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script
  ], { windowsHide: true });
  if (!stdout.trim()) {
    return [];
  }
  const parsed = JSON.parse(stdout);
  return Array.isArray(parsed) ? parsed : [parsed];
}

export function parseWindowsNetstat(output, port) {
  const pids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5 || columns[0] !== "TCP" || columns[3].toUpperCase() !== "LISTENING") {
      continue;
    }
    const localAddress = columns[1];
    const pid = Number.parseInt(columns[4], 10);
    if (localAddress.endsWith(`:${port}`) && Number.isInteger(pid)) {
      pids.add(pid);
    }
  }
  return [...pids];
}

async function enrichWindowsProcess(pid) {
  const script = `
$proc = Get-CimInstance Win32_Process -Filter "ProcessId = ${Number(pid)}" -ErrorAction SilentlyContinue
if ($proc) {
  [pscustomobject]@{
    pid = [int]$proc.ProcessId
    name = [string]$proc.Name
    command = [string]$proc.CommandLine
    cwd = ""
    startedAt = [string]$proc.CreationDate
    user = ""
  } | ConvertTo-Json -Depth 3
}
`;
  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      script
    ], { windowsHide: true });
    if (stdout.trim()) {
      return JSON.parse(stdout);
    }
  } catch {
    // 继续尝试较低权限的 Get-Process。
  }

  try {
    const fallbackScript = `
$proc = Get-Process -Id ${Number(pid)} -ErrorAction SilentlyContinue
if ($proc) {
  [pscustomobject]@{
    pid = [int]$proc.Id
    name = [string]$proc.ProcessName
    command = [string]$proc.Path
    cwd = ""
    startedAt = [string]$proc.StartTime
    user = ""
  } | ConvertTo-Json -Depth 3
}
`;
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      fallbackScript
    ], { windowsHide: true });
    if (stdout.trim()) {
      return JSON.parse(stdout);
    }
  } catch {
    // 兜底返回 PID，避免因为画像失败影响端口恢复。
  }
  return { pid, name: "unknown", command: "", cwd: "" };
}

async function getPortOwnersUnix(port) {
  const { stdout } = await execFileAsync("lsof", [
    "-nP",
    `-iTCP:${port}`,
    "-sTCP:LISTEN"
  ]);
  const lines = stdout.trim().split(/\r?\n/).slice(1);
  const owners = [];
  for (const line of lines) {
    const columns = line.trim().split(/\s+/);
    const pid = Number.parseInt(columns[1], 10);
    if (Number.isInteger(pid)) {
      owners.push(await enrichUnixProcess(pid, columns[0]));
    }
  }
  return dedupeByPid(owners);
}

async function enrichUnixProcess(pid, fallbackName) {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "pid=,user=,etime=,comm=,args="]);
    const line = stdout.trim();
    const match = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/);
    if (match) {
      return {
        pid,
        user: match[2],
        runtime: match[3],
        name: match[4],
        command: match[5],
        cwd: ""
      };
    }
  } catch {
    // 进程可能已经退出，返回已知的最小信息。
  }
  return { pid, name: fallbackName, command: fallbackName, cwd: "" };
}

function dedupeByPid(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (seen.has(item.pid)) {
      return false;
    }
    seen.add(item.pid);
    return true;
  });
}
