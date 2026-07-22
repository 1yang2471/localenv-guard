#!/usr/bin/env node
import { runDoctor } from "../src/doctor.js";
import { parseLegArgs } from "../src/cli-args.js";
import { runGuardedCommand } from "../src/runner.js";
import { translate } from "../src/i18n.js";

const args = process.argv.slice(2);
const parsed = parseLegArgs(args);

if (parsed.commandArgs[0] === "--help" || parsed.commandArgs[0] === "-h") {
  console.log(translate(parsed.options.locale, "usage"));
} else {
  let exitCode = 0;
  if (parsed.commandArgs[0] === "doctor") {
    exitCode = await runDoctor({ locale: parsed.options.locale });
  } else {
    exitCode = await runGuardedCommand(parsed.commandArgs, parsed.options);
  }

  process.exitCode = exitCode;
}
