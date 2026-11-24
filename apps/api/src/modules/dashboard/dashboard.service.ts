import {
  type DashboardSummary,
  type MonitorStatus,
  type WebhookStatus,
  monitorStatusSchema,
  webhookStatusSchema,
} from "@pulse/contracts";
import { cacheKeys, cached } from "../../lib/cache.ts";
import {
  countMonitorsByStatus,
  countOpenIncidents,
  countWebhooksByStatus,
  getActiveMonitorStats,
} from "./dashboard.repository.ts";

const SUMMARY_CACHE_SECONDS = 30;

const tallyStatuses = <TStatus extends string>(
  statuses: readonly TStatus[],
  rows: { status: TStatus; total: number }[],
) => {
  const tally = {} as Record<TStatus, number>;

  for (const status of statuses) {
    tally[status] = 0;
  }

  for (const row of rows) {
    tally[row.status] = row.total;
  }

  return tally;
};

const sum = (rows: { total: number }[]) =>
  rows.reduce((total, row) => total + row.total, 0);

const buildSummary = async (): Promise<DashboardSummary> => {
  const [monitorRows, webhookRows, stats, openIncidents] = await Promise.all([
    countMonitorsByStatus(),
    countWebhooksByStatus(),
    getActiveMonitorStats(),
    countOpenIncidents(),
  ]);

  return {
    monitors: {
      total: sum(monitorRows),
      paused: stats?.paused ?? 0,
      byStatus: tallyStatuses<MonitorStatus>(
        monitorStatusSchema.options,
        monitorRows,
      ),
    },
    webhooks: {
      total: sum(webhookRows),
      byStatus: tallyStatuses<WebhookStatus>(
        webhookStatusSchema.options,
        webhookRows,
      ),
    },
    openIncidents,
    averageResponseTimeMs: stats?.averageResponseTimeMs ?? null,
    uptimePercent: stats?.uptimePercent ?? null,
  };
};

export const getDashboardSummary = () =>
  cached(cacheKeys.dashboardSummary, SUMMARY_CACHE_SECONDS, buildSummary);
