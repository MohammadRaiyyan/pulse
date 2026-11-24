import {
  DEFAULT_REPORT_PRESET,
  DEFAULT_SLA_TARGET,
  REPORT_HISTORY_DAYS,
  type ReportPreset,
  type ReportQuery,
  idSchema,
  reportDaySchema,
  reportPresetDays,
  reportPresetSchema,
  slaTargetSchema,
} from "@pulse/contracts";
import { z } from "zod";

export const reportSearchSchema = z.object({
  range: reportPresetSchema.default(DEFAULT_REPORT_PRESET),
  from: reportDaySchema.optional(),
  to: reportDaySchema.optional(),
  slaTarget: slaTargetSchema.default(DEFAULT_SLA_TARGET),
  monitorId: idSchema.optional(),
});

export type ReportSearch = z.infer<typeof reportSearchSchema>;

const DAY_MS = 86_400_000;

export const todayUtc = () => new Date().toISOString().slice(0, 10);

export const shiftDay = (day: string, days: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);

export const earliestReportDay = (today: string) =>
  shiftDay(today, -(REPORT_HISTORY_DAYS - 1));

export const presetFromDay = (
  preset: Exclude<ReportPreset, "custom">,
  today: string,
) => shiftDay(today, -(reportPresetDays[preset] - 1));

export const validateCustomRange = (
  from: string,
  to: string,
  today: string,
) => {
  if (!from || !to) {
    return "Choose a start and an end date.";
  }

  if (from > to) {
    return "The end date must be on or after the start date.";
  }

  if (to > today) {
    return "The end date cannot be in the future.";
  }

  if (from < earliestReportDay(today)) {
    return `Reports cover the last ${REPORT_HISTORY_DAYS} days.`;
  }

  return null;
};

export const toReportQuery = (search: ReportSearch): ReportQuery => {
  if (search.range !== "custom") {
    return {
      range: search.range,
      slaTarget: search.slaTarget,
      monitorId: search.monitorId,
    };
  }

  const today = todayUtc();

  return {
    range: "custom",
    from: search.from ?? presetFromDay("30d", today),
    to: search.to ?? today,
    slaTarget: search.slaTarget,
    monitorId: search.monitorId,
  };
};
