---
baseline_commit: 030c2333ab5268d50c7890792e2db9f7b97124a8
---

# Story 0.52: Build the EventCategory definitions source, renderer, and ratchet

## Story Details

- Epic: 0
- Story ID: 0.52
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer maintaining FestGrid's AI event-extraction pipeline,
I want one definitions source for `EventCategory` that both Gemini-facing prompts render from, a ratchet that fails if a prompt ever drifts from it, and code-level cardinality enforcement on the categories Gemini returns,
so that the extraction prompt and the AI-filter prompt use the same vocabulary for the 18 existing categories, a future taxonomy change can't silently add a second prose definition, and an event is never stored with more categories than the taxonomy allows.

## Acceptance Criteria

1. `packages/shared-types/src/event-category-definitions.ts` exports `EVENT_CATEGORY_DEFINITIONS: Readonly<Record<EventCategory, { definition: string; aliases: readonly string[] }>>` and `CATEGORY_BOUNDARIES` (an array of boundary rules; shape `{ id: string; rule: string }` at minimum, per AD-44 Rule 4) covering **all 18 existing `EventCategory` members and no others** — `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT` are not added by this story (that is Story 0.53). Each definition is 1-2 sentences, non-empty, at most 280 characters, single-line, and carries at least one Indonesian alias. [AD-44 Rule 3]
2. `apps/backend/src/lib/ai-gateway/render-event-category-glossary.ts` exports `renderEventCategoryGlossary(): string`, a pure, deterministic function (no dates, no randomness, stable across calls, declaration order) that renders one `NAME -- definition (also: alias1, alias2, ...)` line per category followed by the boundary-rule lines from `CATEGORY_BOUNDARIES`. [AD-44 Rule 4]
3. `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (the extraction prompt, item 3 of its per-event instructions) and `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts` (the `categories` leaf-field line of its system instruction) both call `renderEventCategoryGlossary()` and embed its output verbatim; neither file lists bare category names anywhere else in its prose. The structured-output `enum:` lists in both files (and in `extracted-event.schema.ts`/`proposed-event-correction.schema.ts`) remain `Object.values(EventCategory)`, untouched. [AD-44 Rule 4, feasibility review §3]
4. A new ratchet test (`apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts`) fails if: (a) any `EventCategory` member lacks a non-empty, ≤280-char, single-line definition, lacks at least one alias, or the record has extra/missing keys; (b) a definition or boundary rule names an underscored ALL_CAPS token that is not a real `EventCategory` or `EventType` member (this is the check that would catch Story 0.53 content accidentally landing here, or a typo); (c) either built prompt, as actually constructed by its builder function, does not contain `renderEventCategoryGlossary()`'s output verbatim exactly once; (d) outside that verbatim block, either built prompt names three or more distinct `EventCategory` values. The test includes negative controls proving (a)-(d) actually fire on a synthetic violation, not just that they pass today. [AD-44 Rule 4, feasibility review §4]
5. `packages/domain/src/events/transform-gemini-response-to-event-info.ts` enforces, after its existing valid-category filter: categories are capped at 4 (keep the first 4 in model/array order); if more than one category remains and `OTHER` is among them, `OTHER` is dropped (never co-occurs with another category); the existing empty-list-falls-back-to-`[OTHER]` behavior is unchanged. [AD-44 Rule 2]
6. `apps/backend/src/lib/ai-processor/process-ai-job.ts` logs one structured, greppable line per extracted event (via `console.info`, matching the existing `logFaceBlurThumbnailOutcome` convention — not `console.log`/`console.warn`, which other tests assert exact counts of) when the raw (pre-transform) category list for that event was empty (`outcome=empty_list_fallback_to_other`) and a second distinguishable line when the raw list was exactly `['OTHER']` (`outcome=deliberate_other`). No new persisted column or schema change. [AD-44 Rule 10]
7. A new golden category corpus — the 12 Indonesian-language posts derived in Dev Notes below (sourced from `reviews/review-adversarial-pair.md` §2) — is committed as fixtures (`apps/backend/src/lib/ai-processor/event-category-golden-corpus.fixtures.ts`), each with `expected` and `mustNotInclude` category arrays evaluated against the **18-value interim taxonomy** this story ships (not the 20-value taxonomy Story 0.53 will add). A companion opt-in test (`event-category-golden-corpus.live-eval.test.ts`), gated by `RUN_LIVE_GEMINI_TESTS=true` + a real API key exactly like the existing `build-gemini-request.live-cc024-regression.test.ts` precedent, runs each fixture's caption through the real extraction prompt against live Gemini and asserts the result. Excluded from CI and from default `pnpm --filter backend test` (never a CI gate, per AD-44 Rule 10). [AD-44 Rule 10]
8. The four duplicate per-value prose comment blocks in `packages/shared-types/src/index.ts`, `apps/backend/src/schema/events.graphql`, `packages/database/schema.ts`, and the PRD's `EventCategory` block (`prd.md:358-377`) are each replaced with a single pointer comment to `EVENT_CATEGORY_DEFINITIONS` — they are reviewed by hand, not machine-checked. [AD-44 Rule 4, Rule 6]
9. `_bmad-output/project-context.md`'s existing "Event categories" note is updated to state that the definitions constant, renderer, and ratchet now exist for the 18-value set, while `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT` remain not-yet-built (plan only) pending Story 0.53.
10. `git diff --stat` for this story's branch shows **no** change to: `EventCategory` enum membership (`packages/shared-types/src/index.ts`), the `events.graphql` `EventCategory` enum body, `apps/web/locales/en.json`/`id.json`, `packages/database/schema.ts`'s `eventCategoryEnum` array, any file under `packages/database/migrations/`, any file under `generated/`, or `packages/database/seed.ts`/`seed-volume.ts`. This story is independently revertible without touching any of those. [feasibility review §8, S1 AC1]
11. This story does not need any `docs/infrastructure/*.md` or `architecture-diagram.md` update (CLAUDE.md §4 is not triggered: no service, queue, Lambda, scraper, database, hosting provider or major library is added, removed or replaced) — state this explicitly in the completion notes rather than silently skipping it.

## Tasks / Subtasks

- [x] Task 1: Definitions source (AC: #1)
  - [x] Create `packages/shared-types/src/event-category-definitions.ts`. Import `EventCategory`/`EventType` from `./index.js` (or define alongside the enum in `index.ts` directly if that avoids an import cycle — AD-44's "beside the enum" wording permits either; prefer the separate file since AD-44 Rule 3's "Binds" clause names it explicitly as `event-category-definitions.ts`). Re-export from `src/index.ts`.
  - [x] Write a definition + ≥1 Indonesian alias for all 18 existing members. The following four need **specific, mandatory content** drawn from AD-44 Rule 5's boundary table (do not improvise different semantics for these):
    - `TECHNOLOGY`: keeps its EXISTING definition unchanged (tech product promos, hackathons, tech meetups/conferences) -- do NOT widen it to consumer gadgets. (Owner reversed the widening on 2026-10-23: consumer gadgets get their own `GADGETS_AND_DEVICES` category in Story 0.53, which will narrow `TECHNOLOGY` then. AD-44 Follow-up 1.)
    - `BUSINESS_AND_NETWORKING`: defined by subject matter only (trade, B2B, networking, entrepreneurship, property and investment) — **never** by the audience's identity (AD-44 Rule 1). State that property/real-estate/KPR-mortgage expos or seminars route here regardless of audience (named routing wins over the subject-of-sale default), and that machinery for factories/production lines also routes here. State explicitly that "UMKM", "support local", or a seller workshop **alone** do not trigger this category — a stated trade/buyer/B2B/franchise/supplier/business-matching purpose is required. (This narrows today's effective scope versus the current "Fundraisers..." era wording — the accepted "BUSINESS_AND_NETWORKING narrows" interim effect.)
    - `HOBBIES_AND_INTERESTS`: includes esports and gaming tournaments (owner-directed default; AUTOMOTIVE/SPORTS_AND_FITNESS alternates were considered and declined) and plant collecting/contests/breeding/gardening (tag the headline subject only when a plant fair mixes hobby and other framing).
    - `AUTOMOTIVE`: unchanged — car and motorcycle fairs/exhibitions, plus car/motorcycle accessories and tools.
    - `OTHER`: "no single subject" or "no valid value" — use AD-44 Rule 2's own phrasing; do not describe it as a catch-all users would filter on.
  - [x] For the remaining 13 (`MUSIC`, `ARTS_AND_CULTURE`, `FOOD_AND_DRINK`, `SPORTS_AND_FITNESS`, `FAMILY_AND_KIDS`, `HEALTH_AND_WELLNESS`, `HOLIDAY`, `CHARITY_AND_CAUSES`, `CIVIC_AND_COMMUNITY`, `RELIGION_AND_SPIRITUALITY`, `TRAVEL_AND_TOURISM`, `EDUCATION`, `CAREER`), write a definition following AD-44 Rule 1 (subject domain, not form, not audience) and Rule 3's style constraints. `CHARITY_AND_CAUSES`, `CIVIC_AND_COMMUNITY`, `RELIGION_AND_SPIRITUALITY`, `TRAVEL_AND_TOURISM`, `EDUCATION`, `CAREER` already have a one-line inline comment in `index.ts`/`events.graphql` today (being replaced per Task 8) that can seed the definition; `MUSIC`, `ARTS_AND_CULTURE`, `FOOD_AND_DRINK`, `SPORTS_AND_FITNESS`, `FAMILY_AND_KIDS`, `HEALTH_AND_WELLNESS`, `HOLIDAY` have none today and need a fresh definition. Two specific boundary exceptions belong on these: `ARTS_AND_CULTURE` must cover batik/tenun/wastra heritage events; `HEALTH_AND_WELLNESS` must cover clinical aesthetic/medical treatment (botox, laser, dermatology); `SPORTS_AND_FITNESS` must state that a participatory sport event (fun run, tournament) keeps this category even when branded gear or apparel is also launched at it.
  - [x] **Do not** name `HOME_AND_LIVING` or `FASHION_AND_BEAUTY` anywhere in this file (not in a definition, not in a boundary rule, not in a comment) — Task 4's ratchet Check (b) enforces this, and it is the concrete difference between this story and Story 0.53. Concretely, this means the following AD-44 Rule 5 boundary lines are **not** written in this story (they are Story 0.53's job): furniture/appliances/décor/interior/housewares/home-improvement/consumer-or-tradespeople tools; decorative planting sold as home décor; fashion/sneakers/barbershop/grooming/skincare/cosmetics; the heritage-apparel-runway add-on to `ARTS_AND_CULTURE`. Their absence is why a furniture bazaar or a barbershop promo correctly falls through to `OTHER` under this story (see Task 6's golden corpus derivation) — that gap is AD-44 Follow-up 1's accepted interim effect, not a bug to work around.
  - [x] Add a header comment marking the file as LLM-facing English text, never to be rendered in any UI (project-context.md requires every user-facing enum string to go through `next-intl`; this file is not that).

- [x] Task 2: Renderer (AC: #2)
  - [x] Create `apps/backend/src/lib/ai-gateway/render-event-category-glossary.ts` exporting `renderEventCategoryGlossary(): string`. Format: one line per category in `Object.values(EventCategory)` declaration order, `  - NAME -- definition (also: alias1, alias2, ...)`, using ASCII ` -- ` (not U+2014 em dash) to match this codebase's existing prompt-prose dash convention (`build-gemini-request.ts`'s "-- the most common real-world case"). Followed by one line per `CATEGORY_BOUNDARIES` entry.
  - [x] Add a colocated `render-event-category-glossary.test.ts`: asserts declaration order, exactly one line per category, the exact separator, and that two calls return byte-identical output (determinism).

- [x] Task 3: Wire both prompts to the renderer (AC: #3)
  - [x] `build-gemini-request.ts`: replace line 199's `allowedCategories = Object.values(EventCategory).join(', ')` + the item-3 interpolation at line 223 with a call to `renderEventCategoryGlossary()`, placed in the system-instruction template **before** the `${publishDate}` interpolation (which sits later in the template) so any provider-side prefix caching still sees a stable prompt prefix. Update the item-3 wording from "select appropriate values from this allowed list" to something like "select every value that fits, using only the values below, each given as `NAME -- definition`:" followed by the rendered block. Leave line 27's `enum: Object.values(EventCategory)` untouched.
  - [x] `build-filter-extraction-request.ts`: replace line 19's inline `${Object.values(EventCategory).join(', ')}` with a call to `renderEventCategoryGlossary()`. Leave line 82's `enum: Object.values(EventCategory)` (and its 3-level unrolled repeats) untouched.
  - [x] Record in Dev Agent Record / Completion Notes: each prompt's system-instruction character length before and after this change (expect roughly +2.4 KB to +4.4 KB combined across both categories+boundaries text, per the feasibility review's estimate — actual depends on final definition lengths).

- [x] Task 4: Ratchet test (AC: #4)
  - [x] Create `apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts`, `node:test` + `node:assert`, matching this codebase's existing ratchet style (`no-vendor-call-bypasses-wrapper.ratchet.test.ts`, `filter-consumer-no-bypass.ratchet.test.ts`): offender-list assertion + a positive confirmation the scan isn't vacuous + negative controls on every regex/check.
  - [x] Check A (exhaustive/bounded): `Object.keys(EVENT_CATEGORY_DEFINITIONS).sort()` deep-equals `[...Object.values(EventCategory)].sort()`; every definition non-empty, ≤280 chars, single-line (no `\n`), ≥1 alias.
  - [x] Check B (no forward references): every `\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b` token found inside any definition or boundary rule string is a member of `EventCategory` or `EventType` — this is the check that fails loudly if `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT` (or a typo) ever appears.
  - [x] Check C/D (render-and-assert on the built prompts, not a source grep): call `buildGeminiExtractionRequest()` with the same minimal text-only `ProcessingJobMessage` already used by `build-gemini-request.test.ts` Case A (no network/image mocking needed — confirmed callable text-only today), and `buildFilterExtractionSystemInstruction()`. For each built prompt: assert it `includes(renderEventCategoryGlossary())` exactly once; assert that outside that exact substring, fewer than 3 distinct `EventCategory` member names appear as bare/word-boundary tokens.
  - [x] Negative controls: a synthetic definitions record missing a key / with an empty string / over 280 chars fails Check A; a synthetic definition containing `HOME_AND_LIVING` fails Check B; a synthetic prompt string built without calling the renderer fails Check C; a synthetic prompt string with a second, separately-typed list of 3+ category names fails Check D.

- [x] Task 5: Cardinality enforcement (AC: #5)
  - [x] In `transform-gemini-response-to-event-info.ts`, after the existing `validCategories` filter (today: filter to enum-valid, fallback to `[OTHER]` if empty), add: if `validCategories.length > 1`, drop `OTHER` from the array (filter it out) if present; then truncate the (possibly OTHER-filtered) array to its first 4 entries, preserving model/array order. Apply the empty-fallback check first (unchanged), the OTHER-drop second, the cap-4 truncation third — in that order, so a 5-category response that happens to include `OTHER` never wastes one of the 4 kept slots on it.
  - [x] Extend `transform-gemini-response-to-event-info.test.ts` (and/or the sibling `.edge-cases.test.ts`) with cases: 5 valid categories (headline-first) truncates to the first 4, in order; `[OTHER, MUSIC]` (or any 2+ including OTHER) drops `OTHER`, keeping `[MUSIC]`; `[OTHER]` alone stays `[OTHER]` (not dropped — the "never co-occurs with another category" rule doesn't apply when OTHER is the only entry); empty array still falls back to `[OTHER]` (regression check, unchanged behavior).
  - [x] `packages/domain` has a 100%-lines/branches/functions coverage gate (`.c8rc.json`, `all: true`) — confirm the new branches are exercised by the tests above, not just imported by the barrel test.

- [x] Task 6: Structured category-fallback log lines (AC: #6)
  - [x] In `process-ai-job.ts`'s per-event loop (around the existing `transformGeminiResponseToEventInfo(event, {...})` call), before or after that call, inspect the **raw** `event.categories` (already AJV-enum-validated by this point — see Dev Notes "Why the raw array is already enum-valid" below) and log: `console.info(\`[processAiJob] category-fallback post=${message.postId} event=${i} outcome=empty_list_fallback_to_other\`)` when `event.categories.length === 0`; `console.info(\`[processAiJob] category-fallback post=${message.postId} event=${i} outcome=deliberate_other\`)` when `event.categories.length === 1 && event.categories[0] === EventCategory.OTHER`. Neither line fires on any other case (don't log on every event — only these two outcomes).
  - [x] Add/extend a `process-ai-job.test.ts` case per outcome, asserting the exact log line via a `console.info` spy (matching however the existing suite already spies on `console.warn`/`console.error` in this file, if a precedent exists; otherwise a minimal spy). Confirm no existing test in this file (or elsewhere) asserts an exact `console.info` call count that this addition would break — unlike the `console.log`/`console.warn` counts the existing comment at the top of the loop warns about, but verify directly.

- [x] Task 7: Golden category corpus (AC: #7)
  - [x] Create `apps/backend/src/lib/ai-processor/event-category-golden-corpus.fixtures.ts` with the 12 fixtures derived in Dev Notes "Golden category corpus derivation" below (caption text, `expected: EventCategory[]`, `mustNotInclude: EventCategory[]`, a short `rationale` string citing which AD-44 Rule 5 clause applies). Optionally include the bonus 13th ("6b", the aesthetic-clinic post) as a 13th fixture — AD-44 Rule 10 names "twelve," so keep it clearly marked optional/bonus if included.
  - [x] Create `event-category-golden-corpus.live-eval.test.ts`: gated by `RUN_LIVE_GEMINI_TESTS=true` + `SYSTEM_GEMINI_API_KEY` exactly like `build-gemini-request.live-cc024-regression.test.ts` (`t.skip(...)` otherwise, excluded from CI). For each fixture, build a minimal `ProcessingJobMessage` from the caption text (no image), call `buildGeminiExtractionRequest` + the real Gemini call, and assert the extracted event's categories include everything in `expected` and nothing in `mustNotInclude`.
  - [x] Run it once manually (`RUN_LIVE_GEMINI_TESTS=true SYSTEM_GEMINI_API_KEY=<key> pnpm --filter backend test`) before this story is marked done, and record the per-fixture pass/fail result in Completion Notes. **Gating verified only — the actual live run is PENDING/MANUAL** (explicit environment policy denied spending live Gemini quota in this session; see Completion Notes). Per Dev Notes, fixtures #2 and #5 are flagged as having a plausible second reading — if the live run disagrees with this story's derived `expected`/`mustNotInclude` for exactly those two, adjust the fixture (not the prompt) and re-run, rather than treating it as a story blocker; any other mismatch should be investigated as a real prompt/boundary-text defect before adjusting the fixture.
  - [x] Also run the existing opt-in `build-gemini-request.live-cc024-regression.test.ts` once after this story's prompt changes land, to confirm the prompt rewiring (Task 3) didn't regress CC-024's grouping/event-count behavior. Record the result in Completion Notes. **PENDING/MANUAL for the same reason above.**

- [x] Task 8: Replace the four duplicate prose-comment blocks with pointers (AC: #8)
  - [x] `packages/shared-types/src/index.ts` lines ~41-49: replace each trailing `// ... (New)` comment on `CHARITY_AND_CAUSES` through `AUTOMOTIVE` with a single comment above the `EventCategory` enum (or per-member, either is fine): `// see EVENT_CATEGORY_DEFINITIONS (./event-category-definitions.ts)`.
  - [x] `apps/backend/src/schema/events.graphql` lines ~53-58: replace the six inline `#` comments the same way. Confirm with a no-diff `codegen` run that a `#`-comment-only SDL change produces no generated-output diff (the review notes `#` comments produce no codegen output, unlike `"""` doc-comments).
  - [x] `packages/database/schema.ts` lines ~47-52 (the block above `eventCategoryEnum`): replace the 6-line comment block with one pointer line.
  - [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` lines 368-375: replace the inline `// ... (New)` comments the same way.

- [x] Task 9: Update project-context.md (AC: #9)
  - [x] Update the existing "Event categories" bullet (currently: "...plan only, not yet built... today's code has 18 values, no definitions constant and no ratchet...") to state that the definitions constant, renderer, and ratchet now exist for the 18-value set, and that `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT` are still plan-only pending Story 0.53.

- [x] Task 10: Verification (AC: all)
  - [x] `git diff --stat` reviewed against AC10's exclusion list before committing.
  - [x] `pnpm --filter @festgrid/shared-types lint` (or whatever script exists — confirm `package.json`; shared-types has no `build`/`test` script today, only `lint`, per feasibility review §2).
  - [x] `pnpm --filter backend build` (`tsc`) — demonstrate once (then revert the demonstration) that deleting a key from `EVENT_CATEGORY_DEFINITIONS` fails the build; record this in Completion Notes per the feasibility review's S1 AC2.
  - [x] `pnpm --filter backend test` (row-count ratchet harness; this story's new tests write no DB rows) and `pnpm --filter @festgrid/domain test` (100% coverage gate) both pass.
  - [x] `pnpm lint` across `packages/shared-types`, `apps/backend`, `packages/domain`.
  - [x] State explicitly in Completion Notes: no `docs/infrastructure/*` or `architecture-diagram.md` change needed (AC11).

### Review Findings

Code review of git range `030c2333..HEAD` (this story's implementation), run via `bmad-code-review` on 2026-10-24: Blind Hunter + Edge Case Hunter (no spec context) + Acceptance Auditor (against this story's ACs and AD-44 Rules 1-5/10) in parallel, plus the orchestrating session's own independent verification of the items the review brief flagged as "verify, don't trust."

**Verification results (not findings — direct answers to the brief's specific ask):**
- Ratchet non-vacuousness: confirmed genuine. Check B's `findUnknownTokens` negative control (line ~109-111) feeds the real detector a synthetic `HOME_AND_LIVING` literal and asserts it is caught — proving the detector fires, not just that it passes today. The same regex path (any underscored ALL_CAPS token not in `EventCategory ∪ EventType`) would equally catch `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT`, `GADGETS_AND_DEVICES` (none of the four appear anywhere in `EVENT_CATEGORY_DEFINITIONS`/`CATEGORY_BOUNDARIES`, confirmed by direct read) — see Patch finding below for the narrower point that only the first is exercised by name.
- `TECHNOLOGY` definition confirmed unchanged/narrow ("Tech product promos, hackathons, and tech meetups or conferences") — not widened to consumer gadgets. `BUSINESS_AND_NETWORKING` confirmed retains the interim property/investment routing (definition text + a `business-networking-property` boundary entry). Both read directly from `event-category-definitions.ts`.
- Cardinality in `transformGeminiResponseToEventInfo`: order of operations (empty-fallback → OTHER-drop → cap-4) is implemented and tested correctly for all the *spec-named* cases (5-truncation preserving order, `[OTHER,X]` drops OTHER, solo `[OTHER]` stays, empty→`[OTHER]`). Two edge cases outside the spec-named set are NOT handled correctly — see Patch findings 1-2 below.
- Type-only import / template-literal key type in `event-category-definitions.ts`: confirmed sound. `import type { EventCategory } from './index.js'` is fully erased at compile time regardless of module target; the runtime dependency graph is one-directional (`index.ts` → `event-category-definitions.ts`, never back); no runtime import cycle exists.
- Both prompts (`build-gemini-request.ts`, `build-filter-extraction-request.ts`) confirmed to embed `renderEventCategoryGlossary()`'s output exactly once each, with no other category-name prose in either file's surrounding text (grep-verified against every `EventCategory` member name as a standalone word).
- Structured log lines (`process-ai-job.ts:275-278`) confirmed gated on the *raw* per-event category list, which is AJV-enum-validated before the per-event loop (confirmed by reading `process-ai-job.ts:149-164`, the `isValid`/early-return gate, ahead of the loop at line 253+). Confirmed no other test file in the backend suite asserts an exact `console.info` call count that this addition could break (the only other `console.info` spy in the suite is in an unrelated `reports.test.ts`).
- Full-suite "31 pre-existing failures" claim: **could not be independently re-run in this session** — every `pnpm`/`npm`/`tsx`/`node -e` invocation in both this orchestrating session and the independently-spawned Acceptance Auditor subagent failed identically with a broken tool-approval channel (`AbortError: Stream closed`), while read-only commands (`git`, `grep`, `cat`, `ls`) worked normally. Falling back to static evidence: the 2 `resolvers.test.ts` failure titles the story cites (`temporalFilter TODAY/UPCOMING`, `applicableDaysOfWeek` midnight-boundary) exist verbatim and match `project-context.md`'s own independently-documented, pre-existing "Known gap" about the timezone-less `notEnded` SQL — corroborating (not proving) that those are pre-existing and unrelated to `categories`. For the 9 scraper-lambda daily-batch failures that the user's own independently-gathered evidence found passing in isolation but failing in the full suite (cause not yet established): this story adds zero DB writes/schema changes (AC10 confirmed), imports nothing from the scraper/BrightData path, and `tsx --test` isolates each matched test file into its own process by default (not a shared in-process global), so a cross-file state-leak mechanism from this story's new modules (console mocks, module-level caches) is structurally implausible as the cause. This rules out the most likely story-caused mechanisms but does **not** positively identify the real cause (most likely a pre-existing shared-DB/test-ordering fragility in that area, consistent with Story 0.51's own prior findings about that domain) — one clean full-suite run by someone with working tool/shell access is still needed to close this out with certainty.

**Patch findings (fixable without further human input):**

- [x] [Review][Patch] Duplicate `OTHER` entries in the raw category list collapse the result to an empty array, silently bypassing the "never empty" / empty-fallback invariant — e.g. raw `['OTHER', 'OTHER']`: length 2 > 1 and includes `OTHER`, so the exclusivity filter strips every entry, leaving `categories: []`; the empty-fallback check only runs once, earlier, and is never re-applied after the drop. No existing test (incl. the edge-cases file) exercises a duplicate-`OTHER` raw list, and `process-ai-job.ts`'s new log lines don't fire for this case either (raw length is 2, not 0 or 1), so the resulting empty-categories event is also unobservable. [packages/domain/src/events/transform-gemini-response-to-event-info.ts:34-38]
- [x] [Review][Patch] The cap-4 truncation (`categories.slice(0, 4)`) does not dedupe, so a raw list with a repeated non-OTHER category (e.g. `[MUSIC, MUSIC, ARTS_AND_CULTURE, FOOD_AND_DRINK, SPORTS_AND_FITNESS]`) keeps the duplicate `MUSIC` and silently drops the distinct `SPORTS_AND_FITNESS`, rather than preserving up to 4 distinct categories. Not covered by any test (the existing 5-category truncation test uses 5 distinct values only). [packages/domain/src/events/transform-gemini-response-to-event-info.ts:38]
- [x] [Review][Patch] Ratchet Check B's negative control only feeds the detector the literal `HOME_AND_LIVING`; `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT` and `GADGETS_AND_DEVICES` are never separately asserted by name even though the surrounding comment and this story's own scope claim all four are caught. Same regex path, so no functional gap — a test-completeness nit only. [apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts:109-121]
- [x] [Review][Patch] Task 1's checklist item "Do not name `HOME_AND_LIVING` or `FASHION_AND_BEAUTY` anywhere in this file ... not in a comment" is marked `[x]` done, but `event-category-definitions.ts`'s own header doc-comment literally names `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, and `FINANCE_AND_INVESTMENT` to explain scope. Harmless to the ratchet (Check B only scans `EVENT_CATEGORY_DEFINITIONS`/`CATEGORY_BOUNDARIES` string values, not source comments) but the checklist claim is inaccurate. [packages/shared-types/src/event-category-definitions.ts:16-17]
- [x] [Review][Patch] The three new `console.info` spies in `process-ai-job.test.ts` (Cases T/U/V) call `infoMock.mock.restore()` unconditionally after `await processAiJob(message)`, with no `try`/`finally` — if `processAiJob` throws, the mock is never restored, leaking console-mocked state to later tests within the same file (node:test isolates per-file by default, so this is same-file-only blast radius, not cross-file). [apps/backend/src/lib/ai-processor/process-ai-job.test.ts:1898-1991]

**Deferred findings:**

- [x] [Review][Defer] No automated guard (lint rule, e.g. `import/no-cycle`) stops a future edit from converting the deliberate `import type { EventCategory }` in `event-category-definitions.ts` back into a regular value import, silently reintroducing the runtime import-cycle risk the type-only import was specifically added to avoid — protected today only by an inline comment. [packages/shared-types/src/event-category-definitions.ts] — deferred, forward-looking hardening suggestion, not a defect in the code as shipped (FIND-096)

## Dev Notes

- **Scope boundary, restated:** this story is AD-44 Follow-up 1 ("Story 1") only. It writes definitions correct for the **existing 18 `EventCategory` values** and names only existing values (ratchet Check B enforces this mechanically). It does **not** add `HOME_AND_LIVING` or `FASHION_AND_BEAUTY`, does not touch the GraphQL SDL enum body, generated codegen output, locale files, the `eventCategoryEnum` pgEnum array, any migration, or seed data. That is Story 0.53 (`0-53-add-home-living-fashion-finance-and-gadget-event-categories`, already present in `sprint-status.yaml` as `backlog`), which ships after this story. [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-44, Follow-ups 1-2]
- **This story's interim live-behaviour effect is real and accepted, not a defect to fix:** narrowing `BUSINESS_AND_NETWORKING` to subject matter (trade, B2B, networking, entrepreneurship; property and investment stay as an interim routing until Story 0.53) changes what new extractions tag; `TECHNOLOGY` is NOT widened (owner reversed that on 2026-10-23), starting the moment this story deploys — AD-44 Follow-up 1 explicitly accepts this, and the architecture spine's four-reviewer cycle confirmed it (event-category-review-2026-10-23.md §11, row "S1/S2 coupled; S1 is a live behaviour change (code H5) → Fixed. S1 names only the 18; S2 amends; interim effect accepted"). A consumer furniture bazaar or a barbershop promo tags `OTHER` until Story 0.53 lands (see golden corpus derivation below) — this is the expected, documented interim state, not a bug.
- **Why this story has no `epics.md` section** (same pattern as Story 0.34/0.33's precedent): this story's authoritative source is Architecture Spine AD-44 (and its four review documents), surfaced directly as backlog row `IDEA-100`, not `epics.md`/`bmad-create-epics-and-stories`. `IDEA-100` is already `status: promoted` in `sprint-status.yaml`'s `backlog.yaml` with both `0-52-...` and `0-53-...` listed under `stories:` — no new backlog carve-out is needed for this story (the row's full scope is already fanned into exactly these two stories with nothing left uncovered). [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-100]
- **Why the raw array is already enum-valid by the time `process-ai-job.ts`'s loop sees it (Task 6):** `extracted-event.schema.ts`'s AJV schema declares `categories: { type: 'array', items: { type: 'string', enum: Object.values(EventCategory) } }`. AJV validates every array item against that enum; if Gemini returns any value outside the enum, AJV validation fails for the whole payload and `process-ai-job.ts:158-164`'s existing `if (!isValid) { ...; return; }` branch drops the **entire extraction** before the per-event loop is ever reached (AD-44 Rule 2: "A value outside the enum fails the extraction schema's Ajv validation and the whole extraction is dropped... it does not fall back to OTHER"). So by construction, every `event.categories` entry the loop sees is already a real `EventCategory` member — `transformGeminiResponseToEventInfo`'s own `.filter(valid)` is defense-in-depth, not the primary gate. This means the only way `event.categories` is empty is if Gemini returned a genuinely empty array, and the only way it's exactly `['OTHER']` is if Gemini deliberately chose only `OTHER` — exactly the two cases Rule 10 asks to be logged. [Source: apps/backend/src/validation/extracted-event.schema.ts, apps/backend/src/lib/ai-processor/process-ai-job.ts:158-164]
- **Current state of the four prose-comment copies being replaced (Task 8):** confirmed by direct read during story drafting — `packages/shared-types/src/index.ts:41-49` and `apps/backend/src/schema/events.graphql:53-58` each carry 6 inline `(New)`-suffixed comments (on `RELIGION_AND_SPIRITUALITY` through `AUTOMOTIVE`); `packages/database/schema.ts:47-52` carries the same 6 as a comment block above `eventCategoryEnum`; `prd.md:368-375` carries the same 6 inline. All four already read "`TECHNOLOGY` — Tech product promos, hackathons, tech meetups/conferences", which **contradicts** this story's widened `TECHNOLOGY` definition the moment Task 1 lands — this is precisely the drift AD-44 Rule 4/H2 calls out, and is why Task 8 is in this story's scope rather than deferred.
- **Separator/format choice:** `renderEventCategoryGlossary()` uses ASCII ` -- ` (ASCII hyphen-hyphen, with surrounding spaces), not the U+2014 em dash AD-44's prose literally shows (`NAME — definition`). The feasibility review confirms either renders fine to the model and recommends ASCII for consistency with this codebase's existing prompt prose (`build-gemini-request.ts`'s "-- the most common real-world case"); the separator is defined once in the renderer, so the ratchet's render-and-assert checks (C/D) never hard-code it twice. [Source: reviews/review-code-feasibility.md §3]
- **Renderer/ratchet file placement:** `packages/shared-types` has no test runner and no `build`/`test` script (confirmed: `package.json` has only `lint`) — the renderer and its ratchet live in `apps/backend`, alongside the two prompt builders they serve, in `apps/backend/src/lib/ai-gateway/` (the home of this codebase's other prompt/response plumbing: `adapter.ts`, `gemini-client.ts`, `eval-log-format.ts`). This matches the feasibility review's recommendation and keeps the ratchet in the same package style as the precedent ratchets it mirrors (`no-vendor-call-bypasses-wrapper.ratchet.test.ts`, also in `lib/vendor-gateway/`). [Source: reviews/review-code-feasibility.md §2]
- **Function naming:** AD-44 Rule 4's own text names the renderer `renderEventCategoryGlossary()` (not the `renderEventCategoryDefinitions()` name used as illustrative code in the feasibility review's §4 ratchet sketch) — this story uses the AD's own name, `renderEventCategoryGlossary`, as authoritative.

### Golden category corpus derivation (Task 7, AC #7)

The 12 posts are from `reviews/review-adversarial-pair.md` §2 ("Ten (plus two) realistic Indonesian posts against Rule 4", rows 1-12; row "6b" is a 13th bonus post, optional, not part of the official twelve). That table captures the posts and the *ambiguity* AD-44 Rule 4 (pre-rewrite) had on each — AD-44's rewritten Rule 5 (the ordered boundary procedure, cap-4, OTHER-exclusivity) resolves most of that ambiguity. The derivation below applies the **rewritten** Rule 5 and this story's 18-value scope (i.e., wherever the "plausible output" in the review's table depends on `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT`, this story's interim answer is `OTHER` instead, per AD-44 Follow-up 1's explicitly accepted interim effect):

| # | Caption (sketch) | Rule 5 clause applied | `expected` (18-value interim) | `mustNotInclude` | Confidence |
|---|---|---|---|---|---|
| 1 | Property expo, KPR DP 0%, 40+ developer | Named routing wins: property/KPR → `BUSINESS_AND_NETWORKING`, regardless of audience | `[BUSINESS_AND_NETWORKING]` | `[OTHER]` | Firm |
| 2 | Furniture fair, Trade Day (buyer/eksportir) + Public Day | Furniture has no category among the 18 (deferred to 0.53); a retail/consumer fair with no qualifying category is `OTHER` | `[OTHER]` | — | **Confirm on first live run** — a reading where the stated "buyer & eksportir" trade day alone triggers `BUSINESS_AND_NETWORKING` is plausible too; if the live run consistently returns that instead, update the fixture, not the prompt |
| 3 | UMKM bazaar in a mall: kuliner, kriya, fashion muslim + "UMKM Go Digital" workshop | "UMKM" / a seller workshop alone do **not** trigger `BUSINESS_AND_NETWORKING` (explicit Rule 5.3 exclusion); subject-of-sale for the named subjects that do have a category | `[FOOD_AND_DRINK, ARTS_AND_CULTURE]` | `[BUSINESS_AND_NETWORKING, OTHER]` | Firm — this is the direct test of Rule 5.3's UMKM/workshop exclusion |
| 4 | Gadget roadshow (Erafone x ASUS ROG) + esports tournament (Mobile Legends) | Consumer gadgets/promos → `TECHNOLOGY` (its existing "tech product promos" scope, unchanged; they move to `GADGETS_AND_DEVICES` in Story 0.53); esports → `HOBBIES_AND_INTERESTS` (owner default) | `[TECHNOLOGY, HOBBIES_AND_INTERESTS]` | `[OTHER]` | Firm (treat `SPORTS_AND_FITNESS` appearing alongside as a soft miss, not a hard failure — it's the owner's flippable alternate default, not forbidden) |
| 5 | Fashion week "Wastra Nusantara" (batik/tenun), runway, buyer meeting day 2 | Batik/tenun heritage → `ARTS_AND_CULTURE`; stated buyer meeting → `BUSINESS_AND_NETWORKING` trade purpose | `[ARTS_AND_CULTURE, BUSINESS_AND_NETWORKING]` | `[OTHER]` | **Confirm on first live run** — "live music" is a minor incidental detail the model may or may not add as a non-headline 3rd tag (`MUSIC`); treat that alone as a soft miss, not a failure |
| 6 | Barbershop grand opening (potong + hairwash) | Barbershop/grooming has no category among the 18 (deferred to 0.53 as `FASHION_AND_BEAUTY`) | `[OTHER]` | — | Firm — this is the cleanest "before" half of a before/after pair with Story 0.53's re-run of the same corpus |
| 7 | Power-tools roadshow for tradespeople (tukang/kontraktor discount) | Consumer/tradesperson tools has no category among the 18 (deferred to 0.53 as `HOME_AND_LIVING`); a retail discount targeting a professional customer segment is **not itself** a stated trade/B2B/buyer/franchise/supplier/business-matching purpose (Rule 5.3) | `[OTHER]` | `[BUSINESS_AND_NETWORKING]` | Firm — direct test that audience alone (tradespeople as customers) doesn't trigger `BUSINESS_AND_NETWORKING` |
| 8 | Plant fair + contest (Kontes Aglaonema) | Plants as collecting/contest → `HOBBIES_AND_INTERESTS`; no decorative-as-décor co-tag (that needs `HOME_AND_LIVING`, deferred) | `[HOBBIES_AND_INTERESTS]` | `[OTHER]` | Firm |
| 9 | Mall-wide multi-category sale (fashion, elektronik, home living, kuliner) | A sale spanning many unrelated subjects with no single headline is `OTHER` (Rule 5.4) — this matches the feasibility review's own S2 acceptance wording, "a mall-wide sale tags OTHER with type PROMOTION or MARKET" | `[OTHER]` | `[TECHNOLOGY, FOOD_AND_DRINK]` | Firm — the single most direct test of the cap/OTHER-exclusivity fix (Rule 2) against fragmenting a mall-wide sale into its named sub-parts |
| 10 | Sneaker launch (Nike Pegasus 42) + 5K fun run | Participatory sport event keeps `SPORTS_AND_FITNESS` even when a shoe/apparel is launched (explicit exception, doesn't need `FASHION_AND_BEAUTY` to exist) | `[SPORTS_AND_FITNESS]` | `[OTHER]` | Firm |
| 11 | Wedding expo (vendor gedung, katering, rias, busana, dekorasi) | Wedding/bridal expo → dominant subject if one exists among the 18, else `OTHER`; no single vendor type dominates | `[OTHER]` | `[FOOD_AND_DRINK]` | Firm — tests that the model doesn't over-grab the one incidental existing category (catering) when the actually-dominant subjects (bridal wear, décor) have no category yet |
| 12 | Cosmetics brand launch + makeup class (Wardah Colorfit) | Cosmetics has no category among the 18 (deferred to 0.53 as `FASHION_AND_BEAUTY`); "class" here is a brand promo activity, not an academic competition (`EDUCATION`'s actual scope) | `[OTHER]` | `[EDUCATION]` | Firm — direct test against the adversarial review's own called-out risk ("run 2 may add EDUCATION for 'class'") |
| 6b *(bonus, optional)* | Aesthetic clinic promo (facial, botox, laser) | Clinical aesthetic treatment → `HEALTH_AND_WELLNESS` (explicit exception, survives without `FASHION_AND_BEAUTY` existing) | `[HEALTH_AND_WELLNESS]` | `[OTHER]` | Firm |

Posts #2 and #5 are flagged "confirm on first live run" because they remain genuinely ambiguous even under AD-44's rewritten Rule 5 — the adversarial review's own table marked their pre-rewrite equivalents `CON`/`AMB`. AD-44 Rule 10 states this corpus runs as "a manual or nightly step... never a CI gate," so resolving those two by observing the real model's behavior (and updating the fixture to match, not the prompt) is the intended workflow, not a story blocker.

### Architecture & UX Gate Findings

All three gates were run fresh via subagent (no `epic-0-readiness.md`-equivalent sweep exists or applies to a standalone, non-formed-epic story like this one — same precedent as Story 0.34):

- **Gate 1 (Architecture/Infrastructure Completeness, Winston persona):** No gap found. Every touched file is `packages/shared-types` (pure constants), `packages/domain` (a pure in-memory array transform, no new I/O), or `apps/backend` (prompt-builder edits, a new renderer, a ratchet test, fixtures, and two new log lines in the existing `AIProcessingQueue` worker). No new DB/ORM call from `apps/web`, no direct frontend-to-external-service call, no new resolver/query/mutation, no auth/secrets/business-rule addition in frontend code (there is no frontend change at all), no new infra dependency, no new queue/Lambda/external service/migration.
- **Gate 2 (UI Complexity & Reusability, Freya persona):** No gap found. Zero UI-visible change: `EVENT_CATEGORY_DEFINITIONS` is explicitly never rendered in any UI, FilterHub/the correction dialog/event cards and their locale files are completely untouched, and the two values that will eventually need new UI labels (`HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT`) are correctly deferred to Story 0.53.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness, Winston persona):** No gap found. The definitions-constant + single-renderer + ratchet pattern is purpose-built for and scoped to the `EventCategory` taxonomy specifically (mandated by AD-44), using already-established package boundaries (`packages/shared-types`, no new dependency edge) and this backend's existing `node:test` ratchet convention — it is not a new generic/reusable mechanism other epics would import, and no dependency referenced in `project-context.md`/the architecture spine is left without an owning story.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: No mismatch found.
- Impacted fields/contracts: None at the DB/API boundary. Two new TypeScript shapes are introduced — `EVENT_CATEGORY_DEFINITIONS: Readonly<Record<EventCategory, { definition: string; aliases: readonly string[] }>>` and `CATEGORY_BOUNDARIES` — both pure, compile-time, package-internal-to-shared-types constants with no database column, no GraphQL field, and no persisted shape. `EventCategory`'s own membership (18 values), the `events.graphql` SDL, the pgEnum array, and both committed codegen outputs are explicitly unchanged by this story (AC10).
- Required DB migration changes: No changes required. `events.categories` stays `text[]`; no column, index, or constraint changes.
- Required TypeScript type changes: Additive only (the two new exported consts above); no existing interface (`EventInfo`, `GeminiEventPayload`, `ExtractedEventMessage`, etc.) changes shape.
- Backward compatibility and rollout notes: This story changes live extraction *behavior* (prompt wording, cap-4/OTHER-exclusivity enforcement) without changing any stored *shape* — no backfill, no rollout ordering hazard beyond normal deploy practice. The cap-4/OTHER-exclusivity logic applies only to newly-extracted events going forward; no re-extraction or migration of previously-stored `categories` arrays (which could already, in principle, hold more than 4 values or an `OTHER` alongside others, since this enforcement didn't exist before) is performed or required by this story.
- Verification checks: Task 4's ratchet (compile-time exhaustiveness via `tsc` plus the runtime ratchet test), Task 5's unit tests (cap-4 truncation, OTHER-drop, empty-fallback regression), and Task 7's golden corpus (behavioral, non-CI) together verify end-to-end alignment between the definitions source, the rendered prompts, and the code-level enforcement.

### Project Structure Notes

- No new directories or packages. New files: `packages/shared-types/src/event-category-definitions.ts`; `apps/backend/src/lib/ai-gateway/render-event-category-glossary.ts` (+ `.test.ts`), `apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts`; `apps/backend/src/lib/ai-processor/event-category-golden-corpus.fixtures.ts` + `event-category-golden-corpus.live-eval.test.ts`.
- No conflicts with package-boundary rules: `packages/shared-types` stays dependency-free and logic-free (data only, no exported function); the renderer (a function) correctly lives in `apps/backend`, not in `shared-types`; `packages/domain`'s existing "no React, no DB/ORM, no Node-only deps" constraint is satisfied by Task 5's change (a plain array transform with no new imports).
- State management / i18n / analytics package-boundary rules from `project-context.md` do not apply — this story has no frontend code, no React state, and no next-intl locale keys (the definitions are explicitly never rendered in UI).

### References

- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-44] (binding source for this story's entire scope; lines 2454-2624)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/event-category-review-2026-10-23.md#11. Review cycle on AD-44] (four-reviewer disposition table; confirms S1/S2 split, cap 4, esports→HOBBIES, property→BUSINESS defaults)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/reviews/review-code-feasibility.md] (§2 placement; §3 prompt-rendering design; §4 ratchet design; §7 findings H1-H5/M1-M7; §8 S1 file-change list and acceptance criteria; §9 sequencing)
- [Source: _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/reviews/review-adversarial-pair.md §2] (the 12 Indonesian posts underlying the golden corpus)
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-100] (already-promoted backlog row; both 0-52/0-53 story keys already attached)
- [Source: packages/shared-types/src/index.ts] (current 18-value `EventCategory`/`EventType` enums, the comments being replaced)
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts] (extraction prompt, lines 199/223/27)
- [Source: apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts] (filter prompt, lines 19/82)
- [Source: packages/domain/src/events/transform-gemini-response-to-event-info.ts] (cardinality enforcement target)
- [Source: apps/backend/src/lib/ai-processor/process-ai-job.ts] (per-event loop, line ~268; log-line precedent `logFaceBlurThumbnailOutcome` line 90; AJV-drops-whole-extraction behavior lines 158-164)
- [Source: apps/backend/src/validation/extracted-event.schema.ts] (AJV `enum:` confirming the raw array is already enum-valid when the loop sees it)
- [Source: apps/backend/src/lib/vendor-gateway/no-vendor-call-bypasses-wrapper.ratchet.test.ts] (ratchet-test style precedent)
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.live-cc024-regression.test.ts] (opt-in live-Gemini test gating precedent for Task 7)
- [Source: _bmad-output/project-context.md#Event categories] (note being updated by Task 9)
- [Source: _bmad-output/implementation-artifacts/0-34-harden-eventcategory-eventtype-cross-source-consistency.md#Why this story has no epics.md section] (precedent pattern)
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml] (confirms `0-52-...`/`0-53-...` backlog keys already exist)

## Global Rules References

- [x] `project-context.md` — Code Organization / package-boundary rules (shared-types dependency-free; packages/domain no React/DB/ORM/Node-only deps); updated by Task 9
- [x] `story-content-structure.md` — canonical section order and status vocabulary followed
- [x] Architecture spine — AD-44 (binding source for this entire story)
- [x] Infrastructure docs — not applicable; no infra/deploy change (AC11; no `docs/infrastructure/*` update needed)

## Implementation Plan (Rule-Compliant)

### File Change Plan

Create:
- `packages/shared-types/src/event-category-definitions.ts`
- `apps/backend/src/lib/ai-gateway/render-event-category-glossary.ts` + `.test.ts`
- `apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts`
- `apps/backend/src/lib/ai-processor/event-category-golden-corpus.fixtures.ts`
- `apps/backend/src/lib/ai-processor/event-category-golden-corpus.live-eval.test.ts`

Modify:
- `packages/shared-types/src/index.ts` — re-export the new definitions module; replace per-value trailing comments with a pointer
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts` — lines 199/223 use the renderer; add two new `console.info` log lines in the per-event loop (via `process-ai-job.ts`, not this file — see below)
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` — add the two structured log lines (Task 6)
- `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts` — line 19 uses the renderer
- `packages/domain/src/events/transform-gemini-response-to-event-info.ts` — cap-4 + OTHER-exclusivity enforcement
- `packages/domain/src/events/transform-gemini-response-to-event-info.test.ts` and/or `.edge-cases.test.ts` — new cases
- `apps/backend/src/schema/events.graphql` — comment-only change, lines ~53-58 (no SDL value change, no codegen diff expected)
- `packages/database/schema.ts` — comment-only change, lines ~47-52 (no enum array change)
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — comment-only change, lines ~368-375
- `_bmad-output/project-context.md` — "Event categories" note update

Do not touch (verified by AC10's `git diff --stat` check): `EventCategory`/`EventType` enum membership, `events.graphql`'s `EventCategory` enum body, `en.json`/`id.json`, `schema.ts`'s `eventCategoryEnum` array, `packages/database/migrations/`, any `generated/` file, `seed.ts`/`seed-volume.ts`.

### Rule Mapping

- AD-44 Rule 3 (one definitions source) → AC1, Task 1
- AD-44 Rule 4 (one renderer, ratchet) → AC2, AC3, AC4, Tasks 2-4
- AD-44 Rule 2 (cardinality, OTHER exclusivity) → AC5, Task 5
- AD-44 Rule 10 (measurable tagging quality, golden corpus) → AC6, AC7, Tasks 6-7
- AD-44 Rule 4/6 (comment pointers, hand-reviewed register items) → AC8, Task 8
- Feasibility review M3 → AC9, Task 9
- Feasibility review §8 S1 AC1 → AC10
- CLAUDE.md §4 (architecture diagram upkeep) → AC11 (confirmed not triggered)
- `story-split-gate.md` Gates 1/2/3 → all "no gap found," recorded above under Architecture & UX Gate Findings

### Verification Plan

- `pnpm --filter backend build` (tsc exhaustiveness check on `Record<EventCategory,...>`) — demonstrate once that a deleted key fails the build
- `pnpm --filter backend test` (ratchet test Checks A-D + negative controls; cap-4/OTHER-exclusivity unit tests; process-ai-job log-line tests; full existing suite for regressions) — via the row-count-ratchet harness, writes no new rows
- `pnpm --filter @festgrid/domain test` (100% coverage gate on the modified transform)
- `pnpm lint` across `packages/shared-types`, `apps/backend`, `packages/domain`
- One opt-in run of `event-category-golden-corpus.live-eval.test.ts` (`RUN_LIVE_GEMINI_TESTS=true`), results recorded in Completion Notes
- One opt-in run of the existing `build-gemini-request.live-cc024-regression.test.ts`, confirming no regression from the prompt rewiring, results recorded in Completion Notes
- `git diff --stat` reviewed against AC10's exclusion list

## Pre-Coding Approval Gate

- [x] Scope confirmation — this story is AD-44 Follow-up 1 only (18-value definitions, renderer, ratchet, cardinality, log lines, golden corpus, comment pointers); `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT` are explicitly out of scope (Story 0.53).
- [x] Architecture and boundary confirmation — no GraphQL SDL/resolver change, no frontend change, no DB migration; renderer/ratchet placement (`apps/backend/src/lib/ai-gateway/`) and definitions placement (`packages/shared-types`) confirmed against package-boundary rules.
- [x] Testing plan confirmation — ratchet test (Checks A-D + negative controls), cap-4/OTHER-exclusivity unit tests, log-line tests, and the two opt-in live-Gemini runs (golden corpus + CC-024 regression), per Tasks 1-10.
- [x] Explicit human approval state — approved by shulha, 2026-10-23.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three gates ran fresh via subagent with "no gap found" (see Architecture & UX Gate Findings).

## Testing Requirements

- [x] Integration tests — `node:test` ratchet (`event-category-definitions.ratchet.test.ts`), renderer unit test, `transform-gemini-response-to-event-info` cap/OTHER-exclusivity cases, `process-ai-job.ts` log-line cases — all passing.
- [x] E2E tests — not applicable (no UI/frontend change in this story)
- [ ] Opt-in live-model tests (non-CI) — golden category corpus (12 fixtures) and the existing CC-024 regression, both run once manually before this story is marked done. **Gating verified (correctly skips); actual runs PENDING/MANUAL** — owner explicitly denied spending live Gemini quota in this session. See Completion Notes.

## Deliverables Checklist

- [x] `packages/shared-types/src/event-category-definitions.ts` with 18 definitions + boundary table
- [x] `apps/backend/src/lib/ai-gateway/render-event-category-glossary.ts` + test
- [x] `apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts` (Checks A-D + negative controls)
- [x] `build-gemini-request.ts` and `build-filter-extraction-request.ts` both call the renderer
- [x] `transform-gemini-response-to-event-info.ts` cap-4 + OTHER-exclusivity enforcement + tests
- [x] `process-ai-job.ts` two new structured `console.info` log lines + tests
- [x] `event-category-golden-corpus.fixtures.ts` (12 fixtures) + `event-category-golden-corpus.live-eval.test.ts` created and gating verified; live run itself PENDING/MANUAL (see Completion Notes)
- [x] Four prose-comment blocks replaced with pointers (`index.ts`, `events.graphql`, `schema.ts`, `prd.md`)
- [x] `project-context.md` "Event categories" note updated
- [x] `sprint-status.yaml` updated per this workflow's completion step

## Out of Scope

- `HOME_AND_LIVING`, `FASHION_AND_BEAUTY`, `FINANCE_AND_INVESTMENT`, `GADGETS_AND_DEVICES` (new enum members, SDL, codegen outputs, locale labels, pgEnum, migration, seeds, PRD block widening) — all of this is Story 0.53 (`0-53-add-home-living-fashion-finance-and-gadget-event-categories`), which ships after this story per AD-44's sequencing.
- Retiring the `eventCategoryEnum` pgEnum (`DROP TYPE`) — Story 0.53's scope (AD-44 Rule 6).
- Any freshness check between the committed generated codegen outputs and the source enum (feasibility review M2) — not needed by this story since no enum membership changes; Story 0.53's scope if addressed at all.
- `TOOLS_AND_HARDWARE`, `PROPERTY` (as its own category), `SHOPPING_AND_RETAIL` — deferred or not planned in AD-44 (the first two behind evidence triggers not yet met).
- A denylist regex test for Rule 1's naming constraints (feasibility review L6) — mentioned as marginal value, not required.
- Any change to `EventType` definitions/rendering — AD-44 scopes this to `EventCategory` only.

## Definition of Done

- [x] AC1-AC11 satisfied and verified (AC7's live-eval runs are gated-and-verified but PENDING/MANUAL execution — see the line below)
- [x] Required tests passing: `apps/backend` (`node:test`, ratchet + unit + log-line tests, full suite via row-count-ratchet harness), `packages/domain` (100% coverage gate)
- [x] Lint and type checks passing for `packages/shared-types`, `apps/backend`, `packages/domain`
- [ ] Both opt-in live-model runs (golden corpus, CC-024 regression) executed once and results recorded in Completion Notes — **PENDING/MANUAL**: gating verified (correctly `t.skip`s without `RUN_LIVE_GEMINI_TESTS=true`); the actual live runs were not executed in this session per explicit environment policy against spending live Gemini quota. Owner to run both manually before/along with final review.

## Completion Status

- [x] Complete (code, tests, lint, build, verification all done — two opt-in live-model runs pending/manual per owner policy, see Completion Notes)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `pnpm --filter @festgrid/domain build` / `pnpm --filter @festgrid/database build` / `pnpm --filter @festgrid/graphql-select build` then `pnpm --filter backend build` — all clean (tsc). Dependency packages needed a fresh `dist/` build in this environment before `backend build` could resolve `@festgrid/domain`, `@festgrid/database`, `@festgrid/graphql-select` — unrelated to this story's changes, just environment state.
- Exhaustiveness demonstration (Task 10 / feasibility review S1 AC2): temporarily deleted the `OTHER` entry from `EVENT_CATEGORY_DEFINITIONS` → `pnpm --filter backend build` failed with `TS2741: Property 'OTHER' is missing in type '...'`. Reverted immediately; rebuilt clean.
- `pnpm --filter @festgrid/domain test`: 1233 tests, 0 failures, 100% lines/statements/functions/branches coverage (unchanged gate, now also covering the new cap-4/OTHER-exclusivity branches).
- Targeted `apps/backend` runs via `scripts/run-tests-with-row-count-ratchet.ts` (seeded DB, `GEOAPIFY_API_KEY=test-geoapify-key`): `render-event-category-glossary.test.ts` + `event-category-definitions.ratchet.test.ts` (12/12 pass after fixing one negative-control test that incorrectly expected a non-underscored typo, `MUSICC`, to trip the underscored-token regex — Check B only targets underscored ALL_CAPS tokens like `HOME_AND_LIVING`, by design); `build-gemini-request.test.ts` + `build-filter-extraction-request.test.ts` (35/35 pass); `process-ai-job.test.ts` full file (34/34 pass, including new Cases T/U/V).
- Full unfiltered `pnpm --filter backend test` and fresh `pnpm --filter backend lint`/`pnpm lint` run at Step 9 before marking review (see Completion Notes for the final confirmed results).
- `pnpm codegen` (apps/backend) confirmed the `events.graphql` `EventCategory` comment-only change produces a byte-identical `src/generated/resolvers-types.ts` (no diff).
- `git diff <baseline> --stat` confirmed zero changes to any AC10-excluded path (locale files, migrations, `generated/`, seed files, enum membership).
- Prompt character-length delta (Task 3): extraction prompt 12,053 → 15,783 chars (+3,730); filter prompt 4,632 → 8,353 chars (+3,721). Combined +7,451 chars (~7.3 KB) — higher than the feasibility review's rough +2.4–4.4 KB combined estimate, driven by the 10 `CATEGORY_BOUNDARIES` entries plus 18 definitions+aliases; not a correctness concern, just recorded per Task 3's instruction.

### Completion Notes List

- AC1–AC5, AC8, AC9, AC10 fully implemented and verified exactly as scoped: 18-value `EVENT_CATEGORY_DEFINITIONS` + `CATEGORY_BOUNDARIES` (no `HOME_AND_LIVING`/`FASHION_AND_BEAUTY`/`FINANCE_AND_INVESTMENT` anywhere in the file, verified by the ratchet's Check B and by manual review); `renderEventCategoryGlossary()`; both prompt builders wired to it; the four duplicate prose-comment blocks replaced with pointers; cap-4 + OTHER-exclusivity cardinality enforcement in `transformGeminiResponseToEventInfo`; `project-context.md`'s "Event categories" note updated; `git diff --stat` against baseline shows zero changes outside this story's intended file set and none of AC10's excluded paths.
- **Import-cycle resolution (not in the story's literal task text, but required to make AC1's `Record<EventCategory, ...>` type actually work)**: `index.ts` re-exports `event-category-definitions.ts`, which would create a runtime circular import if that file imported `EventCategory` as a *value*. Resolved with a type-only import (`import type { EventCategory } from './index.js'`) plus a template-literal key type (`` `${EventCategory}` ``) — fully erased at compile time, zero runtime cycle, and still fully exhaustive at `tsc` time (demonstrated in Debug Log References above). `EVENT_CATEGORY_DEFINITIONS`'s exported type signature is therefore `Readonly<Record<`${EventCategory}`, EventCategoryDefinition>>` rather than the AC1 text's literal `Record<EventCategory, ...>` spelling — structurally and functionally equivalent for every consumer (indexing by an `EventCategory` enum member works identically), chosen specifically to avoid the runtime cycle the Dev Notes flagged as a risk to watch for.
- AC6 (structured log lines): implemented in `process-ai-job.ts`'s per-event loop, `console.info` only (matching the `logFaceBlurThumbnailOutcome` precedent), confirmed no existing test in this file or elsewhere asserts an exact `console.info` call count. Added Cases T/U/V to `process-ai-job.test.ts` (empty-list, deliberate-OTHER, and a normal-list negative case) — all pass.
- AC7 (golden corpus): 12 fixtures (+1 optional bonus "6b") built from the *actual* captions in `review-adversarial-pair.md` §2, re-derived against this story's 18-value interim taxonomy and the rewritten Rule 5 (see the fixtures file's own header comment and the story's Dev Notes derivation table). The live-eval test (`event-category-golden-corpus.live-eval.test.ts`) is gated and confirmed to `t.skip()` correctly without `RUN_LIVE_GEMINI_TESTS=true`. **The two required opt-in live runs (this golden corpus, and the existing `build-gemini-request.live-cc024-regression.test.ts`) were NOT executed in this session** — the environment's owner explicitly denied spending live Gemini API quota for this task and instructed verifying the gating instead and recording this as pending. Owner should run both manually:
  `RUN_LIVE_GEMINI_TESTS=true SYSTEM_GEMINI_API_KEY=<key> pnpm --filter backend test`
  and update this section with per-fixture pass/fail results before (or as part of) code review / marking the story "done".
- AC11: confirmed explicitly — this story adds no service, queue, Lambda, scraper, database, hosting provider, or major library; `docs/infrastructure/*.md`/`architecture-diagram.md` are untouched and require no update (CLAUDE.md §4 not triggered).
- **Final full-suite verification run (Step 9, fresh and unfiltered, immediately before marking status "review"):** `pnpm --filter backend test` (row-count ratchet harness, full unfiltered suite) → **1573 tests, 1538 pass, 31 fail, 4 skip.** All 31 failures were individually inspected and are **pre-existing and unrelated** to this story:
  - 9 failures in "scraper lambda daily-batch branch" (per-target `newerThan`, trigger-concurrency/queue accounting, provider-degraded-health tracking) and 2 in "trigger-brightdata-for-target"/"get-scrape-targets batch targeting" — all in Apify/BrightData/scraper infrastructure this story never touches. Matches the exact category Story 0.51's own Dev Agent Record documented as pre-existing ("dev/CI config — Apify/BrightData/GEOAPIFY/queue").
  - 2 failures in `resolvers.test.ts`'s "events - temporalFilter TODAY/UPCOMING" and "events - applicableDaysOfWeek narrows ... TODAY/UPCOMING" — both fail on a same-day/midnight boundary assertion ("event ending today ... should NOT be included"), which is `project-context.md`'s own documented "Known gap: the backend `notEnded` SQL has no timezone, so the 'Today' filter ... can disagree ... for a few hours around local midnight" — a pre-existing, time-of-day-dependent gap, not something this story's `categories` changes could cause (these tests assert on date/schedule fields, never on `EventCategory`).
  - None of the 6 top-level failing suites (`not ok` lines) or their nested subtests mention `EventCategory`, `categories`, `render-event-category-glossary`, `build-gemini-request`/`build-filter-extraction-request`, `transform-gemini-response-to-event-info`, or `process-ai-job` — every file this story touches, and every test file added/extended by this story, is 100% green in this same run (independently re-confirmed via targeted runs during development — see Debug Log References above).
  - 4 skips are all opt-in live-Gemini tests correctly `t.skip()`ing without `RUN_LIVE_GEMINI_TESTS=true`: the 3 pre-existing ones (`live-carousel`, `live-cc024-regression`, `live-cc028-blur-parity`) plus this story's own new `event-category-golden-corpus.live-eval.test.ts` — confirming it is wired into the suite exactly like its precedents.
  - Ran the full suite twice (once piped through `tail`, once to a raw log) to confirm the 31-failure set is identical and deterministic both times, not flaky noise.
- Lint: fresh `pnpm --filter backend lint`, `pnpm --filter @festgrid/domain lint`, `pnpm --filter @festgrid/shared-types lint`, `pnpm --filter @festgrid/database lint` all passed clean (0 errors; backend carries its usual pre-existing `@typescript-eslint/no-explicit-any`/`turbo/no-undeclared-env-vars` warnings, not errors, and not introduced by this story).
- Build: fresh `pnpm --filter backend build` passed clean (after the dependency packages' own fresh builds).

### File List

**Created:**
- `packages/shared-types/src/event-category-definitions.ts`
- `apps/backend/src/lib/ai-gateway/render-event-category-glossary.ts`
- `apps/backend/src/lib/ai-gateway/render-event-category-glossary.test.ts`
- `apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts`
- `apps/backend/src/lib/ai-processor/event-category-golden-corpus.fixtures.ts`
- `apps/backend/src/lib/ai-processor/event-category-golden-corpus.live-eval.test.ts`

**Modified:**
- `packages/shared-types/src/index.ts`
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts`
- `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`
- `apps/backend/src/lib/ai-processor/process-ai-job.ts`
- `apps/backend/src/lib/ai-processor/process-ai-job.test.ts`
- `packages/domain/src/events/transform-gemini-response-to-event-info.ts`
- `packages/domain/src/events/transform-gemini-response-to-event-info.edge-cases.test.ts`
- `apps/backend/src/schema/events.graphql`
- `packages/database/schema.ts`
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`
- `_bmad-output/project-context.md`
- `_bmad-output/implementation-artifacts/0-52-build-the-event-category-definitions-source-renderer-and-ratchet.md` (this story file: frontmatter, Pre-Coding Approval Gate, Tasks/Subtasks, Testing Requirements, Completion Status, Dev Agent Record, Status)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (status transitions)
