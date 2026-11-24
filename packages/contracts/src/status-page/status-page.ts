import { z } from "zod";
import { idSchema, timestampSchema } from "../common/index.ts";
import { incidentSeveritySchema } from "../incidents/index.ts";
import {
  serviceDescriptionSchema,
  serviceStatusSchema,
  uptimeHistorySchema,
} from "../services/index.ts";

export const STATUS_PAGE_LIMITS = { title: 100, description: 500 } as const;

export const PUBLIC_RECENT_INCIDENT_DAYS = 7;

export const statusPageSettingsSchema = z.object({
  isEnabled: z.boolean(),
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(STATUS_PAGE_LIMITS.title),
  description: z.string().trim().max(STATUS_PAGE_LIMITS.description),
});

export type StatusPageSettings = z.infer<typeof statusPageSettingsSchema>;

export const updateStatusPageSettingsSchema =
  statusPageSettingsSchema.partial();

export type UpdateStatusPageSettingsInput = z.infer<
  typeof updateStatusPageSettingsSchema
>;

export const overallStatusSchema = z.enum([
  "operational",
  "degraded",
  "partial_outage",
  "major_outage",
]);

export type OverallStatus = z.infer<typeof overallStatusSchema>;

export const publicIncidentStateSchema = z.enum([
  "investigating",
  "identified",
  "resolved",
]);

export type PublicIncidentState = z.infer<typeof publicIncidentStateSchema>;

export const publicServiceSchema = uptimeHistorySchema.extend({
  id: idSchema,
  name: z.string(),
  description: serviceDescriptionSchema,
  status: serviceStatusSchema,
});

export type PublicService = z.infer<typeof publicServiceSchema>;

export const publicIncidentSchema = z.object({
  id: idSchema,
  serviceId: idSchema,
  serviceName: z.string(),
  severity: incidentSeveritySchema,
  state: publicIncidentStateSchema,
  startedAt: timestampSchema,
  resolvedAt: timestampSchema.nullable(),
});

export type PublicIncident = z.infer<typeof publicIncidentSchema>;

export const publicStatusSchema = z.object({
  title: z.string(),
  description: z.string(),
  overallStatus: overallStatusSchema,
  services: z.array(publicServiceSchema),
  activeIncidents: z.array(publicIncidentSchema),
  recentIncidents: z.array(publicIncidentSchema),
  generatedAt: timestampSchema,
});

export type PublicStatus = z.infer<typeof publicStatusSchema>;
