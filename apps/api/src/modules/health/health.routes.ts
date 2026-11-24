import { sql } from "drizzle-orm";
import { type Request, type Response, Router } from "express";
import { db } from "../../db/client.ts";
import { redis } from "../../lib/redis.ts";

const check = async (run: () => Promise<unknown>) => {
  try {
    await run();
    return "ok";
  } catch {
    return "down";
  }
};

const health = async (_req: Request, res: Response) => {
  const [database, cache] = await Promise.all([
    check(() => db.execute(sql`select 1`)),
    check(() => redis.ping()),
  ]);
  const isHealthy = database === "ok" && cache === "ok";

  res
    .status(isHealthy ? 200 : 503)
    .json({ status: isHealthy ? "ok" : "degraded", database, redis: cache });
};

export const healthRouter = Router();

healthRouter.get("/health", health);
