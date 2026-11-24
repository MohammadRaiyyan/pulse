import { pino } from "pino";
import { env, isProduction } from "../config/env.ts";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    'res.headers["set-cookie"]',
  ],
  transport: isProduction
    ? undefined
    : { target: "pino-pretty", options: { colorize: true } },
});
