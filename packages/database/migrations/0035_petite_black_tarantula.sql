ALTER TABLE "default_location_change_requests" ALTER COLUMN "changed_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "location_name" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "owner_display_name" text;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "owner_username" text;