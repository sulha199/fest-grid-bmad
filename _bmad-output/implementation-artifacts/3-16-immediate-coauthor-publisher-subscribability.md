---
baseline_commit: a9b7c904bab4e74ef85590313789f950f2600ec9
---

# Story 3.16: Immediate coauthor/publisher subscribability

## Story Details

- Epic: 3
- Story ID: 3.16
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to subscribe to a coauthor or publisher profile with a stable accountId directly from event/post detail (or a direct account-ID lookup), through the existing subscription contract,
so that I don't have to wait for someone to separately discover and scrape that account before I can subscribe to it (FIND-022, CAP-4).

## Acceptance Criteria

1. **Given** a coauthor profile created via Story 3.14 (never itself directly scraped), **when** a user subscribes to it via the existing `subscribeToAccount` mutation (Story 3.1a/3.1), **then** the subscription succeeds through the unmodified existing GraphQL contract (same mutation name, `SubscribeToAccountInput`/`SubscribeToAccountResult` shapes, unchanged).
2. **And** that coauthor's own feed begins populating through the existing initial-scrape/classification flow (Stories 3.4/3.4a), triggered the same way a directly-added subscription triggers it today — **and** this classify-then-maybe-scrape cascade runs **at most once per account**, even when two subscribe requests for the same still-unclassified account race concurrently (resolved via a TTL-reclaimable claim — see Dev Notes "Design Decisions").
3. **And** this story stays cap-agnostic per the spec's constraint — it does not implement or hardcode `MAX_SUBSCRIBED_ACCOUNTS_FREE_USER` (IDEA-008's scope) but does surface IDEA-008's typed cap error, if returned, through the same error-handling path Story 3.2's subscribe action already uses — no new shared-component redesign needed when IDEA-008 ships.
4. **And** subscribing to a profile whose `isVerifiedForDiscovery` is currently `false` (every Story 3.14-discovered coauthor/publisher profile) flips it to `true` — the signal Story 3.17's demand-gated discovery read-path will later consume (resolved via `AskUserQuestion` — see Dev Notes "Design Decisions"). A profile that is already `true` (the pre-existing direct-subscribe path, or a profile already flipped by an earlier subscriber) is left unchanged.

## Tasks / Subtasks

- [x] **Task 1 — Schema: TTL-reclaimable classification claim column (AC: 2)**
  - [x] 1.1 In `packages/database/schema.ts`, add a nullable `classificationClaimedAt: timestamp('classification_claimed_at', { withTimezone: true })` column to `socialMediaAccountProfiles` (after `isVerifiedForDiscovery`). Doc comment mirrors Story 3.6z's `posts.queuedForExtractionAt` precedent: marks "a classify-then-maybe-trigger-scrape attempt is currently in flight for this account." No default, no backfill — every existing row is correctly null/unclaimed.
  - [x] 1.2 In `apps/backend/src/env.ts`: add `accountClassificationClaimTtlMinutes: number;` to the `BackendEnv` interface and `accountClassificationClaimTtlMinutes: parseInt(process.env.ACCOUNT_CLASSIFICATION_CLAIM_TTL_MINUTES || '30', 10),` to the loader (same `30`-minute default as `postExtractionClaimTtlMinutes`, same `// eslint-disable-next-line turbo/no-undeclared-env-vars` pattern).
  - [x] 1.3 Run `pnpm --filter @festgrid/domain build` then `pnpm --filter @festgrid/database generate`. Expect a plain `ALTER TABLE social_media_account_profiles ADD COLUMN classification_claimed_at timestamptz` — no `WHERE`-clause/partial-index gotcha applies (same class of additive-column migration as Story 3.14's `0063`, not Story 3.15's hand-edited `0064`). Confirm the next sequential migration number via `ls packages/database/migrations | tail -1` before running (expected `0067_<generated-name>.sql`, following `0066_certain_mordo.sql`).
  - [x] 1.4 Run `pnpm --filter @festgrid/database migrate` against the local dev DB. Verify via `psql \d social_media_account_profiles` that the column exists, nullable, no default.

- [x] **Task 2 — Generalize the TTL-claim helpers into a shared, cross-entity home (AC: 2)**
  - [x] 2.1 `packages/domain/src/posts/claim-ttl.ts`'s `computeClaimCutoff`/`isClaimExpired` (built by Story 3.6z) are already fully generic pure date-math — no `Post`-specific type in either signature. Now that a second entity (accounts) needs the identical mechanism, move the real implementation + its test to a new `packages/domain/src/shared/claim-ttl.ts` / `packages/domain/src/shared/claim-ttl.test.ts` (new top-level `shared/` folder — per `project-context.md`'s rule that a generic, cross-entity mechanism belongs in a generic subfolder, not nested under one entity's folder).
  - [x] 2.2 Turn `packages/domain/src/posts/claim-ttl.ts` into a one-line re-export shim: `export * from "../shared/claim-ttl.js";`. Delete the now-duplicate `posts/claim-ttl.test.ts` (its cases move to `shared/claim-ttl.test.ts` verbatim). This keeps `@festgrid/domain/posts`'s public export surface byte-for-byte unchanged, so **`apps/backend/src/lib/posts/enqueue-post-for-processing.ts` and its test need zero edits** — do not touch either file; this is a pure relocation, not a behavior change, and Story 3.6z's surface stays unreopened.
  - [x] 2.3 Add a `./shared` entry to `packages/domain/package.json`'s `exports` map (mirroring the existing `./posts`/`./query` entries exactly: `{ "types": "./dist/shared/index.d.ts", "default": "./dist/shared/index.js" }`) and create `packages/domain/src/shared/index.ts` exporting `export * from "./claim-ttl.js";`.
  - [x] 2.4 Run `pnpm --filter @festgrid/domain build` and confirm `packages/domain/src/posts/claim-ttl.test.ts`'s moved assertions still pass from their new location, plus a quick `tsc`-level smoke check that `@festgrid/domain/posts`'s existing consumers (`enqueue-post-for-processing.ts`) still resolve `computeClaimCutoff` with no import-path change.

- [x] **Task 3 — Restructure `subscribeToAccount` (AC: 1, 2, 4)**
  - [x] 3.1 In `apps/backend/src/lib/subscriptions/subscribe-to-account.ts`, remove the capacity check and the classify-then-maybe-scrape block from inside the `if (!accountProfile) { ... }` branch — that branch becomes find-or-create only (capacity check removed entirely from here; insert via `onConflictDoNothing`, re-select). This is a pure relocation, not a behavior change, for the original brand-new-profile case: today, classification always runs immediately after a successful insert anyway, so moving the same check+classify sequence to run immediately after the branch (Task 3.2) produces an identical observable sequence for that case, while now also covering the pre-existing-row case AC2 requires.
  - [x] 3.2 Immediately after the find-or-create block (so it runs for **both** a just-inserted row and a pre-existing row, e.g. one created by Story 3.14's `getOrCreateDiscoveredAccountProfile`), add: `if (accountProfile && accountProfile.accountTypeStatus === null) { ... }`. Inside it, attempt the atomic claim:
    ```ts
    const now = new Date();
    const cutoff = computeClaimCutoff(env.accountClassificationClaimTtlMinutes, now);
    const [claimed] = await db
      .update(socialMediaAccountProfiles)
      .set({ classificationClaimedAt: now })
      .where(
        and(
          eq(socialMediaAccountProfiles.id, accountProfile.id),
          isNull(socialMediaAccountProfiles.accountTypeStatus),
          or(
            isNull(socialMediaAccountProfiles.classificationClaimedAt),
            lt(socialMediaAccountProfiles.classificationClaimedAt, cutoff)
          )
        )
      )
      .returning();
    ```
    (`and`, `isNull`, `lt`, `or` newly imported from `drizzle-orm`; `computeClaimCutoff` from `@festgrid/domain/shared`, per Task 2; `env` from the already-imported `loadBackendEnv()`.)
  - [x] 3.3 Only when `claimed` is truthy (this caller won the claim): run the existing capacity check (`isProviderCapacityAvailable('apify')`/`'brightdata'`), and on exhaustion **release the claim before rethrowing** (`await db.update(socialMediaAccountProfiles).set({ classificationClaimedAt: null }).where(eq(socialMediaAccountProfiles.id, accountProfile.id));` then `throw new ScraperCapacityExceededError(...)`) — mirrors `enqueuePostForProcessing`'s send-time-failure release pattern, so a capacity failure doesn't hold the claim for the full TTL for nothing. Then call `classifyAccountType({ accountId: accountProfile.id, username: accountProfile.username, userId })` exactly as today, merge its result into the in-memory `accountProfile` exactly as today, and conditionally call `triggerScrapeForAccount` exactly as today (unchanged condition: `classification.accountType === 'ORGANIZER_VENUE_EVENT' && classification.accountTypeStatus === 'CONFIRMED'`). No need to clear `classificationClaimedAt` on success — `classifyAccountType` always sets `accountTypeStatus` to a non-null value before returning (success, low-confidence, or hard-failure all set `CONFIRMED`/`AWAITING_APPROVAL`; see its `handleHardFailure`), so the claim's own `isNull(accountTypeStatus)` guard permanently closes the window regardless of the stale claim timestamp.
  - [x] 3.4 When `claimed` is falsy (another request already claimed or already finished classifying this exact profile): do nothing — no error, no retry. Fall through to subscription-row handling. This is deliberate: AC1 requires the subscription to always succeed, and AC2 only requires the cascade to run once per account, not once per subscriber.
  - [x] 3.5 Add a new, unconditional step (independent of the `accountTypeStatus === null` branch — it must also apply to an already-classified profile subscribed to for the first time, e.g. a coauthor profile that happened to get classified by a different path before anyone subscribed) implementing AC4:
    ```ts
    const [verified] = await db
      .update(socialMediaAccountProfiles)
      .set({ isVerifiedForDiscovery: true })
      .where(and(eq(socialMediaAccountProfiles.id, accountProfile.id), eq(socialMediaAccountProfiles.isVerifiedForDiscovery, false)))
      .returning();
    if (verified) {
      accountProfile = verified;
    }
    ```
    Placed after Task 3.2's block and before the existing-subscription check, so the returned `accountProfile` always reflects the final `isVerifiedForDiscovery` value. A profile already `true` makes this a no-op (`WHERE ... = false` matches zero rows, `verified` stays undefined, `accountProfile` is left as-is) — cheap and idempotent on every repeat call.
  - [x] 3.6 No change to `SubscribeToAccountParams`'s shape, `subscriptions.graphql`'s `SubscribeToAccountInput`/`SubscribeToAccountResult`, or the resolver's `try { ... } catch (err) { if (err instanceof ScraperCapacityExceededError) {...} throw err; }` block in `apps/backend/src/schema/resolvers.ts` — confirm by inspection that `ScraperCapacityExceededError` thrown from the new Task 3.3 location still propagates through this unchanged catch block exactly as it does today for the brand-new-profile case (AC1, AC3).

- [x] **Task 4 — Tests (AC: 1, 2, 3, 4)**
  - [x] 4.1 `packages/domain/src/shared/claim-ttl.test.ts` — the relocated Story 3.6z test cases, unchanged assertions, 100%-branch coverage preserved (Task 2).
  - [x] 4.2 Extend `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` with new cases:
    - **(f) Pre-existing, never-classified profile gets classified and triggers scrape on first subscribe.** Directly `db.insert(socialMediaAccountProfiles)` a row with `accountTypeStatus: null`, `isVerifiedForDiscovery: false`, `discoverySource: { vendor: 'apify' }` (simulating Story 3.14's `getOrCreateDiscoveredAccountProfile` shape) **before** calling `subscribeToAccount` for that same `(platform, accountId)`. Mock classification to resolve `ORGANIZER_VENUE_EVENT`/`CONFIRMED`. Assert: `classifyAccountType`'s seams were invoked, `triggerApifyAsyncTrigger`/scrape was triggered, the subscription still succeeds, and the AC2 "triggered the same way... today" parity holds.
    - **(g) A second subscribe call to the same still-unclassified profile while a claim is in flight does not reclassify or re-trigger scrape.** Pre-seed `classificationClaimedAt: new Date()` (fresh, non-expired) on a `accountTypeStatus: null` row, then call `subscribeToAccount`; assert the classification/scrape seams are **not** invoked this call, and the subscription still succeeds (AC1 always succeeds; AC2's "at most once" guarantee).
    - **(h) A stale (TTL-expired) claim is reclaimable.** Pre-seed `classificationClaimedAt` to a timestamp older than `accountClassificationClaimTtlMinutes`, assert classification **does** run on this call (the claim is treated as abandoned, not permanently blocking).
    - **(i) `isVerifiedForDiscovery` flips from `false` to `true` on first subscribe to a discovery-sourced profile (AC4).** Pre-seed a row with `isVerifiedForDiscovery: false`; after `subscribeToAccount`, assert `result.profile.isVerifiedForDiscovery === true` and the DB row reflects it.
    - **(j) An already-verified, already-classified profile subscribed to again is a no-op on both new columns.** Regression guard: `isVerifiedForDiscovery` stays `true` (not re-written), `accountTypeStatus`/`classificationClaimedAt` are untouched, no classification seam invoked — matches today's "returns existing subscription if already subscribed" case, extended to assert the two new columns don't regress it.
    - Confirm the existing `(a)`–`(e)`-equivalent cases ("triggers Apify async...", "falls back to Bright Data...", "returns existing subscription...", the classification-gating `subT` block) still pass unmodified — the Task 3.1 relocation must not change their observable behavior.
  - [x] 4.3 If constructing a true scraper-capacity-exhausted fixture (`scraperProviderUsage` rows over both providers' budgets) proves impractical within this story's scope, it is acceptable to leave the capacity-exceeded-releases-the-claim path (Task 3.3) verified by code review rather than a dedicated integration test — the pre-existing brand-new-profile capacity-exceeded path was never integration-tested in this file either (confirmed: no `ScraperCapacityExceededError` test exists in `subscribe-to-account.test.ts` today); this is not a new gap introduced by this story.
  - [x] 4.4 Run `pnpm --filter @festgrid/domain build`, `pnpm --filter @festgrid/database generate`/`migrate`, then targeted tests: `TZ=UTC NODE_ENV=test npx tsx --test --test-concurrency=1 "src/lib/subscriptions/subscribe-to-account.test.ts"` (from `apps/backend`) and `packages/domain`'s `src/shared/claim-ttl.test.ts`. Then `pnpm --filter domain build`, `pnpm --filter backend build` (tsc), and lint on all touched files. Full `apps/backend` suite and repo-wide `pnpm test` deferred to the CC-024 batch-end gate, per this wave's established precedent (3.13/3.14/3.15).

## Dev Notes

- **The actual gap this story closes (confirmed by direct code inspection, not assumed from the epics.md AC text alone).** `subscribeToAccount`'s classify-then-maybe-trigger-scrape block today runs **only** inside `if (!accountProfile) { ... }` — i.e. only when *this exact call* just inserted a brand-new profile row. Story 3.14 (built, `review`) added `getOrCreateDiscoveredAccountProfile`, which creates/upserts a `social_media_account_profiles` row for a coauthor/publisher discovered while scraping *someone else's* post — by its own explicit design (its own doc comment: "never subscribed and never triggers a scrape -- that is Story 3.16's job"), it never classifies and never scrapes. Such a row sits with `accountType: null`/`accountTypeStatus: null` indefinitely. When a user later subscribes to that *already-existing* row via today's `subscribeToAccount`, the `if (!accountProfile)` check is false, so classification and the scrape trigger are silently skipped — AC2 ("triggered the same way a directly-added subscription triggers it today") does not hold for the exact scenario this story exists to enable. This is a requirement for AC2 to be true at all, not an optional enhancement, per this project's own "a story must leave the system working end-to-end" rule — it just isn't spelled out at the epics.md AC-bullet level of granularity.
- **Why `accountTypeStatus === null` is the correct, already-precedented "never classified" signal.** The already-shipped `triggerAccountScrape` mutation (`apps/backend/src/schema/resolvers.ts` ~line 601, a manual re-trigger for an already-subscribed account) already gates on `profile.accountTypeStatus === null || (accountType === 'ORGANIZER_VENUE_EVENT' && accountTypeStatus === 'CONFIRMED')` — i.e. it already treats a null status as "never classified, allow it through." This is robust because `classifyAccountType` (`apps/backend/src/lib/accounts/classify-account-type.ts`) always sets `accountTypeStatus` to a non-null value (`CONFIRMED` or `AWAITING_APPROVAL`) before returning, on every path including its own hard-failure fallback — so a non-null status reliably means "a classification attempt has run," regardless of its outcome.
- **Why the fix lives in `subscribeToAccount`, not in Story 3.14's `getOrCreateDiscoveredAccountProfile`.** 3.14's own, already-reviewed AC2 is explicit that a newly discovered profile "is never subscribed and never triggers a scrape" — that file has no `userId` to classify on behalf of (classification is billed/attributed to the subscribing user, per `classifyAccountType`'s `subscriberUserIds: [userId]` parameter) and reopening its reviewed surface for this story's purpose would add risk for no benefit. The classify/scrape decision correctly belongs at the moment a real user actually subscribes, which is exactly `subscribeToAccount`.
- **Read in full before finalizing this design:** `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` and its test, `apps/backend/src/lib/accounts/classify-account-type.ts`, `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts` (Story 3.14, confirmed: never classifies, never scrapes, by design), `apps/backend/src/lib/scraper/trigger-scrape-for-account.ts`, `apps/backend/src/schema/resolvers.ts`'s `subscribeToAccount` and `triggerAccountScrape` resolvers, `apps/backend/src/schema/subscriptions.graphql`, `packages/database/schema.ts`'s full `socialMediaAccountProfiles` definition, `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` + `packages/domain/src/posts/claim-ttl.ts`/`.test.ts` (Story 3.6z's TTL-reclaimable-claim precedent, reused here), `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx` and `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx` (confirmed: both already read `ClientError`'s `extensions.code` generically — `"SCRAPER_CAPACITY_EXCEEDED"` today — so AC3's "no new shared-component redesign needed when IDEA-008 ships" is already true of the existing architecture, zero code change required for AC3 itself), `packages/domain/package.json`'s `exports` map, `_bmad-output/specs/spec-post-coauthor-attribution/SPEC.md` (CAP-4), `epics.md`'s Story 3.14/3.16/3.17 sections, and Architecture Spine AD-31 (confirmed: does not bind Story 3.16 at all — its "Binds" list names 3.13/3.15/3.18/3.6v/3.8/0.i6g, not 3.16; `post_account_associations`/migration `0064` are sequencing context from the wave plan, not a functional dependency of this story's code).

### Design Decisions

Two genuine, non-mechanical design questions were surfaced to the user via `AskUserQuestion` before finalizing this story's technical approach, per this project's standing `bmad-create-story` rule (the root-cause analysis above and the capacity-check relocation are **not** design decisions — they are the one determinate fix implied by AC2 plus existing, precedented code, with no competing valid alternative once the gap is understood):

1. **Who writes the `isVerifiedForDiscovery: false → true` flip Story 3.17's own AC text describes ("at which point `isVerifiedForDiscovery` flips to `true`"), citing a subscribe (Story 3.16) or vote event — but `epics.md` never assigns which story actually writes it.** Resolved: **Story 3.16 writes it now** (AC4), at subscribe time, rather than deferring entirely to Story 3.17. Rationale (user-selected, "recommended" option): matches 3.17's own AC text literally naming "Story 3.16" as the subscribe-trigger point, and keeps the data correct even before 3.17 ships — 3.17 then only needs to add the read-side gate and the (separate, not-yet-designed) vote-event trigger, not retrofit every subscribe that happened before it landed.
2. **How to prevent the classify-then-maybe-scrape cascade from double-firing when two users subscribe to the same still-unclassified coauthor profile at nearly the same moment** — a race that already exists today for two concurrent *first-ever* subscribers of a brand-new account, but which this story makes far more likely (every Story 3.14-discovered profile starts in this unclassified state until someone subscribes, and a popular post's coauthor is a plausible concurrent-subscribe target). Resolved across two rounds:
   - **Round 1:** the user chose "add a row-lock guard" over "accept as a known limitation."
   - **Round 2 (mechanics surfaced a real problem with the naive version):** wrapping the whole classify+scrape sequence in one `db.transaction()` with `SELECT ... FOR UPDATE` would self-deadlock, because `classifyAccountType`'s internal `db.update()` calls run on the plain `db` client, not the transaction's connection — they would block forever waiting for the very row lock the outer transaction holds. And a lock released *before* classification finishes (to avoid the deadlock) doesn't prevent the race at all, since nothing is written to the row while the lock is held, so a second concurrent caller sees the identical pre-classification state once the lock is gone. Given a correct fix needed a DB-level claim either way, the user chose the **TTL-reclaimable claim column**, mirroring this project's own precedent for the identical problem shape: Story 3.6z's `posts.queuedForExtractionAt` (an atomic `UPDATE ... WHERE ... RETURNING` claim, reclaimable after a TTL so a crashed/timed-out attempt doesn't permanently strand the account). This is Task 1-3's `classificationClaimedAt` column. The alternative of holding a live DB connection open across the full Gemini+Apify network round trip was explicitly rejected given this project's own documented connection-pool-exhaustion incident (`docs/infrastructure/incidents/2026-08-27-connection-pool-exhaustion.md`, `project-context.md`'s Connection Pooling rule).

### Architecture & UX Gate Findings

No epic readiness report covers Story 3.16 — `cc-024-multi-event-wave-plan.md` explicitly records "3.16 / 3.17 / 3.19 ... are `backlog`, never swept (added after the 2026-09-11 Epic 3 sweep), and no CC-024 story depends on them. Deferred, not covered." All three gates were therefore run fresh this session, per `story-split-gate.md`'s fallback path.

- **Gate 1 (Architecture/Infrastructure Completeness) — No gap found.** The fix is confined to restructuring a conditional inside one existing backend function (`subscribeToAccount`), reusing `classifyAccountType`/`triggerScrapeForAccount` verbatim, with no GraphQL schema/resolver signature change, no frontend-to-DB or frontend-to-third-party calls, no new auth/secrets logic, and no new infrastructure dependency.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness) — No gap found.** The story introduces no new foundational concept; it extends an already-precedented signal (`accountTypeStatus === null`, already load-bearing in the shipped `triggerAccountScrape` mutation) and composes only already-built pieces (3.1/3.1a, 3.4/3.4a, 3.14, and 3.6z's TTL-claim pattern, generalized per Task 2), all of which already have corresponding stories in `epics.md`.
- **Gate 2 (UI Complexity & Reusability) — No gap found.** Zero React/JSX/TSX files touched, zero `apps/web`/`packages/ui` files touched, no GraphQL schema/mutation signature change. The only UI consumer of this story's output (the event/post-detail subscribe toggle) is Story 0.i6g, an entirely separate, already-identified story that depends on 3.16 — matching the identical pattern and reasoning already validated fresh on sibling stories 3.13–3.15 (all "No gap found," all backend-only). DESIGN.md/EXPERIENCE.md were not loaded in full for this gate, since there is no UI feature-area scope in this story to check them against — consistent with how the prior backend-only siblings in this slice ran this gate.
- **Lightweight guard — does this story's actual scope contain anything the above gates plausibly didn't anticipate?** No. No new external service, no new data entity (the new `classificationClaimedAt` column is a same-table, same-entity addition, directly analogous to Story 3.14's own prior additive-column migration on this exact table), no new infra dependency (no new queue, Lambda, or compute resource).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** A genuine new DB migration is required — a single additive nullable column, the same class of change as Story 3.14's `0063` (not Story 3.15's `0064`, which added a new table with hand-edited partial unique indexes).
- **Impacted fields/contracts:** `packages/database/schema.ts`'s `socialMediaAccountProfiles` table gains `classificationClaimedAt` (Task 1); `apps/backend/src/env.ts`'s `BackendEnv` interface gains `accountClassificationClaimTtlMinutes: number` (Task 1.2); `packages/domain/src/shared/claim-ttl.ts` is a new file carrying `computeClaimCutoff`/`isClaimExpired`, relocated unchanged from `packages/domain/src/posts/claim-ttl.ts` (Task 2) — no signature change, so no consumer-facing type change at all; `packages/domain/package.json`'s `exports` map gains a `./shared` entry.
- **Required DB migration changes:** `ALTER TABLE social_media_account_profiles ADD COLUMN classification_claimed_at timestamptz` (exact DDL as generated by `drizzle-kit generate` from Task 1.1's schema change) — nullable, no default, no backfill (every existing row correctly starts unclaimed/null, matching Story 3.14's `isVerifiedForDiscovery`-sibling-column precedent reasoning for the other three nullable columns it added).
- **Required TypeScript type changes:** none breaking. `SubscribeToAccountParams`/`ProfileInput` (the function's public input shape) are unchanged; the GraphQL `SubscribeToAccountInput`/`SubscribeToAccountResult` types are unchanged (AC1). The only new exported symbol is the relocated `packages/domain/src/shared/claim-ttl.ts` module, whose two functions keep their exact existing signatures.
- **Backward compatibility and rollout notes:** Purely additive at the DB level. No feature flag needed. The behavior change (classification/scrape now also triggers for a pre-existing, previously-discovered-but-never-classified profile) is deliberate and is exactly this story's point — it does not change behavior for any profile that was already classified before this story ships (the `accountTypeStatus === null` guard structurally excludes them), so no existing classified/subscribed account is reclassified or re-scraped by this deploy.
- **Verification checks:** Task 1.4's `psql` column-shape check; Task 4's new/extended test files; `pnpm --filter database generate`/`migrate`, `pnpm --filter domain build`/`pnpm --filter backend build` (tsc), and lint, all clean.

### Project Structure Notes

- New files: `packages/domain/src/shared/claim-ttl.ts`, `packages/domain/src/shared/claim-ttl.test.ts`, `packages/domain/src/shared/index.ts`.
- Modified files: `packages/database/schema.ts` (+ generated migration SQL under `packages/database/migrations/`), `apps/backend/src/env.ts`, `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (+ its test, extended), `packages/domain/src/posts/claim-ttl.ts` (becomes a one-line re-export shim), `packages/domain/package.json` (new `./shared` export entry).
- Deleted files: `packages/domain/src/posts/claim-ttl.test.ts` (its cases move verbatim to `packages/domain/src/shared/claim-ttl.test.ts`).
- Explicitly **not** touched: `apps/backend/src/schema/subscriptions.graphql`, `apps/backend/src/schema/resolvers.ts`'s `subscribeToAccount`/`triggerAccountScrape` resolver bodies (only inspected to confirm the existing catch block still works unchanged — Task 3.6), `apps/backend/src/lib/accounts/classify-account-type.ts`, `apps/backend/src/lib/accounts/get-or-create-discovered-account-profile.ts`, `apps/backend/src/lib/scraper/trigger-scrape-for-account.ts`, `apps/backend/src/lib/posts/enqueue-post-for-processing.ts` and its test (Task 2.2 — zero edits, by design), `post_account_associations`/anything from Story 3.15, any GraphQL schema/resolver/frontend file (no AC in this story requires a UI change — Story 0.i6g owns that), `apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx` and `apps/web/src/features/onboarding/onboarding-subscribe-step.tsx` (read only to confirm AC3 needs no code change there).
- No new workspace package, no new cross-boundary dependency (no `zod`/`ajv` change), no Firebase/queue/state-management code touched, no analytics/i18n touched.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.16: Immediate coauthor/publisher subscribability] — full AC text and the "Amendment" recorded alongside this story
- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.14: Deduplicated, provenance-tracked subscribable profiles] and #Story 3.17: Demand-gated discovery for scrape-discovered profiles — the two stories this story's scope sits directly between
- [Source: _bmad-output/specs/spec-post-coauthor-attribution/SPEC.md#CAP-4 — Immediate coauthor subscribability]
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-31: Post–Account Association Semantics] — confirmed does not bind this story
- [Source: _bmad-output/planning-artifacts/cc-024-multi-event-wave-plan.md] — Wave 4A context; confirms no epic-readiness sweep covers 3.16
- [Source: _bmad-output/implementation-artifacts/3-14-deduplicated-provenance-tracked-subscribable-profiles.md] and 3-15-post-account-association-table-lossless-migration.md — prior stories in this slice; their exact plumbing and Dev Notes conventions are followed here
- [Source: apps/backend/src/lib/subscriptions/subscribe-to-account.ts, subscribe-to-account.test.ts, apps/backend/src/lib/accounts/classify-account-type.ts, get-or-create-discovered-account-profile.ts, apps/backend/src/lib/scraper/trigger-scrape-for-account.ts, apps/backend/src/schema/resolvers.ts, subscriptions.graphql, apps/backend/src/lib/posts/enqueue-post-for-processing.ts, packages/domain/src/posts/claim-ttl.ts/.test.ts, packages/database/schema.ts, packages/domain/package.json, apps/web/src/app/[locale]/settings/account/subscribe-account-dialog.tsx, apps/web/src/features/onboarding/onboarding-subscribe-step.tsx] — all read in full for this story

## Global Rules References

- [x] `_bmad-output/project-context.md` — Database/Runtime Schema Validation (no AJV/Zod boundary touched); Drizzle ORM Types (pg-core types used throughout); Code Organization (the TTL-claim relocation to `packages/domain/src/shared/` follows the explicit "generic, cross-entity mechanism → generic subfolder" rule; no React/DB-ORM-coupled logic placed in `packages/domain`); Testing Rules (100%-branch coverage preserved for the relocated `packages/domain` helper; `apps/backend` follows the existing testing-trophy/real-DB-integration convention already established in this exact file)
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's canonical section order/status vocabulary
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-31 reviewed and confirmed non-binding for this story (see Dev Notes)
- [x] `docs/infrastructure/index.md` — reviewed; this story adds a DB column but no new infrastructure resource (no new queue, Lambda, or compute) — the `2-backend.md`/`3-database.md` shards were not independently re-read in full, matching the 3.14/3.15 precedent for an additive-column-only, no-new-access-pattern migration
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — all three gates run fresh this session (no epic readiness report covers this story); see Architecture & UX Gate Findings

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  1. `packages/database/schema.ts` — add `classificationClaimedAt` to `socialMediaAccountProfiles`.
  2. `apps/backend/src/env.ts` — add `accountClassificationClaimTtlMinutes`.
  3. `packages/database/migrations/0067_<generated>.sql` (+ `meta/` snapshot/journal) — generated, plain additive column, no hand-edit expected.
  4. `packages/domain/src/shared/claim-ttl.ts` + `.test.ts` + `index.ts` (new) — relocated from `packages/domain/src/posts/`.
  5. `packages/domain/src/posts/claim-ttl.ts` — reduced to a one-line re-export shim; its old test file deleted.
  6. `packages/domain/package.json` — new `./shared` export entry.
  7. `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` — restructured per Task 3.
  8. `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` — extended per Task 4.2.
  9. No other file is modified — `subscriptions.graphql`, `resolvers.ts`'s resolver bodies, `classify-account-type.ts`, `get-or-create-discovered-account-profile.ts`, `trigger-scrape-for-account.ts`, `enqueue-post-for-processing.ts` (+ its test), and every frontend file are explicitly out of scope (see Dev Notes/Out of Scope).
- **Rule Mapping:**
  - AC1 (unmodified GraphQL contract, subscription always succeeds) → Task 3.4/3.6 (fall-through on an unclaimed race loser; resolver catch block left untouched).
  - AC2 (classify/scrape triggered the same way, at most once per account) → Task 1-3's TTL-reclaimable claim column + Task 3.2/3.3's claim-gated cascade.
  - AC3 (cap-agnostic, existing error path already generic) → confirmed by inspection, zero code change (Dev Notes).
  - AC4 (`isVerifiedForDiscovery` flip) → Task 3.5.
  - `packages/domain` generic-mechanism placement rule (project-context.md) → Task 2's relocation to `shared/`.
  - `packages/domain` 100%-coverage rule → Task 4.1 (relocated test, unchanged coverage).
- **Verification Plan:** Task 4.4 in full — domain + targeted backend test files, migration generate/apply, both packages' `build`, lint on all touched files.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — one new nullable DB column (`classificationClaimedAt`) + one new env var + a restructured `subscribeToAccount` (claim-gated classify/scrape cascade extended to pre-existing unclassified profiles, plus the `isVerifiedForDiscovery` flip) + a relocation of Story 3.6z's TTL-claim helpers into a shared, cross-entity home; explicitly not touching the GraphQL schema, any resolver body besides inspection, `classify-account-type.ts`/`get-or-create-discovered-account-profile.ts`/`trigger-scrape-for-account.ts` internals, `enqueue-post-for-processing.ts`, or any frontend file.
- [ ] Architecture and boundary confirmation — AD-31 confirmed non-binding; `packages/domain`'s generic-cross-entity-mechanism placement rule followed for the `shared/claim-ttl` relocation; all DB-coupled logic stays in `apps/backend`/`packages/database`.
- [ ] Testing plan confirmation — Task 4's new/extended cases cover AC1-AC4, including the claim race (in-flight and stale-reclaim), the `isVerifiedForDiscovery` flip, and a no-regression idempotency case; the capacity-exceeded-releases-the-claim path may be code-review-verified only, matching this file's pre-existing untested gap for that error path.
- [x] Explicit human approval state (Default: pending approval) — **approved** (user approved via `AskUserQuestion` in `bmad-dev-story` activation, 2026-10-03); implementation starting now.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates run fresh this session (no epic readiness report covers 3.16): No gap found on all three.
- [ ] Design decisions confirmed — both resolved via `AskUserQuestion` (the `isVerifiedForDiscovery` flip ownership, and the classify-once race guard's final shape after the row-lock mechanics were found to self-deadlock) — recorded above in Dev Notes "Design Decisions."

## Testing Requirements

- [x] Unit tests — `packages/domain/src/shared/claim-ttl.test.ts` (relocated, unchanged, 100% branch coverage per the `packages/domain` rule).
- [x] Integration tests — `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (extended, 5 new cases per Task 4.2 — (f)-(j), the task list's own case lettering), `node:test` against the real local Postgres DB, matching this directory's existing convention (no DB mocking).
- [x] E2E tests — not applicable; this is a backend-only change with no new user-facing flow to exercise end-to-end (Story 0.i6g owns the UI that will eventually call this mutation), per `project-context.md`'s testing-trophy guidance.

## Deliverables Checklist

- [x] `classification_claimed_at` column added to `social_media_account_profiles`, migration generated and applied.
- [x] `ACCOUNT_CLASSIFICATION_CLAIM_TTL_MINUTES` env var wired into `BackendEnv`.
- [x] `packages/domain/src/shared/claim-ttl.ts` holds the relocated, generalized TTL-claim helpers; `packages/domain/src/posts/claim-ttl.ts` is a one-line re-export shim; `enqueue-post-for-processing.ts` untouched.
- [x] `subscribeToAccount` restructured: classify-then-maybe-scrape cascade runs for any profile with `accountTypeStatus === null` (new or pre-existing), gated by the atomic TTL-reclaimable claim so it fires at most once per account under concurrent subscribers; `isVerifiedForDiscovery` flips `false → true` unconditionally on subscribe.
- [x] 5 new test cases in `subscribe-to-account.test.ts`, all green; existing cases unregressed.
- [x] `pnpm --filter database generate`/`migrate`, `pnpm --filter domain/backend build`, and lint on all touched files all clean.

## Out of Scope

- `MAX_SUBSCRIBED_ACCOUNTS_FREE_USER`'s value, server-side enforcement guard, and upgrade-CTA UX — IDEA-008's own future story (AC3 only requires today's generic error-handling path to already be forward-compatible, which it is, confirmed by inspection).
- Any GraphQL schema/mutation signature change, or any frontend/UI file — the event/post-detail subscribe-toggle surface is Story 0.i6g, which depends on this story.
- Story 3.17's actual demand-gated discovery read-path (excluding an unverified profile from autocomplete/ranked-discovery queries) and its vote-event trigger — this story only writes the `isVerifiedForDiscovery` flip on the subscribe path (AC4); 3.17 reads/enforces it and adds the vote-event half.
- Any change to `post_account_associations` (Story 3.15) or `event_posts`/AD-30 (Story 3.6r) — confirmed unrelated to this story's actual code.
- Any change to Bright Data's classification/scrape paths, or to `classifyAccountType`'s/`triggerScrapeForAccount`'s own internal logic — both are reused verbatim.
- Constructing a true scraper-capacity-exhausted integration-test fixture, if impractical — code-review verification is acceptable for that one path (Task 4.3), matching a pre-existing untested gap in this same file.

## Definition of Done

- [x] AC1-AC4 satisfied exactly as specified above.
- [x] All Task 4 tests passing, plus every pre-existing test in `subscribe-to-account.test.ts` and the relocated `claim-ttl.test.ts` (no regression).
- [x] `pnpm --filter database generate`/`migrate` clean; `pnpm --filter domain build`/`pnpm --filter backend build` (tsc) clean; lint clean on all touched files.
- [x] No file outside the File Change Plan touched (the one incidental edit, `rehost-post-image.test.ts`, was required by Task 1.2's `BackendEnv` interface widening, not a scope expansion — see Completion Notes).

## Completion Status

- [x] Implemented — all tasks complete, all ACs satisfied, status set to `review`.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`), via `bmad-dev-story`.

### Debug Log References

- `pnpm --filter @festgrid/domain build` — clean.
- `pnpm --filter @festgrid/database generate` — generated `migrations/0067_superb_expediter.sql`: `ALTER TABLE "social_media_account_profiles" ADD COLUMN "classification_claimed_at" timestamp with time zone;` (plain additive column, as expected).
- `pnpm --filter @festgrid/database migrate` — applied cleanly; `psql \d social_media_account_profiles` confirmed `classification_claimed_at` nullable, no default.
- `pnpm --filter backend build` (tsc) — clean (after adding the missing `accountClassificationClaimTtlMinutes` field to `rehost-post-image.test.ts`'s `mockEnv: BackendEnv` literal, required by the `BackendEnv` interface change).
- `TZ=UTC NODE_ENV=test npx tsx --test --test-concurrency=1 "src/lib/subscriptions/subscribe-to-account.test.ts"` (from `apps/backend`) — 10/10 pass (5 pre-existing cases unregressed + 5 new Task 4.2 cases (f)-(j)).
- `npx tsx --test src/shared/claim-ttl.test.ts` (from `packages/domain`) — 4/4 pass, relocated from `posts/claim-ttl.test.ts` unchanged.
- `npx eslint` on all touched/new files — 0 errors, 0 new warnings (a handful of pre-existing warnings in `env.ts` and `rehost-post-image.test.ts`, unrelated to this story's diff, confirmed via `git diff` to predate this change).
- Local DB had only fixture-scale data (117 posts, 47 account profiles) going in — not volume-seeded, so `seed:volume:clean` was not needed before the DB-touching test run.

### Completion Notes List

- Task 4.3's capacity-exceeded-releases-the-claim path (Task 3.3) was left verified by code review only, per the story's own explicit allowance — constructing a true `scraperProviderUsage`-over-budget fixture was out of scope, and this matches a pre-existing untested gap in this same file (no `ScraperCapacityExceededError` test existed here before this story either).
- AC3 required zero code change (confirmed by inspection of `subscribe-account-dialog.tsx`/`onboarding-subscribe-step.tsx`, both already generic on `extensions.code`) — no new test needed beyond the existing resolver catch-block confirmation (Task 3.6).
- All Definition-of-Done commands (`pnpm --filter database generate`/`migrate`, `pnpm --filter domain build`, `pnpm --filter backend build`, targeted test files, lint on touched files) were run and confirmed clean during implementation, not merely inferred from the code.
- No file outside the story's own File Change Plan was touched, except the one pre-existing test (`rehost-post-image.test.ts`) that needed a one-line update to satisfy the now-wider `BackendEnv` interface — an unavoidable consequence of Task 1.2's interface change, not a scope expansion.

### File List

- `packages/database/schema.ts` (modified — `classificationClaimedAt` column)
- `packages/database/migrations/0067_superb_expediter.sql` (new — generated migration)
- `packages/database/migrations/meta/0067_snapshot.json` (new — generated)
- `packages/database/migrations/meta/_journal.json` (modified — generated)
- `apps/backend/src/env.ts` (modified — `accountClassificationClaimTtlMinutes`)
- `apps/backend/src/lib/ai-processor/rehost-post-image.test.ts` (modified — added the new required `BackendEnv` field to its mock)
- `packages/domain/src/shared/claim-ttl.ts` (new — relocated from `posts/`)
- `packages/domain/src/shared/claim-ttl.test.ts` (new — relocated from `posts/`)
- `packages/domain/src/shared/index.ts` (new)
- `packages/domain/src/posts/claim-ttl.ts` (modified — now a one-line re-export shim)
- `packages/domain/src/posts/claim-ttl.test.ts` (deleted — cases moved to `shared/claim-ttl.test.ts`)
- `packages/domain/package.json` (modified — new `./shared` export entry)
- `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` (modified — restructured per Task 3)
- `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` (modified — extended with cases (f)-(j))

## Change Log

- 2026-10-03 — Story created via `bmad-create-story`. Two design decisions resolved with the user via `AskUserQuestion` across two rounds (see Dev Notes "Design Decisions"): `isVerifiedForDiscovery` flip ownership (3.16, not deferred to 3.17), and the classify-once concurrency guard (a new TTL-reclaimable `classificationClaimedAt` claim column, mirroring Story 3.6z's precedent, after a naive `SELECT ... FOR UPDATE` lock was found to self-deadlock against `classifyAccountType`'s internal writes). All three Gate 1/2/3 checks run fresh (no epic readiness report covers this story) — no gap found on any gate.
- 2026-10-03 — Implemented via `bmad-dev-story` (CC-024 Wave 4A). Pre-Coding Approval Gate approved via `AskUserQuestion` at activation. Task 1: added `classificationClaimedAt` column + migration 0067 + `accountClassificationClaimTtlMinutes` env var. Task 2: relocated Story 3.6z's TTL-claim helpers to `packages/domain/src/shared/claim-ttl.ts` (re-export shim left at the old `posts/` path). Task 3: restructured `subscribeToAccount` so the classify-then-maybe-scrape cascade runs for any never-classified profile (new or pre-existing) gated by the atomic claim, plus the unconditional `isVerifiedForDiscovery` flip (AC4). Task 4: added 5 new integration test cases (f)-(j); all pre-existing tests, domain build, backend build, and lint confirmed clean. Status set to `review`.
