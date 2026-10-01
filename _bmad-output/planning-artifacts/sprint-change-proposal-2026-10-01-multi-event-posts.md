---
backlog_id: CC-024
status: approved
---

# Sprint Change Proposal — 2026-10-01 — Multi-event posts and cross-post event matching

**Trigger:** BUG-051 ("A post advertising multiple distinct events has its schedules incorrectly merged into one event"), investigated with `apps/backend/scripts/poc-ingestion-preview.ts` against four real Instagram posts. Folds in BUG-052 ("No duplicate-event detection across posts/accounts") because both need the same Event↔Post cardinality change, and — after a cross-backlog review on 2026-10-01 — BUG-026 (recurring weekday schedules), BUG-039 (scraped posts never auto-extract) and the CC-022 coauthor/publisher attribution stories (3.13–3.19), plus small amendments to 3.4n/3.4o, 3.8, 3.6a/3.6i/3.6j.

**Mode:** Incremental (each artifact edit reviewed and approved individually). **Scope:** Moderate, with one architect sign-off (AD-30).

---

## 1. Issue Summary

The ingestion pipeline assumes **one post = one event**. `events.post_id` carries a full `unique()` ([schema.ts](../../packages/database/schema.ts) `postIdUnq`), `process-ingestion-job.ts` uses `onConflictDoNothing({target:[events.postId]})` as its idempotency guard, and `process-ai-job.ts` builds a single event from a single Gemini payload (`eventName`, `schedules[]` at the top level). A post that advertises several distinct events therefore has its schedules merged into one event, and an event that several posts advertise cannot be linked to them.

### Evidence (four posts, scraped 2026-10-01, cached in `apps/backend/scripts/.poc-cache/`)

| Post | Caption/images | Correct grouping |
|---|---|---|
| `DdV_7Jsk6pw` (Sleman City Hall, "REBORN") | One anniversary: concert (28 Oct), circus (28 Oct–1 Nov), workshop/market, fireworks (1 Nov); one venue, no per-item sign-up | **One event**, several schedules (`program-lineup`) |
| `DdT1cgTlJ2k` (SMI drum contest) | Online audition → 30 finalists → final 17 Oct; video deadline 30 Sep | **One event**, dependent stages (`dependent-stages`) |
| `DcntzF0mB7z` (laridijogja) | Roundup of 5 `@`-tagged runs in caption; carousel calendar images list many more | **Several events** (`roundup`) |
| `Ddi9wU6RCRQ` (Vifation) | Billiard / PES / Futsal, each with its own registration window, technical meeting, match day | **Three events** (`separate-events`) |

### Prototype result (real request builder + experimental `events[]` schema, run twice, two headliner thresholds)

- Sleman, drum, Vifation (rule A) were stable. Rule B ("a standalone headliner alone splits an item") did **not** split Sleman and collapsed Vifation to one event in one run → **rule A chosen**.
- The roundup post yielded **39 events** (all with empty location and 0.95 confidence) → per-post cap, required date+location, no notifications for roundup-sourced events.
- The model used `umbrella-program` for both split and non-split outcomes → enum renamed.
- Vifation's registration windows were dropped from schedules in one run → prompt must state that registration windows are schedules.

### Side finding

`getPostByUrl` in `apps/backend/src/lib/scraper/instagram-adapter.ts` fails against the live `apify/instagram-post-scraper` actor (`Input is not valid: Field input.username is required`). Carved out as BUG-053.

---

## 2. Impact Analysis

### Epic impact
- **Epic 3 (in-progress)** is the home. Direct adjustment: seven new stories (3.6r–3.6x), three amended (3.6l, 3.6o, 3.6p). No new epic; Epic 3 can still complete. 3.6m (ready-for-dev) is unaffected: `hasFaceImage`/`faceImageCount` are post-level and stay at the payload root.
- Stories 3.6b (ingestion, review) and 3.6l (carousel extraction, review) are already built on the 1:1 assumption; 3.6r–3.6t extend them.

### Artifact conflicts
- **Schema:** `events.post_id` unique; no Event↔Post join; no `pg_trgm`.
- **Ingestion idempotency:** relies on the unique `post_id`.
- **AD-16 (slug + parallel oEmbed):** slug `{platform}_{type}_{platformPostId}` assumes one event per post, and Rule 6 reconstructs the oEmbed permalink from the slug alone — so a slug that does not name the primary post would embed the wrong post after a primary change.
- **Extraction contract:** `minScheduleCount`/`expectedScheduleNames` cannot express "three events".
- **Calendar entries:** `calendar_additions.schedule_id` is `ON DELETE CASCADE` — wholesale schedule replacement on enrichment would silently delete users' calendar entries.
- **Notifications:** one push per ingested event; a multi-event or roundup post would burst.
- **Not impacted:** AD-12/AD-28 image re-hosting is per post; hot-path resolvers keep reading `events.post_id` (see AD-30).

### Technical impact
Backend (extraction prompt/schema, ingestion, resolvers for new fields), `packages/database` (schema + migration + backfill), `packages/domain` (transform/insert-values, matching scorer), web (event detail, new post collection page), moderation tooling. No infrastructure change beyond the `pg_trgm` extension.

---

## 3. Recommended Approach

**Direct Adjustment (Option 1).** Effort High, risk Medium. Rollback not viable (nothing to revert). MVP scope unaffected.

Key decisions made with the user during this session:
1. **Full many-to-many now** (not just post 1:N), but with `events.post_id` **kept as the primary-post pointer** so the hot path is untouched.
2. **Slug follows the primary post** (Option 1): a primary change re-slugs and the old slug becomes an alias that redirects. Chosen over opaque stub slugs and over decoupling the slug from the post (which would have reversed AD-16's DB-free embed).
3. **Separate-event grouping rule A** (strong signals, or two weak signals; bounded window; dependent stages are schedules).
4. **Roundup posts:** extract only items with a readable date and location, capped per post (default 10); roundup-sourced events do **not** notify; their image is the roundup post's cover while they are stubs.
5. **Notifications are per event** (not per post), except roundup-sourced events, plus one notification when an event first gains an organizer-authored primary post.
6. **High-confidence cross-post matches auto-link** with no moderator; mid-confidence matches go to moderation.
7. **Account feeds match any linked post's account** (not just the primary's): a promoted event stays visible to subscribers of the roundup account and of the organizer. Implemented as an `EXISTS` over `event_posts` for the account filter and for `isFromSubscribedAccount` (EXPLAIN-gated).
8. **Automatic extraction (BUG-039): auto for new posts within quota.** After each scrape, new posts from subscribed accounts are enqueued automatically using the existing Tier 1/Tier 2 key round-robin and quota checks; manual selection (PRD §3.10) stays for older or over-quota posts.
9. **Related events** are lazy-loaded in two steps (IDs, then `Query.events` with `id in [...]`), rendered with the mobile calendar compact card, inline threshold **5**, overflow to a post collection page (not a popup, since event detail is already a modal) that **reuses the existing event-list UI and logic**.

---

## 4. Detailed Change Proposals

### 4.1 Architecture Spine (`festgrid-architecture-spine.md`) — owner: Winston

**New AD-30: Event↔Post is many-to-many; `events.post_id` stays the primary pointer.**
1. **Tables/columns.**
   - `event_posts(event_id FK cascade, post_id FK cascade, created_at)`, PK `(event_id, post_id)`, plus index `(post_id, event_id)` (post→events lookups, FK cascade, related-events step 1).
   - `events.post_id`: **kept**, now the **primary post** pointer; its `unique()` is dropped. The invariant "primary = `events.post_id`, and a matching `event_posts` row exists" is the single source of truth for primary — there is no `is_primary` column.
   - `events.extraction_ordinal smallint null`: index of the event within its primary post's extraction. New unique index `(post_id, extraction_ordinal)`, unconditional on `deleted_at` (a soft-deleted event is not recreated on re-extraction). Ingestion idempotency becomes `onConflictDoNothing` on that target. Existing rows backfill to ordinal 0.
   - `events.detail_level 'stub'|'full'` (roundup-sourced events start as `stub`); `events.merged_into_event_id uuid null`.
   - `posts.grouping_reason`, `posts.extracted_event_count` (nullable; post-level facts, not in the AD-29 audit table alone since product UI reads them).
   - `event_slug_aliases(slug unique, event_id FK)`.
   - `pg_trgm` extension + trigram index on `events.event_name` (write-path matching only; never on a hot-path query).
2. **Drift guard.** One write helper sets `events.post_id` and inserts the matching `event_posts` row in one transaction; a consistency check asserts every `events.post_id` has its `event_posts` row. (A deferrable composite FK would enforce it in the DB but Drizzle cannot express deferrable FKs.)
3. **Hot path.** `Query.events`, `Query.eventBySlug` and `Report.event` keep `events LEFT JOIN posts ON events.post_id = posts.id` unchanged — same join count, no `event_posts` read. Acceptance: EXPLAIN plans for both endpoints before/after on representative seed data show identical join count and no new Seq Scan. The account filter and `isFromSubscribedAccount` change deliberately: they match **any linked post's account** via `EXISTS (event_posts → posts → subscriptions)` (and, once Story 3.15 lands, the union of post-account associations). The per-row `isFromSubscribedAccount` EXISTS gains one index-lookup join, so the same EXPLAIN acceptance applies to it (plan shape must not regress beyond that one lookup; no new Seq Scan). `event_post_id_idx` is dropped only if EXPLAIN shows the planner does not need it beside the new composite unique index.
4. **Extraction output.** `events[]`, each with its own `schedules[]`; post-level `groupingReason` (`single-event | program-lineup | dependent-stages | separate-events | roundup`), `groupingRationale`, `skippedItems`, `minEventCount`; per-event `expectedScheduleNames`. `hasFaceImage`/`faceImageCount` stay at the payload root.
5. **Grouping rules** (ordered): (1) strong signals — own registration/ticket/fee/sign-up, own organizer handle, different venue — any one ⇒ separate event; (2) weak signals — standalone headliner/title, dates >~7 days apart, different category — two or more ⇒ separate; (3) items within ~7 days under one title and venue ⇒ one event; (4) dependent stages ⇒ one event, registration windows are schedules; (5) otherwise one event. Roundup: event per item only with a readable date and location, capped per post (default 10, configurable), reduced confidence when location missing.
6. **Matching (BUG-052).** Write-path step after extraction, before insert: candidates by overlapping dates (±2 days) plus trigram name similarity; score by same organizer account (post owner = the `@handle` tagged for the item, or the event's organizer), shared registration/ticket link, date+name similarity, venue/coordinates. High ⇒ auto-link; mid ⇒ moderation queue; low ⇒ new event. Primary-post rule: organizer-authored beats roundup/aggregator; then more extracted detail; then earlier post.
7. **Enrichment in place.** Fields with an approved correction or moderator edit are never overwritten (proposed changes queue for moderation). Schedules match by date: updated, added, never deleted while a `calendar_additions` row references them. On promotion the event adopts the matched candidate's `extraction_ordinal` under the new primary; re-running the roundup finds `event_posts(roundup, event)` and skips.
8. **Merge.** A moderator merge soft-deletes the loser with `merged_into_event_id`, repoints favorites/calendar entries/reports (deduplicated per user), and registers its slug as an alias.
9. **Organizer signals.** Each extracted event carries `organizerHandle` captured **at extraction time** (a `CURATOR_GUIDE` post's caption is nulled after extraction per Story 3.4o, so matching can never re-read it). `groupingRationale` is never persisted. `accountType = CURATOR_GUIDE` (Story 3.4n) marks an event `stub` and demotes that post in primary selection; once Story 3.15 lands, "organizer-authored" means a `PUBLISHER`/`COAUTHOR` association rather than `posts.accountId`.
10. **Post deletion.** Deleting a post (including profile/account erasure) promotes the next linked post to primary by the primary rule, else sets `events.post_id` null; `event_posts` rows cascade. The primary-pointer invariant is re-checked in the same transaction.
11. **Weekday-narrowed schedules (BUG-026).** `schedules.applicable_days_of_week` (PRD §4.4, already amended 2026-09-11) **already exists (Story 1.3k) and is not re-added**; it is populated by the per-event schedule schema/prompt, persisted by ingestion, and honored by day-of-week query matching (separate story, AD-17 EXPLAIN-gated).
12. **Related events.** `Query.relatedEventIds(eventId | postId)` is an index-only read of `event_posts`; the client then calls `Query.events` with the existing DSL condition `id in [...]`. No new `Query.events` filter or field resolver (AD-17).

**AD-16 amendment.** Slug for platform-sourced events is `{platformSlug}_{postType}_{platformPostId}` of the **primary** post, plus `~{ordinal}` when `extraction_ordinal > 0` (`ig_p_Ddi9wU6RCRQ`, `ig_p_Ddi9wU6RCRQ~2`) — `~`, not `-`, because `-` is a valid Instagram shortcode character and would make the suffix ambiguous (decided in the architecture session, AD-16 Rules 8–9). The invariant "the slug names the primary post" is what keeps Rule 6's DB-free oEmbed correct; a primary change re-slugs the event and records the old slug in `event_slug_aliases`; `eventBySlug` resolves aliases **only on a slug miss** and signals a permanent redirect to the canonical slug.

**AD-31 (companion, written in the same architecture session): post–account associations** — as written in the architecture session, AD-31 adds **no DDL**: AD-25 (2026-09-18) already resolved the `post_account_associations` DDL that Story 3.15 was blocked on. AD-31 fixes the role vocabulary (`PUBLISHER`/`COAUTHOR`/`SCRAPING_SOURCE`/`PUBLISHER_UNKNOWN`), the shared "organizer-authored" predicate and the event-level union-filtering helper, designed together with AD-30's `event_posts`.

**AD-17 note.** Related-events loading is detail-page-only and lazy; it adds nothing to `Query.events` per-row cost.

### 4.2 Epics (`epics.md`, Epic 3) — applied in this change

New stories (full ACs drafted at `bmad-create-story` time):

| Story | Title | Depends on |
|---|---|---|
| 3.6r | Add the event–post link table and multi-event schema | 3.6b |
| 3.6s | Extract multiple events per post with grouping rules | 3.6l, 3.6r |
| 3.6t | Ingest multiple events per post, with per-event slugs and notifications | 3.6r, 3.6s |
| 3.6u | Show all source posts and related events on the event detail page | 3.6r, 3.6t |
| 3.6v | Match new posts to existing events and enrich them in place (BUG-052) | 3.6t |
| 3.6w | Let moderators merge duplicate events, with slug redirects (BUG-052) | 3.6v |
| 3.6x | Show all events from a post on a post collection page | 3.6u |
| 3.6y | Respect weekday-narrowed schedules in day-of-week filtering (BUG-026) | 3.6r, 1.3j |
| 3.6z | Automatically enqueue new scraped posts for extraction within quota (BUG-039) | 3.5, 3.6t |

**Prerequisite edges (not folded; recorded as `Depends on`):** 3.6t and 3.6v after the IDEA-028 / AD-16 slug stories (platform-prefixed slugs, DB-free oEmbed); 3.6s after BUG-012 (Gemini request timeout — a 39-event response raises its importance; BUG-012 stays owned by `epic-0-i2`); 3.6u after 1.3j and 1.6c (CC-020 hot-path hardening, both in review); 3.6v after 3.13–3.15 (role-tagged post–account associations).

Notes: 3.6v owns the `event_slug_aliases` table and redirect-on-miss; 3.6w reuses it. 3.6x **reuses the existing event-list UI and logic** (`EventListView`, `PageContainer`/`PageHeader`/`GridContainer`, `useListPaginationController`, context-aware detail navigation) — no parallel list implementation. 3.6u caps inline related events at **5** per group with a "See all N events" link to 3.6x.

Additional amendments (cross-backlog review):
- **3.8** (push notifications): per event; none for roundup-sourced events; one notification when an event first gains an organizer-authored primary post.
- **3.4n / 3.4o** (account type / curator-guide minimization): `accountType` is a stub and primary-demotion signal; extraction captures `organizerHandle` before the caption is nulled; a stub's roundup cover from a non-opted-in curator account is a transient hotlink with the existing placeholder fallback.
- **3.6a / 3.6i / 3.6j** (timezone inference, private-contact and performer-leakage guards): run **per event** (explicit ACs in 3.6s/3.6t). **3.6k** (children's-data filter) stays post-level, so one match suppresses the whole post (conservative; accepted).
- **3.6r**: adds the post-deletion/primary-promotion AC (the `schedules.applicable_days_of_week` column already exists from Story 1.3k, so it is not added). **3.6s**: the per-event schedule schema carries `applicableDaysOfWeek` and `organizerHandle`, and sets an output cap. **3.6t**: persists `applicableDaysOfWeek`.
- **3.18** (union-of-associations account filtering): extends to the event level — match any post linked through `event_posts`. **0.i6g** (coauthor/publisher toggle on event/post detail) and CAP-7 attribution UI: unified with 3.6u's source-post entries (each entry: link, posted-at time, coauthors).
- **3.15**: already unblocked by AD-25 (2026-09-18); AD-31 from the same architecture session adds role semantics, not DDL.

Amendments: **3.6l** — `minScheduleCount`/`expectedScheduleNames` become per-event; **3.6o** — the relevance gate takes the max end across **all events** of the post; **3.6p** — also persists/logs event count and `groupingReason`.

### 4.3 PRD (`prd.md`) — owner: John via `bmad-prd`

- **§3.7** new bullet **Multi-Event Posts** (grouping rules, roundup guardrails, no roundup notifications, one extraction call per post, quota unchanged).
- **§3.7** new bullet **Cross-Post Event Matching** (auto-link on high confidence, moderation on mid, primary rule, in-place enrichment, first-organizer-post notification, merge + redirect, slug follows primary, related events).
- **§3.3.3** Source Attribution: link to **every** linked post (primary first, labelled by account/platform); embed and image/video from the primary post.
- **§4.1** `EventInfo.postId` is the primary post; add `sourcePosts?`, `detailLevel`, `mergedIntoEventId`; slug `~{ordinal}` note. **§4.7** `Post` may yield zero/one/several events; add `groupingReason?`, `extractedEventCount?`.
- **§3.4 / §3.5 / §3.10 (BUG-039):** state that newly scraped posts from subscribed accounts are extracted automatically within the Tier 1/Tier 2 key and quota rules, and that manual selection (§3.10) covers older or over-quota posts. §3.7 multi-event rules apply to auto-extracted posts too.
- **Account feeds:** the "Subscribed Events" feed and any account-filter semantics match an event linked to **any** of the subscribed account's posts.
- Add two FRs at the next free FR numbers.

### 4.4 UX (`EXPERIENCE.md`, `DESIGN.md`) — owner: Sally via `bmad-ux` (behavior contracts only)

1. **Source posts area** on event detail: one post as today; two or more → a link per original post, primary first, with account name and platform icon; embed stays on the primary post. Unified with CC-022's CAP-7: each source-post entry shows its original-post link, posted-at time (locale-aware formatter) and that post's coauthors, with the coauthor subscribe toggle from 0.i6g.
2. **Related events area** (lazy-loaded when it nears the viewport), grouped by post with labels such as "Events from [post/account]"; each item uses the mobile calendar compact card (`event_card_compact`) unchanged; inline cap **5** per group, then "See all N events" → post collection page; hidden when empty; skeletons match the compact card.
3. **Post collection page** (not a popup — event detail is already a modal): reuses the existing event-list UI/logic; route roughly `/posts/{platformSlug}/{postType}/{platformPostId}/events`, finalized in the `bmad-ux` pass; Next/Previous detail navigation inherits this list's context.
4. **Redirected slug:** old slug lands on the canonical page without a not-found flash.
5. **Stub events:** lighter "details coming" treatment, roundup cover as image (existing thumbnail-fallback tokens, no new visuals).
6. **Moderator tools (Story 4.7b surface):** suggested-match review list; merge action with confirmation and an undo window matching the soft-delete undo pattern.

### 4.5 Sprint status and backlog

- `sprint-status.yaml`: add 3-6r … 3-6z under `epic-3` as `backlog`.
- `backlog.yaml`: CC-024 (this proposal, `triaged`); BUG-051, BUG-052, BUG-026 and BUG-039 gain this proposal in `ref` (status unchanged until `bmad-create-story` promotes them); IDEA-028 gains `blocks: [CC-024]` (the AD-16 slug stories gate 3.6t/3.6v) and its design file is amended with the primary-slug invariant, `~{ordinal}` suffix and alias table; child rows BUG-053 (`getPostByUrl` actor input), FIND-061 (no new-event notification ever received — diagnose), IDEA-054 (notification burst throttling), IDEA-056 (LLM tie-break for mid-confidence matches).

---

## 5. Implementation Handoff

**Scope: Moderate**, with one architect sign-off.

| Role | Responsibility |
|---|---|
| Winston (architect) | Write AD-30 and the AD-16/AD-17 amendments (§4.1). Precondition for 3.6r. |
| John (product manager) | Apply PRD edits via `bmad-prd` (§4.3). |
| Sally (UX designer) | `bmad-ux` pass for §4.4 before 3.6u/3.6x. |
| Dev (`bmad-create-story` → `bmad-dev-story`) | Stories 3.6r–3.6x in dependency order. |

**Success criteria**
- Each of the four sample posts reproduces its expected grouping on repeated runs (fixtures for 3.6s).
- EXPLAIN plans for `Query.events` and `Query.eventBySlug` are unchanged before/after 3.6r.
- Re-running any post's ingestion creates no duplicate events.
- A promoted event serves the new primary post's image/video/embed, its slug names the primary post, and the old slug redirects.
- A roundup post yields at most the configured cap of events, none with a missing date or location, and sends no push notifications.
- Calendar entries survive enrichment and merge.
- A weekday-narrowed schedule matches only its stated weekdays in day-of-week filtering; newly scraped posts are enqueued automatically within quota; an event promoted from a roundup stays visible to the roundup account's subscribers.
- AD-30 and AD-31 are written together (Story 3.15 itself was already unblocked by AD-25).
