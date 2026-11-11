-- Story 10.3 -- hand-written because drizzle-kit 0.21 drops the WHERE clause of a partial index (AD-8 workaround).
-- Reuse backstop (FR120): at most one OPEN (non-terminal), non-follower job per owner, type and input key, so two
-- simultaneous starts of the same work can never both be written. Followers (leader_job_id set) and system jobs
-- (no owner) are outside it.
CREATE UNIQUE INDEX IF NOT EXISTS "uq_jobs_open_input"
  ON "jobs" ("owner_user_id", "type", "input_key")
  WHERE "owner_user_id" IS NOT NULL
    AND "leader_job_id" IS NULL
    AND "status" NOT IN ('SUCCEEDED', 'SUCCEEDED_WITH_LIMITS', 'FAILED', 'EXPIRED');
--> statement-breakpoint
-- A user's waiting jobs in queue order (oldest queued_since first): the promotion and queue-wait queries.
CREATE INDEX IF NOT EXISTS "idx_jobs_queue"
  ON "jobs" ("owner_user_id", "queued_since")
  WHERE "admitted_at" IS NULL AND "status" = 'QUEUED';
