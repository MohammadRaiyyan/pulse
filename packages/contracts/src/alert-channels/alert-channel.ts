import { z } from "zod";
import {
  httpUrlSchema,
  idSchema,
  nameSchema,
  timestampSchema,
} from "../common/index.ts";
import { emailSchema } from "../users/index.ts";

export const alertChannelTypeSchema = z.enum(["email", "slack", "webhook"]);

export type AlertChannelType = z.infer<typeof alertChannelTypeSchema>;

const { email, slack, webhook } = alertChannelTypeSchema.enum;

export const alertDestinationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(email), target: emailSchema }),
  z.object({ type: z.literal(slack), target: httpUrlSchema }),
  z.object({ type: z.literal(webhook), target: httpUrlSchema }),
]);

export type AlertDestination = z.infer<typeof alertDestinationSchema>;

export const createAlertChannelSchema = z.object({
  name: nameSchema,
  isEnabled: z.boolean(),
  destination: alertDestinationSchema,
});

export type CreateAlertChannelInput = z.infer<typeof createAlertChannelSchema>;

export const updateAlertChannelSchema = createAlertChannelSchema.partial();

export type UpdateAlertChannelInput = z.infer<typeof updateAlertChannelSchema>;

export const alertEventSchema = z.enum([
  "incident.opened",
  "incident.resolved",
  "test",
]);

export type AlertEvent = z.infer<typeof alertEventSchema>;

export const alertDeliveryStatusSchema = z.enum([
  "success",
  "retrying",
  "failed",
]);

export type AlertDeliveryStatus = z.infer<typeof alertDeliveryStatusSchema>;

export const alertDeliverySchema = z.object({
  id: idSchema,
  event: alertEventSchema,
  incidentId: idSchema.nullable(),
  status: alertDeliveryStatusSchema,
  attempts: z.int().min(1),
  lastError: z.string().nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
});

export type AlertDelivery = z.infer<typeof alertDeliverySchema>;

export const alertChannelSchema = createAlertChannelSchema.extend({
  id: idSchema,
  createdAt: timestampSchema,
  lastDelivery: alertDeliverySchema.nullable(),
});

export type AlertChannel = z.infer<typeof alertChannelSchema>;

export const alertChannelSigningSecretSchema = z.object({
  signingSecret: z.string(),
});

export type AlertChannelSigningSecret = z.infer<
  typeof alertChannelSigningSecretSchema
>;
