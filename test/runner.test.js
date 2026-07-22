import assert from "node:assert/strict";
import test from "node:test";

import { buildConflictChoices, runGuardedCommand } from "../src/runner.js";
import { getSafeCurrentOwner } from "../src/protected-services.js";

test("未知进程的冲突菜单不提供终止选项", () => {
  const safeChoices = buildConflictChoices(true).map((choice) => choice.key);
  const unknownChoices = buildConflictChoices(false).map((choice) => choice.key);

  assert.deepEqual(safeChoices, ["p", "k", "d", "q"]);
  assert.deepEqual(unknownChoices, ["p", "d", "q"]);
});

test("英文冲突菜单不向未知进程提供终止选项", () => {
  const safeChoices = buildConflictChoices(true, "en").map((choice) => choice.label);
  const unknownChoices = buildConflictChoices(false, "en").map((choice) => choice.label);

  assert.deepEqual(safeChoices, ["Retry on an available port", "Terminate the process tree and retry", "View details and abort", "Abort"]);
  assert.deepEqual(unknownChoices, ["Retry on an available port", "View details and abort", "Abort"]);
});

test("终止前仅接受仍占用端口的明确开发进程", () => {
  const originalOwner = { pid: 88, name: "node", command: "vite --port 5173" };

  assert.equal(getSafeCurrentOwner(originalOwner, []), null);
  assert.equal(getSafeCurrentOwner(originalOwner, [
    { pid: 88, name: "postgres", command: "postgres -D data" }
  ]), null);
  assert.equal(getSafeCurrentOwner(originalOwner, [
    { pid: 88, name: "node", command: "next dev --port 5173" }
  ]), null);
  assert.equal(getSafeCurrentOwner({ ...originalOwner, startedAt: "2026-07-22T10:00:00" }, [
    { ...originalOwner, startedAt: "2026-07-22T10:01:00" }
  ]), null);
  assert.deepEqual(getSafeCurrentOwner(originalOwner, [
    { pid: 88, name: "node", command: "vite --port 5173" }
  ]), {
    pid: 88,
    name: "node",
    command: "vite --port 5173"
  });
});

test("端口恢复失败时返回退出码而不是抛出异常", async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (message = "") => logs.push(String(message));

  try {
    const code = await runGuardedCommand([
      process.execPath,
      "-e",
      "console.error('That port is already in use.'); process.exit(1)",
      "--",
      "--port",
      "65535"
    ], { autoPort: true });

    assert.equal(code, 1);
    assert.match(logs.join("\n"), /自动恢复失败/);
  } finally {
    console.log = originalLog;
  }
});
