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
  - **success:** A live regression run over the corpus in `evidence.md` returns a plan with a valid grouping label; the added response-schema fields cause no Gemini 400 and are optional in the consumer schema.

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
  - **intent:** Operators bound the work per post with caps in code, and a post stopped by a cap is visibly partial.
  - **success:** With default caps (6 extra steps, 120 events), a 203-event fixture stops at a cap, marks the post partial, and logs which cap fired.

- **CAP-7**
  - **intent:** A step that fails after its retries leaves the post resumable instead of silently incomplete.
  - **success:** After a forced step failure the post is marked partial with its cursor, and resuming from that cursor completes the remaining steps without redoing earlier ones.

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
- Requests multiply against the quotas of the keys used (subscriber BYOK keys by tier, then the system key); AD-13's quota rationale still binds, so caps are mandatory, not optional.
- No step loops inside one Lambda invocation: each step is a separate queue message carrying the cursor (stateless) that fits the PR #180 per-message budget (45s; blur floor 60s plus a 40s margin). The post stays in progress (not marked extracted, claim held) until its last step; each step writes its own audit row.
- Event identity `(post, extraction_ordinal)` stays unique and idempotent (AD-30 Rule 3); `extraction_ordinal` is `smallint`; the slug suffix follows the ordinal. Incremental steps need an allocation scheme (open question).
- Face blur stays fail-closed (AD-28): each step blurs only its own images and never sends unblurred bytes. `additionalImageUrls` remain extraction-time-only and never durable (AD-13 Rule 2). Stub events never notify (AD-30 Rule 10).
- The model is not trusted for limits: caps, the continue decision and the dedupe key are enforced in code; the cursor is advisory input to that code. The prompt's event cap was ignored in prior runs.
- Added response-schema fields must be verified live before shipping: growing the item schema once made Gemini reject whole requests with 400 INVALID_ARGUMENT.
- Image URLs expire about 5 days after scraping, so all steps of a post must run, or resume, inside that window.

## Non-goals

- Chunking single-event or complete-result posts (138 of the 209 over-cap posts are such carousels).
- A daily cap or any cross-post rate limiter.
- The multi-date-row prompt change, the `locationContext` field and any geocoding change (separate stories).
- Re-extracting or recovering posts already stored.
- Parallel step execution.
- Guaranteeing that every item of a very large roundup is imported; partial is an accepted, visible outcome.

## Success signal

Re-extracting a roundup like `DfLcqoqj-al` (cover + 13 slides) imports the items from every slide it reads, up to the caps, flags the post partial when a cap stops it, and its stub pages list their siblings; a 3-slide single-event post still costs exactly one request.

## Assumptions

- The prompt and schema v2 story (multi-date rows, `locationContext`) lands first, or this work depends only on the cursor/post-plan fields.
- The evidence is small (21 sampled posts, one run each, noisy); the starting values (3-image scout window, 25 events per call, 90% output rule, 2-slide step size) are to be tuned with the live regression harness.
- Roundup volume stays near the current 12 per 60 days, so serial steps taking minutes are acceptable.

## Open Questions

- Are the default caps (6 extra steps, 120 events per post) right? The 203-event example ends partial; raise them or accept partial?
- Ordinal scheme for incremental steps: per-step ordinal ranges from a next-free ordinal in the cursor, or content-key idempotency replacing `(post, ordinal)` (see `architecture-decisions-needed.md`).
- Scout window: the agreed "first 3 images" would read fewer images in the first request than today's cover + 5 and regress multi-schedule events with 4-6 images (their schedule counts grew with slides; 95% of posts have 6 images or fewer and are already fully read). Recommendation: keep today's first-request window for every post and start the cursor after slide 6, since an extra image costs about $0.0003. Confirm?
- Whose key pays for the extra requests, and does per-key request accounting need to gate the loop? The system key secret returned `API_KEY_INVALID` on 2026-11-09, so ingestion may rely entirely on subscriber keys; verify the tiers.
- Partial and resume state: a new column (for example `posts.extraction_partial`) or the audit rows only? Who triggers a resume: a scheduled sweep, the moderator Apply (AD-40), or both?
