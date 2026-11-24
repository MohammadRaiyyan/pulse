import { expect, test } from "../../support/fixtures.ts";
import { uniqueSuffix, waitFor } from "../../support/api-client.ts";
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
      alertChannelIds: [sink.channelId],
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: "pending", lastCheckedAt: null, uptimePercent: null });
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
    expect(opened[0]).toMatchObject({ cause: "Expected HTTP 200, got 404", source: { type: "monitor", name } });

    const openedAlerts = await waitFor(sink.receivedAlerts, (alerts) =>
      alerts.some((alert: { event: string }) => alert.event === "incident.opened"),
    );
    expect(openedAlerts.find((alert: { event: string }) => alert.event === "incident.opened").incident.id).toBe(opened[0].id);

    const fixed = await owner.patch(`/monitors/${monitorId}`, { url: `${API_ORIGIN}/api/health` });
    expect(fixed.status).toBe(200);
    expect(fixed.body.alertChannelIds).toEqual([sink.channelId]);

    await waitFor(
      () => owner.get(`/incidents/${opened[0].id}`),
      (response) => response.body.status === "resolved",
      { timeout: 60_000 },
    );

    const recovered = await owner.get(`/monitors/${monitorId}`);
    expect(recovered.body.status).toBe("up");
    expect(recovered.body.uptimePercent).toBeGreaterThan(0);
    expect(recovered.body.uptimePercent).toBeLessThan(100);

    await waitFor(sink.receivedAlerts, (alerts) =>
      alerts.some((alert: { event: string }) => alert.event === "incident.resolved"),
    );

    const allIncidents = await owner.get("/incidents?pageSize=100");
    const forMonitor = allIncidents.body.items.filter((incident: { source: { id: string } }) => incident.source.id === monitorId);
    expect(forMonitor).toHaveLength(1);

  });

  test("paused monitors are not checked and renaming updates incident names", async ({ ownerApi: owner }) => {

    const created = await owner.post("/monitors", {
      name: `Paused ${uniqueSuffix()}`,
      url: `${API_ORIGIN}/api/missing-endpoint`,
      method: "GET",
      intervalSeconds: 30,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
    });
    const monitorId = created.body.id;

    await waitFor(() => owner.get(`/monitors/${monitorId}`), (response) => response.body.status === "down");
    await owner.patch(`/monitors/${monitorId}`, { isPaused: true });
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const checksBefore = (await owner.get(`/monitors/${monitorId}/checks`)).body.total;

    await new Promise((resolve) => setTimeout(resolve, 6_000));
    const checksAfter = (await owner.get(`/monitors/${monitorId}/checks`)).body.total;
    expect(checksAfter).toBe(checksBefore);

    const newName = `Renamed ${uniqueSuffix()}`;
    await owner.patch(`/monitors/${monitorId}`, { name: newName });
    const incidents = await owner.get("/incidents?pageSize=100");
    const incident = incidents.body.items.find((item: { source: { id: string } }) => item.source.id === monitorId);
    expect(incident.source.name).toBe(newName);

    expect((await owner.delete(`/monitors/${monitorId}`)).status).toBe(204);
    expect((await owner.get(`/monitors/${monitorId}`)).status).toBe(404);
    expect((await owner.get(`/incidents/${incident.id}`)).status).toBe(404);

  });

  test("validation errors name the offending fields", async ({ ownerApi: owner }) => {

    const invalid = await owner.post("/monitors", {
      name: "",
      url: "ftp://example.com",
      method: "FETCH",
      intervalSeconds: 5,
      timeoutMs: 100,
      expectedStatusCode: 999,
      alertChannelIds: ["00000000-0000-4000-8000-000000000000"],
    });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.fieldErrors).toSorted()).toEqual(
      ["expectedStatusCode", "intervalSeconds", "method", "name", "timeoutMs", "url"].toSorted(),
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
