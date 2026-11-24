import {
  alertChannelTypeSchema,
  checkOutcomeSchema,
  httpMethodSchema,
  incidentResolutionReasonSchema,
  incidentSeveritySchema,
  incidentSourceTypeSchema,
  incidentStatusSchema,
  invitationStatusSchema,
  monitorStatusSchema,
  oauthProviderSchema,
  roleSchema,
  webhookStatusSchema,
} from "@pulse/contracts";
import { pgEnum } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", roleSchema.enum);
export const oauthProviderEnum = pgEnum(
  "oauth_provider",
  oauthProviderSchema.enum,
);
export const invitationStatusEnum = pgEnum(
  "invitation_status",
  invitationStatusSchema.enum,
);
export const alertChannelTypeEnum = pgEnum(
  "alert_channel_type",
  alertChannelTypeSchema.enum,
);
export const httpMethodEnum = pgEnum("http_method", httpMethodSchema.enum);
export const monitorStatusEnum = pgEnum(
  "monitor_status",
  monitorStatusSchema.enum,
);
export const checkOutcomeEnum = pgEnum(
  "check_outcome",
  checkOutcomeSchema.enum,
);
export const webhookStatusEnum = pgEnum(
  "webhook_status",
  webhookStatusSchema.enum,
);
export const incidentStatusEnum = pgEnum(
  "incident_status",
  incidentStatusSchema.enum,
);
export const incidentSourceTypeEnum = pgEnum(
  "incident_source_type",
  incidentSourceTypeSchema.enum,
);
export const incidentSeverityEnum = pgEnum(
  "incident_severity",
  incidentSeveritySchema.enum,
);
export const incidentResolutionReasonEnum = pgEnum(
  "incident_resolution_reason",
  incidentResolutionReasonSchema.enum,
);
