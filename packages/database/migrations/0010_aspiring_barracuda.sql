ALTER TABLE "schedules" ADD COLUMN "latitude" double precision;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "longitude" double precision;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "schedule_coordinates_idx" ON "schedules" ("latitude","longitude");--> statement-breakpoint
UPDATE "schedules"
SET "latitude" = (location_details->'coordinates'->>'latitude')::double precision,
    "longitude" = (location_details->'coordinates'->>'longitude')::double precision
WHERE location_details IS NOT NULL
  AND location_details->'coordinates'->>'latitude' IS NOT NULL
  AND location_details->'coordinates'->>'longitude' IS NOT NULL;
