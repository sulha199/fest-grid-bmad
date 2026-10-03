# CC-024 Multi-Event Posts & Cross-Post Matching — Wave Plan

**Created:** 2026-10-01
**Status:** working doc — the progress tracker for `CC-024` (Multi-event posts and cross-post event
matching), the way `event-pages-closeout-wave-plan.md` tracked the event-pages tail. Tick boxes live.
**Source of truth on conflict:** `sprint-status.yaml` (story state) and `backlog.yaml` (intake rows)
always win over this file. If a box here disagrees with them, fix the box.

**Scope note (2026-10-03):** this plan also tracks the **CC-023 tail** (face-blurred thumbnails and the
extraction audit log: **3.6m, 3.6n, 3.6o, 3.6p, 3.6q**), because CC-024 amends two of those stories (3.6o, 3.6p)
and both changes edit the same extraction code (`build-gemini-request.ts`, `process-ai-job.ts`). They run as
**Wave 4C** below. CC-023's own proposal stays the source for *what* they build; this plan owns *when* and
*in what order relative to CC-024*.

**Inputs:** `sprint-change-proposal-2026-10-01-multi-event-posts.md` (the approved proposal),
Architecture Spine **AD-30** (Event↔Post many-to-many), **AD-31** (post–account associations),
the **AD-16** (platform-prefixed slugs) and **AD-17** (hot-path rules) amendments, PRD **FR113**
(multi-event posts) and **FR114** (cross-post event matching), and the CC-024 section of
`design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`. For the CC-023 tail:
`sprint-change-proposal-2026-09-30.md` (CC-023), Architecture Spine **AD-28** (face-blurred thumbnails,
consent-independent, expiry-gated; Rule 9 = versioned media keys) and **AD-29** (extraction quality audit log),
and PRD §3.16.

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

**Not swept in the 2026-10-01 batch (and why):**
- **1.3j / 1.6c / 1.3k** are built (`review`), so a Gate 1/3 pass over their planned ACs adds little. 1.6c and 1.3k
  were swept by the event-pages batch (`batch-event-pages-wave-a-readiness.md`); 1.3j appears there only as a
  prerequisite status, not as a swept story.
- **3.16 / 3.17 / 3.19** (coauthor subscribability, demand-gated discovery, toggle analytics) were never swept (added
  after the 2026-09-11 Epic 3 sweep), and no CC-024 story depends on them. Deferred, not covered. As of 2026-10-03 3.16 is
  built (`review`, merged from master); 3.17 and 3.19 are still `backlog`.
- **3.6m–3.6q (CC-023)** were **not** swept either: CC-023 is a change proposal (it drafted the stories), not a
  readiness report. Because CC-024 amends 3.6o and 3.6p, they are now folded into this plan as **Wave 4C** and
  get their own batch-scoped sweep (see Wave 1).

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
- [x] **CC-023 × CC-024: one run per post, not per event (3.6n, 3.6o, 3.6p).** Settled by the CC-023 sweep: the
      post-level region of `process-ai-job.ts` (the image re-host step, before the per-event fan-out) is the run point.
      Written into 3.6n's amendment.
- [x] **`actualScheduleCount` ownership and the audit-row shape (3.6p) — decided with the user 2026-10-03.** One audit
      row per extraction attempt with a jsonb `eventsCompleteness` array (per-event `minScheduleCount`,
      `expectedScheduleNames`, `confidenceScore`, `actualScheduleCount`); `actualScheduleCount` is the extraction-time
      count written synchronously by `process-ai-job.ts`. AD-29 Rule 2 amended to say so. The sweep had missed that
      `confidenceScore` is per-event too.
- [x] **Thumbnail follows the primary post (3.6n × 3.6v).** Settled by design: it follows automatically when
      `durableThumbnailUrl` is projected from the same joined `posts` row via `events.post_id`, like `durableImageUrl`.
      Now an explicit 3.6n AC (the GraphQL/mapper/codegen read path).
- [x] **Refresh the 3.6m story file against the 3.6s shape before dispatch** (done 2026-10-03, commit `6620a9dc`). It was stale: its Task 4 anchors on a
      step 5.5 that is now the zero-events guard (and its proposed "step 5.6" collides with the event-cap truncation),
      and its Task 3 places the fields beside `minScheduleCount`, which now lives on `GeminiEventPayload`. The fields
      belong at the payload root.
- [x] **TensorFlow.js backend (0.46) — decided with the user 2026-10-03: WASM** (`tfjs-backend-wasm`). AD-28 Rule 3
      amended to name it; the story must still measure latency, memory and bundle size on real fixtures.
- [x] **Served-URL precedence including the original-still-valid case — decided with the user 2026-10-03 (3.6n's
      create-story): "thumbnail fills the gap only."** The raw original keeps serving unchanged while still valid
      (any opt-in status); once expired, opted-in still gets `durableImageUrl` as today; non-opted-in now gets
      `durableThumbnailUrl` instead of `null`. Implemented in new Story **3.6n2** (the read-path split, below), not
      3.6n itself.

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
- [x] **Run `bmad-epic-readiness-check`, batch-scoped, over the CC-023 tail** (done 2026-10-03) over 3.6m, 3.6n, 3.6o,
      3.6p (Gates 1 and 3) → `epic-readiness/batch-cc-023-face-blur-audit-readiness.md` — **one new prerequisite story
      (0.46, the AI Processor Lambda's image-processing runtime); AC corrections applied to 3.6n and 3.6p, clarification
      to 3.6o.** 3.6q is built (`review`) and was not swept. See "CC-023 readiness sweep result" below.

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

**Backlog hygiene (CC-023)**
- [x] `backlog.yaml` row **CC-023** listed only `3-6m` under `stories:`; now lists 3.6m, 3.6n, 3.6o, 3.6p and 3.6q
      (fixed 2026-10-03; 3.6q is also linked through IDEA-053)

**Housekeeping**
- [ ] `bmad-code-review` for 3.7f, 3.7g, 3.7h, 3.7i (all `review`; not blocking under the standing rule)
- [ ] `bmad-code-review` for 3.6q (`review`; it is a prerequisite of 3.6n, so not blocking under the standing rule)
- [ ] Push `master` (many local commits, nothing pushed) or move them to a branch + PR; the
      `docs/cc-024-multi-event-posts-proposal` branch is stale at `1aca854e` — delete or fast-forward it

## Readiness sweep result (2026-10-01)

Report: `epic-readiness/batch-cc-024-multi-event-readiness.md`. Verdicts: **READY** — 3.6r, 3.6u, 3.6w,
3.6x, 3.6y, 3.7f, 3.7g, 3.7h, 3.7i, 3.13, 3.14, 3.15, 3.18. **READY-WITH-CORRECTION** (applied) — 3.6t
(queue message without `extractionOrdinal` defaults to ordinal 0), 3.6v (alias redirect wired into both
Next.js slug routes; `getEventBySlugCached` must not swallow a redirect signal). **READY-WITH-CAVEAT** — 3.6s
and 3.6z (the unguarded Gemini call, see the BUG-012 item below). Order to create stories: 3.7f → 3.7g → 3.7h →
3.7i alongside 3.13 → 3.14 → 3.15, then 3.6r → 3.6s → 3.6t → 3.6u/3.6y/3.6z → 3.6v → 3.6w/3.6x/3.18.

## CC-023 readiness sweep result (2026-10-03)

Report: `epic-readiness/batch-cc-023-face-blur-audit-readiness.md`. Verdicts: **READY-WITH-CAVEAT** — 3.6m (refresh
the story file against the 3.6s shape). **READY-WITH-CORRECTION** (applied) — 3.6p (add `minEventCount`; per-event shape and
`actualScheduleCount` write point are decisions for create-story). **READY** — 3.6o (clarification applied). **NOT READY
until 0.46** — 3.6n. New prerequisite: **0.46**, because `AIProcessorLambda` has the 128 MB default memory, no native-module
bundling and no way to ship model weights, and `@vladmandic/face-api`'s default Node entry needs the native
`@tensorflow/tfjs-node` (AD-28 Rule 3 assumed pure npm). Three user decisions are reserved for create-story: the
TensorFlow.js backend (0.46), the served-URL precedence (3.6n), and the audit-row shape and `actualScheduleCount`
write point (3.6p). Order to create stories: 3.6m → 3.6p → 0.46 → 3.6n → 3.6o.

**Update (2026-10-03, 3.6n's own create-story session):** the served-URL precedence was decided ("thumbnail fills
the gap only," see above) and 3.6n was split on size — pipeline (3.6n, story file created) vs. read path/UI (new
**3.6n2**, `backlog`, no story file yet). Revised order: 3.6m → 3.6p → 0.46 → 3.6n → 3.6n2 → 3.6o (3.6o only needs
the pipeline, so it does not need to wait on 3.6n2).

## Order of work (from the readiness sweep, 2026-10-01)

Create stories one at a time via `bmad-create-story`, building each (`bmad-dev-story`) before anything that
depends on it. Wave labels below follow this order; stories inside a wave are listed in dispatch order.

1. **Wave 2A** — Slug foundation: 3.7f → 3.7g → 3.7h → 3.7i
2. **Wave 2B** — Coauthor/publisher roles: 3.13 → 3.14 → 3.15 (independent of 2A; may interleave)
3. **Wave 2C** — Diagnostics: FIND-061, BUG-053
4. **Wave 3** — Core build: 3.6r → 3.6s → 3.6t
5. **Wave 4A** — 3.6u, 3.6y, 3.6z (any order after 3.6t)
6. **Wave 4B** — 3.6v (needs 3.13–3.15 and 3.7g/3.7h)
7. **Wave 4C** — CC-023 tail: 3.6q (built) → 3.6m → 3.6p → **0.46** → 3.6n → 3.6o and 3.6n2 (3.6n now also needs 3.6p; 3.6n2 is the read-path half split from 3.6n; 0.46 may run in parallel with 3.6m/3.6p; independent of 4A/4B, may interleave; needs 3.6t)
8. **Wave 5** — 3.6w, 3.6x, 3.18

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
- **Stale compiled packages after pulling (2026-10-03):** the backend imports `@festgrid/graphql-select` (and the other
  workspace packages) from their gitignored `dist/`. A stale `packages/graphql-select/dist` (built before 3.6y) lacked the
  weekday guard, so Story 3.6y's 4 tests (AC1-AC4; 6 reported incl. their parent suites) failed in `resolvers.test.ts`
  even though the source was correct. `pnpm --filter @festgrid/graphql-select build` fixed it (91/91). After every pull,
  run the packages' builds (`pnpm build`) as well as `pnpm install --frozen-lockfile`. Verified by running the file against
  the pre-3.6n source (same failures) and again after the rebuild (none).
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

**Batch-end gate (2026-10-02, cloud session, `TZ=UTC`):** lint 8/8 pass; build 8/8 pass; tests: 22 backend failures, all
geolocation/location (`GEOAPIFY_API_KEY` unset) or the Bright Data `CAPACITY_EXHAUSTED` test (`.env.example` placeholders) —
the same cloud-environment failures as Wave 2B, none new, and the Wave 2B regression stays fixed.

- [x] **FIND-061** (no new-event push ever received): diagnosed 2026-10-02, bmad-quick-dev — all 3 leads
      (inner joins to `user_settings`/`fcm_tokens`, empty `sourceSocialMediaAccountId`,
      `pushNotificationsEnabled` default) traced end-to-end and refuted/unreproducible against current
      code; recipient query verified correct via real-Postgres regression test (4/4 pass). **Fixed same
      day** after the user ran this diagnosis's two outstanding production checks and reported back new
      evidence (`fcm_tokens` has rows; prod recipient query returns rows), which narrowed
      the failure to at/after FCM send time: `process-ingestion-job.ts` dispatched `sendEventNotifications`
      fire-and-forget, so the deployed ingestor Lambda could freeze its execution environment before the
      send ever completed — now awaited (+ same unawaited-notification pattern fixed in
      `apply-default-location-change.ts`'s moderator email alerts), with a regression test proving the await.
      See `backlog/FIND-061-no-new-event-push-notification-diagnosis.md`. Remaining open item: confirm
      backend `FIREBASE_*` admin creds on the ingestor Lambda and check CloudWatch `[sendEventNotifications]`
      logs after this deploys — this fix corrects a confirmed code bug but doesn't by itself prove prod
      delivery end-to-end. 3.6z's "soft: FIND-061 diagnosed" prerequisite is satisfied.
- [x] **BUG-053** (`getPostByUrl` fails against the live Apify actor): fix so the POC script and the by-URL
      resolver path work, and the 4 reference posts can be re-scraped for 3.6s fixtures
      (fixed 2026-10-02, bmad-quick-dev — code fix + unit test; verified live the same day, which showed
      `basicData` dropped carousel slides and `locationName`, so the input now uses `detailedData`; the 4
      reference posts are re-scraped into `implementation-artifacts/cc-024-reference-posts/` with their
      expected groupings)

## Wave 3 — Core build (BUILT 2026-10-02; code review pending)

**Batch-end gate (2026-10-02, local Windows, `TZ=UTC`, volume seed cleaned):** the first run found 30 new backend failures, all stale test code, not production: 19 older fixtures inserted events with a `post_id` and no `extraction_ordinal` and hit 3.6r's CHECK constraint `events_post_id_extraction_ordinal_check`; the AI-processor lambda and URL-extraction resolver tests still stubbed Gemini with the pre-3.6s flat shape instead of `events[]`. Fixed by test-only commit `b9352bd9` (no production file touched). **Re-run:** lint 8/8; build 8/8; backend 903 run, 897 pass, 2 skipped, 4 fail (the known `.env` `SYSTEM_GEMINI_API_KEY` tests, FIND-063); domain 394, ui 816, web 550, database 10, infrastructure 4 all pass.

**Ordinal suffix note:** AD-16 Rule 9 uses `~` as the separator (`ig_p_Ddi9wU6RCRQ~2`), not the `-` first proposed, because Instagram post ids are base64url and may themselves end in `-<digit>`.

Per story: `create-story` → `dev-story` → `code-review` → status verified in `sprint-status.yaml`.

- [ ] **3.6r** Add the event–post link table and multi-event schema — *needs AD-30; re-run the four scenarios of
      `cc-024-explain-baseline-2026-10-01.md` and compare; promote a clean version of the capture script*
  - [x] create  - [x] dev  - [ ] review  - [x] EXPLAIN evidence attached (AC6 PASS: `cc-024-explain-after-3.6r-2026-10-02.md`; `event_post_id_idx` kept)
- [ ] **3.6s** Extract multiple events per post with grouping rules — *needs 3.6r; carries an inline Gemini timeout
      + output cap (see Deferred track); fixtures: the 4 reference posts, run repeatedly, grouping must match every run*
      (story created 2026-10-02, status `ready-for-dev`, commit `fe043fea`; cites the batch readiness sweep for
      Gates 1/3, Gate 2 run fresh — no gap; two design decisions resolved with the user via `AskUserQuestion`:
      `process-ai-job.ts` defers/does-not-enqueue a multi-event post until 3.6t ships real per-event ordinal
      ingestion, and the 4 reference-post fixtures get a two-tier test strategy — a deterministic CI suite
      replaying a one-time-captured real Gemini response per fixture, plus an opt-in live test following the
      existing `build-gemini-request.live-carousel.test.ts` precedent) (dev done, commit `c57b5c1d`, status `review`; live repeat test run 2026-10-02: all 4 posts matched on all 3 runs, 12 real Gemini calls, 5/5 pass)
  - [x] create  - [x] dev  - [ ] review  - [x] fixtures stable across runs
- [ ] **3.6t** Ingest multiple events per post, with per-event slugs and notifications — *needs 3.6r, 3.6s, 3.7f,
      3.7g; sweep correction: a queued message without `extractionOrdinal` defaults to ordinal 0*
      (story created 2026-10-02, status `ready-for-dev`; cites the batch readiness sweep for Gates 1/3
      (Correction 2 folded into AC2), Gate 2 run fresh — no gap; two design decisions resolved with the user
      via `AskUserQuestion`: best-effort enqueue with per-message retry on partial send failure, and
      deterministic `extractionOrdinal` assignment by earliest schedule date/normalized name/original index
      so a re-extraction of the same events keeps the same ordinals — residual limitation documented in Dev
      Notes for a re-extraction that finds a *different* set of events)
      (dev done, commits `5600c460`..`1c78ed4b`, status `review`)
  - [x] create  - [x] dev  - [ ] review  - [x] re-run creates no duplicates (idempotency tests: `(post_id, extraction_ordinal)`, absent ordinal defaults to 0)

## Wave 4A — Read side, weekday filter, auto-extraction (after 3.6t, any order)

- [ ] **3.6u** Show all source posts and related events on the event detail page — *needs 3.6r, 3.6t, 1.3j, 1.6c;
      coordinate with 0.i6g (coauthor attribution UI); 3.7h/3.7i recommended*
  - [ ] create  - [ ] dev  - [ ] review  - [ ] hot-path EXPLAIN unchanged
- [ ] **3.6y** Respect weekday-narrowed schedules in day-of-week filtering — *needs 3.6r, 1.3k, 1.3j*
      (story created 2026-10-02, status `ready-for-dev`; narrowed to the backend filter gap only —
      1.3k already ships the column/calendar rendering; cites the batch readiness sweep for Gates 1/3
      [READY, no correction], Gate 2 run fresh — no gap, zero frontend scope; one design decision
      resolved with the user via `AskUserQuestion`: the fix is general across all four
      `scheduleDateRange`/`overlaps` callers — `dayOfWeek` filter, plain `dateRange` filter, `TODAY`,
      `UPCOMING` — via one closed-form SQL guard in `drizzle-where.ts`, not a narrower single-day-only
      patch, directly closing the 2026-09-30 backlog finding against BUG-026/0.i5d)
      (dev done, commits `c5a2009`.., status `review`; Task 6 verified by the orchestrator: full suite no new
      failures vs. the cloud-environment set, lint 0 errors, tsc clean; EXPLAIN AC6 PASS)
  - [x] create  - [x] dev  - [ ] review
  - **Resolved 2026-10-02 (orchestrator): the 61 failures were a DB still holding `seed:volume` rows; the clean re-run shows only the known 22 cloud-environment failures. The note below is history.**
  - **2026-10-02 dev session: Tasks 1-5 implemented and individually verified green (SQL guard,
    unit tests, integration tests AC1-4, AD-17 EXPLAIN gate — PASS). Task 6 (final full regression
    pass) BLOCKED — not ticking `dev`.** A full `apps/backend` run returned 845/908 pass, 61 fail
    (cause undetermined, output lost to `tail` truncation), then every further `pnpm`/`npx`/`node`/
    `psql` invocation failed with a persistent `Tool permission request failed: AbortError: Stream
    closed` (confirmed non-transient across repeated retries) — see the story file's Debug Log for
    full detail. Next session: re-run the full suite with untruncated output, triage the 61
    failures, run lint/`tsc --noEmit`, then complete Task 6/9 and tick `dev`.
- [ ] **3.6z** Automatically enqueue new scraped posts for extraction within quota — *needs 3.5, 3.6t (and 3.6s's inline guard);
      soft: FIND-061 diagnosed* (story created 2026-10-02, status `ready-for-dev`; cites the batch readiness sweep for
      Gates 1/3 (READY-WITH-CAVEAT, BUG-012/Finding 1 exposure, no AC change needed), Gate 2 run fresh — no gap, zero
      frontend scope; two design decisions resolved with the user via `AskUserQuestion` across two rounds: (1) close
      Story 3.5's accepted idempotency gap with a full TTL-reclaimable claim column on `posts.queued_for_extraction_at`
      rather than a bare non-expiring flag (which would permanently strand a post whose extraction attempt exhausts
      SQS's 3 retries into the DLQ) or leaving the gap as-is; (2) auto-enqueue applies to every `persistScrapedPost`
      call site uniformly, including a new subscription's initial historical backfill, not just steady-state scrapes)
      (dev done, commits `b4315d0`..`399e67a`, status `review`; one genuine BUG-015 test regression found and fixed,
      surfaced by the idempotency fix itself -- see story's Completion Notes)
  - [x] create  - [x] dev  - [ ] review

## Wave 4B — Matching and enrichment

- [ ] **3.6v** Match new posts to existing events and enrich them in place — *needs 3.6t, 3.13–3.15, 3.4n, 3.7g,
      3.7h; sweep correction: the alias redirect is wired into both Next.js slug routes and
      `getEventBySlugCached` must not swallow a redirect signal*
      **Note from 3.6s:** the extraction prompt sets `organizerHandle` to the *posting* account when no handle is tagged
      for an item (by design, so the handle survives the curator caption being nulled). For roundup-sourced events that is the
      curator, not the organizer: matching must discount `organizerHandle` when the post's grouping reason is `roundup`
      or its account type is `CURATOR_GUIDE`.
  - [ ] create  - [ ] dev  - [ ] review  - [ ] promotion keeps favorites/calendar entries

## Wave 4C — Face-blurred thumbnails and extraction audit log (CC-023 tail, folded in 2026-10-03)

Source: `sprint-change-proposal-2026-09-30.md` (CC-023, approved), AD-28 and AD-29. Order is the proposal's own
(3.6m before 3.6n; 3.6n before 3.6o; 3.6p alongside 3.6m) plus the CC-024 dependencies noted below. Statuses are from
`sprint-status.yaml` on 2026-10-03. Needs 3.6t built (done, `review`) so the per-post/per-event questions in the
pre-flagged list can be settled against real code. Gate 2 stays per story (only 3.6n2, the read-path/UI split off
3.6n at its create-story, 2026-10-03, has frontend scope — 3.6n itself is pipeline-only).

**Dev batch (started 2026-10-03):** orchestrator state `.batch-state-cc023-wave4c-dev.json`
(`_bmad-output/specs/ritual-session-orchestrator/mailbox-runner/`). Order **3.6m → 3.6p → 0.46 → 3.6n → 3.6o**, fully
sequential (3.6n2 is created and built later, after 3.6n). Plain dispatch with no per-story check gate (known environment
failures; see "Test-gate facts"); whole-repo lint/build/test run once at the end with `TZ=UTC`. The Pre-Coding Approval Gate
is **pre-approved by the user for all five** provided each proposed scope matches its story file; 0.46 still stops for AC2(b)
(`sharp` in the real Lambda runtime), which needs a deployed non-prod stage and is never deployed by a child.
Progress: 3.6m done (`review`, `b7d6fb3a`); 3.6p done (`review`, `af8bafe6`); 0.46 done (`review`, `c19ff31b`); 3.6n done (`review`, `6672de14`); 3.6o done (`review`, `b9d19259`). 3.6n2 not yet created. Batch-end gate (2026-10-03, `TZ=UTC`, volume seed cleaned): lint 8/8 pass, build 8/8 pass; the whole-repo test pass has NOT run: the runner's preflight refused to start with C: at 10.3 GB free (guard: 15 GB, Postgres has crashed under write pressure below it). Waiting on the user to free space, then re-run.

- [ ] **3.6q** Version re-hosted media keys and set a 7-day immutable HTTP cache policy — *feeds 3.6n (its key helper
      builds `thumb-{hash8}.jpg`); no CC-024 dependency* (built, status `review`; backfill workflow lives in
      `.github/workflows`, boxes ticked on CI/prod evidence in commit `7c261503`)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.6m** Add `hasFaceImage`/`faceImageCount` self-reported fields to the Gemini extraction schema — *needs 3.6l,
      3.6s; log-only, persistence is 3.6p* (story file exists, status `ready-for-dev`; **refresh against the 3.6s
      `events[]` shape before dispatch**; the fields stay at the payload root) — sweep verdict READY-WITH-CAVEAT
      (story file refreshed 2026-10-03, commit `6620a9dc`; **dev done** 2026-10-03, commit `b7d6fb3a`, status `review`;
      targeted tests green: build-gemini-request 18/18, carousel-completeness 9/9, process-ai-job 30/30; domain and backend
      lint clean; whole-repo gate deferred to batch end)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.6p** Create the `extraction_audit_logs` table and write path — *needs 3.6e, 3.6l, 3.6m, 3.6r, 3.6s;
      **amended by CC-024:** the audit row also records `groupingReason`, event count and `minEventCount`* (`backlog`;
      sweep verdict READY-WITH-CORRECTION; per-event shape and `actualScheduleCount` ownership are user decisions at
      create-story; an ingestor back-fill would also need 3.6t) (story created 2026-10-03, commit `18e997ee`, status
      `ready-for-dev`; decisions taken with the user: one row per attempt + jsonb array, extraction-time
      `actualScheduleCount`; `confidenceScore` also per-event) (**dev done** 2026-10-03, commit `af8bafe6`, status
      `review`; migration `0068_wandering_jack_murdock` generated with drizzle-kit and applied to the local DB;
      `writeExtractionAuditLog` returns `{ id }`; targeted tests 56/56 across 7 files; backend lint 0 errors, domain/
      database/backend builds clean; whole-repo gate deferred to batch end)
  - [x] create  - [x] dev  - [ ] review
- [ ] **0.46** Provision the AI Processor Lambda's image-processing runtime (memory, native-binary bundling, model
      assets) — *new prerequisite found by the CC-023 sweep (Gate 1); hard prerequisite for 3.6n only; includes the
      TensorFlow.js backend decision, the bundle-size check and the timeout/visibility headroom* (added 2026-10-03;
      story created the same day, commit `b722e177`, status `ready-for-dev`; backend decided with the user: WASM)
      (**dev done** 2026-10-03, status `review`; measured peak RSS 903 MB -> `memorySize: 2048`, `architecture: X86_64`;
      stage total ~1.1s vs the 300s timeout/visibility budget (~277x headroom, no guard needed); AC2(b) `sharp`-in-
      real-Lambda-runtime check done via a local Docker build of `public.ecr.aws/lambda/nodejs:22` + its RIE, never
      deployed. AC6 package size needed real mid-story problem-solving: a `bundling.nodeModules` install of face-api/
      tfjs/tfjs-backend-wasm measured 321-345 MB unzipped (over Lambda's 250 MB limit); a `tfjs-core`-only shim was
      tried and rejected after it broke face-api's detector in a real test (`TypeError: i.as3D is not a function` --
      the full `@tensorflow/tfjs` patches ~100 Tensor-prototype methods tfjs-core's build lacks); fixed by
      esbuild-bundling the real, unmodified packages via a dedicated inert probe module never required by
      `ai-processor.ts` -- final real asset: 33 MB unzipped / 13.45 MB zipped. Two `AskUserQuestion` round-trips used
      for the AC6 pivot, both answered by the user/orchestrator; `ai-processor.ts` and `process-ai-job.ts` are untouched
      by this story (independently verified from the commit diff; `process-ai-job.ts` was changed earlier by 3.6m and 3.6p). Targeted tests: infra 6/6 green, backend `ai-processor.test.ts` 3/3 green; infra
      has no lint script, `tsc --noEmit` clean; backend lint 0 errors, build clean; whole-repo gate deferred to batch
      end.)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.6n** Detect and blur faces, generating a consent-independent durable thumbnail — *needs 3.6m, 3.6e, 0.33,
      3.6q, **0.46**; adds `posts.durableThumbnailUrl`; pipeline only (detection/blur/resize/upload, migration,
      once-per-post run point, timeout guard)* (story created 2026-10-03, status `ready-for-dev`; **split at
      create-story** — the read path/UI moved to new **3.6n2** below, per the sweep's own "size check may split it"
      flag, confirmed with the user via `AskUserQuestion`, mirroring the 1.3a/1.3b precedent) (**dev done** 2026-10-03,
      commits `bed5d628`, `9256179a`, `6672de14`, status `review`; migration `0069_noisy_hairball`; real WASM face
      detection + per-face blur, thumbnail upload, the two AD-29 backfills it owns, once-per-post call site with a
      timeout guard; user-approved scope addition: the real face-api/tfjs import graph is now in the Lambda's primary
      esbuild bundle (0.46's inert probe pass removed), final asset 34.5 MB unzipped / 13.53 MB zipped; read path untouched;
      infra tests 6/6; the child needed one resume because it ended a turn on a background task)
  - [x] create  - [x] dev  - [ ] review
- [ ] **3.6n2** Expose the thumbnail through the read path and widen `prominentPoster` — *needs 3.6n; GraphQL field +
      6 `resolvers.ts` select sites + `Event` field resolver, `resolveServedImageUrl`'s extended precedence
      (served-URL decision resolved with the user at 3.6n's create-story: "thumbnail fills the gap only" — original
      stays unchanged while valid; non-opted-in gets the blurred thumbnail instead of null only once it expires),
      `apps/web` mapper/codegen, `EventListView.tsx` wiring; the only Wave 4C story with frontend scope* (added
      2026-10-03, split from 3.6n; `backlog`, no story file yet)
  - [ ] create  - [ ] dev  - [ ] review
- [ ] **3.6o** Skip face-blur processing for events ending before their source image expires — *needs 3.6n;
      **amended by CC-024:** the relevance gate takes the latest schedule end across all events of the post*
      (story created 2026-10-03, commit `5660fdc7`, status `ready-for-dev`; owns ONLY the `'event_relevance_gate'`
      audit outcome. **AD-29 backfill ownership decided with the user at this create-story:** each story writes its
      own outcome, so 3.6n owns `'no_face_reported'` and the real face count, 3.6o owns the relevance-gate outcome;
      3.6p's writer returns the inserted row id; 3.6n/3.6p story files and `epics.md` amended in the same commit)
      (**dev done** 2026-10-03, commits `5b64fa2a`..`b9d19259`, status `review`; pure `computeLatestScheduleEnd` in
      `packages/domain` with 100% coverage, one fail-open gate around 3.6n's call site, 5 integration cases; domain
      415/415, backend 963/969 (the 4 known FIND-063 key tests plus 2 stale-dist failures since fixed by rebuilding);
      no schema, migration, read-path or UI file touched)
  - [x] create  - [x] dev  - [ ] review  - [x] audit row shows `'event_relevance_gate'` on a skipped post (integration case K)
- [ ] **IDEA-051** (sample `hasFaceImage = false` posts through face-api.js to measure the pre-filter's false-negative
      rate) stays `backlog` as a deliberate future decision (AD-29 Rule 4), revisited in Wave 6

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
- [ ] CC-023 success criteria (proposal §6), verified after Wave 4C:
  - [ ] An extracted post's image is face-checked (unless the relevance gate skips it) and detected faces are blurred in
        `durableThumbnailUrl`, whether or not the account opted into image storage
  - [ ] `durableImageUrl` behavior is unchanged (opted-in only, unblurred, full resolution)
  - [ ] `extraction_audit_logs` has one row per extraction attempt, ground-truth columns filled where the stage ran,
        and includes `groupingReason` and event count (CC-024 amendment)
  - [ ] A multi-event post produces one thumbnail and one audit row, not one per event
- [ ] Update `backlog.yaml`: BUG-051, BUG-052, BUG-026, BUG-039 promoted/done as stories complete; CC-024 and CC-023 derived status
- [ ] Deferred rows revisited: **IDEA-054** (notification burst throttling), **IDEA-056** (LLM tie-break for mid-confidence matches), **IDEA-051** (face-detection false-negative sampling)

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
| 3.6q (CC-023) | 3.6e, 0.33 (feeds 3.6n) |
| 3.6m (CC-023) | 3.6, 3.6l, 3.6s |
| 3.6p (CC-023; amended by CC-024) | 3.6e, 3.6l, 3.6m, 3.6r, 3.6s (3.6t only if the ingestor back-fills `actualScheduleCount`) |
| 0.46 (found by the CC-023 sweep) | none (IaC; AD-28 Rule 3 may need an amendment) |
| 3.6n (CC-023) | 3.6m, 3.6e, 0.33, 3.6q, 0.46, 3.6p (writes its own audit outcomes through 3.6p's writer) |
| 3.6n2 (CC-023; split from 3.6n at create-story, 2026-10-03) | 3.6n |
| 3.6o (CC-023; amended by CC-024) | 3.6n |

## Decision log (for reference)

Full-M:N with `events.post_id` kept as the primary pointer (hot path untouched); slug names the primary
post, re-slug + alias on primary change; rule-A grouping (strong signals, or two weak ones); roundup
cap 10 with required date and location; roundup events don't notify; per-event notifications; high-score
matches auto-link; account feeds match any linked post; auto-extraction for new posts within quota;
related events are a lazy two-step load with a cap of 5 inline and a post collection page for more.

CC-023 decisions carried into Wave 4C (full reasoning in `sprint-change-proposal-2026-09-30.md`): face-api.js over AWS
Rekognition (no per-image fee, accepted lower recall); `durableThumbnailUrl` is consent-independent by design (a recorded
divergence from AD-12 Rule 7); 480×480 JPEG thumbnail, blur before resize on the original bytes; relevance gate skips
events that end before the source image expires; audit signals go to a separate `extraction_audit_logs` table, never
into `posts`/`EventInfo` or GraphQL.
