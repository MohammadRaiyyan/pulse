import {
  type MonitorStatus,
  type OverallStatus,
  type ServiceStatus,
  type UptimeHistory,
  UPTIME_HISTORY_DAYS,
  type WebhookStatus,
} from "@pulse/contracts";

export type MemberState = {
  status: MonitorStatus | WebhookStatus;
  isPaused: boolean;
};

export type DailyCounts = {
  day: string;
  checkCount: number;
  downCount: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const memberStatus: Record<MonitorStatus | WebhookStatus, ServiceStatus> = {
  up: "up",
  active: "up",
  pending: "pending",
  degraded: "degraded",
  silent: "degraded",
  down: "down",
};

const severityRank: Record<ServiceStatus, number> = {
  no_data: 0,
  up: 1,
  pending: 2,
  degraded: 3,
  down: 4,
};

export const deriveServiceStatus = (
  members: readonly MemberState[],
): ServiceStatus =>
  members
    .filter((member) => !member.isPaused)
    .map((member) => memberStatus[member.status])
    .reduce<ServiceStatus>(
      (worst, status) =>
        severityRank[status] > severityRank[worst] ? status : worst,
      "no_data",
    );

export const deriveOverallStatus = (
  statuses: readonly ServiceStatus[],
): OverallStatus => {
  const reporting = statuses.filter((status) => status !== "no_data");
  const downCount = reporting.filter((status) => status === "down").length;

  if (downCount > 0) {
    return downCount === reporting.length ? "major_outage" : "partial_outage";
  }

  return reporting.includes("degraded") ? "degraded" : "operational";
};

const toPercent = (checkCount: number, downCount: number) =>
  checkCount > 0
    ? Math.floor((1 - downCount / checkCount) * 10_000) / 100
    : null;

const toIsoDay = (date: Date) => date.toISOString().slice(0, 10);

export const historyStartDay = (now: Date) =>
  toIsoDay(new Date(now.getTime() - (UPTIME_HISTORY_DAYS - 1) * DAY_MS));

export const buildUptimeHistory = (
  counts: readonly DailyCounts[],
  now: Date,
): UptimeHistory => {
  const countsByDay = new Map(counts.map((row) => [row.day, row]));
  let totalChecks = 0;
  let totalDown = 0;

  const days = Array.from({ length: UPTIME_HISTORY_DAYS }, (_, index) => {
    const date = toIsoDay(
      new Date(now.getTime() - (UPTIME_HISTORY_DAYS - 1 - index) * DAY_MS),
    );
    const row = countsByDay.get(date);
    totalChecks += row?.checkCount ?? 0;
    totalDown += row?.downCount ?? 0;

    return {
      date,
      uptimePercent: row ? toPercent(row.checkCount, row.downCount) : null,
    };
  });

  return { uptimePercent: toPercent(totalChecks, totalDown), days };
};

export type TimeWindow = { startedAt: Date; resolvedAt: Date | null };

const overlapSeconds = (fromMs: number, toMs: number, start: Date, end: Date) =>
  Math.max(0, Math.min(toMs, end.getTime()) - Math.max(fromMs, start.getTime())) / 1000;

export const webhookDailyCounts = (
  webhooks: readonly { createdAt: Date }[],
  outages: readonly TimeWindow[],
  now: Date,
): DailyCounts[] => {
  const firstDayMs = Date.parse(historyStartDay(now));

  return Array.from({ length: UPTIME_HISTORY_DAYS }, (_, index) => {
    const dayStart = firstDayMs + index * DAY_MS;
    const dayEnd = Math.min(dayStart + DAY_MS, now.getTime());
    const observed = webhooks.reduce(
      (total, webhook) => total + overlapSeconds(dayStart, dayEnd, webhook.createdAt, now),
      0,
    );
    const down = outages.reduce(
      (total, outage) =>
        total + overlapSeconds(dayStart, dayEnd, outage.startedAt, outage.resolvedAt ?? now),
      0,
    );

    return {
      day: toIsoDay(new Date(dayStart)),
      checkCount: Math.round(observed),
      downCount: Math.round(Math.min(down, observed)),
    };
  }).filter((row) => row.checkCount > 0);
};
