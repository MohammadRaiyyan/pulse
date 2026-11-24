import { pino } from "pino";
import { env, isProduction } from "../config/env.ts";

const usePrettyLogs = !isProduction && process.stdout.isTTY;

const REDACTED = "[redacted]";

const secretPathPatterns = [
  /^(\/api\/invitations\/preview\/)[^/?#]+/,
  /^(\/hooks\/)[^/?#]+/,
];

const secretQueryParameters = ["token", "code", "state"];

export const redactUrl = (url: string) => {
  const queryStart = url.indexOf("?");
  const path = queryStart === -1 ? url : url.slice(0, queryStart);
  const maskedPath = secretPathPatterns.reduce(
    (current, pattern) => current.replace(pattern, `$1${REDACTED}`),
    path,
  );

  if (queryStart === -1) {
    return maskedPath;
  }

  const parameters = new URLSearchParams(url.slice(queryStart + 1));

  for (const name of secretQueryParameters) {
    if (parameters.has(name)) {
      parameters.set(name, REDACTED);
    }
  }

  return `${maskedPath}?${parameters.toString()}`;
};

type SerializedRequest = {
  id?: unknown;
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  remoteAddress?: string;
  remotePort?: number;
};

export const serializeRequest = (req: SerializedRequest) => ({
  id: req.id,
  method: req.method,
  url: req.url === undefined ? undefined : redactUrl(req.url),
  headers: req.headers,
  remoteAddress: req.remoteAddress,
  remotePort: req.remotePort,
});

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
