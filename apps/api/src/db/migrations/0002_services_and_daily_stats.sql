CREATE TABLE "services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_daily_stats" (
	"monitor_id" uuid NOT NULL,
	"day" date NOT NULL,
	"check_count" integer DEFAULT 0 NOT NULL,
	"down_count" integer DEFAULT 0 NOT NULL,
	"degraded_count" integer DEFAULT 0 NOT NULL,
	"total_response_time_ms" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "monitor_daily_stats_monitor_id_day_pk" PRIMARY KEY("monitor_id","day")
);
--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "webhooks" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "monitor_daily_stats" ADD CONSTRAINT "monitor_daily_stats_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "services_name_unique" ON "services" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "monitors" ADD CONSTRAINT "monitors_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monitors_service_idx" ON "monitors" USING btree ("service_id");--> statement-breakpoint
CREATE INDEX "webhooks_service_idx" ON "webhooks" USING btree ("service_id");--> statement-breakpoint
INSERT INTO "monitor_daily_stats" ("monitor_id", "day", "check_count", "down_count", "degraded_count", "total_response_time_ms")
SELECT "monitor_id",
  ("checked_at" AT TIME ZONE 'UTC')::date,
  count(*)::int,
  (count(*) FILTER (WHERE "outcome" = 'down'))::int,
  (count(*) FILTER (WHERE "outcome" = 'degraded'))::int,
  sum("response_time_ms")::bigint
FROM "check_results"
GROUP BY "monitor_id", ("checked_at" AT TIME ZONE 'UTC')::date
ON CONFLICT DO NOTHING;
