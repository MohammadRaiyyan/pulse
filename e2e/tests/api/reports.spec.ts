import { ApiClient, demoUsers } from "../../support/api-client.ts";
import { API_ORIGIN } from "../../support/environment.ts";
import { expect, test } from "../../support/fixtures.ts";

const DAY_MS = 86_400_000;

const isoDaysAgo = (days: number) => new Date(Date.now() - days * DAY_MS).toISOString().slice(0, 10);

const seededMonitors = [
  { name: "Public API", intervalSeconds: 60, baseResponseMs: 120 },
  { name: "Payments service", intervalSeconds: 30, baseResponseMs: 850 },
  { name: "Legacy SOAP gateway", intervalSeconds: 300, baseResponseMs: 2_400 },
  { name: "Docs site", intervalSeconds: 600, baseResponseMs: 60 },
];

const FIRST_DAY_BACK = 2;
const LAST_DAY_BACK = 89;
const from = isoDaysAgo(LAST_DAY_BACK);
const to = isoDaysAgo(FIRST_DAY_BACK);

const historyNoise = (day: number, salt: number) => {
  const value = Math.sin(day * 12.9898 + salt * 78.233) * 43_758.5453;
  return value - Math.floor(value);
};

const dailyResponseFactor = (day: number, monitorIndex: number, isSlow: boolean) =>
  0.85 + historyNoise(day, monitorIndex + 30) * 0.3 + Math.sin(day / 9) * 0.12 + (isSlow ? 0.5 : 0);

const expectedHistory = (monitorIndex: number) => {
  const seed = seededMonitors[monitorIndex]!;
  const perDay = Math.round(86_400 / seed.intervalSeconds);
  let checks = 0;
  let downChecks = 0;
  let degradedChecks = 0;
  let totalResponseTimeMs = 0;

  for (let daysBack = FIRST_DAY_BACK; daysBack <= LAST_DAY_BACK; daysBack += 1) {
    checks += perDay;

    const isSlow = historyNoise(daysBack, monitorIndex + 20) < 0.08;

    if (historyNoise(daysBack, monitorIndex) < 0.05) {
      downChecks += Math.max(1, Math.round(perDay * (0.01 + historyNoise(daysBack, monitorIndex + 10) * 0.04)));
    }

    if (isSlow) {
      degradedChecks += Math.round(perDay * 0.08);
    }

    totalResponseTimeMs += Math.round(perDay * seed.baseResponseMs * dailyResponseFactor(daysBack, monitorIndex, isSlow));
  }

  return {
    checks,
    downChecks,
    degradedChecks,
    averageResponseTimeMs: Math.round(totalResponseTimeMs / checks),
    uptimePercent: ((checks - downChecks) * 100) / checks,
  };
};

test.describe("reports", () => {
  test("numbers match the seeded daily history for past days", async ({ ownerApi: owner }) => {
    const response = await owner.get(`/reports?range=custom&from=${from}&to=${to}&slaTarget=99.9`);
    expect(response.status).toBe(200);

    const report = response.body;
    expect(report.range).toEqual({ preset: "custom", from, to, days: LAST_DAY_BACK - FIRST_DAY_BACK + 1 });
    expect(report.daily).toHaveLength(report.range.days);

    let totalChecks = 0;
    let totalDown = 0;

    seededMonitors.forEach((seed, index) => {
      const expected = expectedHistory(index);
      const row = report.monitors.find((monitor: { name: string }) => monitor.name === seed.name);

      expect(row, seed.name).toMatchObject({
        checks: expected.checks,
        downChecks: expected.downChecks,
        degradedChecks: expected.degradedChecks,
        averageResponseTimeMs: expected.averageResponseTimeMs,
        slaStatus: expected.uptimePercent >= 99.9 ? "met" : "breached",
      });
      expect(row.uptimePercent).toBeCloseTo(expected.uptimePercent, 9);

      totalChecks += expected.checks;
      totalDown += expected.downChecks;
    });

    expect(report.summary.checks).toBe(totalChecks);
    expect(report.summary.downChecks).toBe(totalDown);
    expect(report.summary.uptimePercent).toBeCloseTo(((totalChecks - totalDown) * 100) / totalChecks, 9);
    expect(report.daily.reduce((sum: number, day: { checks: number }) => sum + day.checks, 0)).toBe(totalChecks);
    expect(report.daily.every((day: { checks: number }) => day.checks > 0)).toBe(true);
  });

  test("presets cover the last N UTC days and count the seeded incidents", async ({ ownerApi: owner }) => {
    const [week, month, quarter] = await Promise.all(
      ["7d", "30d", "90d"].map((range) => owner.get(`/reports?range=${range}`)),
    );

    expect(week.body.range).toMatchObject({ preset: "7d", to: isoDaysAgo(0), from: isoDaysAgo(6), days: 7 });
    expect(month.body.daily).toHaveLength(30);
    expect(quarter.body.daily).toHaveLength(90);
    expect(week.body.summary.checks).toBeLessThanOrEqual(month.body.summary.checks);
    expect(month.body.summary.checks).toBeLessThanOrEqual(quarter.body.summary.checks);

    expect(week.body.summary.incidents.total).toBeGreaterThanOrEqual(5);
    expect(week.body.summary.mttaSeconds).toBeGreaterThan(0);
    expect(week.body.summary.mttrSeconds).toBeGreaterThan(0);
    expect(week.body.summary.downtimeSeconds).toBeGreaterThan(0);
  });

  test("a single-monitor report matches its row in the workspace report", async ({ ownerApi: owner }) => {
    const workspace = await owner.get(`/reports?range=custom&from=${from}&to=${to}`);
    const row = workspace.body.monitors.find((monitor: { name: string }) => monitor.name === "Public API");

    const single = await owner.get(`/reports?range=custom&from=${from}&to=${to}&monitorId=${row.id}`);
    expect(single.body.monitor).toEqual({ id: row.id, name: "Public API" });
    expect(single.body.monitors).toEqual([row]);
    expect(single.body.summary).toMatchObject({ checks: row.checks, uptimePercent: row.uptimePercent });
  });

  test("rejects ranges outside the last 400 days and lets a viewer read", async ({ ownerApi: owner, playwright }) => {
    const tooOld = await owner.get(`/reports?range=custom&from=${isoDaysAgo(400)}&to=${isoDaysAgo(0)}`);
    expect(tooOld.status).toBe(400);
    expect(tooOld.body.error.fieldErrors.from).toBeDefined();

    const request = await playwright.request.newContext();
    const viewer = await ApiClient.signIn(request, demoUsers.viewer);
    expect((await viewer.get("/reports?range=7d")).status).toBe(200);
    await request.dispose();
  });

  test("exports per-monitor rows as a CSV attachment", async ({ ownerApi: owner }) => {
    const response = await owner.request.get(
      `${API_ORIGIN}/api/reports/export?range=custom&from=${from}&to=${to}&slaTarget=99.9`,
      { headers: { Authorization: `Bearer ${owner.token}` } },
    );

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toBe("text/csv; charset=utf-8");
    expect(response.headers()["content-disposition"]).toBe(`attachment; filename=pulse-report-${from}-${to}.csv`);

    const lines = (await response.text()).split("\r\n");
    expect(lines[0]).toBe(
      "Monitor ID,Monitor,Service,From,To,Uptime %,SLA target %,SLA status,Avg response time (ms),Checks,Down checks,Degraded checks,Incidents,Downtime (seconds)",
    );

    const expected = expectedHistory(0);
    const publicApi = lines.find((line) => line.includes(",Public API,"));
    expect(publicApi?.split(",").slice(3, 12)).toEqual([
      from,
      to,
      expected.uptimePercent.toFixed(3),
      "99.9",
      expected.uptimePercent >= 99.9 ? "met" : "breached",
      String(expected.averageResponseTimeMs),
      String(expected.checks),
      String(expected.downChecks),
      String(expected.degradedChecks),
    ]);
  });
});
