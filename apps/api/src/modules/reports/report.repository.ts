import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../db/client.ts";
import {
  incidents,
  monitorDailyStats,
  monitors,
  services,
} from "../../models/index.ts";

export type ReportWindow = {
  from: string;
  to: string;
  start: Date;
  end: Date;
  monitorId?: string;
};

const toNullableNumber = (value: unknown): number | null => Number(value);

const timestamp = (date: Date) => sql`${date.toISOString()}::timestamptz`;

const inDayRange = ({ from, to }: ReportWindow) =>
  and(gte(monitorDailyStats.day, from), lte(monitorDailyStats.day, to));

const overlapsWindow = (window: ReportWindow) =>
  and(
    sql`${incidents.startedAt} < ${timestamp(window.end)}`,
    or(
      isNull(incidents.resolvedAt),
      sql`${incidents.resolvedAt} >= ${timestamp(window.start)}`,
    ),
  );

const startedInWindow = (window: ReportWindow) =>
  sql`${incidents.startedAt} >= ${timestamp(window.start)} and ${incidents.startedAt} < ${timestamp(window.end)}`;

const clippedSeconds = (window: ReportWindow) =>
  sql`greatest(0, extract(epoch from (least(coalesce(${incidents.resolvedAt}, ${timestamp(window.end)}), ${timestamp(window.end)}) - greatest(${incidents.startedAt}, ${timestamp(window.start)}))))`;

const countsAsDowntime = sql`${incidents.severity} = 'critical' and ${incidents.sourceType} = 'monitor'`;

export const findReportMonitor = async (id: string) => {
  const [monitor] = await db
    .select({ id: monitors.id, name: monitors.name })
    .from(monitors)
    .where(eq(monitors.id, id));

  return monitor;
};

export const listMonitorTotals = (window: ReportWindow) => {
  const stats = db
    .select({
      monitorId: monitorDailyStats.monitorId,
      checks: sql`sum(${monitorDailyStats.checkCount})`.as("checks"),
      downChecks: sql`sum(${monitorDailyStats.downCount})`.as("down_checks"),
      degradedChecks: sql`sum(${monitorDailyStats.degradedCount})`.as(
        "degraded_checks",
      ),
      totalResponseTimeMs:
        sql`sum(${monitorDailyStats.totalResponseTimeMs})`.as(
          "total_response_time_ms",
        ),
    })
    .from(monitorDailyStats)
    .where(inDayRange(window))
    .groupBy(monitorDailyStats.monitorId)
    .as("stats");

  const outages = db
    .select({
      monitorId: sql`${incidents.sourceId}`.as("outage_monitor_id"),
      incidents: sql`count(*) filter (where ${startedInWindow(window)})`.as(
        "incident_count",
      ),
      downtimeSeconds:
        sql`coalesce(sum(${clippedSeconds(window)}) filter (where ${countsAsDowntime}), 0)`.as(
          "downtime_seconds",
        ),
    })
    .from(incidents)
    .where(and(eq(incidents.sourceType, "monitor"), overlapsWindow(window)))
    .groupBy(incidents.sourceId)
    .as("outages");

  return db
    .select({
      id: monitors.id,
      name: monitors.name,
      isPaused: monitors.isPaused,
      serviceId: monitors.serviceId,
      serviceName: services.name,
      checks: sql`coalesce(${stats.checks}, 0)`.mapWith(Number),
      downChecks: sql`coalesce(${stats.downChecks}, 0)`.mapWith(Number),
      degradedChecks: sql`coalesce(${stats.degradedChecks}, 0)`.mapWith(Number),
      totalResponseTimeMs:
        sql`coalesce(${stats.totalResponseTimeMs}, 0)`.mapWith(Number),
      incidents: sql`coalesce(${outages.incidents}, 0)`.mapWith(Number),
      downtimeSeconds: sql`coalesce(${outages.downtimeSeconds}, 0)`.mapWith(
        Number,
      ),
    })
    .from(monitors)
    .leftJoin(stats, eq(stats.monitorId, monitors.id))
    .leftJoin(outages, sql`${outages.monitorId} = ${monitors.id}`)
    .leftJoin(services, eq(services.id, monitors.serviceId))
    .where(window.monitorId ? eq(monitors.id, window.monitorId) : undefined)
    .orderBy(asc(monitors.name), asc(monitors.id));
};

export const listDailyTotals = (window: ReportWindow) =>
  db
    .select({
      day: monitorDailyStats.day,
      checks: sql`sum(${monitorDailyStats.checkCount})`.mapWith(Number),
      downChecks: sql`sum(${monitorDailyStats.downCount})`.mapWith(Number),
      totalResponseTimeMs:
        sql`sum(${monitorDailyStats.totalResponseTimeMs})`.mapWith(Number),
    })
    .from(monitorDailyStats)
    .where(
      and(
        inDayRange(window),
        window.monitorId
          ? eq(monitorDailyStats.monitorId, window.monitorId)
          : undefined,
      ),
    )
    .groupBy(monitorDailyStats.day)
    .orderBy(asc(monitorDailyStats.day));

export const getIncidentTotals = async (window: ReportWindow) => {
  const started = startedInWindow(window);

  const [totals] = await db
    .select({
      total: sql`count(*) filter (where ${started})`.mapWith(Number),
      critical:
        sql`count(*) filter (where ${started} and ${incidents.severity} = 'critical')`.mapWith(
          Number,
        ),
      warning:
        sql`count(*) filter (where ${started} and ${incidents.severity} = 'warning')`.mapWith(
          Number,
        ),
      mttaSeconds:
        sql`avg(extract(epoch from (${incidents.acknowledgedAt} - ${incidents.startedAt}))) filter (where ${started} and ${incidents.acknowledgedAt} is not null)`.mapWith(
          toNullableNumber,
        ),
      mttrSeconds:
        sql`avg(extract(epoch from (${incidents.resolvedAt} - ${incidents.startedAt}))) filter (where ${started} and ${incidents.resolvedAt} is not null and ${incidents.resolutionReason} is distinct from 'source_deleted')`.mapWith(
          toNullableNumber,
        ),
      downtimeSeconds:
        sql`coalesce(sum(${clippedSeconds(window)}) filter (where ${countsAsDowntime}), 0)`.mapWith(
          Number,
        ),
    })
    .from(incidents)
    .where(
      and(
        overlapsWindow(window),
        window.monitorId ? eq(incidents.sourceId, window.monitorId) : undefined,
      ),
    );

  return totals;
};
