import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis.ts";

export const QUEUE_NAMES = {
  checks: "checks",
  alerts: "alerts",
  maintenance: "maintenance",
} as const;

export type AlertEvent = "incident.opened" | "incident.resolved" | "test";

export type AlertJobData = {
  channelId: string;
  event: AlertEvent;
  incidentId?: string;
};

export type RunCheckJobData = {
  monitorId: string;
};

const connection = createRedisConnection();

const defaultJobOptions = {
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
};

export const checksQueue = new Queue(QUEUE_NAMES.checks, {
  connection,
  defaultJobOptions,
});
export const alertsQueue = new Queue(QUEUE_NAMES.alerts, {
  connection,
  defaultJobOptions,
});
export const maintenanceQueue = new Queue(QUEUE_NAMES.maintenance, {
  connection,
  defaultJobOptions,
});

export const enqueueAlert = async (data: AlertJobData) => {
  await alertsQueue.add("send-alert", data, {
    attempts: 5,
    backoff: { type: "exponential", delay: 5_000 },
  });
};

export const closeQueues = async () => {
  await Promise.all([
    checksQueue.close(),
    alertsQueue.close(),
    maintenanceQueue.close(),
  ]);
  await connection.quit();
};
