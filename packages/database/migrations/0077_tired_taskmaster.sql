CREATE TABLE IF NOT EXISTS "account_profile_merges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"survivor_id" uuid NOT NULL,
	"twin_account_id" text NOT NULL,
	"twin_snapshot" jsonb NOT NULL,
	"performed_by" text NOT NULL,
	"evidence" jsonb NOT NULL,
	"repointed" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_profile_merges" ADD CONSTRAINT "account_profile_merges_survivor_id_social_media_account_profiles_id_fk" FOREIGN KEY ("survivor_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_account_profile_merges_survivor" ON "account_profile_merges" ("survivor_id");