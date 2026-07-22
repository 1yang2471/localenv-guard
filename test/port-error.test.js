import assert from "node:assert/strict";
import test from "node:test";

import { inferRequestedPort, parsePortFromOutput } from "../src/port-error.js";

test("从 Node EADDRINUSE 输出中解析端口", () => {
  const output = "Error: listen EADDRINUSE: address already in use 127.0.0.1:5173";

  assert.equal(parsePortFromOutput(output), 5173);
});

test("从通用 address already in use 输出中解析 IPv6 端口", () => {
  const output = "listen EADDRINUSE: address already in use :::3000";

  assert.equal(parsePortFromOutput(output), 3000);
});

test("当错误文本无端口时，从启动命令参数推断端口", () => {
  const args = ["python", "manage.py", "runserver", "127.0.0.1:8000"];

  assert.equal(inferRequestedPort(args, {}, "Error: That port is already in use."), 8000);
});

test("优先使用显式 --port 参数推断端口", () => {
  const args = ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "4173"];

  assert.equal(inferRequestedPort(args, { PORT: "3000" }, ""), 4173);
});
