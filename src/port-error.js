const PORT_PATTERNS = [
  /EADDRINUSE[^\n\r]*?(?:\[?::ffff:)?(?:\d{1,3}\.){3}\d{1,3}\]?:([1-9]\d{1,4})/i,
  /EADDRINUSE[^\n\r]*?(?:\s|:)([1-9]\d{1,4})(?:\s|$)/i,
  /address already in use[^\n\r]*?(?:\[?::ffff:)?(?:\d{1,3}\.){3}\d{1,3}\]?:([1-9]\d{1,4})/i,
  /address already in use[^\n\r]*?::+:([1-9]\d{1,4})/i,
  /port\s+([1-9]\d{1,4})\s+(?:is\s+)?already in use/i
];

export function parsePortFromOutput(output = "") {
  for (const pattern of PORT_PATTERNS) {
    const match = output.match(pattern);
    if (match) {
      return normalizePort(match[1]);
    }
  }
  return null;
}

export function inferRequestedPort(args = [], env = {}, output = "") {
  return (
    parsePortFromOutput(output) ??
    parsePortFromArgs(args) ??
    normalizePort(env.PORT) ??
    null
  );
}

function parsePortFromArgs(args) {
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--port" || arg === "-p") {
      return normalizePort(args[index + 1]);
    }

    const equalsMatch = arg.match(/^--(?:port|listen-port)=(\d+)$/);
    if (equalsMatch) {
      return normalizePort(equalsMatch[1]);
    }

    const hostPortMatch = arg.match(/^(?:(?:\d{1,3}\.){3}\d{1,3}|localhost|0\.0\.0\.0|\[?::1\]?|):(\d+)$/i);
    if (hostPortMatch) {
      return normalizePort(hostPortMatch[1]);
    }
  }
  return null;
}

function normalizePort(value) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return null;
  }
  return port;
}
