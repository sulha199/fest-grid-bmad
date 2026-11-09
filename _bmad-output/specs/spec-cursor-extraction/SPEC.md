---
id: SPEC-cursor-extraction
companions:
  - continue-rules.md
  - evidence.md
  - architecture-diagrams.md
  - architecture-decisions-needed.md
  - ../../project-context.md
sources: []
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability only — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# Cursor-based sequential AI extraction for multi-slide posts

## Why

A pain to solve. Posts with more images than the extraction read cap (cover + 5) import only a fraction of their events: post `DfLcqoqj-al` (a curator roundup, cover + 13 slides, poster text "203 events in Jogja across 2027") yielded 8 events. Three caps stack: 5 slides read (`MAX_CAROUSEL_IMAGES`), a prompt cap of 10 events that the model ignores and code truncates, and 8192 output tokens (about 30 events per call). Each roundup item then becomes its own stub page that gives no hint that other items exist. About 4.9% of posts exceed the read cap, but most of those are single-event photo carousels that must not be chunked, so extra extraction has to be selective. AD-13 rejected multi-call extraction until the batched cap "proves insufficient in practice"; this is that evidence.

## Capabilities

- **CAP-1**
  - **intent:** The system gets, from the first request of a multi-image post, a small post plan (claimed item count, per-slide role, items per list slide, date range covered, whether more items are likely) alongside the normal extraction.
  - **success:** A live regression run over the corpus in `evidence.md` returns a plan with a valid grouping label; the first request keeps today's read window (cover + 5 slides) for every post; the added response-schema fields cause no Gemini 400 and are optional in the consumer schema.

- **CAP-2**
  - **intent:** The system decides in code, after every step, whether another extraction is warranted, from the cursor and the step's result.
  - **success:** A pure decision function reproduces every row of `continue-rules.md` in unit tests, including both stop rules and the empty-step allowance.

- **CAP-3**
  - **intent:** Each extraction step is independent: it finishes within the per-message time budget and a redelivered step changes nothing.
  - **success:** A step message re-delivered twice produces the same events once (no duplicates, no new ordinals); no step starts below the PR #180 budget minimum.

- **CAP-4**
  - **intent:** The system detects truncated or at-risk model output and recovers by splitting the slide window, instead of losing items silently.
  - **success:** With `finishReason: MAX_TOKENS`, output at 90% or more of `maxOutputTokens`, a full per-call event cap, or `minEventCount` above events plus skipped items, a test shows the window split and retried down to 1 slide; an unparseable response is retried or recorded, never dropped without a trace.

- **CAP-5**
  - **intent:** Events found by later steps join the same post as roundup stubs without duplicating events from earlier steps.
  - **success:** Replaying the 26-event roundup `DfRtgnXE_41` in 3 steps yields 26 distinct events once; a step that re-finds an earlier event (same normalized name and start date) adds nothing.

- **CAP-6**
  - **intent:** The work per post is bounded by construction, and operators can switch the loop off.
  - **success:** For a 20-image fixture whose every response forces splits (14 unread images after the first request), total extra requests never exceed 2 x 14 (27 in the worst case, about 7 typically), and an injected violation logs and stops instead of continuing; with the kill switch off, a roundup takes the single-request path as today.

- **CAP-7**
  - **intent:** A post whose extraction is interrupted is finished automatically, with no human action, including when its image links have expired in the meantime; only a post that truly cannot be finished is left visibly partial.
  - **success:** A forced 429, 503 or Lambda timeout on one step is retried through the queue; when the queue's retries are exhausted, the next 5-minute tick re-enqueues the step from the persisted cursor; when the stored image links have expired with slides unread, one re-scrape replaces only the image links held in the cursor and the chain completes without repeating earlier steps or renumbering events; when the scraper refuses or fails, the slide count changed, or the attempts run out, the cursor is cleared, the post stays flagged partial, and the reason is logged.

- **CAP-8**
  - **intent:** One-event posts with several schedules spread over many slides get all remaining slides in one follow-up request rather than chunking.
  - **success:** A `program-lineup` fixture with 9 images makes exactly one follow-up call covering slides 7-9, and its schedules merge into the one event.

- **CAP-9**
  - **intent:** A visitor on a roundup stub page sees the sibling events of the same roundup, and a note when the list is known to be partial.
  - **success:** A roundup stub page lists its siblings from `event_posts`; the partial note appears only for posts flagged partial and links to the source post; an ordinary event page is unchanged; the `Query.events` and `Query.eventBySlug` plans are unchanged (AD-30 Rule 4).

- **CAP-10**
  - **intent:** Operators can see per step what was read, what was found and why the loop stopped.
  - **success:** Each step emits one greppable line with slides read, events added, input and output tokens, `finishReason`, and the stop rule or cap that ended the loop.

## Constraints

- Only posts selected by the continue rules leave the one-request path; every other post keeps exactly one request. This supersedes AD-13 Rules 1 and 3 and amends AD-30 Rule 5 (one call per post, per-post event cap); the new decision records that.
- Requests multiply against the quotas of the keys used (subscriber BYOK keys by tier, then the system key). 429 TooManyRequests and 503 ServiceUnavailable are already observed in the key monitoring and in our own calls, so every step tolerates them (queue retry with a delay; the steps of one post run serially, which spaces its requests) and the per-post request bound of CAP-6 is part of the contract. AD-13's quota rationale still binds.
- Resume is automatic: the cursor is persisted on the post (nullable; null when no chain is in flight), and the AI Lambda's existing 5-minute tick begins with a resume pass that re-enqueues the next step of any post whose claim is older than the claim TTL while its images are valid and attempts remain. No step of resuming needs a human.
- The first request keeps today's read window (cover + `MAX_CAROUSEL_IMAGES` slides, 6 images) for every post; the cursor starts after it. 95% of posts have 6 images or fewer and stay exactly as they are.
- No step loops inside one Lambda invocation: each step is a separate queue message carrying the cursor (stateless) that fits the PR #180 per-message budget (45s; blur floor 60s plus a 40s margin). The post stays in progress (not marked extracted, claim held) until its last step; each step writes its own audit row.
- Event identity `(post, extraction_ordinal)` stays unique and idempotent (AD-30 Rule 3); `extraction_ordinal` is `smallint`; the slug suffix follows the ordinal. Incremental steps need an allocation scheme (open question).
- Face blur stays fail-closed (AD-28): each step blurs only its own images and never sends unblurred bytes. `additionalImageUrls` remain extraction-time-only and never durable (AD-13 Rule 2). Stub events never notify (AD-30 Rule 10).
- The model is not trusted for limits: caps, the continue decision and the dedupe key are enforced in code; the cursor is advisory input to that code. The prompt's event cap was ignored in prior runs.
- Added response-schema fields must be verified live before shipping: growing the item schema once made Gemini reject whole requests with 400 INVALID_ARGUMENT.
- Image URLs expire about 5 days after scraping (the expiry is read from the URL itself). Before giving up on a post whose images expired, or whose slide fetch fails with 403, 404 or 410, with slides still unread, the resume pass re-scrapes it: at most 2 per post, at least 10 minutes apart, only through the guarded vendor-call wrapper (AD-32), the account scrape gate (AD-34) and the one-scrape-per-URL lease. The re-scrape replaces only the image links held in the cursor: progress (next slide, next ordinal, events found, empty steps, attempts) is untouched, the caption is never stored (AD-40) and `posts` is not rewritten. The fresh slide list must have the same count and order as the stored one, otherwise the cursor's slide index is not trustworthy and the post ends partial. Scraper credit is metered (the prod Apify account is on a capped free plan), so a refused or failed re-scrape ends the post partial with the reason logged; the scrape is never retried in a loop.

## Non-goals

- Chunking single-event or complete-result posts (138 of the 209 over-cap posts are such carousels).
- Tunable per-post caps (steps, events) and any cross-post or daily rate limiter; the loop is bounded by construction instead (CAP-6).
- The multi-date-row prompt change, the `locationContext` field and any geocoding change (separate stories).
- Re-extracting or recovering posts already stored.
- Parallel step execution.
- Guaranteeing that every item of a roundup is imported when a step cannot complete; the post is then flagged partial.

## Success signal

Re-extracting a roundup like `DfLcqoqj-al` (cover + 13 slides) imports the items from all 14 images, flags the post partial only if a step could not finish, and its stub pages list their siblings; a 3-slide single-event post still costs exactly one request.

## Assumptions

- The prompt and schema v2 story (multi-date rows, `locationContext`) lands first, or this work depends only on the cursor/post-plan fields.
- The evidence is small (21 sampled posts, one run each, noisy); the starting values (25 events per call, 90% output rule, 2-slide step size) are to be tuned with the live regression harness.
- Re-scrape starting values: at most 2 per post, 10 minutes apart (the AD-40 rescrape cooldown); a fresh scrape renews image validity by about 5 days.
- Resume starting values: claim TTL 30 minutes (the existing `POST_EXTRACTION_CLAIM_TTL_MINUTES`), up to 6 resume attempts with a growing delay, always bounded by the image expiry (about 5 days).
- Roundup volume stays near the current 12 per 60 days, so serial steps taking minutes are acceptable.

## Open Questions

- Ordinal scheme for incremental steps (see `architecture-decisions-needed.md`, AD-48). Recommendation: per-step ordinal ranges from a next-free ordinal carried in the cursor, assigned after a step's window result is final. Numbering by event `created_at` was considered and rejected: the number must exist before the event (ingestion looks up `(post, ordinal)` before inserting), and `created_at` reflects the race between parallel queue consumers, so a redelivered message could be numbered differently; across steps the ranges already ascend in discovery order, and within a step the order is (earliest start date, normalized name, original index), which is deterministic. Allocating "max + 1" at insert races between parallel ingestion messages, and a unique violation is treated as an idempotent skip (AD-30 Rule 3), which would silently lose an event. Confirm?
