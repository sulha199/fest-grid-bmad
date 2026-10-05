-- Story 3.6x / AD-30 Rule 11 -- partial unique index: NULLs are distinct in Postgres, so the
-- overwhelming majority of pre-AD-16 historical rows (platformPostId/platformPostType only
-- populated going forward, never backfilled) never collide. drizzle-kit 0.21.4 drops WHERE
-- predicates from its generated SQL (same class of gap as the hashtagsIdx/schedule_event_date_idx
-- hand-edit precedent above) -- hand-adding the predicate here. Preceded by a mandatory
-- pre-migration dedupe check against the target database (see story Dev Notes/Task 1); a non-empty
-- result blocks this migration from being applied.
CREATE UNIQUE INDEX IF NOT EXISTS "posts_platform_post_identity_idx" ON "posts" ("platform","platform_post_type","platform_post_id")
WHERE "platform_post_id" IS NOT NULL AND "platform_post_type" IS NOT NULL;