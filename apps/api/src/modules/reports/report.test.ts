import { reportQuerySchema } from "@pulse/contracts";
import { describe, expect, it } from "vitest";
import { db } from "../../db/client.ts";
import { AppError } from "../../lib/errors.ts";
import {
  incidents,
  monitorDailyStats,
  monitors,
  services,
} from "../../models/index.ts";
import {
  registerUser,
  request,
  sendRaw,
  signInWithRole,
  useTestServer,
} from "../../test/client.ts";
import {
  addDays,
  groupByService,
  resolveReportRange,
  slaStatus,
  toDay,
  uptimePercent,
} from "./report-math.ts";
import { buildReport, buildReportCsv } from "./report.service.ts";

useTestServer();

const NOW = new Date("2026-03-15T12:00:00.000Z");

const query = (overrides: Record<string, unknown> = {}) =>
  reportQuerySchema.parse({ range: "7d", ...overrides });

const at = (iso: string) => new Date(iso);

const insertService = async (name: string) => {
  const [service] = await db
    .insert(services)
    .values({ name: `${name} ${crypto.randomUUID()}` })
    .returning();

  if (!service) {
    throw new Error("expected a service");
  }

  return service;
};

const insertMonitor = async (name: string, serviceId: string | null = null) => {
  const [monitor] = await db
    .insert(monitors)
    .values({
      name,
      url: "https://example.com",
      method: "GET",
      intervalSeconds: 60,
      timeoutMs: 5000,
      expectedStatusCode: 200,
      serviceId,
    })
    .returning();

  if (!monitor) {
    throw new Error("expected a monitor");
  }

  return monitor;
};

const monitorSource = (monitor: { id: string; name: string }) => ({
  sourceType: "monitor" as const,
  sourceId: monitor.id,
  sourceName: monitor.name,
  cause: "test",
});

const seedFixture = async () => {
  const service = await insertService("Checkout");
  const alpha = await insertMonitor("Alpha", service.id);
  const beta = await insertMonitor("Beta", service.id);
  const gamma = await insertMonitor("Gamma");

  await db.insert(monitorDailyStats).values([
    {
      monitorId: alpha.id,
      day: "2026-03-14",
      checkCount: 1000,
      downCount: 10,
      degradedCount: 5,
      totalResponseTimeMs: 100_000,
    },
    {
      monitorId: alpha.id,
      day: "2026-03-15",
      checkCount: 1000,
      downCount: 0,
      degradedCount: 0,
      totalResponseTimeMs: 300_000,
    },
    {
      monitorId: alpha.id,
      day: "2026-03-01",
      checkCount: 500,
      downCount: 500,
      degradedCount: 0,
      totalResponseTimeMs: 50_000,
    },
    {
      monitorId: beta.id,
      day: "2026-03-14",
      checkCount: 100,
      downCount: 50,
      degradedCount: 0,
      totalResponseTimeMs: 20_000,
    },
  ]);

  await db.insert(incidents).values([
    {
      ...monitorSource(alpha),
      status: "resolved",
      severity: "critical",
      startedAt: at("2026-03-08T22:00:00Z"),
      resolvedAt: at("2026-03-09T02:00:00Z"),
      resolutionReason: "recovered",
    },
    {
      ...monitorSource(alpha),
      status: "resolved",
      severity: "critical",
      startedAt: at("2026-03-14T10:00:00Z"),
      acknowledgedAt: at("2026-03-14T10:05:00Z"),
      resolvedAt: at("2026-03-14T11:00:00Z"),
      resolutionReason: "recovered",
    },
    {
      ...monitorSource(beta),
      status: "resolved",
      severity: "warning",
      startedAt: at("2026-03-14T09:00:00Z"),
      acknowledgedAt: at("2026-03-14T09:15:00Z"),
      resolvedAt: at("2026-03-14T09:30:00Z"),
      resolutionReason: "recovered",
    },
    {
      ...monitorSource(beta),
      status: "open",
      severity: "critical",
      startedAt: at("2026-03-15T11:30:00Z"),
    },
    {
      sourceType: "webhook",
      sourceId: crypto.randomUUID(),
      sourceName: "Deploys",
      cause: "silent",
      status: "resolved",
      severity: "critical",
      startedAt: at("2026-03-13T00:00:00Z"),
      resolvedAt: at("2026-03-13T01:00:00Z"),
      resolutionReason: "recovered",
    },
    {
      sourceType: "monitor",
      sourceId: crypto.randomUUID(),
      sourceName: "Deleted monitor",
      sourceDeletedAt: at("2026-03-12T05:00:00Z"),
      cause: "test",
      status: "resolved",
      severity: "critical",
      startedAt: at("2026-03-12T00:00:00Z"),
      resolvedAt: at("2026-03-12T05:00:00Z"),
      resolutionReason: "source_deleted",
    },
    {
      ...monitorSource(gamma),
      status: "resolved",
      severity: "critical",
      startedAt: at("2026-03-01T00:00:00Z"),
      resolvedAt: at("2026-03-01T01:00:00Z"),
      resolutionReason: "recovered",
    },
  ]);

  return { service, alpha, beta, gamma };
};

describe("report range", () => {
  it("resolves presets to the last N UTC days including today", () => {
    expect(resolveReportRange({ range: "7d" }, NOW)).toMatchObject({
      preset: "7d",
      from: "2026-03-09",
      to: "2026-03-15",
      days: 7,
      start: at("2026-03-09T00:00:00Z"),
      end: NOW,
    });
    expect(resolveReportRange({ range: "30d" }, NOW).from).toBe("2026-02-14");
    expect(resolveReportRange({ range: "90d" }, NOW).days).toBe(90);
  });

  it("ends a past custom range at midnight after its last day", () => {
    expect(
      resolveReportRange(
        { range: "custom", from: "2026-03-01", to: "2026-03-02" },
        NOW,
      ),
    ).toMatchObject({
      days: 2,
      start: at("2026-03-01T00:00:00Z"),
      end: at("2026-03-03T00:00:00Z"),
    });
  });

  it("accepts exactly 400 days and rejects anything older or in the future", () => {
    const earliest = addDays("2026-03-15", -399);

    expect(
      resolveReportRange(
        { range: "custom", from: earliest, to: "2026-03-15" },
        NOW,
      ).days,
    ).toBe(400);
    expect(() =>
      resolveReportRange(
        { range: "custom", from: addDays(earliest, -1), to: "2026-03-15" },
        NOW,
      ),
    ).toThrow(AppError);
    expect(() =>
      resolveReportRange(
        { range: "custom", from: "2026-03-10", to: "2026-03-16" },
        NOW,
      ),
    ).toThrow("Invalid report range");
  });

  it("rejects bad query parameters with field errors", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const today = toDay(new Date());

    const missing = await request("/api/reports?range=custom", { token });
    expect(missing.status).toBe(400);
    expect(Object.keys(missing.body.error.fieldErrors).toSorted()).toEqual([
      "from",
      "to",
    ]);

    const reversed = await request(
      `/api/reports?range=custom&from=${today}&to=${addDays(today, -3)}`,
      { token },
    );
    expect(reversed.status).toBe(400);
    expect(reversed.body.error.fieldErrors.to).toBeDefined();

    const future = await request(
      `/api/reports?range=custom&from=${today}&to=${addDays(today, 1)}`,
      { token },
    );
    expect(future.status).toBe(400);
    expect(future.body.error.fieldErrors.to).toEqual([
      "The end date cannot be in the future",
    ]);

    const tooOld = await request(
      `/api/reports?range=custom&from=${addDays(today, -400)}&to=${today}`,
      { token },
    );
    expect(tooOld.status).toBe(400);
    expect(tooOld.body.error.fieldErrors.from).toBeDefined();

    for (const bad of [
      "range=14d",
      "from=2026-13-01&range=custom&to=2026-01-01",
      "slaTarget=101",
      "slaTarget=abc",
    ]) {
      expect((await request(`/api/reports?${bad}`, { token })).status).toBe(
        400,
      );
    }

    const unknown = await request(
      `/api/reports?monitorId=${crypto.randomUUID()}`,
      { token },
    );
    expect(unknown.status).toBe(404);
  });
});

describe("report math", () => {
  it("treats degraded checks as up and returns null without checks", () => {
    expect(uptimePercent(0, 0)).toBeNull();
    expect(uptimePercent(1000, 1)).toBe(99.9);
    expect(uptimePercent(3, 3)).toBe(0);
    expect(slaStatus(99.9, 99.9)).toBe("met");
    expect(slaStatus(99.89, 99.9)).toBe("breached");
    expect(slaStatus(null, 99.9)).toBe("no_data");
  });

  it("weights service uptime by checks, not by monitor", () => {
    const [service] = groupByService(
      [
        { serviceId: "s1", serviceName: "API", checks: 900, downChecks: 0 },
        { serviceId: "s1", serviceName: "API", checks: 100, downChecks: 100 },
        { serviceId: null, serviceName: null, checks: 50, downChecks: 50 },
      ],
      99,
    );

    expect(service).toEqual({
      id: "s1",
      name: "API",
      monitorCount: 2,
      checks: 1000,
      downChecks: 100,
      uptimePercent: 90,
      slaStatus: "breached",
    });
  });

  it("adds up the workspace from daily stats and incidents", async () => {
    const { service, alpha, beta, gamma } = await seedFixture();

    const report = await buildReport(query({ slaTarget: 99.5 }), NOW);

    expect(report.range).toEqual({
      preset: "7d",
      from: "2026-03-09",
      to: "2026-03-15",
      days: 7,
    });
    expect(report.summary).toEqual({
      uptimePercent: (2040 * 100) / 2100,
      averageResponseTimeMs: 200,
      checks: 2100,
      downChecks: 60,
      degradedChecks: 5,
      incidents: { total: 5, critical: 4, warning: 1 },
      mttaSeconds: 600,
      mttrSeconds: 3000,
      downtimeSeconds: 7200 + 3600 + 1800 + 18_000,
      slaStatus: "breached",
    });

    expect(report.monitors).toEqual([
      {
        id: alpha.id,
        name: "Alpha",
        isPaused: false,
        serviceId: service.id,
        serviceName: service.name,
        uptimePercent: 99.5,
        averageResponseTimeMs: 200,
        checks: 2000,
        downChecks: 10,
        degradedChecks: 5,
        incidents: 1,
        downtimeSeconds: 10_800,
        slaStatus: "met",
      },
      {
        id: beta.id,
        name: "Beta",
        isPaused: false,
        serviceId: service.id,
        serviceName: service.name,
        uptimePercent: 50,
        averageResponseTimeMs: 200,
        checks: 100,
        downChecks: 50,
        degradedChecks: 0,
        incidents: 2,
        downtimeSeconds: 1800,
        slaStatus: "breached",
      },
      {
        id: gamma.id,
        name: "Gamma",
        isPaused: false,
        serviceId: null,
        serviceName: null,
        uptimePercent: null,
        averageResponseTimeMs: null,
        checks: 0,
        downChecks: 0,
        degradedChecks: 0,
        incidents: 0,
        downtimeSeconds: 0,
        slaStatus: "no_data",
      },
    ]);

    expect(report.services).toEqual([
      {
        id: service.id,
        name: service.name,
        monitorCount: 2,
        checks: 2100,
        downChecks: 60,
        uptimePercent: (2040 * 100) / 2100,
        slaStatus: "breached",
      },
    ]);

    expect(report.daily).toHaveLength(7);
    expect(report.daily[0]).toEqual({
      day: "2026-03-09",
      checks: 0,
      downChecks: 0,
      uptimePercent: null,
      averageResponseTimeMs: null,
    });
    expect(report.daily.slice(-2)).toEqual([
      {
        day: "2026-03-14",
        checks: 1100,
        downChecks: 60,
        uptimePercent: (1040 * 100) / 1100,
        averageResponseTimeMs: 109,
      },
      {
        day: "2026-03-15",
        checks: 1000,
        downChecks: 0,
        uptimePercent: 100,
        averageResponseTimeMs: 300,
      },
    ]);
  });

  it("narrows every number to one monitor", async () => {
    const { alpha } = await seedFixture();

    const report = await buildReport(query({ monitorId: alpha.id }), NOW);

    expect(report.monitor).toEqual({ id: alpha.id, name: "Alpha" });
    expect(report.monitors.map((monitor) => monitor.id)).toEqual([alpha.id]);
    expect(report.services).toEqual([]);
    expect(report.summary).toMatchObject({
      checks: 2000,
      uptimePercent: 99.5,
      incidents: { total: 1, critical: 1, warning: 0 },
      mttaSeconds: 300,
      mttrSeconds: 3600,
      downtimeSeconds: 10_800,
    });
    expect(report.daily.at(-2)).toMatchObject({ checks: 1000, downChecks: 10 });
  });

  it("clips downtime to a past custom range and counts open incidents up to now", async () => {
    await seedFixture();

    const past = await buildReport(
      query({ range: "custom", from: "2026-03-01", to: "2026-03-09" }),
      NOW,
    );
    expect(past.summary.downtimeSeconds).toBe(3600 + 4 * 3600);
    expect(past.summary.incidents.total).toBe(2);
    expect(past.summary.uptimePercent).toBe(0);

    const today = await buildReport(
      query({ range: "custom", from: "2026-03-15", to: "2026-03-15" }),
      NOW,
    );
    expect(today.summary.downtimeSeconds).toBe(1800);
    expect(today.summary.mttaSeconds).toBeNull();
    expect(today.summary.mttrSeconds).toBeNull();
  });
});

describe("report endpoints", () => {
  it("lets a viewer read the report and export, and rejects anonymous calls", async () => {
    await registerUser("Owner", "owner@test.dev");
    const viewer = await signInWithRole("viewer", "viewer@test.dev");

    const report = await request("/api/reports", { token: viewer.token });
    expect(report.status).toBe(200);
    expect(report.body.range).toMatchObject({ preset: "30d", days: 30 });
    expect(report.body.slaTarget).toBe(99.9);
    expect(report.body.daily).toHaveLength(30);

    const csv = await sendRaw("/api/reports/export?range=7d", {
      headers: { Authorization: `Bearer ${viewer.token}` },
    });
    expect(csv.status).toBe(200);

    expect((await request("/api/reports")).status).toBe(401);
    expect((await sendRaw("/api/reports/export", {})).status).toBe(401);
  });

  it("downloads the per-monitor rows as an RFC 4180 CSV attachment", async () => {
    const { token } = await registerUser("Owner", "owner@test.dev");
    const service = await insertService("=Payments");
    const tricky = await insertMonitor('Edge, "quoted"\nname', service.id);
    await insertMonitor("Zulu");

    const today = toDay(new Date());
    const from = addDays(today, -6);
    await db.insert(monitorDailyStats).values({
      monitorId: tricky.id,
      day: today,
      checkCount: 3,
      downCount: 1,
      degradedCount: 1,
      totalResponseTimeMs: 300,
    });

    const response = await sendRaw(
      "/api/reports/export?range=7d&slaTarget=99",
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    expect(response.headers.get("content-type")).toBe(
      "text/csv; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      `attachment; filename=pulse-report-${from}-${today}.csv`,
    );

    const body = await response.text();
    const lines = body.split("\r\n");

    expect(body.endsWith("\r\n")).toBe(true);
    expect(lines[0]).toBe(
      "Monitor ID,Monitor,Service,From,To,Uptime %,SLA target %,SLA status,Avg response time (ms),Checks,Down checks,Degraded checks,Incidents,Downtime (seconds)",
    );
    expect(lines[1]).toBe(
      `${tricky.id},"Edge, ""quoted""\nname",'${service.name},${from},${today},66.667,99,breached,100,3,1,1,0,0`,
    );
    expect(lines[2]).toMatch(
      new RegExp(`,Zulu,,${from},${today},,99,no_data,,0,0,0,0,0$`),
    );
    expect(lines).toHaveLength(4);

    const direct = await buildReportCsv(query());
    expect(direct.filename).toBe(`pulse-report-${from}-${today}.csv`);
  });
});
