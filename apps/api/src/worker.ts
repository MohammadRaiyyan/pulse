import { Worker } from "bullmq";
import { env } from "./config/env.ts";
import { sql } from "./db/client.ts";
import { processAlertJob } from "./jobs/processors/alerts.processor.ts";
import { processCheckJob } from "./jobs/processors/checks.processor.ts";
import { processMaintenanceJob } from "./jobs/processors/maintenance.processor.ts";
import { QUEUE_NAMES, closeQueues } from "./jobs/queues.ts";
import { registerSchedulers } from "./jobs/schedulers.ts";
import { logger } from "./lib/logger.ts";
import { createRedisConnection, redis } from "./lib/redis.ts";

await registerSchedulers();

const workers = [
  new Worker(QUEUE_NAMES.checks, processCheckJob, {
    connection: createRedisConnection(),
    concurrency: env.CHECK_WORKER_CONCURRENCY,
  }),
  new Worker(QUEUE_NAMES.alerts, processAlertJob, {
    connection: createRedisConnection(),
    concurrency: 10,
  }),
  new Worker(QUEUE_NAMES.maintenance, processMaintenanceJob, {
    connection: createRedisConnection(),
  }),
];

for (const worker of workers) {
  worker.on("failed", (job, error) => {
    logger.error(
      {
        queue: worker.name,
        job: job?.name,
        attempt: job?.attemptsMade,
        err: error,
      },
      "Job failed",
    );
  });
}

logger.info("Worker started");

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down worker`);
  setTimeout(() => process.exit(1), 30_000).unref();

  await Promise.all(workers.map((worker) => worker.close()));
  await closeQueues();
  await redis.quit();
  await sql.end({ timeout: 5 });
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
