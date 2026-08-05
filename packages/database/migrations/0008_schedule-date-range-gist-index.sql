-- Custom SQL migration file, put you code below! --
CREATE INDEX IF NOT EXISTS "schedule_date_range_idx" ON "schedules"
USING gist (daterange(event_start_date, COALESCE(event_end_date, event_start_date), '[]'));