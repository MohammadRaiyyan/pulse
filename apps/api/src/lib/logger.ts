import { pino } from "pino";
import { env, isProduction } from "../config/env.ts";

const usePrettyLogs = !isProduction && process.stdout.isTTY;

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    'res.headers["set-cookie"]',
  ],
  transport: usePrettyLogs
    ? { target: "pino-pretty", options: { colorize: true } }
    : undefined,
});
