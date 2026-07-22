import net from "node:net";

export async function findAvailablePort(startPort, host = "127.0.0.1") {
  for (let port = startPort + 1; port <= 65535; port += 1) {
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  throw new Error("未找到可用端口。");
}

function isPortAvailable(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}
