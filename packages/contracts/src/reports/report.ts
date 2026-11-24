import { z } from "zod";
import {
  idSchema,
  nonNegativeIntSchema,
  percentSchema,
  timestampSchema,
} from "../common/index.ts";

export const REPORT_HISTORY_DAYS = 400;

export const DEFAULT_SLA_TARGET = 99.9;

export const reportPresetSchema = z.enum(["7d", "30d", "90d", "custom"]);

export type ReportPreset = z.infer<typeof reportPresetSchema>;

export const DEFAULT_REPORT_PRESET: ReportPreset = "30d";

export const reportPresetDays: Record<
  Exclude<ReportPreset, "custom">,
  number
> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const reportDaySchema = z.iso.date({ error: "Use a YYYY-MM-DD date" });

export const slaTargetSchema = z.coerce
  .number({ error: "Enter a percentage" })
  .min(0, "Use a value from 0 to 100")
  .max(100, "Use a value from 0 to 100");

export const reportQuerySchema = z
  .object({
    range: reportPresetSchema.default(DEFAULT_REPORT_PRESET),
    from: reportDaySchema.optional(),
    to: reportDaySchema.optional(),
    slaTarget: slaTargetSchema.default(DEFAULT_SLA_TARGET),
    monitorId: idSchema.optional(),
  })
  .superRefine((query, context) => {
    if (query.range !== "custom") {
      return;
    }

    if (!query.from) {
      context.addIssue({
        code: "custom",
        path: ["from"],
        message: "Choose a start date",
      });
    }

    if (!query.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "Choose an end date",
      });
    }

    if (query.from && query.to && query.from > query.to) {
      context.addIssue({
        code: "custom",
        path: ["to"],
        message: "The end date must be on or after the start date",
      });
    }
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;

export const slaStatusSchema = z.enum(["met", "breached", "no_data"]);

export type SlaStatus = z.infer<typeof slaStatusSchema>;

const durationSecondsSchema = z.number().min(0);

export const reportRangeSchema = z.object({
  preset: reportPresetSchema,
  from: reportDaySchema,
  to: reportDaySchema,
  days: z.int().min(1),
});

export type ReportRange = z.infer<typeof reportRangeSchema>;

export const reportSummarySchema = z.object({
  uptimePercent: percentSchema.nullable(),
  averageResponseTimeMs: nonNegativeIntSchema.nullable(),
  checks: nonNegativeIntSchema,
  downChecks: nonNegativeIntSchema,
  degradedChecks: nonNegativeIntSchema,
  incidents: z.object({
    total: nonNegativeIntSchema,
    critical: nonNegativeIntSchema,
    warning: nonNegativeIntSchema,
  }),
  mttaSeconds: durationSecondsSchema.nullable(),
  mttrSeconds: durationSecondsSchema.nullable(),
  downtimeSeconds: durationSecondsSchema,
  slaStatus: slaStatusSchema,
});

export type ReportSummary = z.infer<typeof reportSummarySchema>;

export const reportMonitorSchema = z.object({
  id: idSchema,
  name: z.string(),
  isPaused: z.boolean(),
  serviceId: idSchema.nullable(),
  serviceName: z.string().nullable(),
  uptimePercent: percentSchema.nullable(),
  averageResponseTimeMs: nonNegativeIntSchema.nullable(),
  checks: nonNegativeIntSchema,
  downChecks: nonNegativeIntSchema,
  degradedChecks: nonNegativeIntSchema,
  incidents: nonNegativeIntSchema,
  downtimeSeconds: durationSecondsSchema,
  slaStatus: slaStatusSchema,
});

export type ReportMonitor = z.infer<typeof reportMonitorSchema>;

export const reportServiceSchema = z.object({
  id: idSchema,
  name: z.string(),
  monitorCount: nonNegativeIntSchema,
  checks: nonNegativeIntSchema,
  downChecks: nonNegativeIntSchema,
  uptimePercent: percentSchema.nullable(),
  slaStatus: slaStatusSchema,
});

export type ReportService = z.infer<typeof reportServiceSchema>;

export const reportDayPointSchema = z.object({
  day: reportDaySchema,
  checks: nonNegativeIntSchema,
  downChecks: nonNegativeIntSchema,
  uptimePercent: percentSchema.nullable(),
  averageResponseTimeMs: nonNegativeIntSchema.nullable(),
});

export type ReportDayPoint = z.infer<typeof reportDayPointSchema>;

export const reportSchema = z.object({
  range: reportRangeSchema,
  slaTarget: percentSchema,
  monitor: z.object({ id: idSchema, name: z.string() }).nullable(),
  summary: reportSummarySchema,
  monitors: z.array(reportMonitorSchema),
  services: z.array(reportServiceSchema),
  daily: z.array(reportDayPointSchema),
  generatedAt: timestampSchema,
});

export type Report = z.infer<typeof reportSchema>;

export const reportCsvFilename = (range: Pick<ReportRange, "from" | "to">) =>
  `pulse-report-${range.from}-${range.to}.csv`;
