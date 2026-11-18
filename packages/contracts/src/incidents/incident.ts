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

export const incidentSourceSchema = z.object({
  type: incidentSourceTypeSchema,
  id: idSchema,
  name: nameSchema,
});

export type IncidentSource = z.infer<typeof incidentSourceSchema>;

export const incidentSchema = z.object({
  id: idSchema,
  source: incidentSourceSchema,
  status: incidentStatusSchema,
  cause: z.string(),
  startedAt: timestampSchema,
  acknowledgedAt: timestampSchema.nullable(),
  resolvedAt: timestampSchema.nullable(),
});

export type Incident = z.infer<typeof incidentSchema>;

export const incidentListQuerySchema = paginationQuerySchema.extend({
  status: incidentStatusSchema.optional(),
});

export type IncidentListQuery = z.infer<typeof incidentListQuerySchema>;
