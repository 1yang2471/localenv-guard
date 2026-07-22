import { normalizeLocale } from "./i18n.js";

export function parseLegArgs(args = [], environment = process.env) {
  const commandArgs = [...args];
  let locale = normalizeLocale(environment.LEG_LANG);
  let auto = false;

  while (commandArgs.length > 0) {
    if (commandArgs[0] === "--auto") {
      auto = true;
      commandArgs.shift();
      continue;
    }
    if (commandArgs[0] === "--lang" && commandArgs.length > 1) {
      locale = normalizeLocale(commandArgs[1]);
      commandArgs.splice(0, 2);
      continue;
    }
    if (commandArgs[0].startsWith("--lang=")) {
      locale = normalizeLocale(commandArgs[0].slice("--lang=".length));
      commandArgs.shift();
      continue;
    }
    break;
  }

  return {
    commandArgs,
    options: { auto, locale }
  };
}
