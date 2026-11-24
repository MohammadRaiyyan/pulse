import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from "prom-client";
import {
  alertsQueue,
  checksQueue,
  maintenanceQueue,
} from "../../jobs/queues.ts";
import { readHeartbeat } from "../health/worker-heartbeat.ts";
import { readCheckCounts, readJobCounts } from "./metric-counters.ts";

const QUEUE_STATES = [
  "waiting",
  "active",
  "delayed",
  "prioritized",
  "waiting-children",
  "failed",
] as const;

const monitoredQueues = [checksQueue, alertsQueue, maintenanceQueue];

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry, prefix: "pulse_api_" });

export const httpRequestsTotal = new Counter({
  name: "pulse_http_requests_total",
  help: "HTTP requests handled by the API",
  labelNames: ["method", "route", "status"] as const,
  registers: [metricsRegistry],
});

export const httpRequestDuration = new Histogram({
  name: "pulse_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const queueJobsGauge = new Gauge({
  name: "pulse_queue_jobs",
  help: "Jobs in each BullMQ queue by state",
  labelNames: ["queue", "state"] as const,
  registers: [metricsRegistry],
  async collect() {
    this.reset();
    const counts = await Promise.all(
      monitoredQueues.map((queue) => queue.getJobCounts(...QUEUE_STATES)),
    );

    monitoredQueues.forEach((queue, index) => {
      for (const state of QUEUE_STATES) {
        this.set({ queue: queue.name, state }, counts[index]?.[state] ?? 0);
      }
    });
  },
});

export const jobsCompletedTotal = new Counter({
  name: "pulse_jobs_completed_total",
  help: "Jobs completed by the worker, by queue and job name",
  labelNames: ["queue", "name"] as const,
  registers: [metricsRegistry],
  async collect() {
    this.reset();
    for (const { queue, name, count } of await readJobCounts("completed")) {
      this.inc({ queue, name }, count);
    }
  },
});

export const jobsFailedTotal = new Counter({
  name: "pulse_jobs_failed_total",
  help: "Failed job attempts in the worker, by queue and job name",
  labelNames: ["queue", "name"] as const,
  registers: [metricsRegistry],
  async collect() {
    this.reset();
    for (const { queue, name, count } of await readJobCounts("failed")) {
      this.inc({ queue, name }, count);
    }
  },
});

export const checkResultsTotal = new Counter({
  name: "pulse_check_results_total",
  help: "Monitor check results by outcome",
  labelNames: ["outcome"] as const,
  registers: [metricsRegistry],
  async collect() {
    this.reset();
    for (const { outcome, count } of await readCheckCounts()) {
      this.inc({ outcome }, count);
    }
  },
});

export const workerHeartbeatAge = new Gauge({
  name: "pulse_worker_heartbeat_age_seconds",
  help: "Seconds since the last worker heartbeat, -1 when no heartbeat exists",
  registers: [metricsRegistry],
  async collect() {
    const heartbeat = await readHeartbeat();

    this.set(heartbeat ? (Date.now() - heartbeat.timestamp) / 1000 : -1);
  },
});
