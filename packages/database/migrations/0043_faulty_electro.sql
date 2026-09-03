DO $$ BEGIN
 CREATE TYPE "public"."image_storage_opt_in_source" AS ENUM('MODERATOR', 'ACCOUNT_OWNER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "posts" ALTER COLUMN "content" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "is_image_storage_opted_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "social_media_account_profiles" ADD COLUMN "image_storage_opt_in_source" "image_storage_opt_in_source";