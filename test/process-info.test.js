import assert from "node:assert/strict";
import test from "node:test";

import { parseWindowsNetstat } from "../src/process-info.js";

test("从 Windows netstat 输出中解析监听端口 PID", () => {
  const output = "  TCP    127.0.0.1:40560        0.0.0.0:0              LISTENING       19708";

  assert.deepEqual(parseWindowsNetstat(output, 40560), [19708]);
});
