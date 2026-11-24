import { count, ne, sql } from "drizzle-orm";
import { db } from "../../db/client.ts";
import { incidents, monitors, webhooks } from "../../models/index.ts";

export const countMonitorsByStatus = () =>
  db
    .select({ status: monitors.status, total: count() })
    .from(monitors)
    .groupBy(monitors.status);

export const countWebhooksByStatus = () =>
  db
    .select({ status: webhooks.status, total: count() })
    .from(webhooks)
    .groupBy(webhooks.status);

export const getActiveMonitorStats = async () => {
  const [stats] = await db
    .select({
      paused: sql<number>`count(*) filter (where ${monitors.isPaused})`.mapWith(
        Number,
      ),
      averageResponseTimeMs: sql<
        number | null
      >`round(avg(${monitors.lastResponseTimeMs}) filter (where not ${monitors.isPaused}))`.mapWith(
        (value) => (value === null ? null : Number(value)),
      ),
      uptimePercent: sql<
        number | null
      >`avg(${monitors.uptimePercent}) filter (where not ${monitors.isPaused})`.mapWith(
        (value) => (value === null ? null : Number(value)),
      ),
    })
    .from(monitors);

  return stats;
};

export const countActiveIncidents = async () => {
  const [result] = await db
    .select({
      open: sql<number>`count(*) filter (where ${incidents.status} = 'open')`.mapWith(
        Number,
      ),
      active: count(),
      critical:
        sql<number>`count(*) filter (where ${incidents.severity} = 'critical')`.mapWith(
          Number,
        ),
    })
    .from(incidents)
    .where(ne(incidents.status, "resolved"));

  return result ?? { open: 0, active: 0, critical: 0 };
};
