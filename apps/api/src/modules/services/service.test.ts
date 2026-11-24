import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.ts";
import { incidents, monitorDailyStats, monitors } from "../../models/index.ts";
import {
  registerUser,
  request,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";

useTestServer();

const UNKNOWN_ID = "00000000-0000-4000-8000-000000000001";

const serviceInput = {
  name: "Public API",
  description: "Customer facing endpoints",
  isPublic: true,
  position: 1,
  monitorIds: [] as string[],
  webhookIds: [] as string[],
};

const createMonitor = async (token: string, name: string, serviceId?: string) => {
  const response = await request("/api/monitors", {
    method: "POST",
    token,
    body: {
      name,
      url: `https://example.com/${name.toLowerCase().replaceAll(" ", "-")}`,
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
      serviceId,
    },
  });
  expect(response.status).toBe(201);
  return response.body;
};

const createWebhook = async (token: string, name: string, serviceId?: string) => {
  const response = await request("/api/webhooks", {
    method: "POST",
    token,
    body: { name, expectedIntervalSeconds: null, alertChannelIds: [], serviceId },
  });
  expect(response.status).toBe(201);
  return response.body;
};

const createService = async (token: string, body: Partial<typeof serviceInput> = {}) => {
  const response = await request("/api/services", {
    method: "POST",
    token,
    body: { ...serviceInput, ...body },
  });
  expect(response.status).toBe(201);
  return response.body;
};

const setMonitorStatus = (id: string, status: "up" | "down" | "degraded", isPaused = false) =>
  db.update(monitors).set({ status, isPaused }).where(eq(monitors.id, id));

describe("services", () => {
  it("creates, lists, updates and deletes a service", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");

    const created = await createService(token);
    expect(created).toMatchObject({
      name: "Public API",
      description: "Customer facing endpoints",
      isPublic: true,
      position: 1,
      status: "no_data",
      monitorIds: [],
      webhookIds: [],
      activeIncidentCount: 0,
    });

    await createService(token, { name: "Internal", position: 0, isPublic: false });

    const list = await request("/api/services", { token });
    expect(list.status).toBe(200);
    expect(list.body.total).toBe(2);
    expect(list.body.items.map((item: { name: string }) => item.name)).toEqual(["Internal", "Public API"]);

    const updated = await request(`/api/services/${created.id}`, {
      method: "PATCH",
      token,
      body: { name: "Edge API", isPublic: false },
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toMatchObject({ name: "Edge API", isPublic: false, position: 1 });

    const fetched = await request(`/api/services/${created.id}`, { token });
    expect(fetched.body.name).toBe("Edge API");

    const removed = await request(`/api/services/${created.id}`, { method: "DELETE", token });
    expect(removed.status).toBe(204);

    const missing = await request(`/api/services/${created.id}`, { token });
    expect(missing.status).toBe(404);
    const missingUpdate = await request(`/api/services/${created.id}`, {
      method: "PATCH",
      token,
      body: { name: "Gone" },
    });
    expect(missingUpdate.status).toBe(404);
  });

  it("rejects duplicate names regardless of case", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    await createService(token);

    const response = await request("/api/services", {
      method: "POST",
      token,
      body: { ...serviceInput, name: "public api" },
    });

    expect(response.status).toBe(409);
    expect(response.body.error.fieldErrors.name).toEqual(["A service with this name already exists"]);
  });

  it("validates input", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const response = await request("/api/services", {
      method: "POST",
      token,
      body: { ...serviceInput, name: "", position: -1 },
    });

    expect(response.status).toBe(400);
    expect(Object.keys(response.body.error.fieldErrors)).toEqual(expect.arrayContaining(["name", "position"]));
  });

  it("lets viewers read but not write", async () => {
    const { token: ownerToken } = await registerUser("Owner", "owner@test.dev");
    await createService(ownerToken);
    const { token } = await signInWithRole("viewer", "viewer@test.dev");

    const list = await request("/api/services", { token });
    expect(list.status).toBe(200);

    const create = await request("/api/services", { method: "POST", token, body: serviceInput });
    expect(create.status).toBe(403);
  });

  it("assigns members through monitor and webhook serviceId", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const service = await createService(token);
    const monitor = await createMonitor(token, "Payments", service.id);
    const webhook = await createWebhook(token, "Stripe", service.id);

    expect(monitor.serviceId).toBe(service.id);
    expect(webhook.serviceId).toBe(service.id);

    const fetched = await request(`/api/services/${service.id}`, { token });
    expect(fetched.body.monitorIds).toEqual([monitor.id]);
    expect(fetched.body.webhookIds).toEqual([webhook.id]);

    const detached = await request(`/api/monitors/${monitor.id}`, {
      method: "PATCH",
      token,
      body: { serviceId: null },
    });
    expect(detached.body.serviceId).toBeNull();

    const webhookUpdate = await request(`/api/webhooks/${webhook.id}`, {
      method: "PATCH",
      token,
      body: { serviceId: null },
    });
    expect(webhookUpdate.status).toBe(200);
    expect(webhookUpdate.body.serviceId).toBeNull();

    const after = await request(`/api/services/${service.id}`, { token });
    expect(after.body.monitorIds).toEqual([]);
    expect(after.body.webhookIds).toEqual([]);
  });

  it("rejects an unknown serviceId on monitors and webhooks", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const monitor = await request("/api/monitors", {
      method: "POST",
      token,
      body: {
        name: "Ghost",
        url: "https://example.com",
        method: "GET",
        intervalSeconds: 60,
        timeoutMs: 5000,
        expectedStatusCode: 200,
        alertChannelIds: [],
        serviceId: UNKNOWN_ID,
      },
    });
    expect(monitor.status).toBe(400);
    expect(monitor.body.error.fieldErrors.serviceId).toEqual(["Unknown service"]);

    const webhook = await request("/api/webhooks", {
      method: "POST",
      token,
      body: { name: "Ghost", expectedIntervalSeconds: null, alertChannelIds: [], serviceId: UNKNOWN_ID },
    });
    expect(webhook.status).toBe(400);
    expect(webhook.body.error.fieldErrors.serviceId).toEqual(["Unknown service"]);
  });

  it("replaces members from the service and moves them between services", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const first = await createMonitor(token, "First");
    const second = await createMonitor(token, "Second");
    const webhook = await createWebhook(token, "Hook");

    const service = await createService(token, { monitorIds: [first.id, second.id], webhookIds: [webhook.id] });
    expect(service.monitorIds.toSorted()).toEqual([first.id, second.id].toSorted());
    expect(service.webhookIds).toEqual([webhook.id]);

    const other = await createService(token, { name: "Other", monitorIds: [second.id] });
    expect(other.monitorIds).toEqual([second.id]);

    const original = await request(`/api/services/${service.id}`, { token });
    expect(original.body.monitorIds).toEqual([first.id]);

    const trimmed = await request(`/api/services/${service.id}`, {
      method: "PATCH",
      token,
      body: { monitorIds: [], webhookIds: [] },
    });
    expect(trimmed.body.monitorIds).toEqual([]);
    expect(trimmed.body.webhookIds).toEqual([]);

    const firstMonitor = await request(`/api/monitors/${first.id}`, { token });
    expect(firstMonitor.body.serviceId).toBeNull();
  });

  it("rejects unknown members without changing anything", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const monitor = await createMonitor(token, "Kept");
    const service = await createService(token, { monitorIds: [monitor.id] });

    const response = await request(`/api/services/${service.id}`, {
      method: "PATCH",
      token,
      body: { name: "Renamed", monitorIds: [UNKNOWN_ID] },
    });
    expect(response.status).toBe(400);
    expect(response.body.error.fieldErrors.monitorIds).toEqual(["Unknown monitor"]);

    const unchanged = await request(`/api/services/${service.id}`, { token });
    expect(unchanged.body).toMatchObject({ name: "Public API", monitorIds: [monitor.id] });
  });

  it("keeps members when the service is deleted", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const service = await createService(token);
    const monitor = await createMonitor(token, "Survivor", service.id);

    await request(`/api/services/${service.id}`, { method: "DELETE", token });

    const fetched = await request(`/api/monitors/${monitor.id}`, { token });
    expect(fetched.status).toBe(200);
    expect(fetched.body.serviceId).toBeNull();
  });

  it("derives status from members and counts active incidents", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const service = await createService(token);
    const healthy = await createMonitor(token, "Healthy", service.id);
    const broken = await createMonitor(token, "Broken", service.id);

    await setMonitorStatus(healthy.id, "up");
    await setMonitorStatus(broken.id, "degraded");
    expect((await request(`/api/services/${service.id}`, { token })).body.status).toBe("degraded");

    await setMonitorStatus(broken.id, "down");
    await db.insert(incidents).values({
      sourceType: "monitor",
      sourceId: broken.id,
      sourceName: "Broken",
      cause: "Connection refused",
    });
    const down = await request(`/api/services/${service.id}`, { token });
    expect(down.body.status).toBe("down");
    expect(down.body.activeIncidentCount).toBe(1);

    await setMonitorStatus(broken.id, "down", true);
    expect((await request(`/api/services/${service.id}`, { token })).body.status).toBe("up");
  });

  it("returns an overview with members, incidents and uptime bars", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const service = await createService(token);
    const monitor = await createMonitor(token, "Checked", service.id);
    const webhook = await createWebhook(token, "Hook", service.id);
    const today = new Date().toISOString().slice(0, 10);

    await db.insert(monitorDailyStats).values({
      monitorId: monitor.id,
      day: today,
      checkCount: 100,
      downCount: 2,
      degradedCount: 10,
    });
    await db.insert(incidents).values({
      sourceType: "webhook",
      sourceId: webhook.id,
      sourceName: "Hook",
      cause: "No events",
    });

    const response = await request(`/api/services/${service.id}/overview`, { token });

    expect(response.status).toBe(200);
    expect(response.body.monitors).toEqual([
      { id: monitor.id, name: "Checked", status: "pending", isPaused: false, uptimePercent: null },
    ]);
    expect(response.body.webhooks).toEqual([{ id: webhook.id, name: "Hook", status: "pending" }]);
    expect(response.body.activeIncidents).toHaveLength(1);
    expect(response.body.uptime.days).toHaveLength(90);
    expect(response.body.uptime.days.at(-1)).toEqual({ date: today, uptimePercent: 98 });
    expect(response.body.uptime.uptimePercent).toBe(98);

    const missing = await request(`/api/services/${UNKNOWN_ID}/overview`, { token });
    expect(missing.status).toBe(404);
  });
});
