import net from "node:net";

const port = Number.parseInt(process.env.PORT || process.argv[2], 10);

if (!Number.isInteger(port)) {
  console.error("fixture requires a port");
  process.exit(2);
}

const server = net.createServer();
server.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.once("listening", () => {
  console.log(`fixture listening on ${port}`);
  server.close();
});
server.listen(port, "127.0.0.1");
