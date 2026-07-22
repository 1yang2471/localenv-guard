import fs from "node:fs";
import path from "node:path";

export function resolveCommandForSpawn(command, { platform = process.platform, env = process.env } = {}) {
  if (platform !== "win32" || /[\\/]/.test(command) || path.extname(command)) {
    return command;
  }

  const pathEntries = (env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const extensions = (env.PATHEXT ?? ".EXE;.CMD;.BAT;.COM")
    .split(";")
    .filter(Boolean);

  for (const dir of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(dir, `${command}${extension.toLowerCase()}`);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
      const upperCandidate = path.join(dir, `${command}${extension.toUpperCase()}`);
      if (fs.existsSync(upperCandidate)) {
        return upperCandidate;
      }
    }
  }

  return command;
}

export function resolveCommandInvocation(command, args = [], options = {}) {
  const platform = options.platform ?? process.platform;
  const resolvedCommand = resolveCommandForSpawn(command, {
    platform,
    env: options.env ?? process.env
  });

  if (platform === "win32" && path.basename(resolvedCommand).toLowerCase() === "npm.cmd") {
    const npmCli = path.join(path.dirname(resolvedCommand), "node_modules", "npm", "bin", "npm-cli.js");
    if (fs.existsSync(npmCli)) {
      return {
        command: options.runtimeNode ?? process.execPath,
        args: [npmCli, ...args]
      };
    }
  }

  return { command: resolvedCommand, args: [...args] };
}
