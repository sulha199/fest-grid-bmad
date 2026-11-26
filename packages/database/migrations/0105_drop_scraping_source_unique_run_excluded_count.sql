DROP INDEX IF EXISTS "idx_post_account_associations_one_scraping_source_per_post";--> statement-breakpoint
ALTER TABLE "scraper_actor_runs" ADD COLUMN "excluded_post_count" integer;