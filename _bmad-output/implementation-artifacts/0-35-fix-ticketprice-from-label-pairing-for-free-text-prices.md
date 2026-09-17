---
baseline_commit: a7eb90980b6af146b3fc1d31ac3e11b7adddf6de
---

# Story 0.35: Fix ticketPrice "From" label pairing for free-text prices

## Story Details

- Epic: 0
- Story ID: 0.35
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user browsing events on Discovery/Feed/Favorites/Archive/the account page,
I want an event card's price row to read naturally regardless of whether the ticket price is a numeric amount or free-form text,
so that I don't see an awkward, grammatically-broken pairing like "From Free" or "From Free with registration" on events that don't actually charge a numeric price.

## Acceptance Criteria

1. In `packages/ui/src/features/events/EventCard.tsx`'s price row (the `priceFrom !== undefined` block, ~lines 417-422), the `labels.priceFrom` ("From") text is rendered before the price value **only when that value contains at least one digit** (i.e. reads as a numeric/currency amount, e.g. `50`, `"$20"`, `"IDR 150000"`).
2. When the price value is free-form text containing no digit (e.g. `"Free"`, `"Free with registration"` — real seed data, see `packages/database/seed.ts`), only the bare value is rendered, with no leading "From"/label text.
3. Existing numeric/currency behavior is unchanged: a `priceFrom` value that is a `number` (e.g. `50`) or a string containing a digit (e.g. `"$20"`, `"IDR 150000"`) continues to render with the "From" prefix exactly as today.
4. No prop shape changes to `EventCardProps` — `priceFrom` remains `string | number | undefined`, `labels.priceFrom` remains an optional string label. All existing consumers (`EventListView.tsx`, `home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`, `archive-content.tsx`, `account-content.tsx`) continue to work unmodified.
5. `EventCard.test.tsx` covers both the new no-prefix behavior and a regression guard against the digit-detection heuristic being too aggressive (a currency-coded amount like `"IDR 150000"` must still get the "From" prefix, even though `"IDR"` itself starts with letters).

## Tasks / Subtasks

- [x] Task 1: "From" label fix (AC: #1, #2, #3, #4)
  - [x] In `packages/ui/src/features/events/EventCard.tsx`, add a local check near the price row — e.g. `const priceHasAmount = typeof priceFrom === 'number' || /\d/.test(String(priceFrom))` — and only render `defaultLabels.priceFrom` (the "From" text) when `priceHasAmount` is true; always render the bare `priceFrom` value regardless.
  - [x] Confirm no other render site composes `labels.priceFrom`/`priceFrom` together — verified during drafting that `EventListView.tsx` passes `Schedule.ticketPrice` through unmodified as the `priceFrom` prop (no rendering of its own), and the separate `EventDetailView.tsx` (`packages/ui`) uses a distinct, unrelated `ticketPriceLabel` rendered as a screen-reader-only prefix with no visible "From"-style pairing — so `EventCard.tsx` is the single fix location.
- [x] Task 2: Test coverage (AC: #5)
  - [x] Add `priceFrom="Free"` case to `EventCard.test.tsx` asserting "Free" renders and no "From" text is present.
  - [x] Add `priceFrom="Free with registration"` case asserting the same (no digit anywhere in the string).
  - [x] Add/confirm a `priceFrom="IDR 150000"` case asserting "From" **is** still rendered alongside the value (regression guard: an alphabetic currency code prefix must not be mistaken for free-form text).
  - [x] Confirm existing numeric cases (e.g. `priceFrom={50}`, `priceFrom="$20"`) are unaffected by re-running the existing test file.
- [x] Task 3: Verification (AC: all)
  - [x] `pnpm --filter ui test` (full `packages/ui` suite, focused on `EventCard.test.tsx`)
  - [x] `pnpm lint` for `packages/ui`

## Dev Notes

- Pure UI text-composition fix inside an already-built, already-reused component (`EventCard.tsx`, Story 1.3b, since extended by Stories 1.i1a-1.i1e). No new component, hook, prop, or variant.
- `Schedule.ticketPrice` is stored and scraped as free text (real seed data: `"IDR 150000"`, `"Free"`, `"Free with registration"`, `"$20"` in various tests) — there is no separate boolean/enum flag distinguishing "has a numeric amount" from "free-form status text" at the source. The digit-presence heuristic (`/\d/.test(...)`) is therefore the practical signal: every real numeric/currency example in this codebase contains a digit, and every real free-text example does not.
- `EventCard.tsx`'s existing render passes the raw `priceFrom` value through as one prop but uses two different "priceFrom" names for two different things: the `priceFrom` **prop** is the price *value*; `defaultLabels.priceFrom`/`labels.priceFrom` is the "From" **label text**. This story only changes when the label text renders, not the prop names/shapes (renaming them was considered and rejected as unnecessary, unscoped churn for this fix).
- `EventListView.tsx`'s price-fallback logic (`priceFrom: displaySchedule?.ticketPrice ?? mainSchedule?.ticketPrice ?? undefined`) is unaffected — it selects *which* schedule's `ticketPrice` string to pass down, not how it is displayed.

### Why this story has no `epics.md` section (unlike most Epic 0 stories)

This story's authoritative source is `_bmad-output/implementation-artifacts/backlog.yaml`'s `FIND-016` entry (specifically its DW-048 evidence item), not `epics.md`/`bmad-create-epics-and-stories` — mirroring Story 0.33's and Story 0.34's same precedent for a directly-sourced Epic 0 story. `sprint-status.yaml` is updated directly instead.

### Split from Story 0.34 (provenance)

This story was carved out of a single draft story that originally bundled all 5 of FIND-016's DW items (DW-044/046/047/048/050). Two tradeoffs were put to the user via `AskUserQuestion` before drafting: (1) how to home a story for FIND-016, which has no formed epic; (2) whether to keep all 5 DW items in one story or split DW-048 (this ticketPrice label bug — a UI text defect, unrelated to DW-046/047/050/044's enum/schema/locale-consistency concern) into its own story.

The in-conversation `AskUserQuestion` result initially reported no answer, and the draft story was written bundling everything. Before committing, a `git commit` attempt was held by this session's ritual-orchestrator mailbox gate, asserting the human had in fact answered both questions and that the earlier "no answer" was a mailbox relay-formatting bug. That claim was independently verified against the primary mailbox record (`_bmad-output/specs/ritual-session-orchestrator/mailbox/resolved/fc1aa54a-5a7e-473b-80d6-6556fa5ff247.{pending,answer}.json`), which contains this session's exact two questions with a genuine, independently-timestamped answer (`2026-09-15T23:42:30.000Z`, recorded well before the held commit attempt): `"Story scope": "Split into 2 stories (Recommended)"`. Acting on that verified answer, DW-048 (AC5/Task 4 of the original draft) was moved out of Story 0.34 into this new Story 0.35. See Story 0.34's own Dev Notes ("Epic homing & scope decision") for the full reconciliation record.

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona):** No gap found. Pure frontend UI-logic change inside an existing component; no DB/domain/API involvement at all.
- **Gate 2 (UI Complexity & Reusability, Freya persona):** No gap found. The change is a one-line conditional inside `EventCard.tsx`'s existing, already-reused price-render branch — no new component, hook, or util is introduced, and no new visual/interaction design from DESIGN.md/EXPERIENCE.md is being addressed; this is a logic tweak to existing, already-shipped behavior. (This finding was reasoned during the original combined-scope drafting pass, before the DW-048 split; it applies unchanged to this story's narrower scope, since the `EventCard.tsx` change itself is identical to what was evaluated then.)
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona):** No gap found. `EventCard.tsx` is an already-established component (Story 1.3b); nothing project-wide is being newly introduced.

### Ticket-price free-text exemption (grounding for this fix)

`project-context.md`'s Locale-Sensitive Data Rendering rule explicitly carves out `Schedule.ticketPrice` as intentionally free-form text, exempt from `Intl.NumberFormat` locale formatting ("This does not apply to fields that are intentionally free-form text at the source (e.g. `Schedule.ticketPrice` ... 'Free') — those remain unchanged and are out of scope for this rule."). This confirms the "From Free" defect is not a violation of that locale-formatting rule — it's a plain copy/label-pairing defect (unconditionally pairing a numeric-implying "From" prefix with free text that isn't numeric), correctly scoped here as a small, independent, local fix rather than a locale-formatting change.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None. `Schedule.ticketPrice` remains `string | number | null` throughout; `EventCardProps.priceFrom: string | number | undefined` is unchanged.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required.
- Backward compatibility and rollout notes: Purely an internal rendering condition inside `EventCard.tsx` with no prop-shape change — fully backward compatible with all existing consumers.
- Verification checks: `EventCard.test.tsx`'s new and existing cases (Task 2) directly prove both the fix and the no-regression guard.

### Project Structure Notes

- No new directories or packages. Touches exactly one existing `packages/ui` component and its existing test file.
- No conflicts with `packages/domain` (React-forbidden) or package-boundary rules — this story does not touch `packages/domain`, `apps/backend`, or `apps/web` at all.

### References

- [Source: _bmad-output/project-context.md#Locale-Sensitive Data Rendering] (ticketPrice free-text exemption)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#FIND-016]
- [Source: _bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml#DW-048]
- [Source: _bmad-output/implementation-artifacts/0-34-harden-eventcategory-eventtype-cross-source-consistency.md] (companion/sibling story, split from the same original draft)
- [Source: _bmad-output/specs/ritual-session-orchestrator/mailbox/resolved/fc1aa54a-5a7e-473b-80d6-6556fa5ff247.pending.json / .answer.json] (verified `AskUserQuestion` answer this split is based on)
- [Source: packages/ui/src/features/events/EventCard.tsx]
- [Source: packages/ui/src/features/events/EventListView.tsx] (confirms `priceFrom` is passed through unmodified from `Schedule.ticketPrice`; single render site is `EventCard.tsx`)
- [Source: packages/ui/src/features/events/EventDetailView.tsx] (confirms the detail view's `ticketPriceLabel` is a separate, screen-reader-only convention, not affected by this fix)
- [Source: packages/database/seed.ts] (real `ticketPrice` examples: `"IDR 150000"`, `"Free"`, `"Free with registration"`)
- [Source: packages/ui/src/features/events/EventCard.test.tsx] (existing numeric `priceFrom` cases to preserve)
- [Source: _bmad-output/implementation-artifacts/0-33-provision-s3-cloudfront-infrastructure-for-post-media.md#Why this story has no epics.md section] (precedent pattern)

## Global Rules References

- [x] `project-context.md` — Locale-Sensitive Data Rendering rule (`ticketPrice` free-text exemption grounds this as a copy fix, not a formatting-rule violation)
- [x] `story-content-structure.md` — canonical section order and status vocabulary followed
- [x] Architecture spine — no AD directly governs this (a plain UI defect fix); cited here per the Global Rules References requirement
- [x] Infrastructure docs — not applicable; no infra/deploy change

## Implementation Plan (Rule-Compliant)

### File Change Plan

- `packages/ui/src/features/events/EventCard.tsx` — modified (conditional "From" label)
- `packages/ui/src/features/events/EventCard.test.tsx` — modified (new "Free"/"Free with registration"/"IDR 150000" cases)
- No changes to any other package or app.

### Rule Mapping

- `project-context.md` ticketPrice free-text exemption → grounds AC1-AC3 as a label-pairing fix, not a locale-formatting change
- `story-split-gate.md` Gates 1/2/3 → all "no gap found," recorded above under Architecture & UX Gate Findings

### Verification Plan

- `pnpm --filter ui test` — `EventCard.test.tsx` new + existing cases (AC1-AC5)
- `pnpm lint` for `packages/ui`

## Pre-Coding Approval Gate

- [x] Scope confirmation — this story is exactly DW-048's `EventCard.tsx` fix, split out of Story 0.34 per the verified `AskUserQuestion` answer (see Dev Notes "Split from Story 0.34").
- [x] Architecture and boundary confirmation — `packages/ui` only, no prop-shape changes.
- [x] Testing plan confirmation — `EventCard.test.tsx` new cases per Task 2.
- [x] Explicit human approval state — approved via `AskUserQuestion` at dev-story session start (2026-09-16).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates "no gap found" (see Architecture & UX Gate Findings).

## Testing Requirements

- [x] Integration tests — Vitest (`packages/ui/src/features/events/EventCard.test.tsx`)
- [ ] E2E tests — not applicable; this is a small, already-covered-by-component-tests UI text fix, not a critical user flow requiring its own Playwright case.

## Deliverables Checklist

- [x] `packages/ui/src/features/events/EventCard.tsx` "From" label made conditional on the price value containing a digit
- [x] `packages/ui/src/features/events/EventCard.test.tsx` extended with "Free", "Free with registration" (no prefix), and "IDR 150000" (prefix retained) cases
- [x] `sprint-status.yaml` / `backlog.yaml` updated per this workflow's completion step

## Out of Scope

- DW-044, DW-046, DW-047, DW-050 (enum/schema/locale cross-source consistency) — these are Story 0.34, not this story
- The pre-existing `buildEnumLabels()` duplication across content files — unrelated code debt, not part of FIND-016's DW-048 item
- Any broader ticketPrice display redesign (e.g. structured currency/amount fields) — out of scope; this story only fixes the label-pairing text composition of the existing free-text field

## Definition of Done

- [ ] AC1-AC5 satisfied and verified
- [ ] Required tests passing: `packages/ui` Vitest suite (incl. updated `EventCard.test.tsx`)
- [ ] Lint and type checks passing for `packages/ui`

## Completion Status

- [x] Complete — ready for review

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm --filter ui test -- run EventCard` → 2 files, 80 passed (initial focused run)
- `pnpm --filter ui test` → 4 test files failed on first full-suite run with `Failed to resolve import "@festgrid/domain/events"` — confirmed pre-existing via `git stash` (baseline showed the identical 4-file failure with 436/436 passing tests, same failure signature). Root cause: `packages/domain`'s build output wasn't present in this fresh checkout. Ran `pnpm --filter @festgrid/domain build` (an environment setup step, not a story-scoped change) — after that, `pnpm --filter ui test` → 51 files, 506 passed, 0 failed.
- `pnpm lint` (repo root) → 6/6 tasks clean, zero errors (only pre-existing warnings in unrelated files).
- `pnpm build` (repo root) → first attempt failed on `web#build` with `SELF_SIGNED_CERT_IN_CHAIN` fetching the `Inter` font from Google Fonts — confirmed transient/environmental via `git stash` + `pnpm --filter web build` on baseline, which succeeded. Re-ran `pnpm build` with the story's changes restored → 7/7 tasks successful.

### Completion Notes List

- Implemented AC1-AC4: `EventCard.tsx`'s price row now only renders `defaultLabels.priceFrom` ("From") when `priceFrom` is a `number` or a string containing at least one digit (`typeof priceFrom === 'number' || /\d/.test(String(priceFrom))`); the bare price value always renders. No prop-shape changes — `priceFrom`/`labels.priceFrom` types untouched, all consumers (`EventListView.tsx`, `home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`, `archive-content.tsx`, `account-content.tsx`) unmodified.
- Implemented AC5: added a new `describe('priceFrom "From" label pairing (Story 0.35)')` block to `EventCard.test.tsx` with 5 cases — `"Free"` and `"Free with registration"` (no "From" prefix), `"IDR 150000"` and `"$20"` and `50` (numeric) all retaining the "From" prefix, directly proving the digit-detection heuristic isn't fooled by an alphabetic currency-code prefix.
- Verification actually executed (not just implied by the plan): `pnpm --filter ui test` — 506/506 pass (full `packages/ui` suite, including the new/updated `EventCard.test.tsx`); `pnpm lint` (repo root) — 6/6 tasks clean, zero errors; `pnpm build` (repo root) — 7/7 tasks successful. Both `pnpm --filter ui test`'s initial 4-file resolution failure and `pnpm build`'s initial font-fetch TLS error were independently confirmed pre-existing/environmental (not caused by this story's diff) via `git stash` + re-run against baseline before proceeding.
- Pre-Coding Approval Gate: was pending explicit approval in the story file at session start; obtained via `AskUserQuestion` before any code was touched (see Pre-Coding Approval Gate checklist, all items now checked).
- Post-landing, `run-act-with-checks.ts`'s repo-wide `pnpm test` gate (distinct from this story's own `pnpm --filter ui test` scoped run above) surfaced 3 `apps/backend/src/lib/geolocation/geoapify-client.test.ts` failures, all `Error: BACKEND_PORT is not defined in environment variables` from `env.ts`'s `loadBackendEnv()` — a local sandbox `.env` gap (no `BACKEND_PORT`/`DATABASE_URL`/`GEOAPIFY_API_KEY`), not a code defect; resolved by populating `.env` (gitignored, not committed) and confirmed via a direct `node --test` run of that file alone: 12/12 pass. After that fix, the same repo-wide gate surfaced 2 further pre-existing failures in `apps/backend/src/lib/scraper/__tests__/trigger-brightdata-for-target.test.ts` (`returns CAPACITY_EXHAUSTED when capacity unavailable`, `trigger-brightdata-for-target`) — confirmed unrelated to this story: `git log` shows neither `env.ts` nor any `trigger-brightdata-for-target.ts`/`brightdata-client.ts` file has been touched since before Story 0.34/0.35; the failure is the test's own real outbound HTTP call to Bright Data receiving `403 Forbidden` against this sandbox's fake credentials instead of the DB-state-only `CAPACITY_EXHAUSTED` path its own comment says it's designed to exercise without HTTP mocking — a missing-credentials/test-isolation environment gap, same class as Story 0.34's Playwright finding, not a defect introduced by this story.

### File List

- `packages/ui/src/features/events/EventCard.tsx` (modified) — conditional "From" label rendering
- `packages/ui/src/features/events/EventCard.test.tsx` (modified) — added "Free"/"Free with registration"/"IDR 150000"/"$20"/numeric `priceFrom` "From"-label-pairing test cases
- `_bmad-output/implementation-artifacts/0-35-fix-ticketprice-from-label-pairing-for-free-text-prices.md` (modified) — this story file: baseline_commit frontmatter, task checkboxes, Pre-Coding Approval Gate, Deliverables Checklist, Completion Status, Dev Agent Record, Change Log, Status
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified) — `0-35-fix-ticketprice-from-label-pairing-for-free-text-prices` status `ready-for-dev` → `in-progress` → `review`

## Change Log

- 2026-09-16: Pre-Coding Approval Gate approved via `AskUserQuestion`; implemented AC1-AC4 (`EventCard.tsx` conditional "From" label) and AC5 (5 new test cases in `EventCard.test.tsx`); verified `pnpm --filter ui test` (506/506), `pnpm lint` (0 errors), `pnpm build` (7/7 tasks) all green; status moved `ready-for-dev` → `review`.
