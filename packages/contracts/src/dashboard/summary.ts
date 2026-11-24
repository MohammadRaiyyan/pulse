import { z } from "zod";
import { nonNegativeIntSchema, percentSchema } from "../common/index.ts";
import { monitorStatusSchema } from "../monitors/index.ts";
import { webhookStatusSchema } from "../webhooks/index.ts";

export const dashboardSummarySchema = z.object({
  monitors: z.object({
    total: nonNegativeIntSchema,
    paused: nonNegativeIntSchema,
    byStatus: z.record(monitorStatusSchema, nonNegativeIntSchema),
  }),
  webhooks: z.object({
    total: nonNegativeIntSchema,
    byStatus: z.record(webhookStatusSchema, nonNegativeIntSchema),
  }),
  openIncidents: nonNegativeIntSchema,
  activeIncidents: nonNegativeIntSchema,
  criticalIncidents: nonNegativeIntSchema,
  averageResponseTimeMs: nonNegativeIntSchema.nullable(),
  uptimePercent: percentSchema.nullable(),
});

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
