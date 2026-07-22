import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { killProcessTree } from "../src/killer.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.join(testDir, "..", "fixtures", "tree-holder.js");

test("终止进程树会清理忽略 SIGTERM 的子进程并释放端口", async () => {
  const port = await reservePort();
  const holder = spawn(process.execPath, [fixture, String(port)], { stdio: ["ignore", "pipe", "inherit"] });
  let childPid;

  try {
    childPid = await readChildPid(holder);
    await killProcessTree(holder.pid);

    await waitFor(() => isPortAvailable(port));
    assert.equal(isRunning(childPid), false);
  } finally {
    await stopIfRunning(holder.pid);
    await stopIfRunning(childPid);
  }
});

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

function readChildPid(holder) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("测试夹具未报告子进程 PID。")), 3000);
    holder.stdout.on("data", (chunk) => {
      output += chunk.toString();
      const match = output.match(/child:(\d+)/);
      if (match) {
        clearTimeout(timer);
        resolve(Number.parseInt(match[1], 10));
      }
    });
    holder.once("error", reject);
    holder.once("exit", (code) => {
      if (!output.includes("child:")) {
        clearTimeout(timer);
        reject(new Error(`测试夹具提前退出，退出码：${code}`));
      }
    });
  });
}

async function waitFor(check, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("等待资源释放超时。");
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => {
      server.close(() => resolve(true));
    });
  });
}

function isRunning(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

async function stopIfRunning(pid) {
  if (!isRunning(pid)) {
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // 测试夹具已退出时无需处理。
  }
}
