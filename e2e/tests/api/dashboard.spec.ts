import { expect, test } from "../../support/fixtures.ts";
import { uniqueSuffix } from "../../support/api-client.ts";

test.describe("dashboard", () => {
  test("summary agrees with the underlying lists and updates immediately", async ({ ownerApi: owner }) => {

    const [summary, monitors, webhooks, openIncidents, activeIncidents, acknowledgedIncidents] = await Promise.all([
      owner.get("/dashboard/summary"),
      owner.get("/monitors?pageSize=100"),
      owner.get("/webhooks?pageSize=100"),
      owner.get("/incidents?status=open&pageSize=100"),
      owner.get("/incidents?status=active&pageSize=100"),
      owner.get("/incidents?status=acknowledged&pageSize=100"),
    ]);

    expect(summary.body.monitors.total).toBe(monitors.body.total);
    expect(summary.body.monitors.paused).toBe(monitors.body.items.filter((item: { isPaused: boolean }) => item.isPaused).length);
    for (const status of ["up", "down", "degraded", "pending"]) {
      expect(summary.body.monitors.byStatus[status]).toBe(
        monitors.body.items.filter((item: { status: string }) => item.status === status).length,
      );
    }
    expect(summary.body.webhooks.total).toBe(webhooks.body.total);
    expect(summary.body.openIncidents).toBe(openIncidents.body.total);
    expect(summary.body.activeIncidents).toBe(activeIncidents.body.total);
    expect(activeIncidents.body.total).toBe(openIncidents.body.total + acknowledgedIncidents.body.total);
    expect(summary.body.criticalIncidents).toBe(
      activeIncidents.body.items.filter((item: { severity: string }) => item.severity === "critical").length,
    );

    const created = await owner.post("/monitors", {
      name: `Dashboard ${uniqueSuffix()}`,
      url: "https://example.com",
      method: "GET",
      intervalSeconds: 600,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
    });
    await owner.patch(`/monitors/${created.body.id}`, { isPaused: true });

    const after = await owner.get("/dashboard/summary");
    expect(after.body.monitors.total).toBe(summary.body.monitors.total + 1);
    expect(after.body.monitors.paused).toBe(summary.body.monitors.paused + 1);

    await owner.delete(`/monitors/${created.body.id}`);
  });
});
