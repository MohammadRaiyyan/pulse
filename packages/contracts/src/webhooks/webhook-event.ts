import { z } from "zod";
import { idSchema, timestampSchema } from "../common/index.ts";

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
