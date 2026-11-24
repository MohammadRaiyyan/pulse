CREATE TYPE "public"."alert_delivery_status" AS ENUM('success', 'retrying', 'failed');--> statement-breakpoint
CREATE TYPE "public"."alert_event" AS ENUM('incident.opened', 'incident.resolved', 'test');--> statement-breakpoint
CREATE TYPE "public"."incident_resolution_reason" AS ENUM('recovered', 'monitor_paused', 'source_deleted');--> statement-breakpoint
CREATE TYPE "public"."incident_severity" AS ENUM('critical', 'warning');--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "email_verification_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "alert_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"event" "alert_event" NOT NULL,
	"incident_id" uuid,
	"status" "alert_delivery_status" NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "alert_channels" ADD COLUMN "signing_secret" text DEFAULT ('whsec_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')) NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "failure_threshold" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "source_deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "severity" "incident_severity" DEFAULT 'critical' NOT NULL;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "acknowledged_by_id" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "acknowledged_by_name" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolved_by_id" uuid;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolved_by_name" text;--> statement-breakpoint
ALTER TABLE "incidents" ADD COLUMN "resolution_reason" "incident_resolution_reason";--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_verification_tokens_user_idx" ON "email_verification_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "alert_deliveries_channel_created_idx" ON "alert_deliveries" USING btree ("channel_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "password_reset_tokens_user_idx" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_owner" ON "users" USING btree ("role") WHERE "users"."role" = 'owner';--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_failure_threshold_range" CHECK ("monitors"."failure_threshold" between 1 and 10);