DO $$ BEGIN
 CREATE TYPE "public"."extraction_audit_ai_image_input" AS ENUM('blurred', 'original_owner_opted_in', 'original_mode_off', 'text_only_fail_closed', 'no_image_sent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "extraction_audit_logs" ADD COLUMN "ai_image_input" "extraction_audit_ai_image_input" DEFAULT 'original_mode_off' NOT NULL;