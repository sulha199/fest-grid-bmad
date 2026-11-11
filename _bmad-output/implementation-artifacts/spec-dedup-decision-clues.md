---
title: 'Record the clues behind each dedup merge or reject decision'
type: 'feature'
created: '2026-11-11'
status: 'done'
baseline_commit: '35386f5387fa3dbf3951f7c1bacfb3684b4cbc5e'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `event_match_candidates` records who resolved a suggestion (`resolved_via`, `resolved_by_moderator_id`, `resolved_at`, `status`) but not why. The apply workflow accepts `reasons[]` and drops them on purpose (`FIND-114`, narrow the apply role's reads and record the run id): the repo and Actions logs are public and reasons can carry untrusted event text. A reject is not undoable in the app, so its reason matters most.

**Approach:** Record a closed list of clue codes (public-safe) on every resolution, from the apply bridge (attended loop, daily AI accepts) and the in-app moderator screen (Story 3.6w, merge duplicate events). Free text is stored only when it arrives over an authenticated, non-public channel, and is never output anywhere.

## Boundaries & Constraints

**Always:** Clue codes are text, validated in `packages/domain` (pure, no ORM, 100% c8), never a DB enum. Mutually exclusive groups are refused together: venue (`same-venue`, `different-venue`), organizer (`same-organizer`, `different-organizer`), date (`same-date`, `date-drift`, `date-too-far`), name (`same-name-words`, `different-name-words`, `name-translation-or-abbreviation`). `other` means "no listed reason" and may combine with any. Note: optional, trimmed, at most 200 characters, `NULL` when empty. Only codes may appear in any log, issue, report, summary or Actions output. Migration is drizzle-kit generated after `git fetch origin master`, never hand-numbered; RLS is already on the table. A decision stays valid with no clue (optional everywhere). `undoEventMerge` clears both columns with `resolved_via`.

**Ask First:** (1) The loop cannot store free text: workflow inputs show on public run pages, so a typed "Other" there is told "not stored" and dropped; the note exists only in-app. Alternative (not built): encrypt to a public key committed in the repo, decrypt with an environment secret. The loop still reaches all 17 codes: the popup lists them by number and "Other" takes typed numbers, never text. (2) Make at least one clue mandatory for a reject? Default: no, measured by a runbook query instead. (3) In-app Reject becomes a dialog (today one click). (4) Mint a backlog `FIND` row for this change.

**Never:** Free text in apply decisions, the guard, summary, export or report (a `note` key in a decision refuses the whole file; `reasons` stay validated and dropped). Clues in the export or `recentlyResolved`. A change to caps, the floor, the kill switches, workflow logic, the guard script or the apply role's grants. Clue answers counting as consent (rule 7 of the skill is untouched). Starting a vendor scrape or invoking a Lambda.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reject, loop | Reject then clues `different-organizer`, `different-category-or-tier` | `rejected`, `resolution_clues` set, note `NULL` | N/A |
| Merge, in-app | 2 clues and note "kids' run, not 10K" | `accepted`, both columns set | N/A |
| AI accept | Decision `clues:["same-venue","shared-link"]` | Recorded, codes only | N/A |
| No clue | Omitted, `null` or `[]`; blank note | Both columns `NULL` | N/A |
| Bad clues | Unknown code, repeat, non-array, two codes of one exclusive group (`same-venue` + `different-venue`) | Nothing written | Domain error: apply input error (exit 7 path); GraphQL `BAD_REQUEST` |
| Bad note | 201 characters, or not a string | Nothing written | Same |
| `note` in decision | Any apply entry holding `note` | Whole file refused | Input error |
| AI accept vs evidence | AI clue `same-venue` while `venueMatch` is false (also `same-organizer`, `shared-link`, `same-date`) | Reader refuses | Exit 9 |
| Human clue vs evidence | Moderator ticks `same-venue` while `venueMatch` is false | Recorded: the moderator's own reading | N/A |
| Undo | Accepted pair undone | Pending; clues and note `NULL` | N/A |
| Already resolved | Second resolve with clues | Unchanged | Existing not-pending error |
| Typed "Other" in loop | "7, 12" | Codes 7 and 12 recorded | N/A |
| Typed text in loop | Words, or a number outside the list | Dropped, never stored; user is told which part was ignored | N/A |

</frozen-after-approval>

## Code Map

- `packages/database/schema.ts` -- `eventMatchCandidates` (~l.588): add `resolutionClues` text[] and `resolutionNote` text, both nullable.
- `apps/backend/src/lib/events/resolve-suggested-match.ts` -- the one resolve path (AD-30 Rule 9); REJECT updates the row, ACCEPT goes through `mergeEvents`, which flips status.
- `apps/backend/src/lib/events/merge-events.ts` -- step 11 flips the suggestion; step 9 of undo resets it.
- `apps/backend/src/lib/events/dedup-review-apply.ts` + `packages/domain/src/events/dedup-review-apply.ts` -- parser takes `reasons` and `action`; `decideUnderLocks` calls the resolver.
- `apps/backend/src/schema/event-merges.graphql`, `resolvers.ts` (~l.2062) -- `resolveSuggestedEventMatch(id, action)`.
- `apps/web/src/app/[locale]/moderator/tools/duplicate-events-{content.tsx,hooks.ts,.graphql}`, `packages/ui/src/core/confirm-action-dialog.tsx` (no `children` slot), `apps/web/locales/{en,id}.json`.
- `.claude/skills/moderator-dedup-review/{SKILL.md,dedup_report.py}` -- step 8, `brief`, `confirm`, `decisions`. The export has no clue field: the reader derives its clues from signals and names (`build_brief`, `name_clues`).
- `.github/workflows/dedup-review-apply.yml` -- `decisions` input description only.

## Tasks & Acceptance

**Execution:**
- [x] `packages/domain/src/events/dedup-decision-clues.ts` (+ test, `index.ts` export) -- the 17 codes (`same-venue`, `different-venue`, `same-organizer`, `different-organizer`, `same-date`, `date-drift`, `date-too-far`, `shared-link`, `same-name-words`, `different-name-words`, `name-translation-or-abbreviation`, `registration-vs-event-day`, `different-category-or-tier`, `part-of-larger-event-or-session`, `recurring-not-same-occurrence`, `not-an-event`, `other`), the exclusive groups, the note limit, `parseDedupDecisionClues`, `parseDedupDecisionNote`, a typed error -- one definition, 100% coverage
- [x] `packages/database/schema.ts` + generated migration (journal and snapshot included) -- two nullable columns -- storage
- [x] `resolve-suggested-match.ts` (+ test) -- optional `clues`, `note`; validate first; write with the reject update, and after `mergeEvents` for an accept, in the caller's transaction
- [x] `merge-events.ts` (+ test) -- undo clears both columns
- [x] Domain apply parser and backend apply (+ tests) -- optional `clues` per decision, `note` refused, clues passed for accept, reject and override; results and report unchanged
- [x] `event-merges.graphql`, `resolvers.ts`, codegen outputs (+ `event-merges.test.ts`) -- optional `clues: [String!]`, `note: String`; domain error to `BAD_REQUEST`
- [x] Web: `ConfirmActionDialog` optional `children`; one checklist dialog (17 codes in groups, the rest of an exclusive group disabled once one is ticked, 200-character note with counter) for Accept and Reject; Reject warns it cannot be undone; PostHog carries codes, never the note; `en.json` and `id.json`; test
- [x] `dedup_report.py` (+ tests) -- code list and groups pinned to the domain file by a test; `clue-options` (4 evidence-flagged options, decision-supporting first, padded from non-objective codes; the question lists all 17 by number; `clue-answer` maps the selected labels plus typed "Other" numbers to codes, keeps recognised ones, reports what it dropped); `--clues ID=code+code` on `decisions` and `confirm` (confirmation lists codes); `--ai-clues` for the daily accepts, the only path that checks `same-venue`, `same-organizer`, `shared-link` and `same-date` against signals
- [x] `SKILL.md` -- step 8 asks the clue question after each decision (multi-select, exact options, optional, typed text not stored, not consent); step 3 AI accepts name codes only, through `--ai-clues`
- [x] Ratchet test -- `resolution_note` is referenced only by the schema, the resolver, undo and the GraphQL resolver, and reaches no logger or `console`
- [x] Docs -- `7-event-dedup.md` (columns, trust rule, "rejects with no clue" and "most-used `other`" queries), `DESIGN.md` as-built, PRD 3.7 matching amendment, AD-45 one-line note, `project-context.md` dedup bullet. `architecture-diagram.md` and `high-level-overview.md` unchanged: no service, queue, Lambda, database, host or library changes

**Acceptance Criteria:**
- Given a pending suggestion, when a moderator rejects it in-app with clues and a note, then status, clues and note are stored and nothing else logs or returns the note.
- Given a decisions file, when an entry holds `clues`, then a live apply stores the codes and the report and summary are byte-for-byte the shape they had.
- Given an entry holding `note`, when apply parses it, then the whole file is refused before any database access.
- Given an undone merge, when the pair returns to pending, then clues and note are `NULL`.
- Given the loop, when the user picks Reject, then a multi-select of 4 evidence-flagged clues follows with all 17 listed by number, and no answer is consent.
- Given typed "Other" text, when the reader maps it, then only listed numbers become codes and nothing else is stored or printed.

## Spec Change Log

## Design Notes

Why codes only on the bridge: the `decisions` input is shown on the run page, so anything in it is public. Codes are a closed list and safe; free text is not, and no private channel exists from the credential-less session to the database.

Popup order for a reject puts the decision-supporting clues first (`different-*`, `date-too-far`); for a merge, `same-*` and `shared-link`. Codes with no evidence signal (`recurring-not-same-occurrence`, `name-translation-or-abbreviation`, `registration-vs-event-day`, `different-category-or-tier`, `part-of-larger-event-or-session`, `not-an-event`, `other`) are never evidence-flagged, so they reach the loop through padding or typed numbers. `other` is a signal, not a reason: how often it is used says which code to add next. A moderator's own ticks are never checked against signals (they may know two venue names are one place); the AI's are.

The narrow apply role holds a table-level `UPDATE` on the table, so the new columns need no grant.

## Verification

**Commands:**
- `pnpm --filter @festgrid/domain test` -- expected: pass, 100% coverage
- `pnpm --filter @festgrid/database generate` -- expected: one new SQL file, no hand numbering
- `pnpm --filter backend test` and `pnpm --filter web test` -- expected: pass
- `python3 -I .claude/skills/moderator-dedup-review/test_dedup_report.py` -- expected: pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: no failure on a row this change touched

## Suggested Review Order

**Design entry point: one definition of the codes**

- The 17 codes, the exclusive groups and the validators every layer shares.
  [`dedup-decision-clues.ts:37`](../../packages/domain/src/events/dedup-decision-clues.ts#L37)

- Clue validation: unknown, repeated or contradicting codes are refused, order made canonical.
  [`dedup-decision-clues.ts:57`](../../packages/domain/src/events/dedup-decision-clues.ts#L57)

- Note validation: trimmed, 200 characters, NUL refused, never echoed in an error.
  [`dedup-decision-clues.ts:78`](../../packages/domain/src/events/dedup-decision-clues.ts#L78)

**Storage and the one write path**

- Two nullable columns, plain text so a new code needs no migration.
  [`schema.ts:609`](../../packages/database/schema.ts#L609)

- The generated migration: two `ADD COLUMN`s.
  [`0101_bizarre_kronos.sql:1`](../../packages/database/migrations/0101_bizarre_kronos.sql#L1)

- Validate first, before any read or lock.
  [`resolve-suggested-match.ts:66`](../../apps/backend/src/lib/events/resolve-suggested-match.ts#L66)

- Accept writes the reason after the merge flip, always, with a status guard.
  [`resolve-suggested-match.ts:80`](../../apps/backend/src/lib/events/resolve-suggested-match.ts#L80)

- Reject writes it in the same update as the dismissal.
  [`resolve-suggested-match.ts:88`](../../apps/backend/src/lib/events/resolve-suggested-match.ts#L88)

- Undo clears both columns with `resolved_via`.
  [`merge-events.ts:368`](../../apps/backend/src/lib/events/merge-events.ts#L368)

**The public bridge: codes only**

- A decision may hold `clues`; any other key, a `note` included, refuses the file.
  [`dedup-review-apply.ts:95`](../../packages/domain/src/events/dedup-review-apply.ts#L95)

- Clues are validated at parse time and mapped to the apply input error.
  [`dedup-review-apply.ts:124`](../../packages/domain/src/events/dedup-review-apply.ts#L124)

- Apply hands the codes to the shared resolver for every action.
  [`dedup-review-apply.ts:234`](../../apps/backend/src/lib/events/dedup-review-apply.ts#L234)

- Workflow description says codes, never text; no logic changed.
  [`dedup-review-apply.yml:96`](../../.github/workflows/dedup-review-apply.yml#L96)

**In-app moderator path**

- The mutation gains optional `clues` and `note`.
  [`event-merges.graphql:63`](../../apps/backend/src/schema/event-merges.graphql#L63)

- Resolver passes both to the resolver function; bad input becomes BAD_REQUEST.
  [`resolvers.ts:2067`](../../apps/backend/src/schema/resolvers.ts#L2067)

- The note goes to the mutation only, never to analytics or a toast.
  [`duplicate-events-content.tsx:189`](../../apps/web/src/app/%5Blocale%5D/moderator/tools/duplicate-events-content.tsx#L189)

- Reject now opens the same dialog and warns it cannot be undone.
  [`duplicate-events-content.tsx:223`](../../apps/web/src/app/%5Blocale%5D/moderator/tools/duplicate-events-content.tsx#L223)

- Checklist: the rest of an exclusive group is disabled once one is ticked.
  [`resolution-clue-checklist.tsx:38`](../../apps/web/src/app/%5Blocale%5D/moderator/tools/resolution-clue-checklist.tsx#L38)

- The shared dialog gains an optional children slot.
  [`confirm-action-dialog.tsx:121`](../../packages/ui/src/core/confirm-action-dialog.tsx#L121)

**The attended loop and the daily reviewer (skill reader)**

- Picks the four evidence-flagged options, decision-supporting first, never two of one group.
  [`dedup_report.py:808`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L808)

- Reviewer's own codes may not contradict the pair's evidence.
  [`dedup_report.py:787`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L787)

- Typed Other counts only as a pure list of numbers; prose is dropped, never echoed.
  [`dedup_report.py:890`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L890)

- Maps ticks and typed numbers to the `--clues` argument.
  [`dedup_report.py:908`](../../.claude/skills/moderator-dedup-review/dedup_report.py#L908)

- Step 8 asks the clue question; it is never consent.
  [`SKILL.md:22`](../../.claude/skills/moderator-dedup-review/SKILL.md#L22)

- Step 3: the daily reviewer names codes from `clue-codes`, never free text.
  [`SKILL.md:110`](../../.claude/skills/moderator-dedup-review/SKILL.md#L110)

**Guarantees and tests**

- Ratchet: only the resolver and undo may name the note, and none prints.
  [`suggested-match-resolve-ratchet.test.ts:256`](../../apps/backend/src/lib/events/suggested-match-resolve-ratchet.test.ts#L256)

- Resolver tests: accept, reject, AI codes, stale reason, undo.
  [`resolve-suggested-match.test.ts:1`](../../apps/backend/src/lib/events/resolve-suggested-match.test.ts#L1)

- Domain tests keep the module at 100% coverage.
  [`dedup-decision-clues.test.ts:1`](../../packages/domain/src/events/dedup-decision-clues.test.ts#L1)

- Reader tests pin the code list to the domain file.
  [`test_dedup_report.py:1`](../../.claude/skills/moderator-dedup-review/test_dedup_report.py#L1)

- Screen tests: payloads, exclusive groups, note never in analytics, locale labels.
  [`duplicate-events-content.test.tsx:1`](../../apps/web/src/app/%5Blocale%5D/moderator/tools/duplicate-events-content.test.tsx#L1)

