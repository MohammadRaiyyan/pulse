import { readFileSync } from "node:fs";
import { BACKEND_LOG_FILE } from "./environment.ts";

type LogEntry = Record<string, unknown>;

const readLogEntries = () =>
  readFileSync(BACKEND_LOG_FILE, "utf8")
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line) as LogEntry);

export const latestLoggedUrl = (field: "resetUrl" | "inviteUrl", email: string) => {
  const entries = readLogEntries().filter((entry) => entry.email === email && typeof entry[field] === "string");
  return entries.at(-1)?.[field] as string | undefined;
};
