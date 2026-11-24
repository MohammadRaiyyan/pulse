import { describe, expect, it } from "vitest";
import { request, useTestServer } from "../../test/client.ts";
import {
  HEARTBEAT_STALE_AFTER_MS,
  writeHeartbeat,
} from "./worker-heartbeat.ts";

useTestServer();

describe("health", () => {
  it("reports liveness without dependencies", async () => {
    const response = await request("/api/health/live");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("reports readiness when database and redis are reachable", async () => {
    const response = await request("/api/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      database: "ok",
      redis: "ok",
    });
  });

  it("is healthy when the worker heartbeat is fresh", async () => {
    await writeHeartbeat();

    const response = await request("/api/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      database: "ok",
      redis: "ok",
      worker: "up",
      workerLastSeenAt: expect.any(String),
    });
  });

  it("is degraded when the worker has never reported", async () => {
    const response = await request("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: "degraded",
      database: "ok",
      redis: "ok",
      worker: "missing",
      workerLastSeenAt: null,
    });
  });

  it("is degraded when the worker heartbeat is stale", async () => {
    const lastSeen = Date.now() - HEARTBEAT_STALE_AFTER_MS - 1_000;
    await writeHeartbeat(lastSeen);

    const response = await request("/api/health");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      status: "degraded",
      worker: "stale",
      workerLastSeenAt: new Date(lastSeen).toISOString(),
    });
  });
});
