import { expect, test } from "../../support/fixtures.ts";
import { createTeammate, uniqueSuffix } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";

const fetchPublicStatus = async () => {
  const response = await fetch(`${API_ORIGIN}/api/public/status`);
  return { status: response.status, text: await response.text() };
};

const monitorInput = (serviceId: string | null = null) => ({
  name: `Service member ${uniqueSuffix()}`,
  url: `https://internal-${uniqueSuffix()}.example.com/health`,
  method: "GET",
  intervalSeconds: 600,
  timeoutMs: 5000,
  expectedStatusCode: 200,
  alertChannelIds: [],
  serviceId,
});

test.describe("services", () => {
  test("create, assign members, derive status and delete", async ({ ownerApi: owner }) => {
    const name = `Checkout ${uniqueSuffix()}`;
    const created = await owner.post("/services", {
      name,
      description: "Carts and payments",
      isPublic: false,
      position: 5,
      monitorIds: [],
      webhookIds: [],
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name, status: "no_data", monitorIds: [], webhookIds: [] });
    const serviceId = created.body.id;

    const duplicate = await owner.post("/services", {
      ...created.body,
      name: name.toUpperCase(),
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.fieldErrors.name).toBeDefined();

    const monitor = await owner.post("/monitors", monitorInput(serviceId));
    expect(monitor.status).toBe(201);
    expect(monitor.body.serviceId).toBe(serviceId);

    const webhook = await owner.post("/webhooks", {
      name: `Service hook ${uniqueSuffix()}`,
      expectedIntervalSeconds: null,
      alertChannelIds: [],
    });
    const withWebhook = await owner.patch(`/services/${serviceId}`, { webhookIds: [webhook.body.id] });
    expect(withWebhook.body).toMatchObject({ monitorIds: [monitor.body.id], webhookIds: [webhook.body.id], status: "pending" });

    const overview = await owner.get(`/services/${serviceId}/overview`);
    expect(overview.status).toBe(200);
    expect(overview.body.monitors.map((member: { id: string }) => member.id)).toEqual([monitor.body.id]);
    expect(overview.body.webhooks.map((member: { id: string }) => member.id)).toEqual([webhook.body.id]);
    expect(overview.body.uptime.days).toHaveLength(90);

    const unknownService = await owner.patch(`/monitors/${monitor.body.id}`, {
      serviceId: "00000000-0000-4000-8000-000000000001",
    });
    expect(unknownService.status).toBe(400);
    expect(unknownService.body.error.fieldErrors.serviceId).toEqual(["Unknown service"]);

    expect((await owner.delete(`/services/${serviceId}`)).status).toBe(204);
    expect((await owner.get(`/monitors/${monitor.body.id}`)).body.serviceId).toBeNull();
    expect((await owner.get(`/webhooks/${webhook.body.id}`)).body.serviceId).toBeNull();

    await owner.delete(`/monitors/${monitor.body.id}`);
    await owner.delete(`/webhooks/${webhook.body.id}`);
  });

  test("viewers read services, only owners and admins manage the status page", async ({ ownerApi: owner }) => {
    const viewer = await createTeammate(owner, "viewer");
    const member = await createTeammate(owner, "member");
    const admin = await createTeammate(owner, "admin");

    expect((await viewer.client.get("/services")).status).toBe(200);
    expect(
      (await viewer.client.post("/services", { name: "Nope", description: "", isPublic: false, position: 0, monitorIds: [], webhookIds: [] }))
        .status,
    ).toBe(403);

    expect((await member.client.get("/status-page")).status).toBe(403);
    expect((await member.client.patch("/status-page", { title: "Hijacked" })).status).toBe(403);
    expect((await admin.client.get("/status-page")).status).toBe(200);
  });
});

test.describe("public status page", () => {
  test("shows public services and incidents without internal details", async ({ ownerApi: owner }) => {
    expect((await owner.patch("/status-page", { isEnabled: true, title: "Pulse status" })).status).toBe(200);

    const response = await fetchPublicStatus();
    expect(response.status).toBe(200);
    const body = JSON.parse(response.text);

    expect(body.title).toBe("Pulse status");
    expect(["operational", "degraded", "partial_outage", "major_outage"]).toContain(body.overallStatus);
    const serviceNames = body.services.map((service: { name: string }) => service.name);
    expect(serviceNames).toEqual(expect.arrayContaining(["Public API", "Integrations"]));
    expect(serviceNames).not.toContain("Internal");

    for (const service of body.services) {
      expect(Object.keys(service).toSorted()).toEqual(["days", "description", "id", "name", "status", "uptimePercent"]);
      expect(service.days).toHaveLength(90);
    }

    for (const incident of [...body.activeIncidents, ...body.recentIncidents]) {
      expect(Object.keys(incident).toSorted()).toEqual(["id", "resolvedAt", "serviceId", "serviceName", "severity", "startedAt", "state"]);
      expect(serviceNames).toContain(incident.serviceName);
    }

    const monitors = (await owner.get("/monitors?pageSize=100")).body.items;
    const webhooks = (await owner.get("/webhooks?pageSize=100")).body.items;
    const incidents = (await owner.get("/incidents?pageSize=100")).body.items;

    for (const monitor of monitors) {
      expect(response.text).not.toContain(monitor.url);
      expect(response.text).not.toContain(monitor.id);
    }

    for (const webhook of webhooks) {
      expect(response.text).not.toContain(webhook.ingestUrl);
      expect(response.text).not.toContain(webhook.id);
    }

    for (const incident of incidents.filter((item: { cause: string }) => item.cause.length >= 10)) {
      expect(response.text).not.toContain(incident.cause);
    }

    for (const secret of ["Legacy SOAP gateway", "Payments service", "Stripe events", "GitHub deploys", "Olivia", "Adam"]) {
      expect(response.text).not.toContain(secret);
    }
  });

  test("returns 404 while disabled and reflects changes immediately", async ({ ownerApi: owner }) => {
    const name = `Public docs ${uniqueSuffix()}`;
    const service = await owner.post("/services", {
      name,
      description: "",
      isPublic: true,
      position: 99,
      monitorIds: [],
      webhookIds: [],
    });

    try {
      expect((await owner.patch("/status-page", { isEnabled: false })).status).toBe(200);
      expect((await fetchPublicStatus()).status).toBe(404);

      await owner.patch("/status-page", { isEnabled: true });
      expect((await fetchPublicStatus()).text).toContain(name);

      await owner.patch(`/services/${service.body.id}`, { isPublic: false });
      expect((await fetchPublicStatus()).text).not.toContain(name);
    } finally {
      await owner.patch("/status-page", { isEnabled: true });
      await owner.delete(`/services/${service.body.id}`);
    }
  });
});
