DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'user' NOT NULL;