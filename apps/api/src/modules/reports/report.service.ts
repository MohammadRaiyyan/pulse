import {
  type Report,
  type ReportMonitor,
  type ReportQuery,
  reportCsvFilename,
} from "@pulse/contracts";
import { type CsvValue, neutralizeFormula, toCsv } from "../../lib/csv.ts";
import { notFound } from "../../lib/errors.ts";
import {
  averageResponseTime,
  fillDailySeries,
  groupByService,
  resolveReportRange,
  slaStatus,
  uptimePercent,
} from "./report-math.ts";
import {
  findReportMonitor,
  getIncidentTotals,
  listDailyTotals,
  listMonitorTotals,
} from "./report.repository.ts";

const sumOf = <TRow>(rows: readonly TRow[], pick: (row: TRow) => number) =>
  rows.reduce((total, row) => total + pick(row), 0);

const findMonitorOrThrow = async (monitorId: string | undefined) => {
  if (!monitorId) {
    return null;
  }

  const monitor = await findReportMonitor(monitorId);

  if (!monitor) {
    throw notFound("Monitor");
  }

  return monitor;
};

export const buildReport = async (
  query: ReportQuery,
  now = new Date(),
): Promise<Report> => {
  const { start, end, ...range } = resolveReportRange(query, now);
  const monitor = await findMonitorOrThrow(query.monitorId);
  const window = {
    from: range.from,
    to: range.to,
    start,
    end,
    monitorId: query.monitorId,
  };

  const [monitorRows, dailyRows, incidentTotals] = await Promise.all([
    listMonitorTotals(window),
    listDailyTotals(window),
    getIncidentTotals(window),
  ]);

  const monitors: ReportMonitor[] = monitorRows.map(
    ({ totalResponseTimeMs, ...row }) => {
      const percent = uptimePercent(row.checks, row.downChecks);

      return {
        ...row,
        uptimePercent: percent,
        averageResponseTimeMs: averageResponseTime(
          row.checks,
          totalResponseTimeMs,
        ),
        slaStatus: slaStatus(percent, query.slaTarget),
      };
    },
  );

  const checks = sumOf(monitorRows, (row) => row.checks);
  const downChecks = sumOf(monitorRows, (row) => row.downChecks);
  const overallUptime = uptimePercent(checks, downChecks);

  return {
    range,
    slaTarget: query.slaTarget,
    monitor,
    summary: {
      uptimePercent: overallUptime,
      averageResponseTimeMs: averageResponseTime(
        checks,
        sumOf(monitorRows, (row) => row.totalResponseTimeMs),
      ),
      checks,
      downChecks,
      degradedChecks: sumOf(monitorRows, (row) => row.degradedChecks),
      incidents: {
        total: incidentTotals?.total ?? 0,
        critical: incidentTotals?.critical ?? 0,
        warning: incidentTotals?.warning ?? 0,
      },
      mttaSeconds: incidentTotals?.mttaSeconds ?? null,
      mttrSeconds: incidentTotals?.mttrSeconds ?? null,
      downtimeSeconds: incidentTotals?.downtimeSeconds ?? 0,
      slaStatus: slaStatus(overallUptime, query.slaTarget),
    },
    monitors,
    services: query.monitorId ? [] : groupByService(monitors, query.slaTarget),
    daily: fillDailySeries(range, dailyRows),
    generatedAt: now.toISOString(),
  };
};

const CSV_HEADER = [
  "Monitor ID",
  "Monitor",
  "Service",
  "From",
  "To",
  "Uptime %",
  "SLA target %",
  "SLA status",
  "Avg response time (ms)",
  "Checks",
  "Down checks",
  "Degraded checks",
  "Incidents",
  "Downtime (seconds)",
];

const formatPercent = (percent: number | null) =>
  percent === null ? null : percent.toFixed(3);

export const buildReportCsv = async (query: ReportQuery, now = new Date()) => {
  const report = await buildReport(query, now);
  const rows: CsvValue[][] = report.monitors.map((monitor) => [
    monitor.id,
    neutralizeFormula(monitor.name),
    monitor.serviceName === null
      ? null
      : neutralizeFormula(monitor.serviceName),
    report.range.from,
    report.range.to,
    formatPercent(monitor.uptimePercent),
    report.slaTarget,
    monitor.slaStatus,
    monitor.averageResponseTimeMs,
    monitor.checks,
    monitor.downChecks,
    monitor.degradedChecks,
    monitor.incidents,
    Math.round(monitor.downtimeSeconds),
  ]);

  return {
    filename: reportCsvFilename(report.range),
    body: toCsv([CSV_HEADER, ...rows]),
  };
};
