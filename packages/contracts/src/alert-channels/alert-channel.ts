import { z } from "zod";
import {
  httpUrlSchema,
  idSchema,
  nameSchema,
  timestampSchema,
} from "../common/index.ts";
import { emailSchema } from "../users/index.ts";

export const alertChannelTypeSchema = z.enum([
  "email",
  "slack",
  "teams",
  "discord",
  "pagerduty",
  "opsgenie",
  "webhook",
]);

export type AlertChannelType = z.infer<typeof alertChannelTypeSchema>;

export const opsgenieRegionSchema = z.enum(["us", "eu"]);

export type OpsgenieRegion = z.infer<typeof opsgenieRegionSchema>;

export const secretAlertChannelTypes: readonly AlertChannelType[] = [
  "slack",
  "teams",
  "discord",
  "pagerduty",
  "opsgenie",
];

export const isSecretAlertChannelType = (type: AlertChannelType) =>
  secretAlertChannelTypes.includes(type);

export const MASKED_SECRET_PREFIX = "••••";

export const maskSecret = (secret: string) =>
  `${MASKED_SECRET_PREFIX}${secret.slice(-4)}`;

export const isMaskedSecret = (value: string) =>
  value.startsWith(MASKED_SECRET_PREFIX);

export const pagerDutyRoutingKeySchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9]{32}$/,
    "Enter the 32-character integration key from PagerDuty",
  );

export const opsgenieApiKeySchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    "Enter the API key from your Opsgenie API integration",
  );

const { email, slack, teams, discord, pagerduty, opsgenie, webhook } =
  alertChannelTypeSchema.enum;

type SecretSchema = z.ZodType<string, string>;

const buildDestinationSchema = <TSecret extends z.ZodType>(
  secret: (schema: SecretSchema) => TSecret,
) =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal(email), target: emailSchema }),
    z.object({ type: z.literal(slack), target: secret(httpUrlSchema) }),
    z.object({ type: z.literal(teams), target: secret(httpUrlSchema) }),
    z.object({ type: z.literal(discord), target: secret(httpUrlSchema) }),
    z.object({
      type: z.literal(pagerduty),
      target: secret(pagerDutyRoutingKeySchema),
    }),
    z.object({
      type: z.literal(opsgenie),
      target: secret(opsgenieApiKeySchema),
      region: opsgenieRegionSchema,
    }),
    z.object({ type: z.literal(webhook), target: httpUrlSchema }),
  ]);

const keepMaskedSecret = (schema: SecretSchema) =>
  z
    .string()
    .transform((value, context) => {
      if (isMaskedSecret(value)) {
        return value;
      }

      const result = schema.safeParse(value);

      if (result.success) {
        return result.data;
      }

      for (const issue of result.error.issues) {
        context.addIssue({ code: "custom", message: issue.message });
      }

      return z.NEVER;
    })
    .optional();

export const alertDestinationSchema = buildDestinationSchema(
  (schema) => schema,
);

export type AlertDestination = z.infer<typeof alertDestinationSchema>;

export const alertDestinationUpdateSchema =
  buildDestinationSchema(keepMaskedSecret);

export type AlertDestinationUpdate = z.infer<
  typeof alertDestinationUpdateSchema
>;

export const createAlertChannelSchema = z.object({
  name: nameSchema,
  isEnabled: z.boolean(),
  destination: alertDestinationSchema,
});

export type CreateAlertChannelInput = z.infer<typeof createAlertChannelSchema>;

export const updateAlertChannelSchema = z.object({
  name: nameSchema.optional(),
  isEnabled: z.boolean().optional(),
  destination: alertDestinationUpdateSchema.optional(),
});

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

export const alertChannelDestinationSchema = z.object({
  type: alertChannelTypeSchema,
  target: z.string(),
  region: opsgenieRegionSchema.nullable(),
  isMasked: z.boolean(),
});

export type AlertChannelDestination = z.infer<
  typeof alertChannelDestinationSchema
>;

export const alertChannelSchema = z.object({
  id: idSchema,
  name: z.string(),
  isEnabled: z.boolean(),
  destination: alertChannelDestinationSchema,
  createdAt: timestampSchema,
  lastDelivery: alertDeliverySchema.nullable(),
});

export type AlertChannel = z.infer<typeof alertChannelSchema>;

export const alertChannelTypeCountsSchema = z.array(
  z.object({ type: alertChannelTypeSchema, count: z.int().min(0) }),
);

export type AlertChannelTypeCounts = z.infer<
  typeof alertChannelTypeCountsSchema
>;

export const alertChannelSigningSecretSchema = z.object({
  signingSecret: z.string(),
});

export type AlertChannelSigningSecret = z.infer<
  typeof alertChannelSigningSecretSchema
>;
