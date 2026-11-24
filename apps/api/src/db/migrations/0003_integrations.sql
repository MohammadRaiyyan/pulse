CREATE TYPE "public"."opsgenie_region" AS ENUM('us', 'eu');--> statement-breakpoint
ALTER TYPE "public"."alert_channel_type" ADD VALUE 'teams' BEFORE 'webhook';--> statement-breakpoint
ALTER TYPE "public"."alert_channel_type" ADD VALUE 'discord' BEFORE 'webhook';--> statement-breakpoint
ALTER TYPE "public"."alert_channel_type" ADD VALUE 'pagerduty' BEFORE 'webhook';--> statement-breakpoint
ALTER TYPE "public"."alert_channel_type" ADD VALUE 'opsgenie' BEFORE 'webhook';--> statement-breakpoint
ALTER TABLE "alert_channels" ADD COLUMN "region" "opsgenie_region";--> statement-breakpoint
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_region_only_for_opsgenie" CHECK (("alert_channels"."type"::text = 'opsgenie') = ("alert_channels"."region" is not null));