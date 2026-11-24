import { z } from "zod";
import {
  idSchema,
  paginationQuerySchema,
  timestampSchema,
} from "../common/index.ts";

export const WEBHOOK_EVENTS_MAX_PAGE_SIZE = 25;

export const REDACTED_HEADER_VALUE = "[redacted]";

export const webhookEventSchema = z.object({
  id: idSchema,
  webhookId: idSchema,
  method: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
  contentType: z.string().nullable(),
  sourceIp: z.string(),
  receivedAt: timestampSchema,
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export const webhookEventListQuerySchema = paginationQuerySchema.extend({
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(WEBHOOK_EVENTS_MAX_PAGE_SIZE)
    .default(10),
});

export type WebhookEventListQuery = z.infer<typeof webhookEventListQuerySchema>;
