import assert from "node:assert/strict";
import test from "node:test";

import { parseLegArgs } from "../src/cli-args.js";
import { selectConflictAction } from "../src/runner.js";

test("--auto 只作为 leg 前置参数解析", () => {
  assert.deepEqual(parseLegArgs(["--auto", "npm", "run", "dev"]), {
    commandArgs: ["npm", "run", "dev"],
    options: { auto: true, locale: "zh" }
  });
  assert.deepEqual(parseLegArgs(["npm", "run", "dev", "--auto"]), {
    commandArgs: ["npm", "run", "dev", "--auto"],
    options: { auto: false, locale: "zh" }
  });
});

test("--lang 只作为 leg 前置参数解析", () => {
  assert.deepEqual(parseLegArgs(["--lang", "en", "--auto", "npm", "run", "dev"]), {
    commandArgs: ["npm", "run", "dev"],
    options: { auto: true, locale: "en" }
  });
  assert.deepEqual(parseLegArgs(["--lang=en", "node", "server.js"]), {
    commandArgs: ["node", "server.js"],
    options: { auto: false, locale: "en" }
  });
});

test("LEG_LANG 提供默认语言，命令行 --lang 优先", () => {
  assert.deepEqual(parseLegArgs(["npm", "run", "dev"], { LEG_LANG: "en" }), {
    commandArgs: ["npm", "run", "dev"],
    options: { auto: false, locale: "en" }
  });
  assert.deepEqual(parseLegArgs(["--lang", "zh", "npm", "run", "dev"], { LEG_LANG: "en" }), {
    commandArgs: ["npm", "run", "dev"],
    options: { auto: false, locale: "zh" }
  });
  assert.deepEqual(parseLegArgs(["npm", "run", "dev"], { LEG_LANG: "fr" }), {
    commandArgs: ["npm", "run", "dev"],
    options: { auto: false, locale: "zh" }
  });
});

test("--auto 始终换端口，不会静默终止任何进程", () => {
  assert.equal(selectConflictAction({ auto: true }, true), "p");
  assert.equal(selectConflictAction({ auto: true }, false), "p");
  assert.equal(selectConflictAction({}, true), null);
});
