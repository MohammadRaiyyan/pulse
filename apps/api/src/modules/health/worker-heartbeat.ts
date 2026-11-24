import { hostname } from "node:os";
import { env } from "../../config/env.ts";
import { logger } from "../../lib/logger.ts";
import { redis } from "../../lib/redis.ts";

const HEARTBEAT_KEY = "worker:heartbeat";
const HEARTBEAT_INTERVAL_MS = 5_000;
const HEARTBEAT_TTL_SECONDS = 120;
export const HEARTBEAT_STALE_AFTER_MS = 30_000;

export type WorkerHeartbeat = {
  timestamp: number;
  pid: number;
  hostname: string;
  version: string;
};

export type WorkerStatus = "up" | "stale" | "missing";

export const writeHeartbeat = async (timestamp = Date.now()) => {
  const heartbeat: WorkerHeartbeat = {
    timestamp,
    pid: process.pid,
    hostname: hostname(),
    version: env.APP_VERSION,
  };

  await redis.set(
    HEARTBEAT_KEY,
    JSON.stringify(heartbeat),
    "EX",
    HEARTBEAT_TTL_SECONDS,
  );
};

export const readHeartbeat = async (): Promise<WorkerHeartbeat | null> => {
  const value = await redis.get(HEARTBEAT_KEY);

  if (!value) {
    return null;
  }

  const parsed: unknown = JSON.parse(value);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("timestamp" in parsed) ||
    typeof parsed.timestamp !== "number"
  ) {
    return null;
  }

  return parsed as WorkerHeartbeat;
};

export const workerStatusOf = (
  heartbeat: WorkerHeartbeat | null,
  now = Date.now(),
): WorkerStatus => {
  if (!heartbeat) {
    return "missing";
  }

  return now - heartbeat.timestamp > HEARTBEAT_STALE_AFTER_MS ? "stale" : "up";
};

const beat = () =>
  writeHeartbeat().catch((error: unknown) => {
    logger.warn({ err: error }, "Could not write worker heartbeat");
  });

export const startHeartbeat = () => {
  void beat();
  const timer = setInterval(beat, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(timer);
};
