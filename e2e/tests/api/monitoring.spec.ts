import { expect, test } from "../../support/fixtures.ts";
import { ApiClient, demoUsers, uniqueSuffix, waitFor } from "../../support/api-client.ts";
import { createAlertSink } from "../../support/alert-sink.ts";
import { API_ORIGIN } from "../../support/environment.ts";

test.describe("monitoring pipeline", () => {
  test("a failing monitor opens one incident, alerts, and resolves itself on recovery", async ({ ownerApi: owner }) => {
    const sink = await createAlertSink(owner);
    const name = `Checkout ${uniqueSuffix()}`;

    const created = await owner.post("/monitors", {
      name,
      url: `${API_ORIGIN}/api/missing-endpoint`,
      method: "GET",
      intervalSeconds: 30,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      failureThreshold: 1,
      alertChannelIds: [sink.channelId],
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      status: "pending",
      lastCheckedAt: null,
      uptimePercent: null,
      failureThreshold: 1,
      consecutiveFailures: 0,
    });
    const monitorId = created.body.id;

    const down = await waitFor(
      () => owner.get(`/monitors/${monitorId}`),
      (response) => response.body.status === "down",
    );
    expect(down.body.uptimePercent).toBe(0);
    expect(down.body.lastResponseTimeMs).toBeGreaterThanOrEqual(0);

    const checks = await owner.get(`/monitors/${monitorId}/checks`);
    expect(checks.body.items[0]).toMatchObject({
      outcome: "down",
      statusCode: 404,
      errorMessage: "Expected HTTP 200, got 404",
    });

    const incidents = await owner.get("/incidents?status=open&pageSize=100");
    const opened = incidents.body.items.filter((incident: { source: { id: string } }) => incident.source.id === monitorId);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({
      cause: "Expected HTTP 200, got 404",
      severity: "critical",
      acknowledgedBy: null,
      resolvedBy: null,
      source: { type: "monitor", name, isDeleted: false },
    });

    const openedAlerts = await waitFor(sink.receivedAlerts, (alerts) =>
      alerts.some((alert: { event: string }) => alert.event === "incident.opened"),
    );
    expect(openedAlerts.find((alert: { event: string }) => alert.event === "incident.opened").incident.id).toBe(opened[0].id);

    const fixed = await owner.patch(`/monitors/${monitorId}`, { url: `${API_ORIGIN}/api/health` });
    expect(fixed.status).toBe(200);
    expect(fixed.body.alertChannelIds).toEqual([sink.channelId]);

    const resolvedIncident = await waitFor(
      () => owner.get(`/incidents/${opened[0].id}`),
      (response) => response.body.status === "resolved",
      { timeout: 60_000 },
    );
    expect(resolvedIncident.body).toMatchObject({ resolvedBy: null, resolutionReason: "recovered" });

    const recovered = await owner.get(`/monitors/${monitorId}`);
    expect(recovered.body.status).toBe("up");
    expect(recovered.body.consecutiveFailures).toBe(0);
    expect(recovered.body.uptimePercent).toBeGreaterThan(0);
    expect(recovered.body.uptimePercent).toBeLessThan(100);

    await waitFor(sink.receivedAlerts, (alerts) =>
      alerts.some((alert: { event: string }) => alert.event === "incident.resolved"),
    );

    const allIncidents = await owner.get("/incidents?pageSize=100");
    const forMonitor = allIncidents.body.items.filter((incident: { source: { id: string } }) => incident.source.id === monitorId);
    expect(forMonitor).toHaveLength(1);

  });

  test("one failed check does not open an incident until the default threshold of two is reached", async ({ ownerApi: owner }) => {
    test.setTimeout(120_000);
    const created = await owner.post("/monitors", {
      name: `Flaky ${uniqueSuffix()}`,
      url: `${API_ORIGIN}/api/flaky-missing`,
      method: "GET",
      intervalSeconds: 30,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
    });
    expect(created.body.failureThreshold).toBe(2);
    const monitorId = created.body.id;

    const firstFailure = await waitFor(
      () => owner.get(`/monitors/${monitorId}`),
      (response) => response.body.consecutiveFailures === 1,
    );
    expect(firstFailure.body.status).toBe("down");
    const early = await owner.get("/incidents?status=active&pageSize=100");
    expect(early.body.items.some((item: { source: { id: string } }) => item.source.id === monitorId)).toBe(false);

    const confirmed = await waitFor(
      () => owner.get("/incidents?status=active&pageSize=100"),
      (response) => response.body.items.some((item: { source: { id: string } }) => item.source.id === monitorId),
      { timeout: 75_000 },
    );
    const incident = confirmed.body.items.find((item: { source: { id: string } }) => item.source.id === monitorId);
    expect(incident).toMatchObject({ status: "open", severity: "critical" });
    expect((await owner.get(`/monitors/${monitorId}`)).body.consecutiveFailures).toBeGreaterThanOrEqual(2);

    await owner.delete(`/monitors/${monitorId}`);
  });

  test("records who acknowledged and resolved an incident", async ({ ownerApi: owner, playwright }) => {
    const created = await owner.post("/monitors", {
      name: `Actors ${uniqueSuffix()}`,
      url: `${API_ORIGIN}/api/actors-missing`,
      method: "GET",
      intervalSeconds: 600,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      failureThreshold: 1,
      alertChannelIds: [],
    });
    const monitorId = created.body.id;
    const opened = await waitFor(
      () => owner.get("/incidents?status=open&pageSize=100"),
      (response) => response.body.items.some((item: { source: { id: string } }) => item.source.id === monitorId),
    );
    const incident = opened.body.items.find((item: { source: { id: string } }) => item.source.id === monitorId);

    const acknowledged = await owner.post(`/incidents/${incident.id}/acknowledge`);
    expect(acknowledged.body.acknowledgedBy).toMatchObject({ name: "Olivia Owner" });

    const request = await playwright.request.newContext();
    const admin = await ApiClient.signIn(request, demoUsers.admin);
    const resolved = await admin.post(`/incidents/${incident.id}/resolve`);
    expect(resolved.body).toMatchObject({
      status: "resolved",
      acknowledgedBy: { name: "Olivia Owner" },
      resolvedBy: { name: "Adam Admin" },
      resolutionReason: null,
    });
    await request.dispose();

    await owner.delete(`/monitors/${monitorId}`);
  });

  test("pausing resolves the incident, renaming updates it, and deleting keeps it", async ({ ownerApi: owner }) => {
    const created = await owner.post("/monitors", {
      name: `Paused ${uniqueSuffix()}`,
      url: `${API_ORIGIN}/api/missing-endpoint`,
      method: "GET",
      intervalSeconds: 30,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      failureThreshold: 1,
      alertChannelIds: [],
    });
    const monitorId = created.body.id;

    const opened = await waitFor(
      () => owner.get("/incidents?status=active&pageSize=100"),
      (response) => response.body.items.some((item: { source: { id: string } }) => item.source.id === monitorId),
    );
    const incidentId = opened.body.items.find((item: { source: { id: string } }) => item.source.id === monitorId).id;

    const paused = await owner.patch(`/monitors/${monitorId}`, { isPaused: true });
    expect(paused.body).toMatchObject({ isPaused: true, consecutiveFailures: 0 });
    expect((await owner.get(`/incidents/${incidentId}`)).body).toMatchObject({
      status: "resolved",
      resolvedBy: null,
      resolutionReason: "monitor_paused",
    });

    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const checksBefore = (await owner.get(`/monitors/${monitorId}/checks`)).body.total;

    await new Promise((resolve) => setTimeout(resolve, 6_000));
    const checksAfter = (await owner.get(`/monitors/${monitorId}/checks`)).body.total;
    expect(checksAfter).toBe(checksBefore);

    const newName = `Renamed ${uniqueSuffix()}`;
    await owner.patch(`/monitors/${monitorId}`, { name: newName });
    expect((await owner.get(`/incidents/${incidentId}`)).body.source.name).toBe(newName);

    expect((await owner.delete(`/monitors/${monitorId}`)).status).toBe(204);
    expect((await owner.get(`/monitors/${monitorId}`)).status).toBe(404);
    const kept = await owner.get(`/incidents/${incidentId}`);
    expect(kept.status).toBe(200);
    expect(kept.body).toMatchObject({
      status: "resolved",
      source: { id: monitorId, name: newName, isDeleted: true },
    });
  });

  test("deleting a monitor resolves its active incident and keeps it", async ({ ownerApi: owner }) => {
    const created = await owner.post("/monitors", {
      name: `Deleted ${uniqueSuffix()}`,
      url: `${API_ORIGIN}/api/deleted-missing`,
      method: "GET",
      intervalSeconds: 600,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      failureThreshold: 1,
      alertChannelIds: [],
    });
    const monitorId = created.body.id;
    const opened = await waitFor(
      () => owner.get("/incidents?status=active&pageSize=100"),
      (response) => response.body.items.some((item: { source: { id: string } }) => item.source.id === monitorId),
    );
    const incidentId = opened.body.items.find((item: { source: { id: string } }) => item.source.id === monitorId).id;

    expect((await owner.delete(`/monitors/${monitorId}`)).status).toBe(204);

    expect((await owner.get(`/incidents/${incidentId}`)).body).toMatchObject({
      status: "resolved",
      resolvedBy: null,
      resolutionReason: "source_deleted",
      source: { isDeleted: true },
    });
  });

  test("validation errors name the offending fields", async ({ ownerApi: owner }) => {

    const invalid = await owner.post("/monitors", {
      name: "",
      url: "ftp://example.com",
      method: "FETCH",
      intervalSeconds: 5,
      timeoutMs: 100,
      expectedStatusCode: 999,
      failureThreshold: 0,
      alertChannelIds: ["00000000-0000-4000-8000-000000000000"],
    });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.fieldErrors).toSorted()).toEqual(
      ["expectedStatusCode", "failureThreshold", "intervalSeconds", "method", "name", "timeoutMs", "url"].toSorted(),
    );

    const unknownChannel = await owner.post("/monitors", {
      name: "Valid",
      url: "https://example.com",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: ["00000000-0000-4000-8000-000000000000"],
    });
    expect(unknownChannel.status).toBe(400);
    expect(unknownChannel.body.error.fieldErrors).toEqual({ alertChannelIds: ["Unknown alert channel"] });

  });
});
