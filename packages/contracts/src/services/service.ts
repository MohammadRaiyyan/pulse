import { z } from "zod";
import {
  boundedIntSchema,
  idSchema,
  nameSchema,
  nonNegativeIntSchema,
  percentSchema,
  timestampSchema,
} from "../common/index.ts";
import { incidentSchema } from "../incidents/index.ts";
import { monitorStatusSchema } from "../monitors/index.ts";
import { webhookStatusSchema } from "../webhooks/index.ts";

export const serviceStatusSchema = z.enum([
  "up",
  "degraded",
  "down",
  "pending",
  "no_data",
]);

export type ServiceStatus = z.infer<typeof serviceStatusSchema>;

export const SERVICE_LIMITS = {
  description: 500,
  position: { min: 0, max: 10_000 },
} as const;

export const UPTIME_HISTORY_DAYS = 90;

export const serviceDescriptionSchema = z
  .string()
  .trim()
  .max(SERVICE_LIMITS.description);

export const createServiceSchema = z.object({
  name: nameSchema,
  description: serviceDescriptionSchema,
  isPublic: z.boolean(),
  position: boundedIntSchema(SERVICE_LIMITS.position),
  monitorIds: z.array(idSchema),
  webhookIds: z.array(idSchema),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

export const updateServiceSchema = createServiceSchema.partial();

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

export const serviceSchema = createServiceSchema.extend({
  id: idSchema,
  status: serviceStatusSchema,
  activeIncidentCount: nonNegativeIntSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Service = z.infer<typeof serviceSchema>;

export const uptimeDaySchema = z.object({
  date: z.iso.date(),
  uptimePercent: percentSchema.nullable(),
});

export type UptimeDay = z.infer<typeof uptimeDaySchema>;

export const uptimeHistorySchema = z.object({
  uptimePercent: percentSchema.nullable(),
  days: z.array(uptimeDaySchema),
});

export type UptimeHistory = z.infer<typeof uptimeHistorySchema>;

export const serviceMonitorMemberSchema = z.object({
  id: idSchema,
  name: nameSchema,
  status: monitorStatusSchema,
  isPaused: z.boolean(),
  uptimePercent: percentSchema.nullable(),
});

export type ServiceMonitorMember = z.infer<typeof serviceMonitorMemberSchema>;

export const serviceWebhookMemberSchema = z.object({
  id: idSchema,
  name: nameSchema,
  status: webhookStatusSchema,
});

export type ServiceWebhookMember = z.infer<typeof serviceWebhookMemberSchema>;

export const serviceOverviewSchema = z.object({
  monitors: z.array(serviceMonitorMemberSchema),
  webhooks: z.array(serviceWebhookMemberSchema),
  activeIncidents: z.array(incidentSchema),
  uptime: uptimeHistorySchema,
});

export type ServiceOverview = z.infer<typeof serviceOverviewSchema>;
