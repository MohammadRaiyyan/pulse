import {
  REPORT_HISTORY_DAYS,
  type ReportQuery,
  type ReportRange,
  type SlaStatus,
  reportPresetDays,
} from "@pulse/contracts";
import { badRequest } from "../../lib/errors.ts";

const DAY_MS = 86_400_000;

export const toDay = (date: Date) => date.toISOString().slice(0, 10);

export const startOfDay = (day: string) => new Date(`${day}T00:00:00.000Z`);

export const addDays = (day: string, days: number) =>
  toDay(new Date(startOfDay(day).getTime() + days * DAY_MS));

export const daysBetween = (from: string, to: string) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS) +
  1;

export type ResolvedRange = ReportRange & { start: Date; end: Date };

const rangeError = (field: "from" | "to", message: string) =>
  badRequest("Invalid report range", { [field]: [message] });

export const resolveReportRange = (
  query: Pick<ReportQuery, "range" | "from" | "to">,
  now: Date,
): ResolvedRange => {
  const today = toDay(now);
  const earliest = addDays(today, -(REPORT_HISTORY_DAYS - 1));
  let from: string;
  let to: string;

  if (query.range === "custom") {
    if (!query.from || !query.to) {
      throw rangeError(query.from ? "to" : "from", "Choose a date");
    }

    if (query.from > query.to) {
      throw rangeError("to", "The end date must be on or after the start date");
    }

    if (query.to > today) {
      throw rangeError("to", "The end date cannot be in the future");
    }

    if (query.from < earliest) {
      throw rangeError(
        "from",
        `Reports cover the last ${REPORT_HISTORY_DAYS} days (from ${earliest})`,
      );
    }

    from = query.from;
    to = query.to;
  } else {
    to = today;
    from = addDays(today, -(reportPresetDays[query.range] - 1));
  }

  const dayAfterTo = startOfDay(addDays(to, 1));

  return {
    preset: query.range,
    from,
    to,
    days: daysBetween(from, to),
    start: startOfDay(from),
    end: dayAfterTo < now ? dayAfterTo : now,
  };
};

export const uptimePercent = (checks: number, downChecks: number) =>
  checks === 0 ? null : ((checks - downChecks) * 100) / checks;

export const averageResponseTime = (checks: number, totalMs: number) =>
  checks === 0 ? null : Math.round(totalMs / checks);

export const slaStatus = (
  percent: number | null,
  target: number,
): SlaStatus => {
  if (percent === null) {
    return "no_data";
  }

  return percent >= target ? "met" : "breached";
};

type ServiceMember = {
  serviceId: string | null;
  serviceName: string | null;
  checks: number;
  downChecks: number;
};

export const groupByService = (
  members: readonly ServiceMember[],
  target: number,
) => {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      monitorCount: number;
      checks: number;
      downChecks: number;
    }
  >();

  for (const member of members) {
    if (!member.serviceId) {
      continue;
    }

    const group = groups.get(member.serviceId) ?? {
      id: member.serviceId,
      name: member.serviceName ?? "",
      monitorCount: 0,
      checks: 0,
      downChecks: 0,
    };

    group.monitorCount += 1;
    group.checks += member.checks;
    group.downChecks += member.downChecks;
    groups.set(member.serviceId, group);
  }

  return [...groups.values()]
    .map((group) => {
      const percent = uptimePercent(group.checks, group.downChecks);

      return {
        ...group,
        uptimePercent: percent,
        slaStatus: slaStatus(percent, target),
      };
    })
    .toSorted((left, right) => left.name.localeCompare(right.name));
};

type DayTotals = {
  day: string;
  checks: number;
  downChecks: number;
  totalResponseTimeMs: number;
};

export const fillDailySeries = (
  range: Pick<ReportRange, "from" | "days">,
  rows: readonly DayTotals[],
) => {
  const byDay = new Map(rows.map((row) => [row.day, row]));

  return Array.from({ length: range.days }, (_, index) => {
    const day = addDays(range.from, index);
    const row = byDay.get(day);
    const checks = row?.checks ?? 0;
    const downChecks = row?.downChecks ?? 0;

    return {
      day,
      checks,
      downChecks,
      uptimePercent: uptimePercent(checks, downChecks),
      averageResponseTimeMs: averageResponseTime(
        checks,
        row?.totalResponseTimeMs ?? 0,
      ),
    };
  });
};
