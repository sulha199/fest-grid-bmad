ALTER TABLE "user_locations" ADD COLUMN "location_details" jsonb NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_user_locations_user_id" ON "user_locations" ("user_id");