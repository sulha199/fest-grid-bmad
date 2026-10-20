---
title: 'Classification failure persistence + moderator-resolution scrape trigger'
type: 'bugfix'
created: '2026-10-20'
status: 'done'
review_loop_iteration: 0
context: []
baseline_commit: 'bde7aa33b62eeb9aff0759bad5758c8adf571882'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `classifyAccountType`'s hard-failure path writes the profile `AWAITING_APPROVAL` and the moderation review row as two separate statements; a Lambda kill (or any error) between them leaves an orphan profile moderators never see (prod: `infokonsermusik`). Separately, a moderator's `resolveAccountTypeClassificationReview` never starts the account's first scrape — today that only happens via manual trigger or the next daily batch.

**Approach:** Make the profile update + review-row insert one atomic DB transaction in every write path of `classifyAccountType` (low-confidence, hard-failure, and the above-threshold success path), and never return a success-looking status if that transaction fails. After `resolveAccountTypeClassificationReview`'s transaction commits, start the first scrape via `triggerScrapeForAccount` when `isScrapableAccountType` says yes.

**Scope correction (2026-10-20, mid-review):** the classification-specific Apify lookup timeout (originally planned as Part 2) was dropped at the owner's direction — subscribe-time classification is becoming asynchronous in separate work, so a shorter request-path timeout is not wanted. `instagram-adapter.ts` is unchanged from master.

## Boundaries & Constraints

**Always:**
- Any code path starting a scrape calls `isScrapableAccountType()` (AD-34) — never re-inline.
- The profile UPDATE and the review-row INSERT in `classify-account-type.ts` commit or fail together for every write path (including the above-threshold success path); a failed write must not leave a status without the matching row, and must not be swallowed into a return that claims success.
- `instagram-adapter.ts` stays byte-identical to master — no timeout change (dropped, see Scope correction above).
- Moderator-resolution scrape trigger reuses `triggerScrapeForAccount` with the subscribe-time cascade's target shape and 7-day initial window; reuses (doesn't re-derive) the initial-vs-incremental decision; respects the existing scrape-in-progress check.
- A failed scrape trigger is logged, never fails or rolls back the resolution mutation.
- `subscribeToAccount`'s classify-then-scrape cascade must tolerate `classifyAccountType` throwing: log it, release the classification claim, skip the scrape, let the subscription still succeed.
- Backend tests leave no extra rows (row-count ratchet); `packages/domain` additions need 100% coverage (none planned here).
- No DB migration or schema column is added or edited by this change.

**Ask First:** none anticipated.

**Never:** repair existing bad prod rows; make the 5 abandoned NULL-status profiles non-scrapable; change the classification lookup timeout (owner-directed, async work planned separately).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Hard failure, review insert fails | Apify/Gemini error, then review INSERT throws | Profile row unchanged (no orphan AWAITING_APPROVAL) | `classifyAccountType` throws, caller sees the error |
| Low-confidence, review insert fails | confidence < 0.7, review INSERT throws | Profile row unchanged | Same as above |
| Moderator resolves ORGANIZER_VENUE_EVENT/CURATOR_GUIDE | review has no posts yet | `triggerScrapeForAccount` called once, 7-day initial window | n/a |
| Moderator resolves PERSONAL | — | No scrape triggered | n/a |
| Scrape already in progress | `scrapeTriggeredAt` within timeout window, `lastScrapedAt` older | Not re-triggered | n/a |
| Trigger throws | `triggerScrapeForAccount` rejects | Resolution still returns the resolved review | Logged, not re-thrown |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/accounts/classify-account-type.ts` -- wrap the low-confidence path, `handleHardFailure()`, and the above-threshold success-path write in `db.transaction`; add a marked error type so a persistence failure propagates instead of returning a fake status.
- `apps/backend/src/lib/scraper/decide-initial-or-incremental-scrape.ts` (new) -- `decideInitialOrIncrementalNewerThan()`, extracted from `triggerAccountScrape`. The in-progress check reuses the *existing* `computeIsScrapeInProgress` from `@festgrid/domain/scraper` (already 100%-covered, was imported but unused by the resolver) instead of a new helper.
- `apps/backend/src/schema/resolvers.ts` -- `triggerAccountScrape` now calls `computeIsScrapeInProgress` + `decideInitialOrIncrementalNewerThan` (no behavior change); `resolveAccountTypeClassificationReview` triggers the first scrape post-commit using the same two, through a test seam (`triggerFirstScrapeAfterModeratorResolutionSeam`).
- `apps/backend/src/lib/subscriptions/subscribe-to-account.ts` -- wrap only the `classifyAccountType` call in try/catch: on failure, log, release the claim, skip the scrape, let the subscription complete.
- `apps/backend/src/lib/accounts/classify-account-type.test.ts`, `apps/backend/src/schema/account-type-classification-reviews.test.ts`, `apps/backend/src/lib/subscriptions/subscribe-to-account.test.ts` -- new/updated tests per the matrix above.
- `_bmad-output/project-context.md` / Architecture Spine AD-34 -- add the new scrape entry point to the enumerated list.
- `apps/backend/src/lib/scraper/instagram-adapter.ts` -- **unchanged**, reverted to master (Part 2 dropped, see Scope correction).

## Tasks & Acceptance

**Execution:**
- [x] `classify-account-type.ts` -- atomic transaction for all three write paths + `ClassificationPersistenceFailedError` -- closes the orphan-state bug
- [x] `instagram-adapter.ts` -- **dropped**, reverted to master (owner: subscribe-time classification going async separately, shorter request-path timeout not wanted)
- [x] `decide-initial-or-incremental-scrape.ts` -- extract shared decision logic (paired with the existing `computeIsScrapeInProgress`) -- avoids duplicating it a third time
- [x] `resolvers.ts` -- `triggerAccountScrape` uses shared helpers; `resolveAccountTypeClassificationReview` triggers first scrape post-commit -- closes Part 3 gap
- [x] `subscribe-to-account.ts` -- fail-soft wrapping of the `classifyAccountType` call (log, release claim, skip scrape, let subscription succeed)
- [x] AD-34 + project-context.md "Scrape gate" bullet -- both enumerate the new entry point
- [x] Tests for all of the above per the I/O matrix (typechecked/linted/built; DB-backed run blocked, see Verification)

**Acceptance Criteria:**
- Given a review-row insert that throws, when `classifyAccountType` runs either failure path, then the profile row is byte-for-byte unchanged and no review row exists.
- Given a moderator resolves a review as ORGANIZER_VENUE_EVENT or CURATOR_GUIDE, when the mutation's transaction commits, then `triggerScrapeForAccount` is called exactly once with the correct initial/incremental decision; PERSONAL triggers zero calls.
- Given `triggerScrapeForAccount` rejects, when the mutation runs, then it still returns the resolved review (logged, not thrown).
- Given a scrape already in progress for the account, when the mutation runs, then no new trigger fires.

## Design Notes

`triggerAccountScrape`'s in-progress check now calls the existing `computeIsScrapeInProgress` (`@festgrid/domain/scraper`) instead of re-implementing it inline -- it was already imported into resolvers.ts but unused, so this closes a pre-existing drift risk, not just adds one. The initial/incremental decision moves into `decideInitialOrIncrementalNewerThan()` verbatim (same math), called from both `triggerAccountScrape` and the new moderator-resolution trigger. The resolver keeps its existing GraphQLError-throwing behavior on top; the moderator path just checks the plain boolean/decision and logs-don't-throw. `autoEnqueueNewPostForExtraction` is already keyed off the post's persisted `accountId`, not off which trigger path started the scrape, so no ingest-side change is needed -- verified, no gap.

A test seam (`triggerFirstScrapeAfterModeratorResolutionSeam` in resolvers.ts) was added so the Part 3 tests (exactly-once trigger, PERSONAL no-op, failed-trigger-doesn't-fail-mutation, already-in-progress-not-re-triggered) can assert deterministically without a real Apify/queue round trip -- the pre-existing `triggerAccountScrape` tests instead rely on the real fire-and-forget path (`SCRAPE_INLINE_FALLBACK_ENABLED=true` locally) and only assert the synchronous `scrapeTriggeredAt` stamp; the new seam is a stricter, more deterministic test for the new code only, production behavior is unchanged (defaults to the real `triggerScrapeForAccount`).

## Verification

**Commands:**
- `pnpm --filter backend exec tsc --noEmit` -- PASSED, no type errors (after building `@festgrid/domain`/`@festgrid/database`/`@festgrid/graphql-select`, which this fresh worktree hadn't built yet -- unrelated to this change)
- `pnpm lint` (unfiltered, full monorepo) -- PASSED, 0 errors (1301 pre-existing warnings, none new in touched files beyond pre-existing `any`/catch-clause patterns)
- `pnpm build` (unfiltered, full monorepo, 8 packages including `web` and `backend`) -- PASSED
- `pnpm --filter domain test` -- PASSED, 927/927 (no domain changes made; sanity check only)
- `pnpm --filter backend test` -- **BLOCKED**: local Postgres is wedged (TCP port 5432 accepts the connection but every query hangs/resets with `ECONNRESET`, confirmed three times across the session, including after this scope correction). Per the environment notes, did not attempt to restart the service or change `DATABASE_URL`. New/updated DB-backed tests (`classify-account-type.test.ts` x2, `account-type-classification-reviews.test.ts` x5, `subscribe-to-account.test.ts` x1) could not be executed in this environment and need a working local Postgres (or CI) to confirm green.

## Review Pass (post-draft)

Two independent review passes ran against the diff (Blind Hunter errored out on an account rate limit before producing findings; Edge Case Hunter completed). Edge Case Hunter findings and disposition:
1. **Real, fixed (patch):** the above-threshold CONFIRMED-path profile update in `classifyAccountType` wasn't wrapped in try/catch, so a write failure there would hit the generic catch-all and return a fake `AWAITING_APPROVAL` status -- same swallow-into-success-looking-return shape this fix targets elsewhere. Now throws `ClassificationPersistenceFailedError` like the other two paths.
2. **Real, fixed (patch):** `decideInitialOrIncrementalNewerThan`'s TOCTOU fallback (postCount>0 but the row vanishes before the second query) returned `isInitialScrape: true`, silently changing behavior from the original inline code in `triggerAccountScrape` (which left it `false` in that branch). Fixed to match the original exactly.
3. **Rejected:** a claimed staleness risk between the resolution transaction's commit and the moderator-resolution scrape trigger's re-select -- the `accountType` used for the `isScrapableAccountType` gate is the one this exact request's transaction just committed, not a stale read; no real race.

Also addressed: `subscribeToAccount`'s classify-then-scrape cascade had no fail-soft handling for `classifyAccountType` now being able to throw. Added a narrow try/catch around only that call: on failure, log it, release the classification claim, skip the scrape, and let the subscription complete (AC1) -- plus a new test (`(k)` in `subscribe-to-account.test.ts`) that forces the atomic transaction to fail via the review-insert seam and asserts the subscription still succeeds, the claim is released, and no scrape fires.

**Scope correction, post-draft:** the classification-specific lookup timeout (Part 2 as originally drafted) was dropped per explicit owner direction mid-review -- subscribe-time classification is becoming asynchronous in separate work, so a shorter request-path timeout is not wanted there. `instagram-adapter.ts` and its test file are reverted to byte-identical with master; `CLASSIFICATION_PROFILE_LOOKUP_TIMEOUT_MS` does not exist anywhere in this diff. `project-context.md`'s "Scrape gate" bullet now also enumerates the new moderator-resolution entry point (added on reconciliation, alongside AD-34). No DB migration or schema column was added or edited by this change.
