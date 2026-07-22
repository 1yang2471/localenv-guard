import net from "node:net";

const args = process.argv.slice(2);
const port = readExplicitPort(args) ?? Number.parseInt(process.env.PORT, 10);

if (!Number.isInteger(port)) {
  console.error("strict fixture requires an explicit port or PORT");
  process.exit(2);
}

const server = net.createServer();
server.once("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  console.log(`strict fixture listening on ${port}`);
  server.close();
});

function readExplicitPort(values) {
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if ((value === "--port" || value === "-p") && values[index + 1]) {
      return Number.parseInt(values[index + 1], 10);
    }
    const equals = value.match(/^--port=(\d+)$/);
    if (equals) {
      return Number.parseInt(equals[1], 10);
    }
    if (values[index - 1] === "runserver") {
      const match = value.match(/:(\d+)$/);
      if (match) {
        return Number.parseInt(match[1], 10);
      }
    }
  }
  return null;
}
