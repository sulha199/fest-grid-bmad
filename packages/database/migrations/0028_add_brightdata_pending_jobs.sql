CREATE TYPE brightdata_job_status AS ENUM ('PENDING', 'COMPLETED', 'EXPIRED');

CREATE TABLE brightdata_pending_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES social_media_account_profiles(id),
  snapshot_id TEXT NOT NULL UNIQUE,
  webhook_token TEXT NOT NULL UNIQUE,
  status brightdata_job_status NOT NULL DEFAULT 'PENDING',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_brightdata_pending_jobs_status_expires ON brightdata_pending_jobs (status, expires_at);
