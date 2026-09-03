# Story 3.6h: Gate image re-hosting and serving on account opt-in

## Story Details

- Epic: 3
- Story ID: 3.6h
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a subscriber to a non-opted-in account,
I want that account's post images to never be durably copied or served from FestDaily's own storage,
so that FestDaily's default behavior matches its stated data-minimization policy instead of silently storing and serving a copy of every account's images regardless of consent.

## Acceptance Criteria

1. **Given** a post's account has `isImageStorageOptedIn = false` (the default), **when** Story 3.6e's re-hosting step would otherwise run (on successful AI extraction), **then** the upload is skipped entirely — no bytes uploaded, `durableImageUrl` stays `null` for that post, exactly as if the upload had failed (reuses the existing best-effort skip path). [epics.md AC1]
2. **And** given a post's account has `isImageStorageOptedIn = true`, **when** the same trigger fires, **then** re-hosting proceeds exactly as Story 3.6e already implemented it, unchanged. [epics.md AC2]
3. **Given** the Event resolver (Story 3.6f) is about to serve an event's image, **when** the backing post's `imageUrlExpiresAt` has passed (or is `null`/unparseable — treated identically, per AD-12 Rule 3's "never assumed valid indefinitely") and the account is NOT opted in, **then** the resolver returns `null` for `Event.imageUrl` — never falls back to `durableImageUrl` (guaranteed `null` anyway per AC1) and never falls back to the stale/expired original either. The frontend's existing `EventImage` placeholder/fallback state renders (already handles a `null` `imageUrl` today — confirmed via `resolveServedImageUrl`'s pre-existing null-return test case and `EventImage.tsx`'s nullable `imageUrl` prop), never a broken-image icon and never a silent re-hosted copy. [epics.md AC3]
4. **And** given the same expired-original scenario but the account IS opted in, **when** the resolver serves the image, **then** it falls back to `durableImageUrl` exactly as Story 3.6f already implemented — unchanged. [epics.md AC4]
5. **And** given the original image URL is still valid (`now < imageUrlExpiresAt`), **when** the resolver serves the image, **then** it serves the original `imageUrl` regardless of the account's opt-in status — opt-in only gates the *fallback* tier, never the original-URL-while-valid tier, since serving Instagram's own still-live URL carries no FestDaily-storage consent implication. [AD-12 Rule 3, implicit in "original-preferred serving"]
6. **Data-hygiene note (not a migration):** no backfill/purge of already-stored `durableImageUrl` values for currently-non-opted-in accounts is performed by this story — every post re-hosted between Story 3.6e's original merge and this story's own merge stays stored (AD-12 Rule 6's no-deletion stance already covers this; a future dedicated cleanup story could revisit it, out of scope here). [epics.md AC5]

## Tasks / Subtasks

- [ ] **Task 1 (AC1, AC2) — Generalize the AI-processing pipeline's re-hosting trigger gate:**
  - [ ] In `apps/backend/src/lib/ai-processor/process-ai-job.ts`, change the line `const skipImageRehost = isCuratorGuide && !isOptedIntoImageStorage;` to `const skipImageRehost = !isOptedIntoImageStorage;`. This is a **generalization**, not a new call site: `isOptedIntoImageStorage` is already computed a few lines above from the function's existing `db.select({ accountType, isImageStorageOptedIn })...from(socialMediaAccountProfiles)` query (added by Story 3.6g's migration). Per the cross-reference in epics.md Story 3.6h's own Note, this line currently ships a narrower, CURATOR_GUIDE-only version of this story's gate (built by Story 3.4o) — replace it in place with the general, all-accounts condition rather than layering a second condition beside it.
  - [ ] Leave `isCuratorGuide` and its other two usages in this file (the `isEvent === false` early-return branch and the final "mark post extracted" step, both of which clear `posts.content` for CURATOR_GUIDE accounts) completely untouched — Story 3.4o's content-minimization scope is orthogonal to this story's opt-in gate and must not be affected by this change.
  - [ ] Do not add a second/duplicate DB query — the existing `accountRow` query already selects everything this task needs.

- [ ] **Task 2 (AC3, AC4, AC5) — Gate the domain-layer image-serving function on opt-in:**
  - [ ] In `packages/domain/src/events/resolveServedImageUrl.ts`, add a new **required** `isImageStorageOptedIn: boolean` field to the `ResolveServedImageUrlInput` interface (required, not optional — this is the whole point of the gate; a call site that forgets to pass it must fail type-checking, not silently default to a permissive value).
  - [ ] Update the function body to: if the original is still valid (`isOriginalStillValid && imageUrl`), return it unchanged (AC5 — opt-in never gates the still-valid-original tier). Otherwise, if `!isImageStorageOptedIn`, return `null` (AC3). Otherwise, return `durableImageUrl || imageUrl || null` exactly as today (AC4, unchanged for opted-in accounts).
  - [ ] Update `packages/domain/src/events/resolveServedImageUrl.test.ts`: add `isImageStorageOptedIn: true` to all 8 existing cases (a)-(h) — they represent the already-opted-in behavior Story 3.6f shipped, and must keep passing unchanged now that the parameter is required. Add new cases for the not-opted-in branch: (i) expired original + `durableImageUrl` populated + not opted in → `null` (the core AC3 regression case — proves opt-in, not merely "is there a durable copy," gates the fallback); (j) `imageUrlExpiresAt` is `null` + not opted in → `null` (mirrors existing case (d)'s null-expiry-treated-as-expired semantics, now also gated); (k) still-valid original + not opted in → serves the original anyway (AC5 — confirms opt-in does not affect the valid-original tier); (l) both `imageUrl` and `durableImageUrl` null + not opted in → `null` (trivial, but keep the branch coverage explicit).
  - [ ] This is `packages/domain` — 100% unit test coverage is required per project-context.md's Testing Rules; verify every branch of the updated function (valid-original, expired+opted-in-with-durable, expired+opted-in-without-durable, expired+not-opted-in, null-expiry+not-opted-in) has a corresponding test case before marking this task complete.

- [ ] **Task 3 (AC3, AC4) — Wire `isImageStorageOptedIn` through to the `Event.imageUrl` field resolver:**
  - [ ] In `apps/backend/src/schema/resolvers.ts`, there are 5 existing query sites that build an Event row shape by selecting from `events` and `.leftJoin(posts, eq(events.postId, posts.id))` (identifiable by their shared `imageUrl: posts.imageUrl, durableImageUrl: posts.durableImageUrl, imageUrlExpiresAt: posts.imageUrlExpiresAt` field trio): the `restoreEvent` mutation, the paginated `events` list query, the `event` query, the `eventBySlug` query, and `Report.event`. At **each** of these 5 sites: add `.leftJoin(socialMediaAccountProfiles, eq(posts.accountId, socialMediaAccountProfiles.id))` immediately after the existing `.leftJoin(posts, ...)`, and add `isImageStorageOptedIn: socialMediaAccountProfiles.isImageStorageOptedIn` to the selected-fields object (same pattern already used for `durableImageUrl`/`imageUrlExpiresAt` — explicit selection outside `buildOptimizedDrizzleSelect`, since it comes from a joined table, not `events` itself).
  - [ ] Use a `leftJoin` (not `innerJoin`) for consistency with the existing `.leftJoin(posts, ...)` pattern at every one of these sites, even though `posts.accountId` is itself `.notNull()` — a left join never drops an Event row if a post/account reference is ever missing or orphaned, matching this file's established defensive style throughout (e.g. `noPostEvent`-style edge cases already exercised in `resolvers.test.ts`).
  - [ ] Update the existing `Event.imageUrl` field resolver (currently `imageUrl: (parent: any) => resolveServedImageUrl({ imageUrl: parent.imageUrl, durableImageUrl: parent.durableImageUrl, imageUrlExpiresAt: parent.imageUrlExpiresAt })`) to also pass `isImageStorageOptedIn: parent.isImageStorageOptedIn === true` — the explicit `=== true` coercion is required because a left-join miss (or a `null` DB value, though the column is `.notNull()` at the DB layer) must never be passed through as `undefined`/`null` into a function whose new parameter is typed as a strict `boolean`.
  - [ ] Do **not** add `isImageStorageOptedIn` as a new field on the public `Event` GraphQL type in any `.graphql` schema file — it stays an internal row-shape property consumed only inside this one field resolver, never exposed as new API surface (confirmed via this story's Gate 1 check: no new query/mutation/field is needed).
  - [ ] The `totalCount` sub-query in the paginated `events` list resolver does **not** need the new join — it only counts matching rows and never touches `imageUrl`/`isImageStorageOptedIn`.

- [ ] **Task 4 (Testing) — `packages/domain` unit tests:** see Task 2's test updates above (this is the authoritative task; Task 2 already lists the exact cases).

- [ ] **Task 5 (Testing) — `apps/backend` integration tests, `process-ai-job.test.ts` (AC1, AC2):**
  - [ ] Add `isImageStorageOptedIn: true` to the shared top-level `profile` fixture inserted near the top of the `processAiJob orchestrator tests` suite (the `db.insert(socialMediaAccountProfiles).values({ accountId: testProfileAccountId, platform: 'instagram', displayName: 'Process Fest Account', username: ... })` call). This fixture backs roughly 20 pre-existing test cases, two of which ("Case G-1: successful event extraction rehosts image bytes" and "Case G-2: rehost failure does NOT block extraction or enqueuing") specifically assert that re-hosting occurs. Because this story generalizes the opt-in gate from CURATOR_GUIDE-only to **all** accounts, those two tests would otherwise start failing not because of a regression but because the shared fixture account is (correctly, realistically) not opted in by default — setting `isImageStorageOptedIn: true` on the shared fixture keeps Cases G-1/G-2 testing what they've always tested (that re-hosting occurs when nothing else blocks it) rather than accidentally starting to test this story's new gate instead.
  - [ ] Add a new test case, mirroring the existing "Case M-1: CURATOR_GUIDE account without image-storage opt-in skips image rehost..." pattern exactly, but for a **plain, non-CURATOR_GUIDE** account (own isolated `db.insert(socialMediaAccountProfiles)` call, `isImageStorageOptedIn: false`, no `accountType` override — i.e. the account-type default): asserts `rehostCalled === false`, `sendSqsMessageCalled === true`, `markPostExtractedCalled === true` (extraction/ingestion proceeds unaffected — AC1's "best-effort, not a hard requirement" framing), and does **not** assert on `posts.content` (that clearing is CURATOR_GUIDE-specific, Story 3.4o, not this story's concern). This is the direct regression test proving the gate now applies generally, not just to CURATOR_GUIDE accounts — today (pre-this-story) this exact scenario would incorrectly call `rehostPostImageSeam`.

- [ ] **Task 6 (Testing) — `apps/backend` integration tests, `resolvers.test.ts` (AC3, AC4, AC5):**
  - [ ] Add a new test block, mirroring the existing `Event.sourceSocialMediaAccountProfile` resolver test's seeding pattern (`testProfile`/`testPost`/`testEvent`, inserted in `t.before`, cleaned up in `t.after`): seed a `socialMediaAccountProfiles` row, a linked `posts` row with `durableImageUrl` set to a non-null CDN-style URL and `imageUrlExpiresAt` set to a date in the past, and a linked `events` row (with a `slug`, to query via `eventBySlug`).
  - [ ] Test case: account `isImageStorageOptedIn: false` → `eventBySlug(slug) { imageUrl }` resolves `null` (AC3) — this is the end-to-end proof that a non-consenting account's expired-original event never leaks its already-stored `durableImageUrl` through the resolver, closing the gap even for posts re-hosted before this story's gate existed (AC6's data-hygiene note: those rows are never purged, only never served).
  - [ ] Test case: same seed data but account `isImageStorageOptedIn: true` → `imageUrl` resolves to the seeded `durableImageUrl` value (AC4, proves the opted-in path is unaffected, now verified through the full join chain rather than only at the `resolveServedImageUrl` unit level).
  - [ ] Test case: account `isImageStorageOptedIn: false` but `imageUrlExpiresAt` set to a **future** date (original still valid) → `imageUrl` resolves to the original `posts.imageUrl` value, not `null` (AC5 — confirms the join/gate doesn't over-apply to the still-valid tier).

- [ ] **Task 7 — Full verification:** `pnpm --filter @festgrid/domain test` (new/updated `resolveServedImageUrl` cases); `pnpm --filter backend test` (updated `process-ai-job.test.ts` + new `resolvers.test.ts` cases); `pnpm build`, `pnpm lint`, `pnpm test` at the repo root — no regressions anywhere else that reads `Event.imageUrl` or `resolveServedImageUrl`.

## Dev Notes

- **This story is backend-only.** No `apps/web` file is touched — `packages/ui`'s `EventImage.tsx` already accepts a nullable `imageUrl` prop and already has an established placeholder/fallback render path for it (confirmed by direct code read and by `resolveServedImageUrl`'s pre-existing null-return test case (f), which is already exercised in production today whenever a post has neither an original nor a durable image). This story only changes *which backend condition* produces `null` — it does not change the shape of the contract the frontend already consumes.
- Story 3.6g (this story's direct prerequisite) is marked `in-progress` in `sprint-status.yaml`, but its own story file's Completion Status/Deliverables Checklist are fully checked off and its code — the `imageStorageOptInSourceEnum`/`isImageStorageOptedIn`/`imageStorageOptInSource` columns (migration `0043_faulty_electro.sql`), the `setImageStorageOptIn` mutation, and the `accountRow` query already reading `isImageStorageOptedIn` inside `process-ai-job.ts` — is confirmed present and grep-verified in the working tree as of this story's creation (2026-09-03), just not yet committed. **This story builds directly on top of that uncommitted work.** Before starting implementation, confirm Story 3.6g's changes are either already committed, or will be committed in the same working session as this story, so this story's own diff doesn't silently depend on an uncommitted, potentially-still-changing prerequisite. See the Pre-Coding Approval Gate below.
- The Architecture Spine (`festgrid-architecture-spine.md`) AD-12 was **already amended** (Rule 7, 2026-09-02, same `bmad-correct-course` session that created this story) to state Rules 1 and 3 in their final, consent-gated form — this story is pure implementation against an already-decided design, not a fresh design pass. Rule 1 (rehosting trigger) and Rule 3 (serving fallback) were quoted verbatim into this story's Acceptance Criteria above; no interpretation gap exists between the spine and the ACs.
- **Why `isImageStorageOptedIn` is joined via `posts.accountId`, not read some other way:** `Event` has no direct FK to `socialMediaAccountProfiles` — the existing path is `events.postId → posts.id`, then `posts.accountId → socialMediaAccountProfiles.id` (the exact same two-hop join already used by the existing `Event.sourceSocialMediaAccountProfile` field resolver, just inlined into the row-select instead of a separate resolver call, matching how `durableImageUrl`/`imageUrlExpiresAt` are already inlined rather than resolved via a separate field).
- **Why `packages/domain`'s `isImageStorageOptedIn` param is required, not optional with a safe default:** an optional param with e.g. a `false` default would silently produce the correct behavior at every call site that forgets to update it (never serves `durableImageUrl`) — masking the exact class of bug this story exists to fix (a call site quietly not respecting the flag). A required param makes an unupdated call site a compile error instead of a silent, hard-to-notice policy gap. There is exactly one production call site (`apps/backend/src/schema/resolvers.ts`'s `Event.imageUrl` resolver — confirmed via repo-wide grep for `resolveServedImageUrl`), so the blast radius of the required-param change is fully enumerated and covered by Task 3.

### Architecture & UX Gate Findings

Epic 3's readiness sweep (`epic-readiness/epic-3-readiness.md`, `swept: true`) predates this story (swept 2026-08-09; this story was added 2026-09-02 via `bmad-correct-course`, same as its siblings 3.6g/3.6i/3.6j/3.6k), so per `story-split-gate.md`'s epic-level-sweep-mode lightweight guard, all three gates were re-run fresh via `runSubagent` (matching the precedent already set by Story 3.6g's own creation).

- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** All planned changes stay within `apps/backend` and `packages/domain`: a one-line condition generalization in `process-ai-job.ts`, a new required parameter on an already-existing pure `packages/domain` function, and additional joins/field selections at 5 already-existing resolver query sites in `resolvers.ts`. No new GraphQL query/mutation/field is exposed — `isImageStorageOptedIn` remains an internal parent-object property consumed only inside the `Event.imageUrl` field resolver; the opt-in mutation itself was already introduced by Story 3.6g. No frontend code is touched. No new AWS infrastructure — the S3/CloudFront bucket (Story 0.33) and the `isImageStorageOptedIn` column (Story 3.6g) already exist.
- **Gate 2 (UI Complexity & Reusability) — No gap found**, run via `runSubagent` (Freya persona). `EventImage.tsx` already accepts a nullable `imageUrl` and already renders an established fallback/placeholder for that state — this behavior predates this story and is already exercised in production. This story only changes which backend condition produces `null`, introducing no new UI state, variant, or interaction; nothing in `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md` describes a visual/interaction detail this backend-only change should but doesn't surface.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** Every capability this story needs already exists, built by a specific prior story: the conditional-skip gate pattern (Story 3.4o), `resolveServedImageUrl` (Story 3.6f), `socialMediaAccountProfiles`/`isImageStorageOptedIn` (Stories 3.1a/3.6g), the GraphQL codegen pipeline (Story 0.8), and the `.leftJoin(X, eq(...))` pattern already repeated dozens of times in `resolvers.ts`. This story only widens an existing gate's scope and adds a required parameter to an existing pure function — no new i18n/analytics/app-shell/codegen foundation, no new named utility being introduced for reuse beyond this story.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story introduces no new database column, no new Postgres enum/type, no new GraphQL field/type/query/mutation, and no `packages/shared-types` change. It exclusively reuses columns and a mutation already migrated/shipped by Story 3.6g (`isImageStorageOptedIn`, `imageStorageOptInSource`) and a domain function/GraphQL field already shipped by Story 3.6f (`resolveServedImageUrl`, `Event.imageUrl`).
- **Impacted contracts (non-schema):** `packages/domain`'s `ResolveServedImageUrlInput` TypeScript interface gains a new required field (`isImageStorageOptedIn: boolean`) — a source-breaking change for any call site that doesn't pass it, which is intentional (see Dev Notes above) and fully covered: the sole production call site is updated in the same story (Task 3).
- **Required DB migration:** none.
- **Required TypeScript type changes:** `packages/domain/src/events/resolveServedImageUrl.ts`'s exported interface only (Task 2). No `apps/backend/src/generated/resolvers-types.ts` or `apps/web/src/generated/graphql.ts` regeneration needed — no `.graphql` schema file changes, so no `codegen` run is required for this story.
- **Backward compatibility and rollout notes:** Behavior-changing but additive-safe: after this story merges, any post whose account is not opted in and whose original image URL has expired will newly resolve `Event.imageUrl` to `null` where it previously resolved to a stale/broken original URL (see AC3's precise scope — this only affects the already-broken "expired, no durable copy, not opted in" case; opted-in accounts and still-valid-original cases are unchanged). This is a deliberate correctness fix per AD-12 Rule 7's consent-gate correction, not a regression — a `null` image rendering the existing placeholder is strictly better than serving a link Instagram itself has already invalidated.
- **Verification checks:** Task 2's `packages/domain` unit tests (100% branch coverage of the updated function); Task 5's `process-ai-job.test.ts` cases (AC1/AC2); Task 6's `resolvers.test.ts` cases (AC3/AC4/AC5); full `pnpm build`/`pnpm lint`/`pnpm test`.

### Project Structure Notes

- **New:** nothing (no new files — this story only modifies existing ones).
- **Modified:** `apps/backend/src/lib/ai-processor/process-ai-job.ts` (Task 1); `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (Task 5); `packages/domain/src/events/resolveServedImageUrl.ts` and `resolveServedImageUrl.test.ts` (Task 2); `apps/backend/src/schema/resolvers.ts` (Task 3); `apps/backend/src/schema/resolvers.test.ts` (Task 6).
- **Not modified:** `packages/database/schema.ts` (no schema change — reuses Story 3.6g's already-migrated columns); any `.graphql` schema file (no new API surface); `apps/backend/src/generated/resolvers-types.ts`/`apps/web/src/generated/graphql.ts` (no codegen needed); anything under `apps/web/**` (no frontend change — the existing `EventImage.tsx` placeholder already covers the new `null` case); `packages/ui/**`; `apps/infrastructure/**`.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.6h] — this story's own AC/Note; Stories 3.6e/3.6f/3.6g (direct prerequisites) and the cross-reference note to Story 3.4o's shipped `skipImageRehost` condition (generalized by this story, Task 1).
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-12] — Rules 1, 3, 6, 7: the binding, already-corrected design this story implements verbatim.
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts] — read in full; confirmed the exact `isCuratorGuide`/`isOptedIntoImageStorage`/`skipImageRehost` shape (Story 3.4o's shipped condition) this story generalizes, and confirmed `isCuratorGuide`'s two other, untouched usages (content-clearing for CURATOR_GUIDE posts).
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.test.ts] — read the shared top-level `profile` fixture and the existing "Case G-1"/"Case G-2" (generic rehost happy-path) and "Case M-1"/"Case M-2"/"Case M-3" (CURATOR_GUIDE-specific, Story 3.4o) test patterns this story's Task 5 extends and partially mirrors.
- [Source: packages/domain/src/events/resolveServedImageUrl.ts, resolveServedImageUrl.test.ts] — read in full; confirmed the exact current fallback logic and all 8 existing test cases (a)-(h) this story's Task 2 extends.
- [Source: apps/backend/src/schema/resolvers.ts] — repo-wide grep confirmed `resolveServedImageUrl` has exactly one production call site (the `Event.imageUrl` field resolver); read all 5 `events`+`posts` join sites (`restoreEvent`, the paginated `events` list, `event`, `eventBySlug`, `Report.event`) in full to confirm their identical `imageUrl`/`durableImageUrl`/`imageUrlExpiresAt` selection shape and the exact `.leftJoin(posts, eq(events.postId, posts.id))` pattern Task 3's new join is added alongside; confirmed `posts.accountId` is `.notNull()` in `packages/database/schema.ts` but chose `leftJoin` anyway to match this file's established defensive-join style.
- [Source: packages/ui/src/features/events/EventImage.tsx] — confirmed the component already accepts `imageUrl?: string | null` and already handles a null value, supporting Gate 2's "no gap" verdict.
- [Source: apps/backend/src/schema/resolvers.test.ts] — read the existing `Event.sourceSocialMediaAccountProfile` resolver test's `testProfile`/`testPost`/`testEvent` seeding pattern (L1370-1382) this story's Task 6 mirrors; read the existing `setImageStorageOptIn`/`queryModeratorAccountProfiles` integration test block (Story 3.6g) for the `durableImageUrl`-seeding pattern reused in Task 6; confirmed via grep that `imageUrl`/`durableImageUrl` are queried in exactly one existing test (`eventBySlug - fetch single event by slug with schedules`, L298-344) and that test makes no assertion on `imageUrl`'s actual value, so it is unaffected by this story's change.
- [Source: _bmad-output/implementation-artifacts/3-6g-add-image-storage-opt-in-flag-and-moderator-only-mutation.md] — this story's direct prerequisite; confirmed its Completion Status/Deliverables Checklist are fully checked and its code is present (grep-verified) in the working tree, despite `sprint-status.yaml` still showing `in-progress` — see Dev Notes above for the sequencing implication.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — gate definitions and the epic-level-sweep-mode basis for re-running Gates 1/2/3 fresh here.
- [Source: _bmad-output/project-context.md#Testing-Rules] — `packages/domain` 100% unit coverage requirement (Task 2).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Testing Rules (`packages/domain` 100% unit coverage requirement, Task 2); Database Access via Drizzle only, no new pattern; Code Organization (no `packages/domain` DB/ORM-coupling introduced — the function stays pure, the DB join lives in `apps/backend`).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed by this file.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-12 (this story's binding design: Rules 1, 3, 6, 7, all quoted/applied above).
- [x] `docs/infrastructure/index.md` — confirmed not applicable: no backend compute/queue/EventBridge/DB-provisioning change, only additive logic against already-provisioned infrastructure (Story 0.33's S3/CloudFront bucket, Story 3.6g's already-migrated columns).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - Modified only, no new files: `apps/backend/src/lib/ai-processor/process-ai-job.ts`; `apps/backend/src/lib/ai-processor/process-ai-job.test.ts`; `packages/domain/src/events/resolveServedImageUrl.ts`; `packages/domain/src/events/resolveServedImageUrl.test.ts`; `apps/backend/src/schema/resolvers.ts`; `apps/backend/src/schema/resolvers.test.ts`.
- **Rule Mapping:**
  - AD-12 Rule 1 (rehosting trigger gated on `isImageStorageOptedIn`, generalized to all accounts) → Task 1.
  - AD-12 Rule 3 (serving fallback gated on `isImageStorageOptedIn`; original-while-valid ungated) → Task 2.
  - AD-12 Rule 6 (no-deletion/no-backfill stance) → AC6, explicitly not implemented (no migration/backfill task exists in this story).
  - `packages/domain` 100% unit coverage (project-context.md) → Task 2/4.
  - Reuse over reinvention (existing `.leftJoin(X, eq(...))` pattern, existing test-seeding patterns) → Task 3, Tasks 5-6.
  - Story-split-gate discipline (fresh Gate 1/2/3, epic-level-sweep-mode lightweight guard) → Dev Notes "Architecture & UX Gate Findings".
  - Testing-trophy (integration tests for the resolver/pipeline behavior change, unit tests for the pure domain function) → Tasks 2, 5, 6.
- **Verification Plan:**
  - `packages/domain`: `pnpm --filter @festgrid/domain test` — all `resolveServedImageUrl` cases (existing (a)-(h), updated for the required param; new not-opted-in cases) pass.
  - `apps/backend`: `pnpm --filter backend test` — updated `process-ai-job.test.ts` (Cases G-1/G-2 still pass with the opted-in fixture; new plain-account-not-opted-in case passes) and new `resolvers.test.ts` cases (AC3/AC4/AC5) pass; `pnpm --filter backend build`/`lint` clean.
  - `pnpm build`, `pnpm lint`, `pnpm test` (root) — full suite, no regressions, confirming no other code path silently relied on the pre-this-story `resolveServedImageUrl` signature or the CURATOR_GUIDE-only rehost gate.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — one condition generalized in `process-ai-job.ts` (Task 1); one required parameter added to an existing pure `packages/domain` function plus its logic/tests (Task 2); 5 existing resolver query sites gain one join + one field each, plus the `Event.imageUrl` field resolver updated to pass the new param (Task 3). No new files, no new DB migration, no new GraphQL API surface, no `apps/web` change.
- [ ] Architecture and boundary confirmation — the domain-layer gate stays pure in `packages/domain` (no DB/ORM coupling introduced there); the DB join and row-shape wiring stay in `apps/backend/src/schema/resolvers.ts`, matching this file's existing pattern for every other joined field (`durableImageUrl`, `imageUrlExpiresAt`, `sourceSocialMediaAccountProfile`).
- [ ] Testing plan confirmation — `packages/domain`: 100% branch coverage of the updated `resolveServedImageUrl` (Task 2); `apps/backend`: updated `process-ai-job.test.ts` fixture + new not-opted-in regression case (Task 5), new `resolvers.test.ts` end-to-end resolver cases (Task 6), as specified in the Verification Plan above.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1: no gap (re-run fresh via `runSubagent`, Winston persona). Gate 2: no gap (re-run fresh via `runSubagent`, Freya persona — confirmed `EventImage.tsx` already handles the null-image state this story newly produces in one more case). Gate 3: no gap (re-run fresh via `runSubagent`, Winston persona).
- [ ] **Dependency/sequencing risk flagged, needs explicit acknowledgment:** Story 3.6g (this story's direct prerequisite — provides the `isImageStorageOptedIn` column and the `accountRow` query this story's Task 1 relies on) is still tracked as `in-progress` in `sprint-status.yaml` and its code is present in the working tree **uncommitted** as of this story's creation (2026-09-03), despite its own story file's Completion Status/Deliverables Checklist being fully checked off. This story's diff (especially Task 1 and Task 3's `socialMediaAccountProfiles` join) directly builds on that uncommitted code. Recommend either (a) committing/landing Story 3.6g first, or (b) explicitly accepting the risk of implementing this story in the same uncommitted working tree as 3.6g and committing/verifying both together — either is workable, but proceeding as if 3.6g were already merged without this acknowledgment risks losing track of which uncommitted changes belong to which story.
- [ ] **Design decision confirmed (no user input needed, already spec'd):** the `ResolveServedImageUrlInput.isImageStorageOptedIn` parameter is **required**, not optional-with-a-safe-default — an unupdated call site must fail to compile rather than silently keep serving `durableImageUrl` regardless of consent (Dev Notes explain the rationale; only one production call site exists, fully covered by Task 3).

## Testing Requirements

- [ ] Unit tests (required, `packages/domain`, 100% coverage rule): `packages/domain/src/events/resolveServedImageUrl.test.ts` — existing cases (a)-(h) updated with `isImageStorageOptedIn: true`; new cases for expired+not-opted-in (with and without a populated `durableImageUrl`), null-expiry+not-opted-in, and still-valid-original+not-opted-in (Task 2).
- [ ] Integration tests (required, `apps/backend`, `node:test` against the real test DB): `process-ai-job.test.ts` — shared fixture updated to `isImageStorageOptedIn: true`; new case for a plain (non-CURATOR_GUIDE) account without opt-in asserting `rehostCalled === false` (Task 5). `resolvers.test.ts` — new block covering `eventBySlug`/`Event.imageUrl` for not-opted-in+expired (→ `null`), opted-in+expired (→ `durableImageUrl`), and not-opted-in+still-valid (→ original `imageUrl`) (Task 6).
- [ ] E2E tests: not required — this is a backend-only data-correctness fix with no new user-facing flow to exercise; the existing frontend placeholder behavior for a null image is already covered by whatever E2E/integration coverage exists for that pre-existing state (not newly introduced by this story).

## Deliverables Checklist

- [ ] `process-ai-job.ts`'s rehost-skip gate generalized from CURATOR_GUIDE-only to all accounts (AC1, AC2).
- [ ] `resolveServedImageUrl` gated on a new required `isImageStorageOptedIn` param, with the still-valid-original tier left ungated (AC3, AC4, AC5).
- [ ] All 5 `resolvers.ts` Event-row query sites join `socialMediaAccountProfiles` and pass `isImageStorageOptedIn` into the `Event.imageUrl` field resolver.
- [ ] No new GraphQL API surface, no new DB migration, no `apps/web` change.
- [ ] `packages/domain` unit tests at 100% coverage for the updated function; `apps/backend` integration tests for both the pipeline gate and the resolver gate.

## Out of Scope

- Any backfill/purge of already-stored `durableImageUrl` values for currently-non-opted-in accounts — AD-12 Rule 6's no-deletion stance already covers this (AC6); a future dedicated cleanup story could revisit it.
- The `ACCOUNT_OWNER` self-service opt-in path and any account-claim/ownership-verification flow — not spec'd anywhere yet (future epic, per AD-12 Rule 7); this story only consumes the existing moderator-set flag from Story 3.6g.
- Any change to the public GraphQL schema (`Event` gains no new field), to `packages/shared-types`, or to `apps/web`/`packages/ui` — the existing frontend placeholder for a null image already covers this story's new `null`-producing case.
- Committing/landing Story 3.6g itself — this story only builds on top of it; see the Pre-Coding Approval Gate's flagged dependency risk.
- Stories 3.6i/3.6j/3.6k (contact-info/photo/children's-data minimization) — separate, unrelated data-minimization concerns from the same 2026-09-02 correct-course batch, not touched here.

## Definition of Done

- [ ] AC1-6 satisfied.
- [ ] All required tests passing (`packages/domain` unit tests at 100% coverage for the updated function; `apps/backend` integration tests for both the generalized pipeline gate and the new resolver gate).
- [ ] Lint and type checks passing for `packages/domain` and `apps/backend`.
- [ ] No `apps/web`/`packages/ui`/database-migration/GraphQL-schema changes introduced (this story is scoped to be backend-logic-only — any diff outside `packages/domain`/`apps/backend` should be treated as scope creep and questioned).
- [ ] The Pre-Coding Approval Gate's flagged Story 3.6g dependency/sequencing risk is resolved (3.6g committed, or both stories' uncommitted work is being tracked/committed together) before this story is marked done.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

_To be filled in by the implementing agent._

### Debug Log References

_To be filled in by the implementing agent._

### Completion Notes List

_To be filled in by the implementing agent._

### File List

_To be filled in by the implementing agent._
