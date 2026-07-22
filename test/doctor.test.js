import assert from "node:assert/strict";
import test from "node:test";

import { buildDoctorRows } from "../src/doctor.js";

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
