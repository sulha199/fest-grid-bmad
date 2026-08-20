ALTER TABLE "apify_pending_jobs" ADD COLUMN "scraper_actor_run_id" uuid;--> statement-breakpoint
ALTER TABLE "brightdata_pending_jobs" ADD COLUMN "scraper_actor_run_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "scraper_actor_run_id" uuid;--> statement-breakpoint
ALTER TABLE "unprocessed_scraper_payloads" ADD COLUMN "scraper_actor_run_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apify_pending_jobs" ADD CONSTRAINT "apify_pending_jobs_scraper_actor_run_id_scraper_actor_runs_id_fk" FOREIGN KEY ("scraper_actor_run_id") REFERENCES "public"."scraper_actor_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brightdata_pending_jobs" ADD CONSTRAINT "brightdata_pending_jobs_scraper_actor_run_id_scraper_actor_runs_id_fk" FOREIGN KEY ("scraper_actor_run_id") REFERENCES "public"."scraper_actor_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "posts" ADD CONSTRAINT "posts_scraper_actor_run_id_scraper_actor_runs_id_fk" FOREIGN KEY ("scraper_actor_run_id") REFERENCES "public"."scraper_actor_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "unprocessed_scraper_payloads" ADD CONSTRAINT "unprocessed_scraper_payloads_scraper_actor_run_id_scraper_actor_runs_id_fk" FOREIGN KEY ("scraper_actor_run_id") REFERENCES "public"."scraper_actor_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_posts_scraper_actor_run_id" ON "posts" ("scraper_actor_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_unprocessed_payloads_scraper_actor_run_id" ON "unprocessed_scraper_payloads" ("scraper_actor_run_id");