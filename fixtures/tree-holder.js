import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const port = Number.parseInt(process.argv[2], 10);
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const child = spawn(process.execPath, [path.join(currentDir, "stubborn-listener.js"), String(port)], {
  stdio: ["ignore", "pipe", "inherit"]
});

child.stdout.once("data", () => {
  console.log(`child:${child.pid}`);
});

setInterval(() => {}, 1000);
