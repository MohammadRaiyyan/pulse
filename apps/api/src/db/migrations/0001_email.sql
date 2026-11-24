CREATE TYPE "public"."alert_delivery_status" AS ENUM('success', 'retrying', 'failed');--> statement-breakpoint
CREATE TYPE "public"."alert_event" AS ENUM('incident.opened', 'incident.resolved', 'test');--> statement-breakpoint
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
ALTER TABLE "alert_channels" ADD COLUMN "signing_secret" text DEFAULT ('whsec_' || replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')) NOT NULL;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_channel_id_alert_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."alert_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alert_deliveries_channel_created_idx" ON "alert_deliveries" USING btree ("channel_id","created_at" DESC NULLS LAST);