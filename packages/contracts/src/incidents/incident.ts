import { z } from "zod";
import {
  idSchema,
  nameSchema,
  paginationQuerySchema,
  timestampSchema,
} from "../common/index.ts";

export const incidentStatusSchema = z.enum([
  "open",
  "acknowledged",
  "resolved",
]);

export type IncidentStatus = z.infer<typeof incidentStatusSchema>;

export const incidentSourceTypeSchema = z.enum(["monitor", "webhook"]);

export type IncidentSourceType = z.infer<typeof incidentSourceTypeSchema>;

export const activeIncidentStatuses = ["open", "acknowledged"] as const;

export const incidentStatusFilterSchema = z.enum([
  "active",
  ...incidentStatusSchema.options,
]);

export type IncidentStatusFilter = z.infer<typeof incidentStatusFilterSchema>;

export const incidentSeveritySchema = z.enum(["critical", "warning"]);

export type IncidentSeverity = z.infer<typeof incidentSeveritySchema>;

export const incidentResolutionReasonSchema = z.enum([
  "recovered",
  "monitor_paused",
  "source_deleted",
]);

export type IncidentResolutionReason = z.infer<
  typeof incidentResolutionReasonSchema
>;

export const incidentActorSchema = z.object({
  id: idSchema,
  name: z.string(),
});

export type IncidentActor = z.infer<typeof incidentActorSchema>;

export const incidentSourceSchema = z.object({
  type: incidentSourceTypeSchema,
  id: idSchema,
  name: nameSchema,
  isDeleted: z.boolean(),
});

export type IncidentSource = z.infer<typeof incidentSourceSchema>;

export const incidentSchema = z.object({
  id: idSchema,
  source: incidentSourceSchema,
  status: incidentStatusSchema,
  severity: incidentSeveritySchema,
  cause: z.string(),
  startedAt: timestampSchema,
  acknowledgedAt: timestampSchema.nullable(),
  acknowledgedBy: incidentActorSchema.nullable(),
  resolvedAt: timestampSchema.nullable(),
  resolvedBy: incidentActorSchema.nullable(),
  resolutionReason: incidentResolutionReasonSchema.nullable(),
});

export type Incident = z.infer<typeof incidentSchema>;

export const incidentListQuerySchema = paginationQuerySchema.extend({
  status: incidentStatusFilterSchema.optional(),
});

export type IncidentListQuery = z.infer<typeof incidentListQuerySchema>;
