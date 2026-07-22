import net from "node:net";

const port = Number.parseInt(process.argv[2], 10);
if (!Number.isInteger(port)) {
  console.error("vite fixture requires a port");
  process.exit(2);
}

const server = net.createServer();
server.listen(port, "127.0.0.1", () => {
  console.log(`vite fixture holding ${port}`);
});

setInterval(() => {}, 1000);
