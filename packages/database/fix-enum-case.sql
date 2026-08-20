-- Fix enum case sensitivity for scraper_run_vendor and scraper_run_trigger_mode
-- Drop dependent objects first
ALTER TABLE scraper_actor_runs DROP CONSTRAINT IF EXISTS scraper_actor_runs_vendor_run_id_key;
ALTER TABLE scraper_actor_runs DROP CONSTRAINT IF EXISTS idx_scraper_actor_runs_vendor_status;

-- Drop the old enum types (they will be recreated by Drizzle or manually)
DROP TYPE IF EXISTS scraper_run_vendor CASCADE;
DROP TYPE IF EXISTS scraper_run_trigger_mode CASCADE;

-- Create the new enum types with correct case
CREATE TYPE scraper_run_vendor AS ENUM ('APIFY', 'BRIGHTDATA');
CREATE TYPE scraper_run_trigger_mode AS ENUM ('SYNC', 'ASYNC');

-- Recreate the constraints
ALTER TABLE scraper_actor_runs
ADD CONSTRAINT scraper_actor_runs_vendor_run_id_key UNIQUE (vendor, run_id);

CREATE INDEX idx_scraper_actor_runs_vendor_status ON scraper_actor_runs (vendor, status);
