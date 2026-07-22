import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(testDir, "..");
const cli = path.join(projectRoot, "bin", "leg.js");
const holderFixture = path.join(projectRoot, "fixtures", "hold-port.js");

test("leg --auto npm run dev 会静默换端口并覆写脚本端口", async () => {
  const port = await findConsecutiveAvailablePorts();
  const tempProject = await mkdtemp(path.join(os.tmpdir(), "leg-npm-forward-"));
  const holder = spawn(process.execPath, [holderFixture, String(port)], { stdio: ["ignore", "pipe", "inherit"] });

  try {
    await createViteLikeProject(tempProject, port);
    await waitForOutput(holder, `holding ${port}`);
    const result = await run(process.execPath, [cli, "--auto", "npm", "run", "dev"], tempProject);

    assert.equal(result.code, 0, result.output);
    assert.equal(isRunning(holder.pid), true, "未知端口占用者不应被 leg 终止");
    assert.doesNotMatch(result.output, /已终止 PID/, result.output);
    const match = result.output.match(/vite-like script listening (\d+)/);
    assert.ok(match, result.output);
    assert.notEqual(Number.parseInt(match[1], 10), port, result.output);
  } finally {
    if (!holder.killed) {
      holder.kill("SIGKILL");
    }
    await rm(tempProject, { recursive: true, force: true });
  }
});

async function createViteLikeProject(directory, fixedPort) {
  await writeFile(path.join(directory, "package.json"), JSON.stringify({
    private: true,
    scripts: { dev: "node vite-like-server.mjs" }
  }, null, 2));
  await writeFile(path.join(directory, "vite-like-server.mjs"), `
import net from "node:net";
const args = process.argv.slice(2);
const index = args.lastIndexOf("--port");
const port = index === -1 ? ${fixedPort} : Number(args[index + 1]);
const server = net.createServer();
server.once("error", (error) => { console.error(error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => { console.log("vite-like script listening " + port); server.close(); });
`);
}

function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
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

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk.toString(); });
    child.stderr.on("data", (chunk) => { output += chunk.toString(); });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, output }));
  });
}
