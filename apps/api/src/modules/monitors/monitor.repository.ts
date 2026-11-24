import type {
  CheckOutcome,
  CreateMonitorInput,
  MonitorListQuery,
  UpdateMonitorInput,
} from "@pulse/contracts";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { type Transaction, db } from "../../db/client.ts";
import {
  checkResults,
  monitorDailyStats,
  monitorAlertChannels,
  monitors,
} from "../../models/index.ts";

export type CheckMeasurement = {
  outcome: CheckOutcome;
  statusCode: number | null;
  responseTimeMs: number;
  errorMessage: string | null;
};

const UPTIME_WINDOW_MS = 24 * 60 * 60 * 1000;

const buildListFilter = (query: MonitorListQuery) => {
  const search = query.search ? `%${query.search}%` : undefined;

  return and(
    query.status ? eq(monitors.status, query.status) : undefined,
    search
      ? or(ilike(monitors.name, search), ilike(monitors.url, search))
      : undefined,
  );
};

export const listMonitors = async (
  query: MonitorListQuery,
  limit: number,
  offset: number,
) => {
  const where = buildListFilter(query);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(monitors)
      .where(where)
      .orderBy(desc(monitors.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(monitors).where(where),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const findMonitor = async (id: string) => {
  const [monitor] = await db.select().from(monitors).where(eq(monitors.id, id));
  return monitor;
};

export const findChannelIdsByMonitorIds = async (monitorIds: string[]) => {
  const channelIdsByMonitor = new Map<string, string[]>();

  for (const monitorId of monitorIds) {
    channelIdsByMonitor.set(monitorId, []);
  }

  if (monitorIds.length === 0) {
    return channelIdsByMonitor;
  }

  const links = await db
    .select()
    .from(monitorAlertChannels)
    .where(inArray(monitorAlertChannels.monitorId, monitorIds));

  for (const link of links) {
    channelIdsByMonitor.get(link.monitorId)?.push(link.channelId);
  }

  return channelIdsByMonitor;
};

const replaceChannelLinks = async (
  tx: Transaction,
  monitorId: string,
  channelIds: string[],
) => {
  await tx
    .delete(monitorAlertChannels)
    .where(eq(monitorAlertChannels.monitorId, monitorId));

  if (channelIds.length > 0) {
    const uniqueIds = [...new Set(channelIds)];
    await tx
      .insert(monitorAlertChannels)
      .values(uniqueIds.map((channelId) => ({ monitorId, channelId })));
  }
};

export const insertMonitorWithinLimit = (
  input: CreateMonitorInput,
  maxMonitors: number,
) =>
  db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('monitors_limit'))`);

    const [existing] = await tx.select({ total: count() }).from(monitors);

    if ((existing?.total ?? 0) >= maxMonitors) {
      return undefined;
    }

    const { alertChannelIds, ...values } = input;
    const [monitor] = await tx.insert(monitors).values(values).returning();

    if (!monitor) {
      throw new Error("Failed to insert monitor");
    }

    await replaceChannelLinks(tx, monitor.id, alertChannelIds);

    return monitor;
  });

export const updateMonitor = (id: string, input: UpdateMonitorInput) =>
  db.transaction(async (tx) => {
    const { alertChannelIds, ...values } = input;
    const [monitor] = await tx
      .update(monitors)
      .set({
        ...values,
        ...(values.isPaused ? { consecutiveFailures: 0 } : {}),
        updatedAt: new Date(),
      })
      .where(eq(monitors.id, id))
      .returning();

    if (monitor && alertChannelIds) {
      await replaceChannelLinks(tx, id, alertChannelIds);
    }

    return monitor;
  });

export const deleteMonitor = async (id: string) => {
  const [monitor] = await db
    .delete(monitors)
    .where(eq(monitors.id, id))
    .returning({ id: monitors.id });
  return monitor;
};

export const findChannelIdsForMonitor = async (monitorId: string) => {
  const channelIds = await findChannelIdsByMonitorIds([monitorId]);
  return channelIds.get(monitorId) ?? [];
};

export const listChecks = async (
  monitorId: string,
  limit: number,
  offset: number,
) => {
  const where = eq(checkResults.monitorId, monitorId);

  const [rows, [totalRow]] = await Promise.all([
    db
      .select()
      .from(checkResults)
      .where(where)
      .orderBy(desc(checkResults.checkedAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: count() }).from(checkResults).where(where),
  ]);

  return { rows, total: totalRow?.total ?? 0 };
};

export const findDueMonitors = () =>
  db
    .select({ id: monitors.id, intervalSeconds: monitors.intervalSeconds })
    .from(monitors)
    .where(
      and(
        eq(monitors.isPaused, false),
        or(
          isNull(monitors.lastCheckedAt),
          lte(
            sql`${monitors.lastCheckedAt} + make_interval(secs => ${monitors.intervalSeconds})`,
            sql`now()`,
          ),
        ),
      ),
    );

export const saveCheckResult = (
  monitorId: string,
  measurement: CheckMeasurement,
) =>
  db.transaction(async (tx) => {
    const checkedAt = new Date();

    const [checked] = await tx
      .update(monitors)
      .set({
        status: measurement.outcome,
        lastCheckedAt: checkedAt,
        lastResponseTimeMs: measurement.responseTimeMs,
        consecutiveFailures:
          measurement.outcome === "up"
            ? 0
            : sql`${monitors.consecutiveFailures} + 1`,
      })
      .where(and(eq(monitors.id, monitorId), eq(monitors.isPaused, false)))
      .returning({ id: monitors.id });

    if (!checked) {
      return undefined;
    }

    await tx
      .insert(checkResults)
      .values({ monitorId, checkedAt, ...measurement });

    await tx
      .insert(monitorDailyStats)
      .values({
        monitorId,
        day: checkedAt.toISOString().slice(0, 10),
        checkCount: 1,
        downCount: measurement.outcome === "down" ? 1 : 0,
        degradedCount: measurement.outcome === "degraded" ? 1 : 0,
        totalResponseTimeMs: measurement.responseTimeMs,
      })
      .onConflictDoUpdate({
        target: [monitorDailyStats.monitorId, monitorDailyStats.day],
        set: {
          checkCount: sql`${monitorDailyStats.checkCount} + 1`,
          downCount: sql`${monitorDailyStats.downCount} + excluded.down_count`,
          degradedCount: sql`${monitorDailyStats.degradedCount} + excluded.degraded_count`,
          totalResponseTimeMs: sql`${monitorDailyStats.totalResponseTimeMs} + excluded.total_response_time_ms`,
        },
      });

    const [stats] = await tx
      .select({
        uptimePercent:
          sql<number>`100.0 * count(*) filter (where ${checkResults.outcome} <> 'down') / count(*)`.mapWith(
            Number,
          ),
      })
      .from(checkResults)
      .where(
        and(
          eq(checkResults.monitorId, monitorId),
          gte(
            checkResults.checkedAt,
            new Date(checkedAt.getTime() - UPTIME_WINDOW_MS),
          ),
        ),
      );

    const [monitor] = await tx
      .update(monitors)
      .set({ uptimePercent: stats?.uptimePercent ?? null })
      .where(eq(monitors.id, monitorId))
      .returning();

    return monitor;
  });

export const deleteChecksOlderThan = async (date: Date) => {
  await db.delete(checkResults).where(lt(checkResults.checkedAt, date));
};


export const rebuildDailyStats = (monitorIds?: string[]) =>
  db.transaction(async (tx) => {
    const forMonitors = monitorIds ? inArray(checkResults.monitorId, monitorIds) : undefined;

    await tx
      .delete(monitorDailyStats)
      .where(monitorIds ? inArray(monitorDailyStats.monitorId, monitorIds) : undefined);

    const day = sql<string>`(${checkResults.checkedAt} at time zone 'UTC')::date`;

    await tx.insert(monitorDailyStats).select(
      tx
        .select({
          monitorId: checkResults.monitorId,
          day: sql<string>`${day}`.as("day"),
          checkCount: sql<number>`count(*)::int`.as("check_count"),
          downCount: sql<number>`(count(*) filter (where ${checkResults.outcome} = 'down'))::int`.as("down_count"),
          degradedCount: sql<number>`(count(*) filter (where ${checkResults.outcome} = 'degraded'))::int`.as(
            "degraded_count",
          ),
          totalResponseTimeMs: sql<number>`sum(${checkResults.responseTimeMs})::bigint`.as("total_response_time_ms"),
        })
        .from(checkResults)
        .where(forMonitors)
        .groupBy(checkResults.monitorId, day),
    );
  });

export const deleteDailyStatsBefore = async (day: string) => {
  await db.delete(monitorDailyStats).where(lt(monitorDailyStats.day, day));
};
