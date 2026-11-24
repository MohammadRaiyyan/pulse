import { sql } from "drizzle-orm";
import { type Request, type Response, Router } from "express";
import { db } from "../../db/client.ts";
import { redis } from "../../lib/redis.ts";
import { readHeartbeat, workerStatusOf } from "./worker-heartbeat.ts";

const CHECK_TIMEOUT_MS = 2_000;

const withTimeout = <T>(promise: Promise<T>) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Health check timed out")),
      CHECK_TIMEOUT_MS,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });

const check = async (run: () => Promise<unknown>) => {
  try {
    await withTimeout(run());
    return "ok";
  } catch {
    return "down";
  }
};

const checkDependencies = async () => {
  const [database, cache] = await Promise.all([
    check(() => db.execute(sql`select 1`)),
    check(() => redis.ping()),
  ]);

  return { database, redis: cache };
};

const readWorker = async () => {
  try {
    const heartbeat = await withTimeout(readHeartbeat());

    return {
      worker: workerStatusOf(heartbeat),
      workerLastSeenAt: heartbeat
        ? new Date(heartbeat.timestamp).toISOString()
        : null,
    };
  } catch {
    return { worker: "unknown", workerLastSeenAt: null };
  }
};

const health = async (_req: Request, res: Response) => {
  const [dependencies, worker] = await Promise.all([
    checkDependencies(),
    readWorker(),
  ]);
  const isHealthy =
    dependencies.database === "ok" &&
    dependencies.redis === "ok" &&
    worker.worker === "up";

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "ok" : "degraded",
    ...dependencies,
    ...worker,
  });
};

const live = (_req: Request, res: Response) => {
  res.json({ status: "ok" });
};

const ready = async (_req: Request, res: Response) => {
  const dependencies = await checkDependencies();
  const isReady = dependencies.database === "ok" && dependencies.redis === "ok";

  res
    .status(isReady ? 200 : 503)
    .json({ status: isReady ? "ok" : "unavailable", ...dependencies });
};

export const healthRouter = Router();

healthRouter.get("/health", health);
healthRouter.get("/health/live", live);
healthRouter.get("/health/ready", ready);
