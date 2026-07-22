import assert from "node:assert/strict";
import test from "node:test";

import { resolveCommandForSpawn, resolveCommandInvocation } from "../src/command-resolver.js";

test("非 Windows 平台保持原命令", () => {
  const result = resolveCommandForSpawn("node", { platform: "linux", env: {} });

  assert.equal(result, "node");
});

test("Windows 平台优先解析 PATH 中的可执行命令", () => {
  const result = resolveCommandForSpawn("node", {
    platform: "win32",
    env: process.env
  });

  assert.match(result.toLowerCase(), /node(\.exe)?$/);
});

test("非 Windows 平台的 npm 保持原命令", { skip: process.platform === "win32" }, () => {
  const result = resolveCommandInvocation("npm", ["run", "dev"]);

  assert.deepEqual(result, { command: "npm", args: ["run", "dev"] });
});

test("Windows 的 npm.cmd 使用 npm-cli.js 安全启动", { skip: process.platform !== "win32" }, () => {
  const result = resolveCommandInvocation("npm", ["run", "dev"], {
    platform: "win32",
    env: process.env,
    runtimeNode: process.execPath
  });

  assert.equal(result.command, process.execPath);
  assert.match(result.args[0].replace(/\\/g, "/"), /node_modules\/npm\/bin\/npm-cli\.js$/);
  assert.deepEqual(result.args.slice(1), ["run", "dev"]);
});
