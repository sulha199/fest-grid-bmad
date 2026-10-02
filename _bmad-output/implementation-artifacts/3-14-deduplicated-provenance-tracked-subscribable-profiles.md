---
baseline_commit: f0d5ef586240ad5b538de5cf029714009c447496
---

# Story 3.14: Deduplicated, provenance-tracked subscribable profiles

## Story Details

- Epic: 3
- Story ID: 3.14
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a system,
I want every publisher/coauthor identity with a stable platform account ID to get or reuse exactly one `SocialMediaAccountProfile` row (unique on `platform` + `accountId`), created unsubscribed by default and carrying `firstSeen`/`lastSeen`/`discoverySource` (PRD §4.5), while an identity with no stable accountId is retained only as an internal, non-public, non-subscribable, non-searchable provisional record,
so that re-scraping the same coauthor across many posts never creates duplicate profiles, and a malformed/ambiguous identity is observable rather than silently discarded (FIND-022, CAP-2).

## Acceptance Criteria

1. **Given** Story 3.13's normalized publisher/coauthor identities for a post (`ScrapedPost.ownerId`/`ownerUsername`/`ownerDisplayName` for the publisher, `ScrapedPost.coauthors[]` for coauthors), **when** an identity with a stable `accountId` is processed, **then** it gets-or-creates exactly one `social_media_account_profiles` row (Story 3.1a's lookup-or-create pattern, extended) keyed on `(platform, accountId)`, with `lastSeen` advanced to now on every observation and `firstSeen` left unchanged if the row already existed, or both set to now if newly created.
2. A newly created profile from this path defaults `isVerifiedForDiscovery: false` (PRD §4.5, consumed by Story 3.17) and is unsubscribed by default — no `subscriptions` row is created for anyone, and no scrape/classification is triggered (that is Story 3.16's job, gated on an explicit subscribe action).
3. `displayName` is populated via a fallback chain (publisher: `ownerDisplayName || ownerUsername`; coauthor: `username`, since Apify's `coauthorProducers` never supplies a full name — confirmed in `vendor-role-mapping.md`) and `username` falls back to the raw `accountId` only in the defensive case where even `username` is absent — never a null insert (PRD §4.5's `displayName`/`username` are `NOT NULL`).
4. An identity with no stable `accountId` never creates a public `social_media_account_profiles` row. This is already fully satisfied by Story 3.13's existing per-entry filtering (a malformed `coauthorProducers` entry missing `id` is excluded from `ScrapedPost.coauthors[]` before this story's code ever sees it, and persisted via `persistUnprocessedPayload` by 3.13's own code) — no new filtering logic is required here; this AC is a regression guard confirming 3.14 introduces no second path that could create a profile from an accountId-less identity.
5. `discoverySource` (`{ vendor, runId }`) is recorded on first creation and never overwritten by a later re-observation of the same `(platform, accountId)`.

## Tasks / Subtasks

- [ ] **Task 1: Add the four new columns to `social_media_account_profiles`** (AC: 1, 2, 5)
  - [ ] In `packages/database/schema.ts`, add to the `socialMediaAccountProfiles` table definition (after `imageStorageOptInSource`, before the closing `...timestamps`):
    - `firstSeen: timestamp('first_seen', { withTimezone: true })` — nullable (PRD §4.5's `firstSeen?: string` is optional; legacy pre-3.14 rows keep this `NULL`, matching `lastScrapedAt`'s existing nullable-timestamp style in the same table).
    - `lastSeen: timestamp('last_seen', { withTimezone: true })` — nullable, same reasoning.
    - `discoverySource: jsonb('discovery_source').$type<{ vendor: string; runId?: string }>()` — nullable, mirroring the existing `defaultLocation: jsonb('default_location').$type<LocationDetails>()` typed-jsonb pattern immediately above it in this same table.
    - `isVerifiedForDiscovery: boolean('is_verified_for_discovery').default(true).notNull()` — **default `true` at the column level**, not `false`. This is deliberate: this column's two writers are (a) `subscribeToAccount`'s existing insert (the pre-existing, direct-subscribe path, Story 3.1a) and (b) this story's new discovered-profile insert (Task 3). PRD §4.5 documents `isVerifiedForDiscovery` as defaulting to `true` for the direct-subscribe path and `false` only for the scrape-discovered path. Since `subscribeToAccount`'s insert is **not** modified by this story (see Out of Scope), the column default must be `true` so that path keeps correct behavior without any code change; this story's own new insert (Task 3) sets `isVerifiedForDiscovery: false` explicitly, overriding the column default for every row it creates. Existing legacy rows backfilled by this migration also correctly become `true` (they were all created via the pre-existing subscribe path, which predates this feature).
  - [ ] Run `pnpm --filter @festgrid/database generate` to produce the migration SQL. This is a plain `ALTER TABLE ... ADD COLUMN` set (no partial unique index, no `WHERE` predicate) — unlike AD-25's `post_account_associations` DDL, this migration is **not** subject to the drizzle-kit 0.21.x dropped-`WHERE`-clause gotcha; verify the generated SQL by reading it, but no hand-editing is expected to be necessary.
  - [ ] Run `pnpm --filter @festgrid/database migrate` against the local dev DB and confirm the four columns exist via `psql`/Drizzle Studio.
- [ ] **Task 2: Add a pure `resolveDiscoveredIdentityNames` helper to `packages/domain`** (AC: 3)
  - [ ] In `packages/domain/src/scraper/account-enrichment.ts` (same file as the existing `computeProfileBackfillPatch`, which this helper is adjacent to in both purpose and precedent for staying inline/small), add:
    ```ts
    export function resolveDiscoveredIdentityNames(identity: {
      accountId: string;
      username?: string;
      displayName?: string;
    }): { displayName: string; username: string } {
      const username = identity.username?.trim() || identity.accountId;
      const displayName = identity.displayName?.trim() || identity.username?.trim() || identity.accountId;
      return { displayName, username };
    }
    ```
  - [ ] This is a genuinely reusable, cross-call-site mechanism (used once for the publisher identity and once per coauthor, within this same story) — unlike 3.13's single-use inline transforms, which is why it gets its own small domain function rather than staying inline in `apps/backend`, per `project-context.md`'s Code Organization rule and this project's "generic/reusable → packages/domain" convention.
  - [ ] Export it from `packages/domain/src/scraper/index.ts` (or wherever `computeProfileBackfillPatch` is already re-exported from) alongside the existing exports.
- [ ] **Task 3: Create `getOrCreateDiscoveredAccountProfile` in `apps/backend/src/lib/accounts/`** (AC: 1, 2, 3, 5)
  - [ ] New file `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts`:
    ```ts
    import { db } from '../../db/client.js';
    import { socialMediaAccountProfiles } from '@festgrid/database';
    import { resolveDiscoveredIdentityNames } from '@festgrid/domain/scraper';

    interface DiscoveredIdentityInput {
      platform: string;
      accountId: string;
      username?: string;
      displayName?: string;
      vendor: string;
      runId?: string;
    }

    export async function getOrCreateDiscoveredAccountProfile(identity: DiscoveredIdentityInput) {
      const { displayName, username } = resolveDiscoveredIdentityNames(identity);
      const now = new Date();

      const [profile] = await db
        .insert(socialMediaAccountProfiles)
        .values({
          accountId: identity.accountId,
          platform: identity.platform,
          username,
          displayName,
          firstSeen: now,
          lastSeen: now,
          discoverySource: { vendor: identity.vendor, runId: identity.runId },
          isVerifiedForDiscovery: false,
        })
        .onConflictDoUpdate({
          target: [socialMediaAccountProfiles.platform, socialMediaAccountProfiles.accountId],
          set: { lastSeen: now, updatedAt: now },
        })
        .returning();

      return profile;
    }
    ```
  - [ ] This is the **first use of Drizzle's `onConflictDoUpdate` in this codebase** (every existing upsert-shaped call site — `persistScrapedPost`'s post insert, `subscribeToAccount`'s profile insert — uses `onConflictDoNothing` followed by a re-select). It is chosen deliberately here over replicating that exact select-then-branch idiom: a single atomic upsert is the natural fit for "always advance `lastSeen` on conflict, never touch `firstSeen`/`discoverySource`/`displayName` on conflict" — the `set` clause only ever touches `lastSeen`/`updatedAt`, so AC1's "firstSeen left unchanged" and AC5's "discoverySource never overwritten" fall out structurally from the `ON CONFLICT ... DO UPDATE SET lastSeen = ..., updatedAt = ...` shape, with no race window and no second query. Flag this explicitly for `bmad-code-review` since it is a new pattern, not a bug.
  - [ ] `runId` here is the **same `scraperActorRunId` value already threaded through this pipeline** (the internal `scraperActorRuns.id` uuid — e.g. `apifyAuditContext?.runId` in the sync path), not a separately-sourced vendor-native run id. This avoids introducing a second "which run" representation alongside the one `posts.scraperActorRunId`/AD-25 already use for the same underlying fact.
  - [ ] `accountType`/`accountTypeStatus` are intentionally left unset (column default `NULL`) on a newly created discovered profile — `classifyAccountType` is not called here. This matches AD-31 Rule 3 ("a NULL `accountType` is not curator-typed") and keeps classification scoped to the existing direct-subscribe trigger (`subscribeToAccount.ts`), avoiding uncontrolled AI-classification calls for every coauthor incidentally surfaced by scraping.
- [ ] **Task 4: Thread `ownerId`/`coauthors`/vendor through `persistScrapedPost`** (AC: 1, 2, 3, 5)
  - [ ] In `apps/backend/src/lib/posts/persist-scraped-post.ts`, extend `PersistScrapedPostParams` with:
    - `ownerId?: string` — the publisher's stable platform account ID (from `ScrapedPost.ownerId`).
    - `coauthors?: { accountId: string; username?: string }[]` — from `ScrapedPost.coauthors`.
    - `discoverySourceVendor?: string` — an explicit, caller-supplied vendor label (e.g. `'apify'`), **not derived implicitly from the presence of `ownerId`/`coauthors`** (resolved via `AskUserQuestion`, 2026-10-02 — see Dev Notes "Design Decisions").
  - [ ] After `post` is resolved (both the "already existed" branch and the "newly inserted" branch — see Dev Notes for why this runs unconditionally, not gated on `alreadyExisted`), if `ownerId` and `discoverySourceVendor` are both present, call `getOrCreateDiscoveredAccountProfile` once for the publisher identity (`accountId: ownerId, username: ownerUsername, displayName: ownerDisplayName`), wrapped in its own `try { } catch { console.error(...) }` — a failure here must never block returning the persisted post, matching the non-blocking resilience convention already established throughout this pipeline (`backfillAccountProfileAndInferDefaultLocationSeam`'s own wrapper, `process-scrape-job.ts`'s top-level catch, 3.13's per-entry `persistUnprocessedPayload` handling).
  - [ ] If `coauthors` is a non-empty array and `discoverySourceVendor` is present, call `getOrCreateDiscoveredAccountProfile` once per coauthor entry (`accountId: coauthor.accountId, username: coauthor.username`), each independently wrapped in its own try/catch so one coauthor's failure never blocks the others or the publisher.
  - [ ] If `ownerId`/`coauthors` is present but `discoverySourceVendor` is absent (should never happen given Task 5's call-site wiring — a defensive guard against future drift, not an expected runtime case), skip identity processing entirely and log a single `console.error` noting the missing vendor label, rather than guessing or defaulting it.
- [ ] **Task 5: Wire the three Apify-sourced call sites** (AC: 1, 2, 3, 5)
  - [ ] `apps/backend/src/lib/scraper/process-scrape-job.ts`'s `persistScrapedPosts()`: add `ownerId: post.ownerId, coauthors: post.coauthors, discoverySourceVendor: 'apify'` to its `persistScrapedPost(...)` call. This is a static, always-correct vendor label at this call site: `getScraperAdapter('instagram').getNewestPosts()` is hardcoded to call Apify only (`assertProviderCapacityAvailable('apify', ...)`, confirmed by reading `instagram-adapter.ts`'s `getNewestPosts` — there is no Bright Data branch inside it), so every `ScrapedPost` reaching this call site that could carry `ownerId`/`coauthors` is, today, structurally Apify-sourced.
  - [ ] `apps/backend/src/lib/scraper/process-apify-async-result.ts`: add the same three fields (`post.ownerId`, `post.coauthors`, `discoverySourceVendor: 'apify'`) to its `persistScrapedPost(...)` call — this function is explicitly Apify-only by name and by its `mapApifyItemToScrapedPost` call.
  - [ ] `apps/backend/src/lib/scraper/replay-actor-run.ts`: in the `run.vendor === 'APIFY'` branch only, add the same three fields to its `persistScrapedPost(...)` call, reading `vendor: 'apify'` as a literal (not `run.vendor` directly, to keep the string casing/value consistent with the other two call sites' `'apify'` literal rather than the DB enum's `'APIFY'`). Do **not** touch the Bright Data (`else`) branch's `persistScrapedPost(...)` call — `mapBrightDataRecordToScrapedPost`'s output never populates `ownerId`/`coauthors` (3.13 AC4), so there is nothing to thread there.
  - [ ] Do **not** touch `apps/backend/src/lib/scraper/process-brightdata-result.ts` — same reasoning as the replay Bright Data branch.
- [ ] **Task 6: Tests**
  - [ ] `packages/domain/src/scraper/account-enrichment.test.ts` (extend): `resolveDiscoveredIdentityNames` — full name present → returned as-is (trimmed); only `username` present → `displayName` falls back to `username`, `username` returned as-is; neither present → both fall back to `accountId`; whitespace-only `username`/`displayName` treated as absent (trimmed to empty, falls through). 100% branch coverage per `project-context.md`'s `packages/domain` testing rule.
  - [ ] `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.test.ts` (new file, real local Postgres DB, `node:test` pattern matching this directory's existing test files): (a) a brand-new `(platform, accountId)` creates a row with `firstSeen`/`lastSeen` both ~now, `isVerifiedForDiscovery: false`, `discoverySource` matching the passed `{vendor, runId}`, and the expected `displayName`/`username` fallback; (b) calling it again for the **same** `(platform, accountId)` with a later timestamp advances `lastSeen` and leaves `firstSeen`/`discoverySource`/`displayName`/`username` unchanged from the first call; (c) a coauthor-shaped identity (`username` present, no `displayName`) resolves `displayName` to the username; (d) an identity with neither `username` nor `displayName` resolves both to the raw `accountId`. Clean up created rows in `t.afterEach`/`t.after` (matching this directory's existing cleanup convention) — do not leave rows in the shared dev database (FIND-064).
  - [ ] `apps/backend/src/lib/posts/persist-scraped-post.test.ts` (extend): (a) calling `persistScrapedPost` with `ownerId`/`coauthors`/`discoverySourceVendor: 'apify'` set results in a `social_media_account_profiles` row for the publisher and one per coauthor, queried directly from the DB after the call (matching this file's existing real-DB-assertion style); (b) calling it with none of those three params set (today's existing call shape, e.g. the Bright Data path) creates no extra profile rows beyond the post's own `accountId` — explicit regression guard that the new logic is additive and opt-in; (c) `ownerId` present but a coauthor's `accountId` deliberately colliding with an already-existing different-platform-same-accountId-string profile does not corrupt the existing row (sanity check on the `(platform, accountId)` composite key, not just `accountId` alone).
  - [ ] `apps/backend/src/lib/scraper/process-scrape-job.test.ts` (extend): a fake adapter returning a `ScrapedPost` with `ownerId`+`coauthors` populated results in the corresponding `social_media_account_profiles` rows existing after `processScrapeJob` runs; clean them up in `t.afterEach` (extend the existing `createdProfiles` cleanup array to include the new rows' ids, not just the job's own profile).
  - [ ] `apps/backend/src/lib/scraper/process-apify-async-result.test.ts` (extend): a raw Apify `item` with `ownerId`+`coauthorProducers` populated results in the corresponding profile rows after `processApifyAsyncResult` runs.
  - [ ] `apps/backend/src/lib/scraper/replay-actor-run.test.ts` (extend): an Apify-vendor replay run whose raw output items carry `ownerId`/`coauthorProducers` results in the corresponding profile rows; the existing Bright Data replay test in this file is unaffected (no `ownerId`/`coauthors` in its fixtures).
  - [ ] Existing tests in all six touched files must continue passing unmodified in shape (only additive assertions/fixture fields) — this story does not change any existing documented behavior.
- [ ] **Task 7: Verification**
  - [ ] `cd packages/domain && npx tsx --test "src/scraper/*.test.ts"` — green, including the new `resolveDiscoveredIdentityNames` cases.
  - [ ] `cd apps/backend && npx cross-env NODE_ENV=test npx tsx --test --test-concurrency=1 "src/lib/accounts/get-or-create-discovered-account-profile.test.ts" "src/lib/posts/persist-scraped-post.test.ts" "src/lib/scraper/process-scrape-job.test.ts" "src/lib/scraper/process-apify-async-result.test.ts" "src/lib/scraper/replay-actor-run.test.ts"` (`TZ=UTC`, synthetic volume seed cleaned first per the wave plan's test-gate facts) — all green.
  - [ ] `pnpm --filter database generate && pnpm --filter database migrate` — migration applies cleanly against the local dev DB; read the generated SQL file to confirm it is a plain `ALTER TABLE ... ADD COLUMN` set with no dropped predicate (this migration has no partial-unique-index clause, so the AD-25 gotcha does not apply, but confirm by inspection anyway).
  - [ ] `pnpm --filter domain build && pnpm --filter backend build` — both clean (confirms the new `packages/domain` export resolves from `apps/backend` and the extended `PersistScrapedPostParams`/Drizzle schema types compile).
  - [ ] `pnpm lint` on all touched files — 0 new errors/warnings (baseline-diff via `git stash`, matching 3.13's verification convention).
  - [ ] Full `apps/backend` suite and repo-wide `pnpm test` deferred to the CC-024 batch-end gate per the wave plan's established convention for this batch (3.13 did the same) — targeted files above are run in the foreground this session.

## Dev Notes

- **This is the first story in the CC-024 coauthor-attribution slice that requires a real DB migration.** Story 3.13 explicitly required none (pure in-process data-shape addition). The four new `social_media_account_profiles` columns (`firstSeen`, `lastSeen`, `discoverySource`, `isVerifiedForDiscovery`) are all documented in PRD §4.5 (confirmed by reading the PRD interface in full — `firstSeen?`/`lastSeen?`/`discoverySource?`/`isVerifiedForDiscovery: boolean`) but do not exist yet in `packages/database/schema.ts` (confirmed by grep — zero matches for any of the four column names anywhere in the schema or backend source before this story).
- **Why `persistScrapedPost` is the right choke point, not each of the three call sites independently.** Story 3.13's own Dev Notes already named this: "threading the new fields that far downstream... is explicitly Story 3.14's job." Extending `persistScrapedPost`'s params once and calling the new get-or-create logic from inside it (rather than duplicating the call in each of the three Apify call sites) means the actual identity-processing logic is written and tested in exactly one place; the three call sites only need to forward three already-available fields from the `ScrapedPost`/`candidate` object they already hold.
- **Why identity processing runs on every `persistScrapedPost` call, not gated on `alreadyExisted`.** PRD §4.5 describes `lastSeen` as "most recently re-observed... by any scrape/ingestion run" and this story's own AC2 success criterion is "re-scraping the same coauthor across many posts" — i.e. the signal is "this identity was seen again," not "this exact post object is new." Gating identity processing on `alreadyExisted === false` would under-count re-observations (e.g. a retry-window overlap re-encountering the same post, or a different post from the same already-known coauthor) and contradicts the documented field semantics. The cost of running it on every call is one additional upsert per identity per post — acceptable for an async ingestion Lambda (not a user-facing hot path subject to `Query.events`/AD-17's per-row-cost discipline).
- **Read in full before this story's design was finalized:** `apps/backend/src/lib/posts/persist-scraped-post.ts`, its three callers (`process-scrape-job.ts`, `process-apify-async-result.ts`, `replay-actor-run.ts`) and the two call sites explicitly excluded (`process-brightdata-result.ts`, `replay-actor-run.ts`'s Bright Data branch), `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (the "Story 3.1a lookup-or-create logic" this story's AC1 says to extend — confirmed it is the only existing get-or-create for this table), `apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.ts` and `classify-account-type.ts` (confirmed neither should be reused/extended for this story's purpose — classification requires a `userId` and is deliberately not invoked for ingestion-discovered identities), `packages/database/schema.ts`'s full `socialMediaAccountProfiles` definition, and `packages/domain/src/scraper/types.ts`'s current `ScrapedPost`/`AccountProfileLookupResult` (both already final from Story 3.13 — no change needed to either in this story).
- **`instagramScraperAdapter.getNewestPosts` is Apify-only today — verified, not assumed.** Read in full: it calls `assertProviderCapacityAvailable('apify', ...)` and `callApifyActor(...)` unconditionally, with no Bright Data branch. Bright Data entry happens through an entirely separate path (`trigger-scrape-for-account.ts`'s async fallback → `process-brightdata-result.ts`), never through `process-scrape-job.ts`. This is what makes the literal `'apify'` vendor label at Task 5's three call sites a correctness fact, not an assumption — each call site's own code path structurally guarantees which vendor produced the `ScrapedPost`/raw item it is holding.

### Design Decisions (resolved via `AskUserQuestion`, 2026-10-02)

One real, non-mechanical design choice was surfaced to the user before drafting this story's technical approach, per this project's `bmad-create-story` persistent workflow rule:

1. **`discoverySource.vendor` derivation: implicit (infer `'apify'` from `ownerId`/`coauthors` presence) vs. explicit parameter threaded through `persistScrapedPost` and its three call sites.** Resolved: **explicit parameter** (`discoverySourceVendor`). Rationale: `ownerId`/`coauthors` are Apify-exclusive today only by documented convention (a comment on `ScrapedPost`, not a type-level guarantee), and the three call sites being touched for this story already know their own vendor context unambiguously (two are Apify-only by construction, the third branches explicitly on `run.vendor === 'APIFY'`). Threading the label explicitly, now, while these exact call sites are already being modified to add `ownerId`/`coauthors` plumbing, removes a silent invariant that a future Bright Data role-normalization story (FIND-039, not yet started) could otherwise violate without any test catching it.

### Architecture & UX Gate Findings

- **Gates 1 and 3 — cited from the batch readiness sweep, not re-run.** `_bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md` (frontmatter `swept: true`, `gates: [1, 3]`, `stories_covered` includes `3.14`) already ran Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) across this batch, including this story. Per-story verdict table: "**3.14 (deduplicated, provenance-tracked subscribable profiles) | READY** | Depends on 3.13; AC chain intact."
  - **Lightweight guard — does this story's actual scope contain anything the sweep plausibly didn't anticipate?** No new external service, no new data entity beyond the four-column extension to an existing, already-swept table, and no new infra dependency: this story adds columns to a table the sweep already reviewed (`social_media_account_profiles`) and a new backend function reusing the existing `persistScrapedPost`/Drizzle-upsert idiom already present elsewhere in the sweep's scope. The DB migration itself (new for this story, where 3.13 needed none) is a plain additive `ALTER TABLE ADD COLUMN` set — not the kind of schema-shape decision (partial unique indexes, cross-table constraints) Gate 1 exists to catch; AD-25's migration-safety concerns are scoped to `post_account_associations` (Story 3.15), not this table. No gap found; Gates 1/3 stand as cited.
- **Gate 2 — run fresh (per-story, as required even when Gates 1/3 are cited).** Dispatched to a one-shot UX-persona analytical pass against this story's exact scope (the DB column additions, the new `apps/backend/src/lib/accounts/` function, the `packages/domain` helper, and the five touched ingestion-pipeline files). **Verdict: No gap found.** The entire change surface is backend TypeScript (Drizzle ORM schema/queries, Lambda ingestion pipeline files, and one pure domain helper) with zero React/JSX/TSX, zero `apps/web` file, and no UI component, hook, loading/empty/error state, or rendering surface anywhere in scope. The eventual consuming UI (verified-profile `SubscribedAccountCard` with its subscribe/unsubscribe toggle) is explicitly owned by Story 0.i6g/CAP-7, which depends on this story's data existing but shares none of this story's scope.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** A genuine new DB migration is required — the first in this coauthor-attribution slice (3.13 needed none). PRD §4.5 already documents `firstSeen?: string`, `lastSeen?: string`, `discoverySource?: { vendor: string; runId?: string }`, and `isVerifiedForDiscovery: boolean` on the `SocialMediaAccountProfile` interface, but none exist yet on `packages/database/schema.ts`'s `socialMediaAccountProfiles` table (confirmed by grep: zero matches for any of the four names anywhere in `packages/database` or `apps/backend/src` before this story).
- **Impacted fields/contracts:** `packages/database/schema.ts`'s `socialMediaAccountProfiles` table (four new columns, Task 1); `apps/backend/src/lib/posts/persist-scraped-post.ts`'s `PersistScrapedPostParams` interface (three new optional fields, Task 4); a new `DiscoveredIdentityInput` interface local to the new `get-or-create-discovered-account-profile.ts` file.
- **Required DB migration changes:** `ALTER TABLE social_media_account_profiles ADD COLUMN first_seen timestamptz, ADD COLUMN last_seen timestamptz, ADD COLUMN discovery_source jsonb, ADD COLUMN is_verified_for_discovery boolean NOT NULL DEFAULT true` (exact DDL as generated by `drizzle-kit generate` from Task 1's schema changes — all four nullable except `is_verified_for_discovery`, which carries a `NOT NULL DEFAULT true` precisely so existing rows and the unmodified `subscribeToAccount` insert path both resolve to the PRD-documented "direct subscribe path defaults to true" behavior with zero code change to that file). No backfill `UPDATE` is needed for `first_seen`/`last_seen` on legacy rows — both are optional per the PRD interface, and `NULL` correctly represents "this identity predates provenance tracking."
- **Required TypeScript type changes:** `PersistScrapedPostParams` (Task 4) gains `ownerId?`, `coauthors?`, `discoverySourceVendor?`. No existing caller of `persistScrapedPost` breaks — all three are optional and every existing call site (the Bright Data ones) simply omits them, exactly as they omit other already-optional fields today (e.g. `hashtags`, `additionalImageUrls` on some call sites).
- **Backward compatibility and rollout notes:** Purely additive on both the DB and TypeScript sides. No feature flag needed. `isVerifiedForDiscovery`'s `NOT NULL DEFAULT true` means the migration is safe to run against a populated production table without an explicit backfill step — Postgres (11+) applies a `DEFAULT` for a new `NOT NULL` column without rewriting every row. The three other columns being nullable means no default-value decision was needed for them at all.
- **Verification checks:** Task 7's `pnpm --filter database generate`/`migrate` plus the full test suite listed there — the `get-or-create-discovered-account-profile.test.ts` cases directly assert the four new columns' values across both the "freshly created" and "re-observed" paths.

### Project Structure Notes

- New files: `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts` + its test.
- Modified files: `packages/database/schema.ts` (+ generated migration SQL file under `packages/database/migrations/`), `packages/domain/src/scraper/account-enrichment.ts` (+ its test), `packages/domain/src/scraper/index.ts` (new export, if not already a wildcard re-export — confirm during implementation), `apps/backend/src/lib/posts/persist-scraped-post.ts` (+ its test), `apps/backend/src/lib/scraper/process-scrape-job.ts` (+ its test), `apps/backend/src/lib/scraper/process-apify-async-result.ts` (+ its test), `apps/backend/src/lib/scraper/replay-actor-run.ts` (+ its test).
- Explicitly **not** touched: `apps/backend/src/lib/scraper/process-brightdata-result.ts`, `apps/backend/src/lib/scraper/brightdata-record-mapper.ts`, `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`, `apps/backend/src/lib/accounts/classify-account-type.ts`, `apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.ts`, any GraphQL schema/resolver file (no AC in this story requires exposing the four new columns via GraphQL — see Out of Scope), `packages/domain/src/scraper/types.ts` (already final from Story 3.13, no change needed).
- No new workspace package, no new cross-boundary dependency (no `zod`/`ajv` change — `PersistScrapedPostParams` is not an AJV-validated boundary), no Firebase/queue/state-management code touched.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.14: Deduplicated, provenance-tracked subscribable profiles]
- [Source: _bmad-output/specs/spec-post-coauthor-attribution/SPEC.md#CAP-2 — Deduplicated subscribable profiles]
- [Source: _bmad-output/specs/spec-post-coauthor-attribution/vendor-role-mapping.md] — confirms Apify's `coauthorProducers[]` never supplies a full name, the basis for AC3's fallback chain
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#4.5. SocialMediaAccountProfile Interface] — read in full; defines `firstSeen?`/`lastSeen?`/`discoverySource?`/`isVerifiedForDiscovery` exactly as implemented here
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-25: Post-Account Association Table Shape] — context only; this story writes no `post_account_associations` row (that is Story 3.15)
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-31: Post–Account Association Semantics] — Rule 3's `NULL` `accountType` handling, referenced for why this story leaves `accountType` unset on new discovered profiles
- [Source: _bmad-output/implementation-artifacts/3-13-normalize-apify-vendor-coauthor-publisher-roles-during-ingestion.md] — previous story; its Dev Notes explicitly scope threading `ownerId`/`coauthors` through `persistScrapedPost` to this story
- [Source: _bmad-output/planning-artifacts/epic-readiness/batch-cc-024-multi-event-readiness.md] — Gate 1/3 sweep, per-story verdict table entry for 3.14 ("READY")
- [Source: apps/backend/src/lib/posts/persist-scraped-post.ts, apps/backend/src/lib/scraper/process-scrape-job.ts, apps/backend/src/lib/scraper/process-apify-async-result.ts, apps/backend/src/lib/scraper/replay-actor-run.ts, apps/backend/src/lib/scraper/process-brightdata-result.ts, apps/backend/src/lib/scraper/instagram-adapter.ts (getNewestPosts), apps/backend/src/lib/subscriptions/subscribe-to-account.ts, apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.ts, apps/backend/src/lib/accounts/classify-account-type.ts, packages/database/schema.ts, packages/domain/src/scraper/types.ts, packages/domain/src/scraper/account-enrichment.ts] — all read in full for this story

## Global Rules References

- [x] `_bmad-output/project-context.md` — Database/Runtime Schema Validation (no AJV boundary touched here — `PersistScrapedPostParams` is internal, not an external-entry schema); Code Organization (`packages/domain` for the pure `resolveDiscoveredIdentityNames` helper, DB/ORM-coupled get-or-create logic correctly routed to `apps/backend` instead — see Dev Notes); Testing Rules (`packages/domain`'s 100%-coverage rule applies to the new helper; `apps/backend` follows the testing-trophy/real-DB-integration convention already established in this exact pipeline)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-25 (table shape for `post_account_associations`, context only — not touched here), AD-31 Rule 3 (`NULL` `accountType` semantics, referenced for why classification is deliberately not run on discovered profiles)
- [x] `docs/infrastructure/index.md` — reviewed; this story adds a DB migration but no new infrastructure resource (no new queue, Lambda, or compute) — the existing `2-backend.md`/`3-database.md` shards were not independently re-read in full, as this story's migration is additive-column-only and introduces no new access pattern, index, or queue interaction requiring their guidance beyond what AD-25 (already read) already covers for this table family

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `packages/database/schema.ts` — add `firstSeen`, `lastSeen`, `discoverySource`, `isVerifiedForDiscovery` to `socialMediaAccountProfiles`; generate + apply migration.
  2. `packages/domain/src/scraper/account-enrichment.ts` (+ its export barrel) — add `resolveDiscoveredIdentityNames`.
  3. `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts` (new) — race-safe upsert via `onConflictDoUpdate`.
  4. `apps/backend/src/lib/posts/persist-scraped-post.ts` — extend `PersistScrapedPostParams`; call Task 3's function per identity, non-blocking.
  5. `apps/backend/src/lib/scraper/process-scrape-job.ts`, `process-apify-async-result.ts`, `replay-actor-run.ts` (Apify branch only) — pass `ownerId`/`coauthors`/`discoverySourceVendor: 'apify'` through.
  6. Six test files (five extended, one new) per Task 6.
  7. No other file is modified — `process-brightdata-result.ts`, `brightdata-record-mapper.ts`, `subscribe-to-account.ts`, `classify-account-type.ts`, `backfill-account-profile-and-infer-location.ts`, any GraphQL schema/resolver file, and `packages/domain/src/scraper/types.ts` are all explicitly out of scope (see Dev Notes/Out of Scope).
- **Rule Mapping:**
  - AC1/AC5 (get-or-create with `lastSeen` advance, `firstSeen`/`discoverySource` preserved on conflict) → Task 3's `onConflictDoUpdate` shape, Task 1's column additions.
  - AC2 (`isVerifiedForDiscovery: false`, unsubscribed, no scrape trigger) → Task 3 (explicit `false` in insert values); no `subscriptions`/`triggerScrapeForAccount` call anywhere in the new code path.
  - AC3 (`displayName`/`username` fallback) → Task 2's `resolveDiscoveredIdentityNames`.
  - AC4 (accountId-less identity never creates a profile) → no new code; Task 6's regression-guard test confirms Story 3.13's existing filtering is sufficient.
  - DB migration requirement (project-context.md) → Task 1.
  - `packages/domain` 100%-coverage rule → Task 6's `account-enrichment.test.ts` cases.
  - Explicit-vendor-parameter design decision (`AskUserQuestion`) → Task 4's `discoverySourceVendor` param, Task 5's three call-site literals.
- **Verification Plan:** Task 7 in full — domain + targeted backend test files, migration generate/apply, both packages' `build`, lint on all touched files.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — DB migration (4 columns) + new `apps/backend/src/lib/accounts/` function + `packages/domain` helper + threading through `persistScrapedPost` and its 3 Apify call sites; explicitly not `subscribe-to-account.ts`, not Bright Data, not `post_account_associations` (Story 3.15), not any GraphQL exposure.
- [ ] Architecture and boundary confirmation — AD-25/AD-31 reviewed (context only, no DDL conflict); DB-coupled logic stays in `apps/backend`, pure fallback-chain logic in `packages/domain`, per `project-context.md`'s Code Organization rule.
- [ ] Testing plan confirmation — Task 6's test cases cover AC1-AC5, including the new-vs-re-observed upsert distinction and the accountId-less regression guard.
- [ ] Explicit human approval state (Default: pending approval) — **pending**; this story has not yet been implemented.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md` (READY, no correction needed for 3.14); Gate 2 run fresh this session (No gap found, backend-only scope).
- [ ] Design decision confirmed — the explicit `discoverySourceVendor` parameter (vs. implicit derivation) was resolved via `AskUserQuestion` before this story was drafted; see Dev Notes "Design Decisions."

## Testing Requirements

- [ ] Unit tests — `packages/domain/src/scraper/account-enrichment.test.ts`'s `resolveDiscoveredIdentityNames` cases, 100% branch coverage per the `packages/domain` rule.
- [ ] Integration tests — `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.test.ts` (new), `persist-scraped-post.test.ts`, `process-scrape-job.test.ts`, `process-apify-async-result.test.ts`, `replay-actor-run.test.ts` (all extended), `node:test` pattern against the real local Postgres DB, matching this directory's existing convention (no DB mocking).
- [ ] E2E tests — not applicable; this is a backend-only data-pipeline change with no user-facing flow to exercise end-to-end, per `project-context.md`'s testing-trophy guidance.

## Deliverables Checklist

- [ ] `social_media_account_profiles` extended with `firstSeen`/`lastSeen`/`discoverySource`/`isVerifiedForDiscovery` + generated migration applied.
- [ ] `resolveDiscoveredIdentityNames` added to `packages/domain` with 100%-coverage tests.
- [ ] `getOrCreateDiscoveredAccountProfile` implemented in `apps/backend/src/lib/accounts/` with race-safe `onConflictDoUpdate` upsert.
- [ ] `persistScrapedPost` threads `ownerId`/`coauthors`/`discoverySourceVendor` and calls the new get-or-create logic non-blockingly for the publisher + each coauthor.
- [ ] All three Apify-sourced call sites (`process-scrape-job.ts`, `process-apify-async-result.ts`, `replay-actor-run.ts`'s Apify branch) pass the three new fields through.
- [ ] Six test files (one new, five extended) per Task 6, all green.
- [ ] `pnpm --filter database generate`/`migrate`, both packages' `build`, and lint on all touched files all clean.

## Out of Scope

- The `post_account_associations` table, its DDL, or any migration, or linking a post to the publisher/coauthor profiles this story creates — Story 3.15 (CAP-3), which depends on this story.
- Immediate subscribability of a discovered profile, or triggering its initial scrape — Story 3.16 (CAP-4).
- Demand-gated discovery (`isVerifiedForDiscovery` actually gating any autocomplete/ranked-discovery query) — Story 3.17 (CAP-5); this story only writes the column, Story 3.17 reads/enforces it.
- Union-of-associations account filtering, the event/post-detail attribution UI, or subscription-toggle analytics — Stories 3.18/0.i6g/3.19 respectively.
- Exposing `firstSeen`/`lastSeen`/`discoverySource`/`isVerifiedForDiscovery` via any GraphQL query or type — no AC in this story requires it, and no consumer in this wave reads them over GraphQL yet.
- Setting `isVerifiedForDiscovery: true` explicitly in `subscribe-to-account.ts`'s insert — the column's `NOT NULL DEFAULT true` already produces correct behavior for that path without a code change; Story 3.17's own AC text is where that path's behavior is actually specified and tested.
- Any Bright Data (`brightdata-record-mapper.ts`, `process-brightdata-result.ts`) change — `ScrapedPost.ownerId`/`coauthors` are Apify-exclusive per Story 3.13 AC4; Bright Data-side work is tracked separately as `backlog.yaml` FIND-039.
- Backfilling a provisional (accountId-less) identity into a real profile once a platform ID is later known — structurally possible (the raw entry is preserved in `unprocessedScraperPayloads`) but not built by any AC in this story.

## Definition of Done

- [ ] AC1-AC5 satisfied exactly as specified above.
- [ ] All Task 6 tests passing, plus every pre-existing test in the six touched files (no regression).
- [ ] `pnpm --filter database generate`/`migrate` clean; `pnpm --filter domain build`/`pnpm --filter backend build` (tsc) clean; `pnpm lint` clean on all touched files.
- [ ] No file outside the File Change Plan touched.

## Completion Status

- [ ] Not yet implemented — story is `ready-for-dev`.

## Dev Agent Record

### Agent Model Used

_To be filled by `bmad-dev-story`._

### Debug Log References

_To be filled by `bmad-dev-story`._

### Completion Notes List

_To be filled by `bmad-dev-story`._

### File List

_To be filled by `bmad-dev-story`._

## Change Log

- 2026-10-02: Story drafted via `bmad-create-story`, batch CC-024 Wave 2B, built against Story 3.13 (status `review`, standing rule allows). Gates 1/3 cited from `batch-cc-024-multi-event-readiness.md`; Gate 2 run fresh (no gap, backend-only). One design decision (`discoverySource.vendor` derivation: explicit parameter vs. implicit field-presence inference) resolved via `AskUserQuestion` before drafting — explicit parameter chosen. Status set to `ready-for-dev`.
