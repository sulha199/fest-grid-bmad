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

The readiness sweep is done; the remaining hygiene items live in the blocker checklist below.

- [x] **Run `bmad-epic-readiness-check`, batch-scoped** (done 2026-10-01, commit `90c0c0cd`) over 3.6r, 3.6s, 3.6t, 3.6u, 3.6v, 3.6w,
      3.6x, 3.6y, 3.6z, 3.7f, 3.7g, 3.7h, 3.7i, 3.13, 3.14, 3.15, 3.18 (Gates 1 and 3) → `epic-readiness/batch-cc-024-multi-event-readiness.md` — **no new prerequisite stories; 3 AC corrections applied** (0.i2c, 3.6t, 3.6v)
- [x] Fold any new prerequisite stories the sweep finds into `epics.md` and `sprint-status.yaml` — none needed

## Open blockers and loose ends (checked against the files 2026-10-02)

Tick as each is closed. Evidence for each line is in the file named beside it.

**Solved**
- [x] Readiness sweep (above)
- [x] **3.15** (post–account association table) was "blocked pending architecture": AD-25 (2026-09-18) settled the DDL and
      AD-31 the role semantics; `sprint-status.yaml` shows it as `backlog`, no longer `blocked`

**Blocked on an architecture decision (does not gate CC-024)**
- [ ] **Guarded vendor-call wrapper — write AD-32 via `bmad-architecture`.** The Architecture Spine ends at AD-31 and has no decision
      for it. Then build **0.i2a** (build the guarded vendor call wrapper; carries the FIND-004 vendor-DPA compliance gate) →
      **0.i2c** (adopt the wrapper in the async inference path; amended 2026-10-01 to cover `callGemini`) → **0.i2b** → **0.i2z**.
      All four are `backlog` in `sprint-status.yaml`
  - [ ] Vendor DPA confirmation decision (FIND-004) — needs your input, not only a code change
- [ ] **Interim inline guard in Story 3.6s** (request timeout + output cap on the extraction call; AC amended in `epics.md`) —
      built as part of 3.6s, not yet implemented; 0.i2c later deletes it

**Documentation loose ends (small)**
- [x] `epics.md`: FR113 and FR114 added to the requirements inventory, the FR coverage map and Epic 3's "FRs covered" (2026-10-02)
- [x] PRD §4.7: `publishedAt` added to the `Post` interface (commit `ca76e7e3`, 2026-10-02)
- [x] PRD §3.9.3: decided 2026-10-02 — suggested matches DO count toward the moderator badge (commit `ca76e7e3`)
- [x] PRD: auto-extraction (BUG-039) wording stays in §3.7/§3.10 — confirmed 2026-10-02

**Backlog hygiene**
- [x] The three test-environment findings filed on the board (2026-10-02): FIND-062 (time-zone fixture), FIND-063 (`.env` key tests), FIND-064 (shared dev database)

**Housekeeping**
- [ ] `bmad-code-review` for 3.7f, 3.7g, 3.7h, 3.7i (all `review`; not blocking under the standing rule)
- [ ] Push `master` (many local commits, nothing pushed) or move them to a branch + PR; the
      `docs/cc-024-multi-event-posts-proposal` branch is stale at `1aca854e` — delete or fast-forward it

## Readiness sweep result (2026-10-01)

Report: `epic-readiness/batch-cc-024-multi-event-readiness.md`. Verdicts: **READY** — 3.6r, 3.6u, 3.6w,
3.6x, 3.6y, 3.7f, 3.7g, 3.7h, 3.7i, 3.13, 3.14, 3.15, 3.18. **READY-WITH-CORRECTION** (applied) — 3.6t
(queue message without `extractionOrdinal` defaults to ordinal 0), 3.6v (alias redirect wired into both
Next.js slug routes; `getEventBySlugCached` must not swallow a redirect signal). **READY-WITH-CAVEAT** — 3.6s
and 3.6z (the unguarded Gemini call, see the BUG-012 item below). Order to create stories: 3.7f → 3.7g → 3.7h →
3.7i alongside 3.13 → 3.14 → 3.15, then 3.6r → 3.6s → 3.6t → 3.6u/3.6y/3.6z → 3.6v → 3.6w/3.6x/3.18.

## Order of work (from the readiness sweep, 2026-10-01)

Create stories one at a time via `bmad-create-story`, building each (`bmad-dev-story`) before anything that
depends on it. Wave labels below follow this order; stories inside a wave are listed in dispatch order.

1. **Wave 2A** — Slug foundation: 3.7f → 3.7g → 3.7h → 3.7i
2. **Wave 2B** — Coauthor/publisher roles: 3.13 → 3.14 → 3.15 (independent of 2A; may interleave)
3. **Wave 2C** — Diagnostics: FIND-061, BUG-053
4. **Wave 3** — Core build: 3.6r → 3.6s → 3.6t
5. **Wave 4A** — 3.6u, 3.6y, 3.6z (any order after 3.6t)
6. **Wave 4B** — 3.6v (needs 3.13–3.15 and 3.7g/3.7h)
7. **Wave 5** — 3.6w, 3.6x, 3.18

**Per-story box legend:** `create` = `bmad-create-story` done (story file exists, status `ready-for-dev`);
`dev` = `bmad-dev-story` done (`review`); `review` = `bmad-code-review` done. Orchestrator batch state files
live in `_bmad-output/specs/ritual-session-orchestrator/mailbox-runner/` (`.batch-state-cc024-*.json`).

## Test-gate facts learned while orchestrating Wave 2A (2026-10-01)

Read this before trusting a red gate. None of these come from CC-024 stories.

- **Stale `node_modules` after pulling master** broke the first gate (declared but not installed:
  `@aws-sdk/client-cloudfront` in apps/backend, `@radix-ui/react-radio-group` in packages/ui). Fix:
  `pnpm install --frozen-lockfile` (lockfile unchanged). Do this after every pull.
- **Time-zone test:** `packages/ui` `format-event-date.test.ts` ("endTime present, endDate today, now BEFORE
  the combined end instant") passes under `TZ=UTC` and fails in Asia/Jakarta — the shared fixture in
  `packages/domain/src/events/__fixtures__/ended-cases.ts` assumes UTC. Run gates with `TZ=UTC`.
- **`.env` system key:** 4 backend `system-key-adapter` tests fail because `.env` now defines
  `SYSTEM_GEMINI_API_KEY` and `loadBackendEnv()` re-reads it after the test `delete`s it from `process.env`.
- **Synthetic volume pollutes the DB-backed tests:** with `seed:volume` rows present, 12 backend integration
  tests failed and the run took ~640 s; after `seed:volume:clean` only the 4 key tests failed. Always clean
  before running tests.
- **Backend suite is slow:** ~570 s (800 tests) when clean; the gate's 1,200 s timeout is fine, but the
  orchestrator's per-story `--checks test` is expensive. With these known failures the auto-dispatched
  quick-dev fix would chase environment problems, so Wave 2A dev stories run through the plain dispatch and
  the whole-repo gate runs once at the end (`TZ=UTC`, volume cleaned), tolerating the 4 key-test failures.
- **Headless sessions cannot wait on background tasks:** twice a dev-story child started a long test run in the
  background and ended its turn ("will continue once it finishes"), which ends the process and leaves the story
  half-recorded (3.7f first run, 3.7h first and second runs). Dev prompts now say: foreground-only tests, targeted
  test files only, never end a turn while anything runs, finish all bookkeeping before stopping.
- **Filed 2026-10-02 as FIND-062, FIND-063, FIND-064:** (1) `isEventEnded` shared fixture is time-zone dependent;
  (2) `system-key-adapter` tests depend on `.env` lacking `SYSTEM_GEMINI_API_KEY`; (3) DB-backed backend
  integration tests share the developer database, so any extra data breaks them.

## Wave 2A — Slug foundation (BUILT 2026-10-02; code review pending)

**Batch-end gate (2026-10-02, `TZ=UTC`, volume seed cleaned):** lint 8/8 pass; build 8/8 pass; tests: backend 807 run, 802 pass, 4 fail, 1 skipped (the 4 are the known `system-key-adapter` / `.env` `SYSTEM_GEMINI_API_KEY` failures), domain 372 pass, ui 816 pass, web 550 pass, database 10 pass, infrastructure 4 pass. No failure comes from Wave 2A.

- [ ] **3.7f** Capture each post's platform post id and permalink type at scrape time — *gates 3.6t* (dev done, commit `90dae6d9`, status `review`)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.7g** Build platform-prefixed event slugs at ingestion — *needs 3.7f; gates 3.6t and 3.6v* (story created 2026-10-02, status `ready-for-dev`) (dev done, commit `04c94a42`, status `review`)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.7h** Resolve Instagram oEmbed from the event slug without a database lookup — *needs 3.7g, 3.7e; gates 3.6v* (story created 2026-10-02, status `ready-for-dev`; Lazy-join design confirmed with user — opt-in/durable fallback join runs only on the UNAVAILABLE branch) (dev done, commit `f3e1bcac`, status `review`)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.7i** Fetch the event-detail oEmbed in parallel with the event query — *needs 3.7h, 3.7d, 1.6c* (story created 2026-10-02, status `ready-for-dev`; Gate 2 run fresh — no gap, hook logic kept inline in `EventDetailWrapper.tsx`, not extracted) (dev done, commit `ba6f33be`, status `review`)
  - [x] create  - [x] dev  - [ ] review
- [x] IDEA-028 (platform-prefixed event slugs) split into 3.7f–3.7i in `epics.md` / `sprint-status.yaml` (2026-10-01)

## Deferred track — Gemini call guard (does NOT gate this wave)

- [ ] **Architecture decision needed first.** No AD exists for the guarded vendor-call wrapper (AD-1–AD-31 have
      none) and **0.i2a** (build the guarded vendor call wrapper) says it establishes one; it also carries the
      FIND-004 vendor-DPA compliance gate. Run `bmad-architecture` for it (AD-32) before 3.6-series
      work needs it. Then **0.i2a** → **0.i2c** (amended to cover `callGemini`) → 0.i2b.
- [x] **3.6s carries a minimal inline guard instead** (`AbortController` timeout + output-size cap on the
      extraction call; amended in `epics.md` 2026-10-01). When 0.i2c lands it replaces the inline guard.

## Wave 2B — Coauthor and publisher roles (BUILT 2026-10-02; code review pending; gates 3.6v)

Run from a Claude Code cloud session (Linux, local Postgres via `scripts/cloud-db-setup.sh`), all-claude-medium preset.
Decisions taken during the wave: 3.14 threads an explicit `vendor` parameter into `persistScrapedPost`; 3.15 sets new
posts' `posts.accountId` to the canonical PUBLISHER (AC3 spec-literal), accepting that a subscribed account's
reposts/collabs drop out of its subscribed-feed filter until **3.18** switches the filter to `post_account_associations`.

**Batch-end gate (2026-10-02, `TZ=UTC`):** lint 8/8 pass; build 8/8 pass (one transient `web#build` failure with no
diagnostic, clean on re-run and standalone); tests: 28 backend failures on the first run. 3 were a Wave 2B regression
(3.15's FK broke 3.14 test cleanup) — fixed by quick-dev commit `7cf3b28`, the six affected files then 55/55 green.
The other 25 are cloud-environment only, not Wave 2B: 24 geolocation/location tests need `GEOAPIFY_API_KEY`, and the
Bright Data `CAPACITY_EXHAUSTED` test runs against `.env.example` placeholders. Polish findings from the quick-dev
self-review are in `deferred-work.md`.

- [ ] **3.13** Normalize Apify vendor coauthor/publisher roles during ingestion (dev done, commit `3d96426`, status `review`)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.14** Deduplicated, provenance-tracked subscribable profiles — *needs 3.13* (dev done 2026-10-02, status `review`; DB migration 0063 applied; new `onConflictDoUpdate` upsert pattern in `getOrCreateDiscoveredAccountProfile`, flagged for code review; 11 new tests, targeted domain 62/62 + backend 43/43 green, build/lint clean)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.15** Post-account association table + lossless migration — *needs 3.13/3.14 outputs; AD-25 and AD-31 settle the DDL* (dev done 2026-10-02, status `review`; DB migration 0064 applied, 81/81 legacy posts backfilled `PUBLISHER_UNKNOWN`; 11 new/extended tests, targeted 40/40 green, domain/database/backend build + lint clean)
  - [x] create  - [x] dev  - [ ] review
- [ ] Prerequisite stories **1.3j**, **1.6c**, **1.3k** are at `review`: standing rule is to build against
      `review`-status prerequisites, so no wait — confirm they reach `done` before 3.6u/3.6y close

## Wave 2C — Diagnostics (no CC-024 behavior change)

- [x] **FIND-061** (no new-event push ever received): diagnosed 2026-10-02, bmad-quick-dev — all 3 leads
      (inner joins to `user_settings`/`fcm_tokens`, empty `sourceSocialMediaAccountId`,
      `pushNotificationsEnabled` default) traced end-to-end and refuted/unreproducible against current
      code; recipient query verified correct via real-Postgres regression test (4/4 pass). No local root
      cause confirmed, no code changed — remaining candidates (frontend FCM env config, backend FCM admin
      creds) are production-only checks, see `backlog/FIND-061-no-new-event-push-notification-diagnosis.md`.
      3.6z's "soft: FIND-061 diagnosed" prerequisite is satisfied; it is not a guarantee notifications work
      in production.
- [x] **BUG-053** (`getPostByUrl` fails against the live Apify actor): fix so the POC script and the by-URL
      resolver path work, and the 4 reference posts can be re-scraped for 3.6s fixtures
      (fixed 2026-10-02, bmad-quick-dev — code fix + unit test; live re-scrape of the 4 reference
      posts still owed on a machine with `APIFY_API_TOKEN` set, see backlog.yaml BUG-053 note)

## Wave 3 — Core build (strictly sequential)

Per story: `create-story` → `dev-story` → `code-review` → status verified in `sprint-status.yaml`.

- [ ] **3.6r** Add the event–post link table and multi-event schema — *needs AD-30; re-run the four scenarios of
      `cc-024-explain-baseline-2026-10-01.md` and compare; promote a clean version of the capture script*
  - [ ] create  - [ ] dev  - [ ] review  - [ ] EXPLAIN evidence attached
- [ ] **3.6s** Extract multiple events per post with grouping rules — *needs 3.6r; carries an inline Gemini timeout
      + output cap (see Deferred track); fixtures: the 4 reference posts, run repeatedly, grouping must match every run*
  - [ ] create  - [ ] dev  - [ ] review  - [ ] fixtures stable across runs
- [ ] **3.6t** Ingest multiple events per post, with per-event slugs and notifications — *needs 3.6r, 3.6s, 3.7f,
      3.7g; sweep correction: a queued message without `extractionOrdinal` defaults to ordinal 0*
  - [ ] create  - [ ] dev  - [ ] review  - [ ] re-run creates no duplicates

## Wave 4A — Read side, weekday filter, auto-extraction (after 3.6t, any order)

- [ ] **3.6u** Show all source posts and related events on the event detail page — *needs 3.6r, 3.6t, 1.3j, 1.6c;
      coordinate with 0.i6g (coauthor attribution UI); 3.7h/3.7i recommended*
  - [ ] create  - [ ] dev  - [ ] review  - [ ] hot-path EXPLAIN unchanged
- [ ] **3.6y** Respect weekday-narrowed schedules in day-of-week filtering — *needs 3.6r, 1.3k, 1.3j*
  - [ ] create  - [ ] dev  - [ ] review
- [ ] **3.6z** Automatically enqueue new scraped posts for extraction within quota — *needs 3.5, 3.6t (and 3.6s's inline guard);
      soft: FIND-061 diagnosed*
  - [ ] create  - [ ] dev  - [ ] review

## Wave 4B — Matching and enrichment

- [ ] **3.6v** Match new posts to existing events and enrich them in place — *needs 3.6t, 3.13–3.15, 3.4n, 3.7g,
      3.7h; sweep correction: the alias redirect is wired into both Next.js slug routes and
      `getEventBySlugCached` must not swallow a redirect signal*
  - [ ] create  - [ ] dev  - [ ] review  - [ ] promotion keeps favorites/calendar entries

## Wave 5 — Moderation, collection page, account filtering

- [ ] **3.6w** Let moderators merge duplicate events, with slug redirects — *needs 3.6v, 4.7b*
  - [ ] create  - [ ] dev  - [ ] review
- [ ] **3.6x** Show all events from a post on a post collection page — *needs 3.6u; reuses the existing event-list
      UI and logic, no parallel list implementation*
  - [ ] create  - [ ] dev  - [ ] review
- [ ] **3.18** Union-of-associations account filtering (amended: event level via `event_posts`) — *needs 3.15, 3.6r*
  - [ ] create  - [ ] dev  - [ ] review

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
| 3.6s | 3.6l, 3.6r (inline Gemini guard; 0.i2c later replaces it) |
| 0.i2c | 0.i2a, AD-32 (not yet written) |
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
