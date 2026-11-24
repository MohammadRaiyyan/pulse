import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.ts";
import { monitorDailyStats } from "../../models/index.ts";
import { insertMonitorWithinLimit, rebuildDailyStats, saveCheckResult } from "./monitor.repository.ts";

const createMonitor = async () => {
  const monitor = await insertMonitorWithinLimit(
    {
      name: "Rollup",
      url: "https://example.com",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      alertChannelIds: [],
    },
    100,
  );

  if (!monitor) {
    throw new Error("expected a monitor");
  }

  return monitor;
};

const statsFor = (monitorId: string) =>
  db.select().from(monitorDailyStats).where(eq(monitorDailyStats.monitorId, monitorId));

describe("daily stats", () => {
  it("rolls every check into one row per monitor per UTC day", async () => {
    const monitor = await createMonitor();

    await saveCheckResult(monitor.id, { outcome: "up", statusCode: 200, responseTimeMs: 100, errorMessage: null });
    await saveCheckResult(monitor.id, { outcome: "degraded", statusCode: 200, responseTimeMs: 300, errorMessage: "slow" });
    await saveCheckResult(monitor.id, { outcome: "down", statusCode: null, responseTimeMs: 50, errorMessage: "failed" });

    const [row] = await statsFor(monitor.id);

    expect(row).toMatchObject({
      day: new Date().toISOString().slice(0, 10),
      checkCount: 3,
      downCount: 1,
      degradedCount: 1,
      totalResponseTimeMs: 450,
    });
  });

  it("rebuilding from raw check results gives the same rollup", async () => {
    const monitor = await createMonitor();

    for (const outcome of ["up", "down", "up", "up"] as const) {
      await saveCheckResult(monitor.id, { outcome, statusCode: 200, responseTimeMs: 120, errorMessage: null });
    }

    const live = await statsFor(monitor.id);
    await rebuildDailyStats([monitor.id]);
    const rebuilt = await statsFor(monitor.id);

    expect(rebuilt).toEqual(live);
  });
});
