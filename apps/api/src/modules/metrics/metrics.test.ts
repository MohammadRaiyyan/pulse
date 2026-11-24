import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorHandler } from "../../middleware/error-handler.ts";
import {
  registerUser,
  request,
  sendRaw,
  useTestServer,
} from "../../test/client.ts";
import { writeHeartbeat } from "../health/worker-heartbeat.ts";
import { recordCheckOutcome, recordJobOutcome } from "./metric-counters.ts";
import { httpRequestsTotal } from "./metrics.registry.ts";
import { createMetricsRouter } from "./metrics.routes.ts";

useTestServer();

const METRICS_TOKEN = "test-metrics-token-that-is-at-least-32-chars";

let metricsServer: Server;
let metricsUrl = "";

beforeAll(() => {
  const app = express();
  app.use(createMetricsRouter(METRICS_TOKEN));
  app.use(errorHandler);
  metricsServer = app.listen(0);
  metricsUrl = `http://localhost:${(metricsServer.address() as AddressInfo).port}/metrics`;
});

afterAll(() => {
  metricsServer.close();
});

const requestCount = async (route: string, status: string) => {
  const metric = await httpRequestsTotal.get();
  return metric.values
    .filter(
      (value) => value.labels.route === route && value.labels.status === status,
    )
    .reduce((total, value) => total + value.value, 0);
};

describe("metrics endpoint", () => {
  it("is not exposed when no token is configured", async () => {
    const response = await request("/metrics");

    expect(response.status).toBe(404);
  });

  it("rejects requests without a valid token", async () => {
    const missing = await fetch(metricsUrl);
    const wrong = await fetch(metricsUrl, {
      headers: { Authorization: "Bearer not-the-token" },
    });

    expect(missing.status).toBe(401);
    expect(missing.headers.get("www-authenticate")).toContain("Bearer");
    expect(wrong.status).toBe(401);
  });

  it("exposes process, queue, job, check and heartbeat metrics", async () => {
    await writeHeartbeat();
    await recordJobOutcome("checks", "run-check", "completed");
    await recordJobOutcome("checks", "run-check", "completed");
    await recordJobOutcome("alerts", "send-alert", "failed");
    await recordCheckOutcome("down");
    await recordCheckOutcome("not-an-outcome");

    const response = await fetch(metricsUrl, {
      headers: { Authorization: `Bearer ${METRICS_TOKEN}` },
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain("pulse_api_process_cpu_user_seconds_total");
    expect(body).toContain('pulse_queue_jobs{queue="checks",state="waiting"}');
    expect(body).toContain(
      'pulse_jobs_completed_total{queue="checks",name="run-check"} 2',
    );
    expect(body).toContain(
      'pulse_jobs_failed_total{queue="alerts",name="send-alert"} 1',
    );
    expect(body).toContain('pulse_check_results_total{outcome="down"} 1');
    expect(body).not.toContain("not-an-outcome");
    expect(body).toMatch(/pulse_worker_heartbeat_age_seconds \d/);
  });
});

describe("HTTP request metrics", () => {
  it("labels requests with the matched route pattern", async () => {
    const before = await requestCount("/api/monitors/:id", "401");

    await request("/api/monitors/7d0c0a52-1f1e-4a57-9f55-1f6b7c1d2e3f");
    await request("/api/monitors/0b6a3a5e-2f2e-4b68-8f66-2a7c8d2e3f40");

    expect(await requestCount("/api/monitors/:id", "401")).toBe(before + 2);
  });

  it("labels successful requests through nested routers", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const before = await requestCount("/api/monitors", "200");

    await request("/api/monitors", { token });

    expect(await requestCount("/api/monitors", "200")).toBe(before + 1);
  });

  it("groups unknown URLs under a single label", async () => {
    const before = await requestCount("unmatched", "404");

    await request("/api/does-not-exist/abc");
    await request("/totally/unknown");

    expect(await requestCount("unmatched", "404")).toBe(before + 2);
  });
});

describe("client IP behind a trusted proxy", () => {
  it("stores the forwarded address for webhook events from a loopback proxy", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const webhook = await request("/api/webhooks", {
      method: "POST",
      token,
      body: {
        name: "Proxy test",
        expectedIntervalSeconds: 3600,
        alertChannelIds: [],
      },
    });
    const ingestPath = new URL(webhook.body.ingestUrl).pathname;

    await sendRaw(ingestPath, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.7",
      },
      body: "{}",
    });

    const events = await request(`/api/webhooks/${webhook.body.id}/events`, {
      token,
    });

    expect(events.body.items[0].sourceIp).toBe("203.0.113.7");
  });
});
