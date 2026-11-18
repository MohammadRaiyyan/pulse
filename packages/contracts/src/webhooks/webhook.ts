import { z } from "zod";
import {
  boundedIntSchema,
  idSchema,
  nameSchema,
  nonNegativeIntSchema,
  timestampSchema,
} from "../common/index.ts";

export const webhookStatusSchema = z.enum(["active", "silent", "pending"]);

export type WebhookStatus = z.infer<typeof webhookStatusSchema>;

export const WEBHOOK_SILENCE_LIMITS = { min: 60, max: 604_800 } as const;

export const createWebhookSchema = z.object({
  name: nameSchema,
  expectedIntervalSeconds: boundedIntSchema(WEBHOOK_SILENCE_LIMITS).nullable(),
  alertChannelIds: z.array(idSchema),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const updateWebhookSchema = createWebhookSchema.partial();

export type UpdateWebhookInput = z.infer<typeof updateWebhookSchema>;

export const webhookSchema = createWebhookSchema.extend({
  id: idSchema,
  ingestUrl: z.url(),
  status: webhookStatusSchema,
  eventCount: nonNegativeIntSchema,
  lastReceivedAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
});

export type Webhook = z.infer<typeof webhookSchema>;
