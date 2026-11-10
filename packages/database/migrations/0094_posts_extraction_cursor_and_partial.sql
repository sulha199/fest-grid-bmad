ALTER TABLE "posts" ADD COLUMN "extraction_cursor" jsonb;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "extraction_partial" boolean DEFAULT false NOT NULL;