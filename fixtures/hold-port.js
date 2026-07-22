import net from "node:net";

const port = Number.parseInt(process.argv[2], 10);
const server = net.createServer();

server.listen(port, "127.0.0.1", () => {
  console.log(`holding ${port}`);
});

setInterval(() => {}, 1000);
