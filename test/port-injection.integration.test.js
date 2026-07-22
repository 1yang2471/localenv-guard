import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(testDir, "..");
const cli = path.join(projectRoot, "bin", "leg.js");
const holderFixture = path.join(projectRoot, "fixtures", "hold-port.js");
const strictFixture = path.join(projectRoot, "fixtures", "strict-port-server.js");

test("真实 CLI 覆写 --port，而非仅注入 PORT", async () => {
  await verifyRecovery((port) => [process.execPath, strictFixture, "--port", String(port)]);
});

test("真实 CLI 覆写 Django runserver host:port 参数", async () => {
  await verifyRecovery((port) => [process.execPath, strictFixture, "runserver", `127.0.0.1:${port}`]);
});

async function verifyRecovery(buildTargetArgs) {
  const port = await findConsecutiveAvailablePorts();
  const holder = spawn(process.execPath, [holderFixture, String(port)], { stdio: ["ignore", "pipe", "inherit"] });

  try {
    await waitForOutput(holder, `holding ${port}`);
    const result = await run(process.execPath, [cli, ...buildTargetArgs(port)]);

    assert.equal(result.code, 0, result.output);
    const match = result.output.match(/strict fixture listening on (\d+)/);
    assert.ok(match, result.output);
    assert.notEqual(Number.parseInt(match[1], 10), port, result.output);
  } finally {
    if (!holder.killed) {
      holder.kill("SIGKILL");
    }
  }
}

async function findConsecutiveAvailablePorts() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port = await reservePort();
    if (await isAvailable(port + 1)) {
      return port;
    }
  }
  throw new Error("未找到两个连续可用端口。");
}

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

function isAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

function waitForOutput(child, expected) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`夹具未输出：${expected}`)), 3000);
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
      if (output.includes(expected)) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("error", reject);
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}
