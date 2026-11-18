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

export const alertChannelSchema = createAlertChannelSchema.extend({
  id: idSchema,
  createdAt: timestampSchema,
});

export type AlertChannel = z.infer<typeof alertChannelSchema>;
