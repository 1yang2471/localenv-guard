import assert from "node:assert/strict";
import test from "node:test";

import { injectPort } from "../src/port-injection.js";

test("更新 --port 独立参数并同步 PORT 环境变量", () => {
  const result = injectPort(["vite", "--host", "0.0.0.0", "--port", "5173"], {}, 5174);

  assert.deepEqual(result.args, ["vite", "--host", "0.0.0.0", "--port", "5174"]);
  assert.equal(result.env.PORT, "5174");
});

test("更新 --port= 写法", () => {
  const result = injectPort(["next", "dev", "--port=3000"], {}, 3001);

  assert.deepEqual(result.args, ["next", "dev", "--port=3001"]);
});

test("更新 Django runserver 的 host:port 参数", () => {
  const result = injectPort(["python", "manage.py", "runserver", "127.0.0.1:8000"], {}, 8001);

  assert.deepEqual(result.args, ["python", "manage.py", "runserver", "127.0.0.1:8001"]);
});

test("npm run 脚本追加 --port 覆写并同步 PORT 环境变量", () => {
  const result = injectPort(["npm", "run", "dev"], {}, 4321);

  assert.deepEqual(result.args, ["npm", "run", "dev", "--", "--port", "4321"]);
  assert.equal(result.env.PORT, "4321");
});
