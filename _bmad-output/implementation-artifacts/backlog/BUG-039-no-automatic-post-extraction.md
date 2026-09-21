---
backlog_id: BUG-039
title: "Scraped posts never auto-extract - only manual post selection triggers extraction, not scrape-time"
captured: 2026-09-21
---

# BUG-039 — No automatic post extraction after scrape

## Capture

User checked the production `posts` table and found every post scraped the previous day still
had `is_extracted = false`. Asked whether auto-ingest was broken, or whether `is_extracted =
false` can also just mean "extraction still in progress." Follow-up, after the initial
investigation below: the user corrected the conclusion — posts are *supposed* to be extracted
automatically on scrape, which is the entire reason the round-robin BYOK key-sharing mechanism
(PRD §3.4/§3.5) exists in the first place.

## Investigation

`posts.is_extracted` (`packages/database/schema.ts:284`) is a plain boolean, `default(false)`.
There is no separate "queued" or status column, so the column alone cannot distinguish "never
selected for extraction" from "enqueued but AI processing hasn't finished yet."

Traced the pipeline end to end:

1. **Scrape → persist**: `apps/backend/src/lib/scraper/process-scrape-job.ts` calls
   `persistScrapedPost` (`apps/backend/src/lib/posts/persist-scraped-post.ts`) for every scraped
   post. This function only inserts/updates the `posts` row — it never calls anything that
   enqueues extraction.
2. **The only enqueue path**: `enqueuePostForProcessing`
   (`apps/backend/src/lib/posts/enqueue-post-for-processing.ts`) is the function that actually
   pushes a post onto the AI-processing SQS queue (`AIProcessingQueue`, consumed by
   `process-ai-job.ts`, which does use the round-robin/fairness key selection in
   `packages/domain/src/ai-gateway/select-api-key.ts`). A repo-wide search found **exactly one
   caller** of `enqueuePostForProcessing`: the `selectPostsForExtraction` GraphQL mutation
   (`apps/backend/src/schema/resolvers.ts:1988`).
3. **That mutation is manual-only**: it requires an authenticated user, an active subscription
   to the post's account, and available extraction quota, and is only ever invoked from the
   `posts/select` UI (`apps/web/src/app/[locale]/posts/select/posts-select-content.tsx`) where a
   user browses their subscribed accounts' posts and explicitly checks boxes to submit them.
4. Story history confirms this was never wired otherwise: `3-5-add-new-posts-to-a-processing-
   queue.md` built `enqueuePostForProcessing` and explicitly noted "no existing caller anywhere
   in the codebase yet"; `5-1a-build-the-manual-post-selection-and-extraction-graphql-api-
   layer.md` is what gave it its first (and only) caller.

## PRD tension

PRD §3.4 (Account Subscription) states plainly: *"Event data from these subscribed accounts
will be processed by an AI agent to extract event details... the system will intelligently
utilize any valid API key from contributing users."* §3.5's Quota Management Algorithm
describes Tier 1 (single-subscriber) and Tier 2 (round-robin with fairness across multiple
subscribers' keys) — both phrased as automatic, system-driven processing, not something a user
opts into per post.

PRD §3.10 ("Manual Post Selection for Event Extraction") was added later, framed as giving
"users greater control over their API quota usage" — i.e. as an *additional* control surface,
not a description of the only path. As implemented, §3.10's mechanism is the sole path; §3.4/
§3.5's automatic round-robin processing has no trigger at all.

## Open question (needs a PRD/architecture decision, not just a code fix)

Was automatic extraction ever built and then the trigger got dropped, or was §3.10 meant to
fully supersede automatic extraction and the PRD's §3.4/§3.5 language was simply never updated
to reflect that pivot? The round-robin key-selection logic itself (`select-api-key.ts`) and the
whole AI-processing pipeline downstream of an enqueue already exist and work — the only missing
piece is the automatic trigger (plus whatever quota-gating policy should apply to auto-enqueued
posts, as distinct from the existing quota check on manual selection). This needs a
`bmad-correct-course` or PRD-update pass to decide the intended behavior before a story is
written.
