CREATE TYPE "public"."incident_resolution_reason" AS ENUM('recovered', 'monitor_paused', 'source_deleted');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('critical', 'warning');--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "failure_threshold" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "source_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "severity" "incident_severity" DEFAULT 'critical' NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "acknowledged_by_id" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "acknowledged_by_name" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolved_by_name" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolution_reason" "incident_resolution_reason";--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_failure_threshold_range" CHECK ("monitors"."failure_threshold" between 1 and 10);