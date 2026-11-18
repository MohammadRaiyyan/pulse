import { z } from "zod";
import {
  boundedIntSchema,
  httpUrlSchema,
  idSchema,
  nameSchema,
  nonNegativeIntSchema,
  paginationQuerySchema,
  percentSchema,
  timestampSchema,
} from "../common/index.ts";

export const httpMethodSchema = z.enum([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
]);

export type HttpMethod = z.infer<typeof httpMethodSchema>;

export const monitorStatusSchema = z.enum([
  "up",
  "down",
  "degraded",
  "pending",
]);

export type MonitorStatus = z.infer<typeof monitorStatusSchema>;

export const MONITOR_LIMITS = {
  intervalSeconds: { min: 30, max: 86_400 },
  timeoutMs: { min: 1_000, max: 30_000 },
  statusCode: { min: 100, max: 599 },
} as const;

export const createMonitorSchema = z.object({
  name: nameSchema,
  url: httpUrlSchema,
  method: httpMethodSchema,
  intervalSeconds: boundedIntSchema(MONITOR_LIMITS.intervalSeconds),
  timeoutMs: boundedIntSchema(MONITOR_LIMITS.timeoutMs),
  expectedStatusCode: boundedIntSchema(MONITOR_LIMITS.statusCode),
  alertChannelIds: z.array(idSchema),
});

export type CreateMonitorInput = z.infer<typeof createMonitorSchema>;

export const updateMonitorSchema = createMonitorSchema.partial().extend({
  isPaused: z.boolean().optional(),
});

export type UpdateMonitorInput = z.infer<typeof updateMonitorSchema>;

export const monitorSchema = createMonitorSchema.extend({
  id: idSchema,
  status: monitorStatusSchema,
  isPaused: z.boolean(),
  lastCheckedAt: timestampSchema.nullable(),
  lastResponseTimeMs: nonNegativeIntSchema.nullable(),
  uptimePercent: percentSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type Monitor = z.infer<typeof monitorSchema>;

export const monitorListQuerySchema = paginationQuerySchema.extend({
  status: monitorStatusSchema.optional(),
  search: z.string().trim().optional(),
});

export type MonitorListQuery = z.infer<typeof monitorListQuerySchema>;
