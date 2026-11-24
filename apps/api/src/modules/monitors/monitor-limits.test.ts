import { afterEach, describe, expect, it } from "vitest";
import { env } from "../../config/env.ts";
import { acquireHostSlot } from "../../lib/host-concurrency.ts";
import { registerUser, request, useTestServer } from "../../test/client.ts";
import { runCheckWithHostLimit } from "./check-runner.service.ts";
import { insertMonitor, listChecks } from "./monitor.repository.ts";

useTestServer();

const defaults = {
  maxMonitors: env.MAX_MONITORS_PER_WORKSPACE,
  perHost: env.CHECK_MAX_CONCURRENCY_PER_HOST,
};

afterEach(() => {
  env.MAX_MONITORS_PER_WORKSPACE = defaults.maxMonitors;
  env.CHECK_MAX_CONCURRENCY_PER_HOST = defaults.perHost;
});

const monitorInput = (name: string) => ({
  name,
  url: "http://127.0.0.1:9/health",
  method: "GET" as const,
  intervalSeconds: 60,
  timeoutMs: 1000,
  expectedStatusCode: 200,
  alertChannelIds: [] as string[],
});

describe("monitor quota", () => {
  it("rejects new monitors once the workspace limit is reached", async () => {
    env.MAX_MONITORS_PER_WORKSPACE = 2;
    const { token } = await registerUser("Owner", "owner@test.dev");

    for (const name of ["First", "Second"]) {
      const created = await request("/api/monitors", {
        method: "POST",
        token,
        body: monitorInput(name),
      });
      expect(created.status).toBe(201);
    }

    const rejected = await request("/api/monitors", {
      method: "POST",
      token,
      body: monitorInput("Third"),
    });

    expect(rejected.status).toBe(409);
    expect(rejected.body.error.code).toBe("CONFLICT");
    expect(rejected.body.error.message).toBe(
      "Monitor limit reached. This workspace can have up to 2 monitors.",
    );
  });
});

describe("host concurrency", () => {
  it("hands out at most the limit of slots per host", async () => {
    const first = await acquireHostSlot("api.example.com", 2, 10_000);
    const second = await acquireHostSlot("api.example.com", 2, 10_000);
    const third = await acquireHostSlot("api.example.com", 2, 10_000);
    const otherHost = await acquireHostSlot("other.example.com", 2, 10_000);

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).toBeNull();
    expect(otherHost).not.toBeNull();

    await first?.release();
    expect(await acquireHostSlot("api.example.com", 2, 10_000)).not.toBeNull();
  });

  it("frees slots whose lease expired", async () => {
    await acquireHostSlot("stale.example.com", 1, 50);
    expect(await acquireHostSlot("stale.example.com", 1, 50)).toBeNull();

    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(await acquireHostSlot("stale.example.com", 1, 50)).not.toBeNull();
  });

  it("defers a check while its host is at the limit", async () => {
    env.CHECK_MAX_CONCURRENCY_PER_HOST = 1;
    const monitor = await insertMonitor(monitorInput("Busy host"));
    const held = await acquireHostSlot("127.0.0.1", 1, 10_000);

    expect(await runCheckWithHostLimit(monitor.id)).toBe("host-busy");
    expect((await listChecks(monitor.id, 10, 0)).total).toBe(0);

    await held?.release();

    expect(await runCheckWithHostLimit(monitor.id)).toBe("completed");
    const checks = await listChecks(monitor.id, 10, 0);
    expect(checks.total).toBe(1);
    expect(checks.rows[0]?.errorMessage).toBe(
      "Blocked: private network address",
    );
  });
});
