ALTER TABLE "scraper_actor_runs" ADD COLUMN "records_reported" integer;--> statement-breakpoint
ALTER TABLE "scraper_actor_runs" ADD COLUMN "errors_reported" integer;--> statement-breakpoint
ALTER TABLE "scraper_actor_runs" ADD COLUMN "error_codes" jsonb;--> statement-breakpoint
ALTER TABLE "scraper_actor_runs" ADD COLUMN "new_posts" integer;