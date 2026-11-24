import {
  type ReportPreset,
  type SlaStatus,
  reportPresetSchema,
} from "@pulse/contracts";
import type { StatusMeta } from "@/components/data/tones";
import { withPlaceholder } from "@/lib/format/placeholder";
import { metaOptions } from "@/lib/options";

export const reportPresetMeta: Record<ReportPreset, { label: string }> = {
  "7d": { label: "7 days" },
  "30d": { label: "30 days" },
  "90d": { label: "90 days" },
  custom: { label: "Custom" },
};

export const reportPresetOptions = metaOptions(
  reportPresetSchema.options,
  reportPresetMeta,
);

export const slaStatusMeta: Record<SlaStatus, StatusMeta> = {
  met: { label: "Met", tone: "success" },
  breached: { label: "Breached", tone: "danger" },
  no_data: { label: "No data", tone: "neutral" },
};

const UPTIME_DECIMALS = 3;
const UPTIME_SCALE = 10 ** UPTIME_DECIMALS;

const uptimeFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: UPTIME_DECIMALS,
});

export const formatUptime = withPlaceholder(
  (percent: number) =>
    `${uptimeFormatter.format(Math.floor(percent * UPTIME_SCALE) / UPTIME_SCALE)}%`,
);

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const fullDayFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeZone: "UTC",
});

export const formatDay = (day: string) =>
  dayFormatter.format(new Date(`${day}T00:00:00Z`));

export const formatFullDay = (day: string) =>
  fullDayFormatter.format(new Date(`${day}T00:00:00Z`));
