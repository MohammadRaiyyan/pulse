import { publicStatusSchema } from "@pulse/contracts";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.ts";
import { cacheKeys } from "../../lib/cache.ts";
import { redis } from "../../lib/redis.ts";
import { incidents, monitorDailyStats, monitors } from "../../models/index.ts";
import { daysAgo } from "../../lib/dates.ts";
import {
  openIncidentForSource,
  resolveIncidentForSource,
} from "../incidents/incident.service.ts";
import {
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";

useTestServer();

const SECRET_URL = "https://internal.secret.example/health";
const SECRET_CAUSE = "ECONNREFUSED 10.0.0.12:8443";

const createMonitor = async (token: string, name: string) => {
  const response = await request("/api/monitors", {
    method: "POST",
    token,
    body: {
      name,
      url: SECRET_URL,
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
    },
  });
  return response.body;
};

const createService = async (token: string, body: Record<string, unknown>) => {
  const response = await request("/api/services", {
    method: "POST",
    token,
    body: { description: "", isPublic: true, position: 0, monitorIds: [], webhookIds: [], ...body },
  });
  return response.body;
};

const enableStatusPage = (token: string) =>
  request("/api/status-page", {
    method: "PATCH",
    token,
    body: { isEnabled: true, title: "Acme status", description: "Live system health" },
  });

const setUpWorkspace = async () => {
  const { token } = await registerUser("Owner", "owner@test.dev");
  const publicMonitor = await createMonitor(token, "Checkout backend");
  const privateMonitor = await createMonitor(token, "Billing database");
  const publicService = await createService(token, {
    name: "Checkout",
    description: "Payments and carts",
    monitorIds: [publicMonitor.id],
  });
  const privateService = await createService(token, {
    name: "Secret internal service",
    isPublic: false,
    monitorIds: [privateMonitor.id],
  });

  return { token, publicMonitor, privateMonitor, publicService, privateService };
};

const publicStatus = () => request("/api/public/status");

describe("status page settings", () => {
  it("defaults to disabled and is managed by owners and admins only", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");

    const settings = await request("/api/status-page", { token });
    expect(settings.status).toBe(200);
    expect(settings.body).toEqual({ isEnabled: false, title: "Status", description: "" });

    const updated = await enableStatusPage(token);
    expect(updated.body).toEqual({ isEnabled: true, title: "Acme status", description: "Live system health" });

    const partial = await request("/api/status-page", { method: "PATCH", token, body: { description: "" } });
    expect(partial.body).toEqual({ isEnabled: true, title: "Acme status", description: "" });

    const invalid = await request("/api/status-page", { method: "PATCH", token, body: { title: "" } });
    expect(invalid.status).toBe(400);

    const admin = await signInWithRole("admin", "admin@test.dev");
    expect((await request("/api/status-page", { token: admin.token })).status).toBe(200);

    const member = await signInWithRole("member", "member@test.dev");
    expect((await request("/api/status-page", { token: member.token })).status).toBe(403);
    const memberUpdate = await request("/api/status-page", {
      method: "PATCH",
      token: member.token,
      body: { isEnabled: false },
    });
    expect(memberUpdate.status).toBe(403);
  });
});

describe("public status", () => {
  it("returns 404 while the status page is disabled", async () => {
    await setUpWorkspace();

    const response = await publicStatus();

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("serves public services without signing in", async () => {
    const { token, publicService, publicMonitor } = await setUpWorkspace();
    await enableStatusPage(token);
    const today = new Date().toISOString().slice(0, 10);
    await db.insert(monitorDailyStats).values({
      monitorId: publicMonitor.id,
      day: today,
      checkCount: 50,
      downCount: 5,
      degradedCount: 20,
    });

    const response = await publicStatus();

    expect(response.status).toBe(200);
    expect(publicStatusSchema.safeParse(response.body).success).toBe(true);
    expect(response.body).toMatchObject({
      title: "Acme status",
      description: "Live system health",
      overallStatus: "operational",
    });
    expect(response.body.services).toHaveLength(1);
    expect(response.body.services[0]).toMatchObject({
      id: publicService.id,
      name: "Checkout",
      description: "Payments and carts",
      status: "pending",
      uptimePercent: 90,
    });
    expect(response.body.services[0].days).toHaveLength(90);
    expect(response.body.services[0].days.at(-1)).toEqual({ date: today, uptimePercent: 90 });
  });

  it("never leaks internal details", async () => {
    const { token, publicMonitor, privateMonitor } = await setUpWorkspace();
    await enableStatusPage(token);
    await db.insert(incidents).values([
      {
        sourceType: "monitor",
        sourceId: publicMonitor.id,
        sourceName: "Checkout backend",
        cause: SECRET_CAUSE,
        acknowledgedByName: "Olivia Owner",
      },
      {
        sourceType: "monitor",
        sourceId: privateMonitor.id,
        sourceName: "Billing database",
        cause: SECRET_CAUSE,
      },
    ]);

    const response = await publicStatus();
    const body = JSON.stringify(response.body);

    for (const secret of [
      SECRET_URL,
      "internal.secret",
      SECRET_CAUSE,
      "Checkout backend",
      "Billing database",
      "Secret internal service",
      "Olivia",
      publicMonitor.id,
      privateMonitor.id,
    ]) {
      expect(body).not.toContain(secret);
    }

    expect(response.body.activeIncidents).toHaveLength(1);
    expect(Object.keys(response.body.activeIncidents[0]).toSorted()).toEqual(
      ["id", "resolvedAt", "serviceId", "serviceName", "severity", "startedAt", "state"].toSorted(),
    );
    expect(response.body.activeIncidents[0]).toMatchObject({
      serviceName: "Checkout",
      severity: "critical",
      state: "investigating",
      resolvedAt: null,
    });
    expect(Object.keys(response.body.services[0]).toSorted()).toEqual(
      ["days", "description", "id", "name", "status", "uptimePercent"].toSorted(),
    );
  });

  it("lists incidents resolved in the last seven days only", async () => {
    const { token, publicMonitor } = await setUpWorkspace();
    await enableStatusPage(token);
    const base = {
      sourceType: "monitor" as const,
      sourceId: publicMonitor.id,
      sourceName: "Checkout backend",
      cause: SECRET_CAUSE,
      status: "resolved" as const,
    };
    await db.insert(incidents).values([
      { ...base, severity: "warning", startedAt: daysAgo(3), resolvedAt: daysAgo(2) },
      { ...base, startedAt: daysAgo(1), resolvedAt: daysAgo(0.5) },
      { ...base, startedAt: daysAgo(10), resolvedAt: daysAgo(9) },
      { ...base, sourceId: "00000000-0000-4000-8000-000000000009", startedAt: daysAgo(1), resolvedAt: daysAgo(0.5) },
    ]);

    const response = await publicStatus();

    expect(response.body.activeIncidents).toEqual([]);
    expect(response.body.recentIncidents).toHaveLength(2);
    expect(response.body.recentIncidents.map((incident: { severity: string }) => incident.severity)).toEqual([
      "critical",
      "warning",
    ]);
    expect(response.body.recentIncidents[0].state).toBe("resolved");
  });

  it("reports the overall status from public services only", async () => {
    const { token, publicMonitor, privateMonitor } = await setUpWorkspace();
    await enableStatusPage(token);

    await db.update(monitors).set({ status: "down" }).where(eq(monitors.id, privateMonitor.id));
    await redis.del(cacheKeys.publicStatus);
    expect((await publicStatus()).body.overallStatus).toBe("operational");

    await db.update(monitors).set({ status: "down" }).where(eq(monitors.id, publicMonitor.id));
    await redis.del(cacheKeys.publicStatus);
    expect((await publicStatus()).body.overallStatus).toBe("major_outage");

    const extra = await createMonitor(token, "Healthy");
    await db.update(monitors).set({ status: "up" }).where(eq(monitors.id, extra.id));
    await createService(token, { name: "Docs", monitorIds: [extra.id] });
    expect((await publicStatus()).body.overallStatus).toBe("partial_outage");
  });

  it("caches the response and invalidates it on relevant changes", async () => {
    const { token, publicService, publicMonitor } = await setUpWorkspace();
    await enableStatusPage(token);

    const first = await publicStatus();
    expect(await redis.exists(cacheKeys.publicStatus)).toBe(1);

    const cachedAgain = await publicStatus();
    expect(cachedAgain.body.generatedAt).toBe(first.body.generatedAt);

    await request(`/api/services/${publicService.id}`, {
      method: "PATCH",
      token,
      body: { name: "Storefront" },
    });
    expect(await redis.exists(cacheKeys.publicStatus)).toBe(0);
    expect((await publicStatus()).body.services[0].name).toBe("Storefront");

    const source = { type: "monitor" as const, id: publicMonitor.id, name: "Checkout backend", alertChannelIds: [] };
    await openIncidentForSource(source, SECRET_CAUSE);
    expect((await publicStatus()).body.activeIncidents).toHaveLength(1);

    await resolveIncidentForSource(source);
    const resolved = await publicStatus();
    expect(resolved.body.activeIncidents).toHaveLength(0);
    expect(resolved.body.recentIncidents).toHaveLength(1);

    await request(`/api/monitors/${publicMonitor.id}`, { method: "PATCH", token, body: { serviceId: null } });
    expect((await publicStatus()).body.services[0].status).toBe("no_data");

    await request("/api/status-page", { method: "PATCH", token, body: { isEnabled: false } });
    expect((await publicStatus()).status).toBe(404);
  });

  it("drops a service from the page when it is made private or deleted", async () => {
    const { token, publicService } = await setUpWorkspace();
    await enableStatusPage(token);
    expect((await publicStatus()).body.services).toHaveLength(1);

    await request(`/api/services/${publicService.id}`, { method: "PATCH", token, body: { isPublic: false } });
    expect((await publicStatus()).body.services).toHaveLength(0);

    await request(`/api/services/${publicService.id}`, { method: "PATCH", token, body: { isPublic: true } });
    await request(`/api/services/${publicService.id}`, { method: "DELETE", token });
    expect((await publicStatus()).body.services).toHaveLength(0);
  });
});
