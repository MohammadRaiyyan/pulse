import { randomUUID } from "node:crypto";
import type { AlertEvent } from "@pulse/contracts";
import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis.ts";

export const QUEUE_NAMES = {
  checks: "checks",
  alerts: "alerts",
  maintenance: "maintenance",
} as const;

export type { AlertEvent };

export type AlertJobData = {
  channelId: string;
  event: AlertEvent;
  incidentId?: string;
  deliveryId?: string;
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
  const deliveryId = data.deliveryId ?? randomUUID();

  await alertsQueue.add("send-alert", { ...data, deliveryId }, {
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
