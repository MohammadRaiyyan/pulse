CREATE TABLE "status_page_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"title" text DEFAULT 'Status' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "status_page_settings_singleton" CHECK ("status_page_settings"."id" = 1)
);
