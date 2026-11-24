CREATE TYPE "public"."opsgenie_region" AS ENUM('us', 'eu');--> statement-breakpoint
ALTER TYPE "public"."alert_channel_type" ADD VALUE 'teams' BEFORE 'webhook';--> statement-breakpoint
ALTER TYPE "public"."alert_channel_type" ADD VALUE 'discord' BEFORE 'webhook';--> statement-breakpoint
ALTER TYPE "public"."alert_channel_type" ADD VALUE 'pagerduty' BEFORE 'webhook';--> statement-breakpoint
ALTER TYPE "public"."alert_channel_type" ADD VALUE 'opsgenie' BEFORE 'webhook';--> statement-breakpoint
CREATE TABLE "status_page_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"title" text DEFAULT 'Status' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_page_settings_singleton" CHECK ("status_page_settings"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "alert_channels" ADD COLUMN "region" "opsgenie_region";--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "request_headers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "request_body" text;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "request_content_type" text;--> statement-breakpoint
CREATE INDEX "monitor_daily_stats_day_idx" ON "monitor_daily_stats" USING btree ("day");--> statement-breakpoint
ALTER TABLE "alert_channels" ADD CONSTRAINT "alert_channels_region_only_for_opsgenie" CHECK (("alert_channels"."type"::text = 'opsgenie') = ("alert_channels"."region" is not null));