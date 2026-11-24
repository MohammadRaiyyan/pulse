ALTER TABLE "monitors" ADD COLUMN "request_headers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "request_body" text;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "request_content_type" text;