CREATE TABLE IF NOT EXISTS "account_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_votes" ADD CONSTRAINT "account_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "account_votes" ADD CONSTRAINT "account_votes_account_id_social_media_account_profiles_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."social_media_account_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_account_votes_user_account" ON "account_votes" ("user_id","account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_account_votes_active_user" ON "account_votes" ("user_id") WHERE "deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_account_votes_active_account" ON "account_votes" ("account_id") WHERE "deleted_at" IS NULL;
