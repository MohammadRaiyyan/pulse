import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { BACKEND_LOG_FILE } from "../support/environment.ts";

const apiDirectory = new URL("../../apps/api", import.meta.url).pathname;

mkdirSync(dirname(BACKEND_LOG_FILE), { recursive: true });
const log = createWriteStream(BACKEND_LOG_FILE, { flags: "w" });

const runOnce = (script: string) => {
  const result = spawnSync("node", [script], { cwd: apiDirectory, env: process.env, encoding: "utf8" });
  log.write(result.stdout);
  log.write(result.stderr);

  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
};

runOnce("src/db/migrate.ts");
runOnce("src/db/seed.ts");

const startProcess = (script: string) => {
  const child = spawn("node", [script], { cwd: apiDirectory, env: process.env });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.stderr.pipe(process.stderr);
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      process.exit(code);
    }
  });
  return child;
};

const children = [startProcess("src/server.ts"), startProcess("src/worker.ts")];

const stop = () => {
  for (const child of children) {
    child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(0), 5_000).unref();
};

process.on("SIGTERM", stop);
process.on("SIGINT", stop);
