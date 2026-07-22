import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const directory = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.join(directory, "..", "bin", "leg.js");

test("leg --help 显示用法且不尝试启动子命令", () => {
  const result = spawnSync(process.execPath, [cliPath, "--help"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /用法：leg/);
  assert.doesNotMatch(result.stderr, /启动命令失败/);
});

test("leg --lang en --help 输出英文用法且不尝试启动子命令", () => {
  const result = spawnSync(process.execPath, [cliPath, "--lang", "en", "--help"], {
    encoding: "utf8"
  });

  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: leg/);
  assert.doesNotMatch(result.stderr, /Failed to start command/);
});

test("LEG_LANG=en 输出英文用法，命令行 --lang zh 覆盖环境变量", () => {
  const englishResult = spawnSync(process.execPath, [cliPath, "--help"], {
    encoding: "utf8",
    env: { ...process.env, LEG_LANG: "en" }
  });
  const chineseResult = spawnSync(process.execPath, [cliPath, "--lang", "zh", "--help"], {
    encoding: "utf8",
    env: { ...process.env, LEG_LANG: "en" }
  });

  assert.equal(englishResult.status, 0);
  assert.match(englishResult.stdout, /Usage: leg/);
  assert.equal(chineseResult.status, 0);
  assert.match(chineseResult.stdout, /用法：leg/);
});
