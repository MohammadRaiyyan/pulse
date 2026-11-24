CREATE TYPE "public"."alert_channel_type" AS ENUM('email', 'slack', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."check_outcome" AS ENUM('up', 'down', 'degraded');--> statement-breakpoint
CREATE TYPE "public"."http_method" AS ENUM('GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD');--> statement-breakpoint
CREATE TYPE "public"."incident_source_type" AS ENUM('monitor', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked', 'expired');--> statement-breakpoint
CREATE TYPE "public"."monitor_status" AS ENUM('up', 'down', 'degraded', 'pending');--> statement-breakpoint
CREATE TYPE "public"."oauth_provider" AS ENUM('github', 'google');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."webhook_status" AS ENUM('active', 'silent', 'pending');--> statement-breakpoint
CREATE TABLE "linked_accounts" (
	"user_id" uuid NOT NULL,
	"provider" "oauth_provider" NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text NOT NULL,
	"linked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "linked_accounts_user_id_provider_pk" PRIMARY KEY("user_id","provider")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	CONSTRAINT "password_reset_tokens_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"family_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"invited_by" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"type" "alert_channel_type" NOT NULL,
	"target" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "check_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"outcome" "check_outcome" NOT NULL,
	"status_code" integer,
	"response_time_ms" integer NOT NULL,
	"error_message" text,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_alert_channels" (
	"monitor_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "monitor_alert_channels_monitor_id_channel_id_pk" PRIMARY KEY("monitor_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"method" "http_method" NOT NULL,
	"interval_seconds" integer NOT NULL,
	"timeout_ms" integer NOT NULL,
	"expected_status_code" integer NOT NULL,
	"is_paused" boolean DEFAULT false NOT NULL,
	"status" "monitor_status" DEFAULT 'pending' NOT NULL,
	"last_checked_at" timestamp with time zone,
	"last_response_time_ms" integer,
	"uptime_percent" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_alert_channels" (
	"webhook_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	CONSTRAINT "webhook_alert_channels_webhook_id_channel_id_pk" PRIMARY KEY("webhook_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"webhook_id" uuid NOT NULL,
	"method" text NOT NULL,
	"headers" jsonb NOT NULL,
	"body" text NOT NULL,
	"content_type" text,
	"source_ip" text NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"expected_interval_seconds" integer,
	"status" "webhook_status" DEFAULT 'pending' NOT NULL,
	"event_count" integer DEFAULT 0 NOT NULL,
	"last_received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhooks_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "incident_source_type" NOT NULL,
	"source_id" uuid NOT NULL,
	"source_name" text NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"cause" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "linked_accounts" ADD CONSTRAINT "linked_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "check_results" ADD CONSTRAINT "check_results_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_alert_channels" ADD CONSTRAINT "monitor_alert_channels_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_alert_channels" ADD CONSTRAINT "monitor_alert_channels_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_alert_channels" ADD CONSTRAINT "webhook_alert_channels_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_alert_channels" ADD CONSTRAINT "webhook_alert_channels_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_webhook_id_webhooks_id_fk" FOREIGN KEY ("webhook_id") REFERENCES "public"."webhooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "linked_accounts_provider_account_unique" ON "linked_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_family_idx" ON "sessions" USING btree ("family_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "invitations_one_pending_per_email" ON "invitations" USING btree ("email") WHERE "invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "check_results_monitor_time_idx" ON "check_results" USING btree ("monitor_id","checked_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "monitors_due_idx" ON "monitors" USING btree ("is_paused","last_checked_at");--> statement-breakpoint
CREATE INDEX "webhook_events_webhook_time_idx" ON "webhook_events" USING btree ("webhook_id","received_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "incidents_status_started_idx" ON "incidents" USING btree ("status","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "incidents_source_idx" ON "incidents" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "incidents_one_active_per_source" ON "incidents" USING btree ("source_id") WHERE "incidents"."status" <> 'resolved';