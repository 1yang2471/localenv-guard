export function injectPort(args = [], env = {}, port) {
  const nextArgs = [...args];
  let changedArgs = false;

  for (let index = 0; index < nextArgs.length; index += 1) {
    const arg = nextArgs[index];
    if ((arg === "--port" || arg === "-p") && nextArgs[index + 1]) {
      nextArgs[index + 1] = String(port);
      changedArgs = true;
      break;
    }

    if (/^--(?:port|listen-port)=\d+$/.test(arg)) {
      nextArgs[index] = arg.replace(/=\d+$/, `=${port}`);
      changedArgs = true;
      break;
    }
  }

  if (!changedArgs) {
    changedArgs = rewriteDjangoRunserverPort(nextArgs, port) || appendNpmRunPort(nextArgs, port);
  }

  return {
    args: nextArgs,
    env: { ...env, PORT: String(port) }
  };
}

function appendNpmRunPort(args, port) {
  if (args[0] !== "npm" || args[1] !== "run" || !args[2]) {
    return false;
  }

  if (!args.includes("--", 3)) {
    args.push("--");
  }
  args.push("--port", String(port));
  return true;
}

function rewriteDjangoRunserverPort(args, port) {
  const runserverIndex = args.indexOf("runserver");
  if (runserverIndex === -1) {
    return false;
  }

  for (let index = runserverIndex + 1; index < args.length; index += 1) {
    const value = args[index];
    const match = value.match(/^((?:(?:\d{1,3}\.){3}\d{1,3}|localhost|0\.0\.0\.0|\[?::1\]?|):)(\d+)$/i);
    if (match) {
      args[index] = `${match[1]}${port}`;
      return true;
    }

    if (/^\d+$/.test(value)) {
      args[index] = String(port);
      return true;
    }
  }
  return false;
}
