import { createApp } from "./app.ts";
import { env } from "./config/env.ts";
import { sql } from "./db/client.ts";
import { closeQueues } from "./jobs/queues.ts";
import { logger } from "./lib/logger.ts";
import { exitOnFatalErrors } from "./lib/process-errors.ts";
import { closeChangeSubscriber } from "./lib/realtime.ts";
import { redis } from "./lib/redis.ts";
import { closeAllLiveStreams } from "./modules/events/live-stream.service.ts";

exitOnFatalErrors("api");

const server = createApp().listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`);
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received, shutting down API`);

  closeAllLiveStreams();

  server.close(async () => {
    await closeChangeSubscriber();
    await closeQueues();
    await redis.quit();
    await sql.end({ timeout: 5 });
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
