ALTER TABLE "apify_pending_jobs" DROP CONSTRAINT "apify_pending_jobs_profile_id_social_media_account_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "brightdata_pending_jobs" DROP CONSTRAINT "brightdata_pending_jobs_profile_id_social_media_account_profiles_id_fk";
--> statement-breakpoint
ALTER TABLE "scraper_actor_runs" DROP CONSTRAINT "scraper_actor_runs_profile_id_social_media_account_profiles_id_fk";
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "apify_pending_jobs" ADD CONSTRAINT "apify_pending_jobs_profile_id_social_media_account_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brightdata_pending_jobs" ADD CONSTRAINT "brightdata_pending_jobs_profile_id_social_media_account_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scraper_actor_runs" ADD CONSTRAINT "scraper_actor_runs_profile_id_social_media_account_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
