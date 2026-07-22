import assert from "node:assert/strict";
import test from "node:test";

import { buildDoctorRows } from "../src/doctor.js";
import { getSafeCurrentOwner } from "../src/protected-services.js";

test("doctor 标记保护服务且不建议自动清理", () => {
  const rows = buildDoctorRows([
    {
      port: 5432,
      process: { pid: 22, name: "postgres", command: "postgres -D data" }
    },
    {
      port: 5173,
      process: { pid: 88, name: "node", command: "vite --port 5173", cwd: "/tmp/app" }
    }
  ]);

  assert.equal(rows[0].action, "手动处理");
  assert.equal(rows[1].action, "可交互清理");
});

test("doctor 不为未知服务提供终止选项", () => {
  const [row] = buildDoctorRows([
    {
      port: 8080,
      process: { pid: 99, name: "internal-service.exe", command: "internal-service --listen 8080" }
    }
  ]);

  assert.equal(row.action, "手动处理");
});

test("doctor 可输出英文操作建议", () => {
  const [row] = buildDoctorRows([
    {
      port: 5173,
      process: { pid: 88, name: "node", command: "vite --port 5173" }
    }
  ], "en");

  assert.equal(row.action, "Interactive cleanup available");
});

test("doctor 终止前重新核验监听者，拒绝 PID 复用或服务变化", () => {
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
  ]), originalOwner);
});
