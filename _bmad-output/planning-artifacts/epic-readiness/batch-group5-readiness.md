---
batch: group5-ready-for-dev
swept: true
date: 2026-10-08
scope: batch-scoped (not per-epic) — five ready-for-dev stories re-verified against master ffeced6
gates: [1, 3]
stories_covered: [3.17, 3.19, 1.6g, 4.9, 4.10]
new_prerequisite_stories: []
new_backlog_rows: [FIND-080, FIND-081, IDEA-064]
---

# Batch Readiness — Group 5 (3.17, 3.19, 1.6g, 4.9, 4.10)

Gate 1 and Gate 3 run once over the batch against current master (AD-32 vendor wrapper, AD-33 z-tiers and
masonry Phase 2 landed). Gate 2 only where a story adds UI (1.6g, 4.9, 4.10 — each already ran it; re-checked
for drift only). Every citation below was checked against source. No application code was touched.

**Headline:** no new stories. Two ACs changed with your approval (4.9 AC15 added, 4.10 clear semantics).
**4.9 is blocked on FIND-080.** 3.17, 3.19 and 1.6g are ready (3.17/1.6g with reference corrections).

## Per-story verdicts

| Story | Gate 1 | Gate 3 | Verdict |
|---|---|---|---|
| 3.17 | No gap | No gap | **READY** (line refs corrected) |
| 3.19 | No gap | No gap | **READY** |
| 1.6g | No gap | No gap | **READY** (missing backend codegen step recorded) |
| 4.9 | **Gap: Set path needs a backend change** (AC15 added) | **Gap: ConfirmActionDialog defect** (FIND-080) | **BLOCKED on FIND-080** |
| 4.10 | No gap (all `ProposedEventCorrection` consumers enumerated) | No gap | **READY-WITH-CORRECTION** (applied) |

## Findings by brief item

**a. 4.10 Gates 1 and 3 (previously reasoned away).** Run properly. Everything stays behind `submitCorrection`; no
migration (`events.links` exists since 0058); `isAllowedHttpUrl`/`sanitizeEventLinks` are exported through the
`@festgrid/domain/events` barrel (`export *`); `build-correction-classification-text.ts` (3.6k kids' filter) does not
classify link labels on either the AI or correction path, so no change. Two real consequences, resolved by you:
(1) omitting `links` meant "clear", so a stale web tab would wipe AI-extracted links on any correction; (2)
`getProtectedFields` (`set-event-primary-post.ts`) only protects a column when the key is in an applied correction, so
a user's clear could be undone by enrichment. **New rule (AC5/AC9/AC10): omitted = unchanged, `[]` = clear, array =
replace.** Informational: `events.links` feeds the dedup scorer's `sharedLink` weight (0.20, cannot reach the 0.75
"high" tier alone). 4.10's Out of Scope claim that "nothing renders `event.links`" was stale
(`EventDetailView.tsx:477`) and is corrected. 4.10 does **not** use `ConfirmActionDialog` (see c).

**b. 3.19 vs 1.6g on `EventDetailWrapper.tsx`.** Disjoint regions: 3.19 edits the import line and the mutation hooks
(333-390); 1.6g edits `mappedProps` (~775-780). Test files also disjoint. No shared type or GraphQL dependency
(3.19 needs no codegen; 1.6g regenerates `generated/graphql.ts` and `resolvers-types.ts`). **Order: 3.19 first, then
1.6g**, re-running both codegens after rebase. Merge-conflict risk: low (adjacent-line only). Neither conflicts with
Wave A's 1.6c/0.38 (already landed, `review`).

**c. `ConfirmActionDialog` (0.47) vs 4.9/4.10.**
- 4.10 does not use it. Only 4.9 does.
- API matches 4.9's assumptions (`open/title/description/confirmLabel/cancelLabel/confirmVariant/onConfirm/onCancel`).
- **But the primitive has a defect, so a primitive change IS needed (FIND-080).** `isConfirming` is set on confirm and
  reset only when `onConfirm` rejects. Reproduced with a scratch Vitest run (kept outside the repo): after a
  successful confirm the reopened dialog has Confirm disabled; a consumer that toasts and does not rethrow (exactly
  4.9 AC12, and `duplicate-events-content.tsx` today) leaves Cancel disabled and Escape blocked. The primitive's own
  test only covers a rejecting `onConfirm`. This is live in the existing Duplicate Events tab.
- FIND-081: the primitive's Overlay/Content have no AD-33 tier class at all (AD-33 Rule 3 listed four Radix wrappers
  and missed this one); the ratchet forbids raw values but cannot detect an absent tier.

**d. 3.17 references.** All re-found on master and corrected in the story: `castVote` 2152-2229 (call point ~2205,
existing-vote lookup 2207, reactivate branch ~2212-2220); `rankedVoteAccounts` 2804-2891 (loop guard line 2879);
`votedAccountSuggestions` 2941-2998 (`innerJoin` 2971); `queryModeratorAccountProfiles` 4224;
`subscribe-to-account.ts` block 164-178 (comment from 157). `subscribe-to-account.test.ts` cases (i)/(j) exist. The
helper path `apps/backend/src/lib/accounts/` is correct and has no name clash. No `0.i2*` change touches this code
(0.i2 edits `createApiKey`/the Gemini verify path; pending 0.i2d changes scraper adapters, not `castVote`'s
`lookupAccountProfile` call). The story also claimed "latest migration 0075"; master is 0076.

**e. 3.17 accepted gap.** Confirmed stated as a user-confirmed decision in Dev Notes, Data Type section and Out of
Scope. Not reopened. IDEA-064 only *tracks* it (see below).

**f. Prerequisites and migrations.** None of the five needs a migration; next free number remains **0077**. The only
new prerequisite is FIND-080 for 4.9; 4.9 gains a backend change (AC15) but no migration.

## Other verified drift (no AC change)
- 4.9 and 4.10 listed `apps/web/src/gql/graphql.ts` as a codegen output; it is a one-line re-export. Corrected.
- 1.6g omitted `pnpm --filter backend codegen` (committed `resolvers-types.ts` changes when `events.graphql` does). Added.
- 1.6g line numbers shifted +1 to +20; corrected. 3.19's line citations were still accurate.
- 4.9 `hasPendingDefaultLocationReview` is a per-row resolver (20 small queries per moderator page). Acceptable; noted.

## Recommended order
1. **FIND-080 (+FIND-081)** — small primitive fix; unblocks 4.9. Independent of everything else.
2. **3.17** — backend only; touches `resolvers.ts` regions that no other story in this batch edits.
3. **3.19** — frontend instrumentation only.
4. **1.6g** — after 3.19 (rebase, re-run both codegens).
5. **4.10** — touches `packages/domain`, `resolvers.ts` (`submitCorrection` region, far from 3.17), `corrections.graphql`.
6. **4.9** — after FIND-080; edits `resolvers.ts` (`setAccountDefaultLocation`, new mutation) and `social-media-accounts.graphql`.
Orders 2-6 can run in parallel except 3.19 → 1.6g; the only shared generated files are `resolvers-types.ts` and
`generated/graphql.ts` — never hand-merge, re-run codegen after each rebase. Shared locale files (`en.json`,
`id.json`) are touched by 1.6g, 4.9, 4.10 in different namespaces.

## Files corrected
- `_bmad-output/implementation-artifacts/3-17-demand-gated-discovery-for-scrape-discovered-profiles.md` (line refs, migration note, sweep note)
- `_bmad-output/implementation-artifacts/3-19-sanitized-subscription-toggle-analytics.md` (sweep note: stale comment, ordering)
- `_bmad-output/implementation-artifacts/1-6g-event-detail-hashtags.md` (line refs, backend codegen, file plan, sweep note)
- `_bmad-output/implementation-artifacts/4-9-moderator-accounts-tab-location-info-and-edit-clear-actions.md` (AC4 corrected, **AC15 added**, Task 1.4, test cases, gql note, FIND-080 blocker)
- `_bmad-output/implementation-artifacts/4-10-add-manual-link-editing-to-the-correct-data-dialog.md` (**AC5/AC9/AC10 three-state links**, tests, migration note, stale Out of Scope, gql note, Gate 1/3 note)
- `_bmad-output/implementation-artifacts/backlog.yaml` (three new rows)

## New backlog rows (IDs verified free on origin/master and every origin/claude/* branch)
| ID | Summary | Blocks |
|---|---|---|
| FIND-080 | `ConfirmActionDialog` never resets `isConfirming` after success / consumer-handled failure | IDEA-034 (Story 4.9) |
| FIND-081 | `ConfirmActionDialog` has no AD-33 z-tier; ratchet can't catch absence | — (fix together with FIND-080) |
| IDEA-064 | Backfill for 3.17's deferred pre-existing-vote gap (tracking only) | — |
No story numbers, `IDEA-065/066`, `FIND-082..084` or `CC-032` were used.

## Decisions taken with the user in this sweep
- 4.9 Set path: extend `setAccountDefaultLocation` with an AD-11 `asModeratorCorrection` path (AC15).
- 4.10: explicit `links: []` clears; omitted leaves unchanged.
