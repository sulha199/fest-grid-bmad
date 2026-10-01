# CC-024 Multi-Event Posts & Cross-Post Matching — Wave Plan

**Created:** 2026-10-01
**Status:** working doc — the progress tracker for `CC-024` (Multi-event posts and cross-post event
matching), the way `event-pages-closeout-wave-plan.md` tracked the event-pages tail. Tick boxes live.
**Source of truth on conflict:** `sprint-status.yaml` (story state) and `backlog.yaml` (intake rows)
always win over this file. If a box here disagrees with them, fix the box.

**Inputs:** `sprint-change-proposal-2026-10-01-multi-event-posts.md` (the approved proposal),
Architecture Spine **AD-30** (Event↔Post many-to-many), **AD-31** (post–account associations),
the **AD-16** (platform-prefixed slugs) and **AD-17** (hot-path rules) amendments, PRD **FR113**
(multi-event posts) and **FR114** (cross-post event matching), and the CC-024 section of
`design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`.

## Why a batch readiness sweep is worth it here

`bmad-epic-readiness-check` (Gate 1 architecture/infrastructure + Gate 3 foundational dependencies)
last swept **Epic 3 on 2026-09-11**, before any of these stories existed. So **3.6r–3.6z were never
swept**, nor were **3.13, 3.14, 3.15, 3.18** (coauthor attribution, added 2026-09-18), and the
**IDEA-028** (platform-prefixed slugs) stories are new (split into 3.7f–3.7i on 2026-10-01). This wave also changes
shared plumbing that many stories touch at once — one DB migration, the extraction response shape,
the queue message shape, slug generation and the two highest-traffic resolvers — which is exactly
what Gate 1 and Gate 3 exist to catch *once* instead of per story. The repo already has the shape for
it: `epic-readiness/batch-event-pages-wave-a-readiness.md` is a **batch-scoped** report (not
per-epic). Gate 2 (UI) stays per story.

**Not worth sweeping:** 3.6m–3.6q (covered by the CC-023 proposal), 1.3j / 1.6c / 1.3k (swept by
the event-pages batch), and 3.16 / 3.17 / 3.19 (coauthor stories not on this wave's critical path).

### Things the sweep should verify (pre-flagged during planning)

- [x] **`pg_trgm` availability.** Local native Windows Postgres 18.4: verified available 2026-10-01
      (version 1.6, not installed yet — the migration needs `CREATE EXTENSION`). Supabase production:
      confirmed by the user 2026-10-01. Remember the extension lives in Supabase's `extensions` schema
      (qualify `gin_trgm_ops` or confirm `search_path`) and migrations run over the direct connection.
- [ ] **Queue message compatibility:** `DataIngestionQueue` gets one message per event with a new
      `extractionOrdinal`; messages already in flight at deploy time must default to ordinal 0.
- [ ] **Migration safety:** backfill of `events.extraction_ordinal` and `event_posts` for every
      existing event with a post; unique index on `(post_id, extraction_ordinal)` on a live table.
- [x] **EXPLAIN evidence harness:** done 2026-10-01. Permanent deterministic synthetic-volume seed
      (`pnpm --filter @festgrid/database seed:volume`; 30,000 events by default, relative dates, additive
      and cleanable) and a "before" baseline in `cc-024-explain-baseline-2026-10-01.md`. 3.6r re-runs the same
      four scenarios and compares. (3.6r should promote a clean version of the throwaway capture script.)
- [ ] **Next.js alias redirect:** a permanent redirect from `eventBySlug` in both the full-page and
      the intercepted modal route (3.6v), with no not-found flash.
- [ ] **Output size / timeout:** a 39-event roundup response vs the Gemini call's missing timeout
      (BUG-012, owned by epic `epic-0-i2`; stories 0.i2a–0.i2c, all `backlog`).
- [ ] **Migration ordering** between 3.6r (AD-30) and 3.15 (post–account associations, AD-31):
      both change `packages/database/schema.ts`.
- [ ] **Per-event guards:** timezone inference (3.6a), private-contact and performer-leakage (3.6i,
      3.6j) must run per event — confirm they are not shared mutable state across events.

## Wave 0 — Planning artifacts (done)

- [x] Sprint Change Proposal CC-024 approved and registered (commit `1aca854e`)
- [x] Architecture Spine: AD-30, AD-31, AD-16 and AD-17 amendments (commit `6b65be60`)
- [x] PRD: FR113 and FR114 plus the section edits (commit `793e1f34`)
- [x] UX contracts in `EXPERIENCE.md` + accessibility lens review (commit `073cca5d`)
- [x] Story 3.6y (weekday-narrowed schedules in day-of-week filtering) kept, narrowed to the backend
      filter gap (Story 1.3k already ships the column and calendar rendering; verified that
      `buildEventsQueryCondition`/`drizzle-where` do not read `applicableDaysOfWeek`)

## Wave 1 — Hygiene, then the readiness sweep

- [ ] Push `master` (4 local CC-024 commits) or move them to a branch + PR; the
      `docs/cc-024-multi-event-posts-proposal` branch is stale at `1aca854e` — delete or fast-forward it
- [ ] `epics.md`: add FR113 and FR114 to the requirements inventory and coverage map
- [ ] PRD loose ends: do suggested matches count toward the moderator badge (§3.9.3)? Add
      `publishedAt` to the `Post` interface (needed for the posted-at time in source-post entries)
- [ ] **Run `bmad-epic-readiness-check`, batch-scoped** over 3.6r, 3.6s, 3.6t, 3.6u, 3.6v, 3.6w,
      3.6x, 3.6y, 3.6z, 3.7f, 3.7g, 3.7h, 3.7i, 3.13, 3.14, 3.15, 3.18 (Gates 1 and 3) → `epic-readiness/batch-cc-024-multi-event-readiness.md`
- [ ] Fold any new prerequisite stories the sweep finds into `epics.md` and `sprint-status.yaml`

## Wave 2 — Prerequisites and diagnostics (no CC-024 behavior change yet)

- [x] **IDEA-028** (platform-prefixed event slugs, AD-16) split into four stories in `epics.md` and
      `sprint-status.yaml` (2026-10-01), so the readiness sweep covers them:
  - [ ] **3.7f** Capture each post's platform post id and permalink type at scrape time — *gates 3.6t*
  - [ ] **3.7g** Build platform-prefixed event slugs at ingestion — *needs 3.7f; gates 3.6t and 3.6v*
  - [ ] **3.7h** Resolve Instagram oEmbed from the event slug without a database lookup — *needs 3.7g, 3.7e; gates 3.6v*
  - [ ] **3.7i** Fetch the event-detail oEmbed in parallel with the event query — *needs 3.7h, 3.7d, 1.6c*
  - [ ] Each: create-story → dev-story → code-review
- [ ] **FIND-061** (no new-event push ever received): diagnose before 3.6t/3.6z ship per-event
      notifications. Leads: inner joins to `user_settings`/`fcm_tokens`, empty `sourceSocialMediaAccountId`,
      `pushNotificationsEnabled` default
- [ ] **BUG-053** (`getPostByUrl` fails against the live Apify actor): fix so the POC script and the
      by-URL resolver path work, and the 4 reference posts can be re-scraped for 3.6s fixtures
- [ ] **BUG-012** (no Gemini request timeout; epic `epic-0-i2`): at least Story 0.i2a (guarded vendor
      call wrapper) in place before 3.6s, or an explicit output cap + timeout inside 3.6s
- [ ] **3.13** (normalize vendor coauthor/publisher roles) → **3.14** (deduplicated subscribable
      profiles) → **3.15** (post–account association table + migration): create-story, then dev. Gates 3.6v
- [ ] Prerequisite stories **1.3j**, **1.6c**, **1.3k** are at `review`: standing rule is to build
      against `review`-status prerequisites, so no wait — confirm they reach `done` before 3.6u/3.6y close

## Wave 3 — Core build (strictly sequential)

Per story: `create-story` → `dev-story` → `code-review` → status verified in `sprint-status.yaml`.

- [ ] **3.6r** Add the event–post link table and multi-event schema — *needs AD-30; attach before/after
      EXPLAIN plans for `Query.events` and `Query.eventBySlug`*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review  - [ ] EXPLAIN evidence attached
- [ ] **3.6s** Extract multiple events per post with grouping rules — *needs 3.6r; fixtures: the 4
      reference posts, run repeatedly, grouping must match every run*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review  - [ ] fixtures stable across runs
- [ ] **3.6t** Ingest multiple events per post, with per-event slugs and notifications — *needs 3.6r,
      3.6s, 3.7f and 3.7g*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review  - [ ] re-run creates no duplicates

## Wave 4 — Read side, matching, auto-extraction, weekday filter

- [ ] **3.6u** Show all source posts and related events on the event detail page — *needs 3.6r, 3.6t,
      1.3j, 1.6c; coordinate with 0.i6g (coauthor attribution UI); 3.7h/3.7i recommended*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review  - [ ] hot-path EXPLAIN unchanged
- [ ] **3.6v** Match new posts to existing events and enrich them in place — *needs 3.6t, 3.13–3.15,
      3.4n, 3.7g and 3.7h*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review  - [ ] promotion keeps favorites/calendar entries
- [ ] **3.6y** Respect weekday-narrowed schedules in day-of-week filtering — *needs 3.6r, 1.3j*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review
- [ ] **3.6z** Automatically enqueue new scraped posts for extraction within quota — *needs 3.5, 3.6t;
      soft: FIND-061 diagnosed*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review

## Wave 5 — Moderation and collection page

- [ ] **3.6w** Let moderators merge duplicate events, with slug redirects — *needs 3.6v, 4.7b*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review
- [ ] **3.6x** Show all events from a post on a post collection page — *needs 3.6u; reuses the
      existing event-list UI and logic, no parallel list implementation*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review
- [ ] **3.18** Union-of-associations account filtering (amended: event level via `event_posts`) — *needs 3.15, 3.6r*
  - [ ] create-story  - [ ] dev-story  - [ ] code-review

## Wave 6 — Batch-end checks and closeout

- [ ] One batch-end pass of lint, build and test after the code waves (orchestrator Step 4.5)
- [ ] Verify the proposal's success criteria (§5 of the proposal):
  - [ ] The 4 sample posts reproduce their expected grouping on repeated runs
  - [ ] EXPLAIN plans for `Query.events` / `Query.eventBySlug` unchanged before vs after 3.6r
  - [ ] Re-running any post's ingestion creates no duplicate events
  - [ ] A promoted event serves the new primary post's image/video/embed; its slug names the primary; the old slug redirects
  - [ ] A roundup yields at most the cap of events, none missing a date or location, and sends no push
  - [ ] Calendar entries survive enrichment and merge
  - [ ] A weekday-narrowed schedule matches only its stated weekdays in day-of-week filtering
  - [ ] An event promoted from a roundup stays visible to the roundup account's subscribers
- [ ] Update `backlog.yaml`: BUG-051, BUG-052, BUG-026, BUG-039 promoted/done as stories complete; CC-024 derived status
- [ ] Deferred rows revisited: **IDEA-054** (notification burst throttling), **IDEA-056** (LLM tie-break for mid-confidence matches)

## Dependency summary

| Story | Depends on |
|---|---|
| 3.6r | 3.6b, AD-30 |
| 3.6s | 3.6l, 3.6r; BUG-012 (via 0.i2a) |
| 3.6t | 3.6r, 3.6s, 3.7f, 3.7g |
| 3.6u | 3.6r, 3.6t, 1.3j, 1.6c; coordinate 0.i6g (3.7h/3.7i recommended) |
| 3.6v | 3.6t, 3.13–3.15, 3.4n, 3.7g, 3.7h |
| 3.6w | 3.6v, 4.7b |
| 3.6x | 3.6u |
| 3.6y | 3.6r, 1.3k, 1.3j |
| 3.6z | 3.5, 3.6t |
| 3.18 | 3.15, 3.6r |

## Decision log (for reference)

Full-M:N with `events.post_id` kept as the primary pointer (hot path untouched); slug names the primary
post, re-slug + alias on primary change; rule-A grouping (strong signals, or two weak ones); roundup
cap 10 with required date and location; roundup events don't notify; per-event notifications; high-score
matches auto-link; account feeds match any linked post; auto-extraction for new posts within quota;
related events are a lazy two-step load with a cap of 5 inline and a post collection page for more.
