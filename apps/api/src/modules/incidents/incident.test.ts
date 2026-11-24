import type { CheckOutcome } from "@pulse/contracts";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { db } from "../../db/client.ts";
import { alertsQueue } from "../../jobs/queues.ts";
import { webhooks } from "../../models/index.ts";
import {
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";
import { runHttpCheck } from "../monitors/http-check.ts";
import { checkMonitor } from "../monitors/monitor-check.service.ts";
import { detectSilentWebhooks } from "../webhooks/webhook.service.ts";
import { openIncidentForSource } from "./incident.service.ts";

vi.mock("../monitors/http-check.ts", () => ({ runHttpCheck: vi.fn() }));

useTestServer();

const errorMessages: Record<CheckOutcome, string | null> = {
  up: null,
  degraded: "Response took 2400 ms",
  down: "Expected HTTP 200, got 503",
};

const runCheck = async (monitorId: string, outcome: CheckOutcome) => {
  vi.mocked(runHttpCheck).mockResolvedValueOnce({
    outcome,
    statusCode: outcome === "down" ? 503 : 200,
    responseTimeMs: 120,
    errorMessage: errorMessages[outcome],
  });
  await checkMonitor(monitorId);
};

const queuedAlerts = async () => {
  const jobs = await alertsQueue.getJobs(["waiting", "delayed"]);
  return jobs.map((job) => job.data.event as string).toSorted();
};

const createChannel = async (token: string) => {
  const channel = await request("/api/alert-channels", {
    method: "POST",
    token,
    body: {
      name: "On call",
      isEnabled: true,
      destination: { type: "email", target: "oncall@test.dev" },
    },
  });
  return channel.body.id as string;
};

const createMonitor = async (
  token: string,
  overrides: Record<string, unknown> = {},
) => {
  const response = await request("/api/monitors", {
    method: "POST",
    token,
    body: {
      name: "Checkout API",
      url: "https://example.com/health",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
      ...overrides,
    },
  });
  return response.body;
};

const incidentsFor = async (token: string, query = "") => {
  const response = await request(`/api/incidents${query}`, { token });
  return response.body;
};

describe("confirming failures", () => {
  it("opens a critical incident only after the threshold of consecutive failures", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channelId = await createChannel(token);
    const monitor = await createMonitor(token, { alertChannelIds: [channelId] });
    expect(monitor.failureThreshold).toBe(2);

    await runCheck(monitor.id, "down");

    const afterOne = await request(`/api/monitors/${monitor.id}`, { token });
    expect(afterOne.body).toMatchObject({ status: "down", consecutiveFailures: 1 });
    expect((await incidentsFor(token)).total).toBe(0);
    expect(await queuedAlerts()).toEqual([]);

    await runCheck(monitor.id, "down");

    const opened = await incidentsFor(token, "?status=open");
    expect(opened.total).toBe(1);
    expect(opened.items[0]).toMatchObject({
      severity: "critical",
      cause: "Expected HTTP 200, got 503",
      acknowledgedBy: null,
      resolvedBy: null,
      resolutionReason: null,
      source: { type: "monitor", id: monitor.id, isDeleted: false },
    });
    expect(await queuedAlerts()).toEqual(["incident.opened"]);

    await runCheck(monitor.id, "down");
    expect((await incidentsFor(token)).total).toBe(1);
    expect(await queuedAlerts()).toEqual(["incident.opened"]);

    await runCheck(monitor.id, "up");

    const resolved = await request(`/api/incidents/${opened.items[0].id}`, { token });
    expect(resolved.body).toMatchObject({
      status: "resolved",
      resolvedBy: null,
      resolutionReason: "recovered",
      acknowledgedAt: null,
    });
    expect(await queuedAlerts()).toEqual(["incident.opened", "incident.resolved"]);

    const recovered = await request(`/api/monitors/${monitor.id}`, { token });
    expect(recovered.body.consecutiveFailures).toBe(0);
  });

  it("resets the counter when a check succeeds between failures", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const monitor = await createMonitor(token, { failureThreshold: 3 });

    await runCheck(monitor.id, "down");
    await runCheck(monitor.id, "down");
    await runCheck(monitor.id, "up");
    await runCheck(monitor.id, "down");
    await runCheck(monitor.id, "down");
    expect((await incidentsFor(token)).total).toBe(0);

    await runCheck(monitor.id, "down");
    expect((await incidentsFor(token)).total).toBe(1);
  });

  it("opens on the first failure when the threshold is 1 and validates the range", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const monitor = await createMonitor(token, { failureThreshold: 1 });

    await runCheck(monitor.id, "down");
    expect((await incidentsFor(token, "?status=open")).total).toBe(1);

    const invalid = await request("/api/monitors", {
      method: "POST",
      token,
      body: { ...monitor, id: undefined, failureThreshold: 11 },
    });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.fieldErrors)).toContain("failureThreshold");
  });
});

describe("severity", () => {
  it("opens a silent warning for degraded checks and escalates it when the monitor goes down", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channelId = await createChannel(token);
    const monitor = await createMonitor(token, { alertChannelIds: [channelId] });

    await runCheck(monitor.id, "degraded");
    await runCheck(monitor.id, "degraded");

    const warning = await incidentsFor(token, "?status=active");
    expect(warning.total).toBe(1);
    expect(warning.items[0]).toMatchObject({
      severity: "warning",
      cause: "Response took 2400 ms",
    });
    expect(await queuedAlerts()).toEqual([]);

    await runCheck(monitor.id, "down");

    const escalated = await incidentsFor(token);
    expect(escalated.total).toBe(1);
    expect(escalated.items[0]).toMatchObject({
      id: warning.items[0].id,
      severity: "critical",
      cause: "Expected HTTP 200, got 503",
    });
    expect(await queuedAlerts()).toEqual(["incident.opened"]);

    await runCheck(monitor.id, "degraded");
    expect((await incidentsFor(token)).items[0].severity).toBe("critical");

    await runCheck(monitor.id, "up");
    expect(await queuedAlerts()).toEqual(["incident.opened", "incident.resolved"]);
  });

  it("resolves a warning without sending a recovery alert", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channelId = await createChannel(token);
    const monitor = await createMonitor(token, {
      alertChannelIds: [channelId],
      failureThreshold: 1,
    });

    await runCheck(monitor.id, "degraded");
    await runCheck(monitor.id, "up");

    expect((await incidentsFor(token, "?status=resolved")).total).toBe(1);
    expect(await queuedAlerts()).toEqual([]);
  });

  it("marks silent webhooks as critical", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const created = await request("/api/webhooks", {
      method: "POST",
      token,
      body: { name: "Nightly job", expectedIntervalSeconds: 3600, alertChannelIds: [] },
    });
    await db
      .update(webhooks)
      .set({ createdAt: new Date(Date.now() - 2 * 3600 * 1000) })
      .where(eq(webhooks.id, created.body.id));

    await detectSilentWebhooks();

    expect((await incidentsFor(token)).items[0]).toMatchObject({
      severity: "critical",
      source: { type: "webhook", id: created.body.id },
    });
  });
});

describe("who acted", () => {
  it("records who acknowledged and who resolved, and enforces the transition rules", async () => {
    const { token, user } = await registerUser("Olivia Owner", "owner@test.dev");
    const admin = await signInWithRole("admin", "admin@test.dev");
    const monitor = await createMonitor(token, { failureThreshold: 1 });
    await runCheck(monitor.id, "down");
    const [incident] = (await incidentsFor(token)).items;

    const acknowledged = await request(`/api/incidents/${incident.id}/acknowledge`, {
      method: "POST",
      token,
    });
    expect(acknowledged.body).toMatchObject({
      status: "acknowledged",
      acknowledgedBy: { id: user.id, name: "Olivia Owner" },
      resolvedBy: null,
    });
    expect(acknowledged.body.acknowledgedAt).not.toBeNull();

    const again = await request(`/api/incidents/${incident.id}/acknowledge`, {
      method: "POST",
      token,
    });
    expect(again.status).toBe(409);

    const resolved = await request(`/api/incidents/${incident.id}/resolve`, {
      method: "POST",
      token: admin.token,
    });
    expect(resolved.body).toMatchObject({
      status: "resolved",
      acknowledgedBy: { id: user.id, name: "Olivia Owner" },
      resolvedBy: { id: admin.user.id, name: admin.user.name },
      resolutionReason: null,
    });

    const unknown = await request(`/api/incidents/${incident.id}/explode`, {
      method: "POST",
      token,
    });
    expect(unknown.status).toBe(404);
  });

  it("marks the resolver as acknowledger when resolving an open incident", async () => {
    const { token, user } = await registerUser("Olivia Owner", "owner@test.dev");
    const monitor = await createMonitor(token, { failureThreshold: 1 });
    await runCheck(monitor.id, "down");
    const [incident] = (await incidentsFor(token)).items;

    const resolved = await request(`/api/incidents/${incident.id}/resolve`, {
      method: "POST",
      token,
    });
    expect(resolved.body.acknowledgedBy).toEqual({ id: user.id, name: "Olivia Owner" });
    expect(resolved.body.resolvedBy).toEqual({ id: user.id, name: "Olivia Owner" });
  });
});

describe("active incidents", () => {
  it("counts open and acknowledged incidents as active", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const first = await createMonitor(token, { name: "First", failureThreshold: 1 });
    const second = await createMonitor(token, { name: "Second", failureThreshold: 1 });
    const third = await createMonitor(token, { name: "Third", failureThreshold: 1 });

    await runCheck(first.id, "down");
    await runCheck(second.id, "down");
    await runCheck(third.id, "degraded");
    const acknowledged = (await incidentsFor(token)).items.find(
      (item: { source: { name: string } }) => item.source.name === "Second",
    );
    await request(`/api/incidents/${acknowledged.id}/acknowledge`, {
      method: "POST",
      token,
    });

    const active = await incidentsFor(token, "?status=active");
    expect(active.total).toBe(3);
    expect(
      active.items.map((item: { status: string }) => item.status).toSorted(),
    ).toEqual(["acknowledged", "open", "open"]);

    const summary = await request("/api/dashboard/summary", { token });
    expect(summary.body).toMatchObject({
      openIncidents: 2,
      activeIncidents: 3,
      criticalIncidents: 2,
    });

    await runCheck(first.id, "up");

    const after = await request("/api/dashboard/summary", { token });
    expect(after.body).toMatchObject({
      openIncidents: 1,
      activeIncidents: 2,
      criticalIncidents: 1,
    });
  });
});

describe("source lifecycle", () => {
  it("keeps incident history when a monitor is deleted", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const monitor = await createMonitor(token, { failureThreshold: 1 });

    await runCheck(monitor.id, "down");
    await runCheck(monitor.id, "up");
    await runCheck(monitor.id, "down");

    const removed = await request(`/api/monitors/${monitor.id}`, {
      method: "DELETE",
      token,
    });
    expect(removed.status).toBe(204);

    const history = await incidentsFor(token);
    expect(history.total).toBe(2);
    for (const incident of history.items) {
      expect(incident.status).toBe("resolved");
      expect(incident.source).toMatchObject({ id: monitor.id, isDeleted: true });
    }
    expect(
      history.items.map((item: { resolutionReason: string }) => item.resolutionReason).toSorted(),
    ).toEqual(["recovered", "source_deleted"]);

    await openIncidentForSource(
      { type: "monitor", id: monitor.id, name: monitor.name, alertChannelIds: [] },
      "Late check",
    );
    expect((await incidentsFor(token, "?status=active")).total).toBe(0);
  });

  it("keeps incident history when a webhook is deleted", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const created = await request("/api/webhooks", {
      method: "POST",
      token,
      body: { name: "Deploys", expectedIntervalSeconds: 60, alertChannelIds: [] },
    });
    await db
      .update(webhooks)
      .set({ createdAt: new Date(Date.now() - 120 * 1000) })
      .where(eq(webhooks.id, created.body.id));
    await detectSilentWebhooks();

    await request(`/api/webhooks/${created.body.id}`, { method: "DELETE", token });

    const history = await incidentsFor(token);
    expect(history.total).toBe(1);
    expect(history.items[0]).toMatchObject({
      status: "resolved",
      resolutionReason: "source_deleted",
      source: { type: "webhook", name: "Deploys", isDeleted: true },
    });
  });

  it("resolves the active incident and resets the counter when a monitor is paused", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const channelId = await createChannel(token);
    const monitor = await createMonitor(token, { alertChannelIds: [channelId] });

    await runCheck(monitor.id, "down");
    await runCheck(monitor.id, "down");
    expect(await queuedAlerts()).toEqual(["incident.opened"]);

    const paused = await request(`/api/monitors/${monitor.id}`, {
      method: "PATCH",
      token,
      body: { isPaused: true },
    });
    expect(paused.body).toMatchObject({ isPaused: true, consecutiveFailures: 0 });

    const [incident] = (await incidentsFor(token)).items;
    expect(incident).toMatchObject({
      status: "resolved",
      resolvedBy: null,
      resolutionReason: "monitor_paused",
    });
    expect(await queuedAlerts()).toEqual(["incident.opened"]);

    await runCheck(monitor.id, "down");
    await openIncidentForSource(
      { type: "monitor", id: monitor.id, name: monitor.name, alertChannelIds: [] },
      "Late check",
    );
    expect((await incidentsFor(token, "?status=active")).total).toBe(0);

    await request(`/api/monitors/${monitor.id}`, {
      method: "PATCH",
      token,
      body: { isPaused: false },
    });
    await runCheck(monitor.id, "down");
    expect((await incidentsFor(token, "?status=active")).total).toBe(0);
    await runCheck(monitor.id, "down");
    expect((await incidentsFor(token, "?status=active")).total).toBe(1);
  });
});
