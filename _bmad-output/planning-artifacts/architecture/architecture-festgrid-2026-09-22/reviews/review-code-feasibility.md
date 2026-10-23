---
title: AD-44 code-level feasibility review
reviewer: independent senior code reviewer (read-only walk of the real code)
date: 2026-10-23
subject: Architecture Spine AD-44 (spine lines 2454-2530), planned as S1 (definitions constant + both prompts + ratchet) and S2 (HOME_AND_LIVING + FASHION_AND_BEAUTY across every source)
repo-state: master at 5ff986fb (docs-only commits since the AD was written; no code touched)
---

# AD-44 code-level feasibility review

## 0. Verdict

The mechanism is feasible and needs no new package, dependency or boundary exception. As written, AD-44 has no critical defects but five high-severity gaps that would let S2 ship with silent drift or let S1 ship a ratchet that is either unimplementable or vacuous:

1. Rule 5 claims "the 0.34 consistency tests must fail if any is missed". They guard only two of the nine sources it lists.
2. Rule 5's ripple list omits hand-maintained sources (`packages/database/schema.ts` pgEnum, `seed-volume.ts`, four duplicate comment-definitions, migration `meta/`).
3. The Rule 3 ratchet, read literally ("builds its category list from anything but this constant"), would flag legitimate uses. Both prompt files and two AJV schemas use `Object.values(EventCategory)` for structured-output `enum:`.
4. Two prompts rendering `NAME — definition` independently will drift in format; a single renderer is required.
5. S1 definitions cannot reference S2's new values (Rule 4 cross-references), and S1 is not behaviour-neutral (it widens `TECHNOLOGY` and narrows `BUSINESS_AND_NETWORKING` for live extraction).

Recommended placement: keep the constant in `packages/shared-types` as Rule 3 says (it works), put the single renderer and the ratchet in `apps/backend`, and add cheap consistency tests so Rule 5's claim becomes true (section 8).

---

## 1. Complete inventory (every place EventCategory is declared, enumerated, validated, translated, filtered, stored, seeded or tested)

Search method: `grep -rIn` for `EventCategory`, `event_category`, `ARTS_AND_CULTURE`, `AUTOMOTIVE`, `CIVIC_AND_COMMUNITY`, and category display labels across `apps/`, `packages/`, `docs/`, `design-artifacts/`, `_bmad-output/`, `scripts/`, `.github/`, e2e and visual-audit. Excluded: `node_modules`, `.next`, `dist`, `packages/database/migrations/meta/*_snapshot.json`.

Legend. Kind: **H** = hand-maintained list, **G** = generated, **D** = derived from the enum at runtime (adds itself), **T** = test. "Silent if missed" means adding two values and forgetting this source produces no CI failure and no obvious runtime error. "Rule 5?" = named in AD-44 Rule 5.

### 1a. Declarations (a new value must be typed in by hand)

| # | Source | Evidence | Kind | Silent if missed? | Rule 5? |
|---|--------|----------|------|-------------------|---------|
| D1 | TS enum `EventCategory` | `packages/shared-types/src/index.ts:32-51` (OTHER last at :50) | H, canonical | No: everything derived from it changes; but nothing forces the other H rows | Yes |
| D2 | GraphQL SDL enum | `apps/backend/src/schema/events.graphql:41-60` (OTHER at :59) | H | No: `schema-consistency.test.ts:39-43` fails on set mismatch (backend, needs DB harness in CI) | Yes |
| D3 | Web codegen output (enum, PascalCase keys, alphabetised) | `apps/web/src/generated/graphql.ts:318-337`; committed (`git ls-files`) | G | **Yes.** No test compares it. CI regenerates it in `turbo build` (turbo.json `build.dependsOn: ["^build","codegen"]`) but never diffs it against the commit | Yes ("codegen") |
| D4 | Backend codegen output (`enumsAsTypes: true`, string union) | `apps/backend/src/generated/resolvers-types.ts:297-315`; codegen config `apps/backend/codegen.ts` | G | **Yes** (same as D3). Type-only, so a stale union is a latent type error, not a runtime one | Yes ("codegen") |
| D5 | `next-intl` labels, en | `apps/web/locales/en.json:533-552` | H | No: `locales.test.ts:37-41` (`arrayContaining`) fails | Yes |
| D6 | `next-intl` labels, id | `apps/web/locales/id.json:533-552` | H | No, transitively: `locales.test.ts:19-23` requires id keys == en keys | Yes |
| D7 | Drizzle pgEnum `event_category` | `packages/database/schema.ts:54-60` (hand array; unused by any column: the column is `text('categories').array()` at :438; index :472) | H | **Yes.** No test; `drizzle-kit generate` would emit the migration, but nobody is forced to run it | **No** (Rule 5 names "the `ADD VALUE` migration" but not the pgEnum it is generated from) |
| D8 | Migration SQL | `packages/database/migrations/0000_cultured_ultragirl.sql:2` (CREATE TYPE), `0003_strong_stark_industries.sql`, `0038_smooth_switch.sql` (precedent: five `ADD VALUE IF NOT EXISTS ... BEFORE 'OTHER'` lines). Latest is `0080_loving_doctor_octopus.sql` | H (hand-adjusted drizzle-kit output) | **Yes** (type is unused, so prod never notices) | Yes |
| D9 | Migration bookkeeping | `packages/database/migrations/meta/_journal.json` (last idx 80) and a new `meta/0081_snapshot.json` | G (drizzle-kit) | Yes | **No** |
| D10 | PRD interface block | `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md:358-377` (CLAUDE.md makes the PRD mandatory reading) | H | **Yes** | Yes |
| D11 | Seed fixtures (event rows) | `packages/database/seed.ts:770-927` (12 `categories:` literals, only 5 distinct values; untyped strings) | H | **Yes**; nothing validates seed category strings against the enum | Yes ("a seed fixture") |
| D12 | Volume seed list | `packages/database/seed-volume.ts:99` (`CATEGORIES`, 8 hand-typed values), used at :198 | H | Yes (benign: a subset) | **No** |
| D13 | Duplicate "definitions" as code comments | `shared-types/src/index.ts:42-49`, `events.graphql:53-58`, `schema.ts:47-52`, `prd.md:370-375` | H (prose) | **Yes**, and they go stale: e.g. `TECHNOLOGY` is commented "Tech product promos, hackathons, tech meetups/conferences" in all four, contradicting AD-44's widened definition | **No** |
| D14 | Project docs stating the count | `_bmad-output/project-context.md:86` ("20 values", "a ratchet test enforces it"), spine AD-44, spine AD-42 Rule 7 on the planning branch ("18 values", per AD-44 Deferred) | H (prose) | Yes | Partly |

### 1b. Enumerations that derive from the enum (adding values updates them automatically; no edit needed)

| # | Source | Evidence | Kind | Notes |
|---|--------|----------|------|-------|
| E1 | Extraction prompt allowed list (names only) | `apps/backend/src/lib/ai-processor/build-gemini-request.ts:199` (`allowedCategories`), rendered at :223 | D | **The S1 target.** Prompt sees names only |
| E2 | Extraction structured-output schema `enum:` | `build-gemini-request.ts:27` | D | Must stay `Object.values(EventCategory)`; not a "category list" in the AD sense |
| E3 | Filter prompt allowed list (names only) | `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts:19` | D | **The second S1 target** |
| E4 | Filter structured-output schema `enum:` (unrolled 3 levels, appears 7 times) | `build-filter-extraction-request.ts:82` | D | +2 values x 7 = 14 extra enum strings; negligible |
| E5 | AJV extraction validation | `apps/backend/src/validation/extracted-event.schema.ts:49` | D | |
| E6 | AJV correction validation | `apps/backend/src/validation/proposed-event-correction.schema.ts:47` | D | |
| E7 | Response -> EventInfo (unknown values filtered, empty falls back to `OTHER`) | `packages/domain/src/events/transform-gemini-response-to-event-info.ts:28-31` | D | |
| E8 | Response -> filter | `packages/domain/src/ai-event-filters/transform-gemini-response-to-event-filter.ts:59-60` | D | |
| E9 | Filter tree zod schema (`z.nativeEnum`, `.max(length)`) | `packages/domain/src/ai-event-filters/filter-node-schema.ts:96` | D | |
| E10 | Type-only uses | `domain/src/events/types.ts:131,228`; `ai-event-filters/filter-node.ts:44`; `flat-filter-conversion.ts:28`; `render-ai-filter-summary.ts:81`; `summary-clause-formatters.ts:41`; `map-extraction-payload-to-proposed-correction.ts:36` | D | |
| E11 | Web FilterHub options and labels | `home-content.tsx:156,201`; `feed-content.tsx:80,128`; `favorites-content.tsx:116,164`; `account-content.tsx:76,119`; `archive-content.tsx:52` (labels only); `EventDetailWrapper.tsx:76` | D | Each file has its own try/catch `buildEnumLabels` that **hides** a missing locale key (falls back to the raw enum string); only `locales.test.ts` stands behind it |
| E12 | Correction dialog options | `apps/web/src/features/events/correction-dialog.tsx:8,68` | D but from the **generated** enum (`@/generated/graphql`) | A stale D3 silently drops the new options here only. Option order is alphabetical, unlike the other facets |
| E13 | UI package | `packages/ui/src/features/events/CorrectionForm.tsx:5,36,292`; `FilterHub.tsx` | D (options come in as props) | |
| E14 | Filter facet storage | `events.categories text[]` (`schema.ts:438`), partial index `event_categories_idx` (:472); `widgets.filters` and saved AI filters are jsonb | n/a | Adding a value needs no data change. Removing one does (Rule 6) |
| E15 | GraphQL usage sites | `events.graphql:118,291,318`; `extraction.graphql:27`; `corrections.graphql:34` | n/a | They reference the enum type; no list |

### 1c. Tests, fixtures, tooling

| # | Source | Evidence | What it does for 20 values |
|---|--------|----------|----------------------------|
| T1 | Locale coverage | `apps/web/locales/locales.test.ts:37-41` | Fails until en keys exist (good). Uses `arrayContaining`, so **stale extra keys are never detected** |
| T2 | SDL vs enum | `apps/backend/src/schema/schema-consistency.test.ts:39-43` | Fails until SDL updated (good). Does not read the generated files |
| T3 | Golden-prompt fixtures | `packages/domain/src/ai-event-filters/golden-prompts/golden-prompt-fixtures.ts:1893,1968,2346,2373` | Only `ARTS_AND_CULTURE` appears in expected outputs; no prompt mentions fashion/home/gadget words (grep). Fixtures feed canned responses; the suite is model-free |
| T4 | Incidental fixtures using `MUSIC`/`OTHER`/`FAMILY_AND_KIDS` | `process-ingestion-job.test.ts`, `build-event-insert-values*.test.ts`, `ai-event-filters.test.ts:215,241`, `transform-gemini-response-to-filter-expression.test.ts`, `CorrectionForm.test.tsx`, e2e `filter.spec.ts`, `locale.spec.ts`, `event-correction.spec.ts:83` | Unaffected |
| T5 | Seed integration | `packages/database/seed.integration.test.ts:69-87` (`FIXTURE_COUNTS` pinned to fixture array lengths; each event must join exactly one post) | A new event fixture also needs a post and schedule (see M5) |
| T6 | `apps/web/fix-codegen.js:22,100` | Strips a duplicate `export type EventCategory = ...` and patches `ProposedEventCorrectionInput`; contains **no value list** | No change needed (see section 6) |
| T7 | `apps/backend/src/explain-events-queries.ts:319` | Uses `EventCategory.MUSIC` | Unaffected |
| T8 | visual-audit manifests, `scripts/`, `.github/workflows`, `apps/infrastructure`, `docs/infrastructure` | grep: no category lists | Nothing to change. CLAUDE.md section 4 (architecture diagram upkeep) is **not** triggered: no service, queue, Lambda, scraper, database, host or major library changes |
| T9 | Prose mentions (examples only) | `design-artifacts/D-Design-System/01-event-list-view.md:23`, `C-UX-Scenarios/.../01.1-event-discovery.md:23`, `UX-festgrid-run-1/EXPERIENCE.md:86,92` | Examples of labels, not enumerations; no update required |

### 1d. Not named by Rule 5 (the list the caller asked for)

D7 (pgEnum in `schema.ts`), D9 (migration `meta/`), D12 (`seed-volume.ts`), D13 (four duplicate comment-definitions), E12 (correction dialog consuming the generated enum), and the fact that D3/D4 have no freshness check. Also not mentioned: that `locales.test.ts` cannot detect stale extra keys (T1) and that the `buildEnumLabels` try/catch (E11, five copies) converts a missing key into a raw token on screen.

---

## 2. Package-dependency feasibility and placement of the constant

### Facts

- `packages/shared-types` is **not** types-only. `package.json` has `main`/`types` -> `./src/index.ts`, no `exports` map, no `build`, no `test` script, only `lint`. `src/index.ts` is one 212-line file and already ships runtime enums (`EventType` :17, `EventCategory` :32) that the web client imports as values (`Object.values(EventCategory)` in `home-content.tsx` etc.). It has zero dependencies and no functions today.
- Importers (grep `package.json`): `packages/domain` (dependency), `packages/ui`, `apps/web`, `apps/backend`, `packages/database`. Therefore a `Readonly<Record<EventCategory,string>>` in shared-types is reachable from backend prompt builders with no new edge and no boundary exception.
- `packages/domain` rules (project-context.md:156-160): no React, no DB/ORM, no Node-only deps. A plain string record satisfies these. Domain's `.c8rc.json` demands 100% lines/branches/functions with `all: true`; a const object has no branches and is counted once any test imports its barrel (`src/public-api.test.ts` loads every `index.ts`).
- Precedent for prompt text living in `packages/domain`: `packages/domain/src/scraper/account-classification.ts:26` and `account-enrichment.ts:60` build Gemini `systemInstruction` strings. Precedent for the database schema deriving pgEnums from domain constants: `schema.ts:93,103,104,611` (`pgEnum('...', POST_GROUPING_REASONS)` etc.).
- Only two prompts list categories: `build-gemini-request.ts` (called by `process-ai-job.ts:129` and `process-manual-extraction-job.ts:76`; the re-extraction preview goes through one of those) and `build-filter-extraction-request.ts` (called by `schema/resolvers.ts:390` and `scripts/run-golden-prompt-live-eval.ts:128`). `account-classification`, `account-enrichment` and `build-correction-classification-text` do not list categories.
- Backend `tsc` build (`"build": "tsc"`, `include: ["."]`) type-checks imported shared-types source, so a missing key in a `Record<EventCategory,string>` fails `pnpm run build` in CI. This compile-time exhaustiveness is the strongest ratchet and works in either location. Nothing type-checks shared-types on its own (no tsconfig-driven script runs there), so the guarantee is transitive.

### Recommendation

Place `EVENT_CATEGORY_DEFINITIONS` in `packages/shared-types` (new file `src/event-category-definitions.ts`, re-exported from `src/index.ts` because `main` is the index), as AD-44 Rule 3 and project-context.md:86 already say. Evidence for keeping it there: locality with the enum (a reviewer adding a member sees the neighbouring record fail to compile), zero new dependency edges, already-proven runtime use by web and backend, and a stable import path (`@festgrid/shared-types`) that the ratchet and both builders can use.

Put the **renderer** (one pure function) and the **ratchet test** in `apps/backend`, not in shared-types, because shared-types has no test runner and both prompt builders live in the backend. Suggested files: `apps/backend/src/lib/ai-gateway/render-event-category-definitions.ts` (+ colocated `.test.ts`) and `apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts` (same location style as `lib/vendor-gateway/no-vendor-call-bypasses-wrapper.ratchet.test.ts`).

`packages/domain/src/events` is a defensible alternative (it brings the 100%-coverage gate, `tsx --test`, and the existing cross-package scanning ratchet precedent `filter-consumer-no-bypass.ratchet.test.ts`). Choose it only if the owner wants the renderer unit-tested under the domain gate. It deviates from the AD's "beside the enum" wording and from the existing cross-reference in project-context.md:86, so it costs two doc edits for no functional gain.

Cautions regardless of location:
- The definitions are English, LLM-facing text. Add a header comment forbidding use in UI (project-context.md:143 requires every user-facing enum string to go through `next-intl`). Otherwise someone will render them as tooltips.
- shared-types has no `sideEffects` flag. The record is only included in a client chunk if some web module imports it; today none would. Low impact (about 3 KB if it ever were).
- Do not export a function from shared-types; keep it data-only so the package stays dependency- and logic-free.

---

## 3. How each prompt would render the definitions; size and pinning

### Current rendering

- Extraction (`build-gemini-request.ts:199,223`): `3. categories: select appropriate values from this allowed list: ${allowedCategories}.` where the list is the 18 names joined with `, `.
- Filter (`build-filter-extraction-request.ts:19`): `- categories: optional array of EventCategory strings: ${Object.values(EventCategory).join(', ')}.` inside a dash-bulleted field list.

### Proposed rendering (one renderer, two call sites)

`renderEventCategoryDefinitions(): string` returns the lines in enum declaration order, one per value, each `  - NAME -- definition` (see Format note). Extraction item 3 becomes:

```
3. categories: select every value that fits, using only the values below, each given as NAME -- definition:
${block}
```

The filter field line becomes `- categories: optional array of EventCategory strings; allowed values, each given as NAME -- definition:` followed by the same block, indented under the bullet. The filter prompt keeps its "NOT FILTERABLE" paragraph untouched.

Format note: the existing prompts use ASCII `--` in prose (for example "or -- the most common real-world case"). Rule 3's `NAME — definition` uses U+2014. Either works for the model, but the separator must be defined once inside the renderer so the ratchet can assert the exact rendered line instead of re-typing it. Recommend ASCII ` -- ` for consistency, or keep the em dash and let only the renderer know.

### Size

- Extraction instruction is about 12 KB (lines 203-252 measured at 12,074 chars including template code, roughly 3,000 tokens). Filter instruction is about 4.6 KB (about 1,150 tokens). Both measurements are estimates; the backend could not be run here (`@festgrid/domain` dist is not built in this sandbox).
- 20 entries at 120-220 chars is 2.4-4.4 KB, minus the removed bare-name line (about 0.4 KB): about +0.5 to +1.0K tokens per call. That is roughly +20-35% on the extraction instruction and +45-85% on the filter instruction. In absolute terms it is small next to image tokens on an extraction call, and the filter path is user-interactive but rate-limited (`prompt-filter-rate-limit-store.ts`).
- Keep the block **before** the `${publishDate}` interpolation (which sits late in the extraction template) so any provider-side implicit prefix caching still sees a stable prefix, and keep the renderer deterministic (declaration order, no dates, no randomness).
- The extraction call uses the lighter `geminiModel`; the filter call uses a dedicated `geminiFilterModel` (resolvers.ts:398-400 comment: the lite model hallucinated on vague prompts). A longer filter prompt is more likely to help than hurt; the nightly eval will show.

### Does anything pin the prompt text?

No. Checked: no `toMatchSnapshot`/inline snapshot anywhere in `apps/` or `packages/`. The only prompt-text assertions are substring checks: `build-gemini-request.test.ts:35` (`includes('PERFORMANCE')`, an EventType), `:108-110, :162-164, :178-179, :304-307, :351-362, :390-400` (rule phrases), and `build-filter-extraction-request.test.ts:9-15` (`assert.match(/NOT KEEPS it/)`). None mention a category name. The golden-prompt suite (`golden-prompt-fixtures.ts`) feeds canned `geminiResponse` objects into `transformGeminiResponseToFilterExpression` and never calls a model, so it is not prompt-pinned. `parser-versions.ts` / `parser_version_registry` track the **scraper parser** (Instagram/Bright Data record mapping), not the Gemini prompt. `write-extraction-audit-log.ts` records `geminiModel` but no prompt hash or version. The CC-024 reference posts are an opt-in live regression (`build-gemini-request.live-cc024-regression.test.ts`, gated by `RUN_LIVE_GEMINI_TESTS=true`); they check grouping reason and event count, not categories.

Consequence: a prompt change is not caught by any deterministic gate; the only behavioural signals are the nightly live golden eval (`.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`, ~20 free-tier requests a night, ledger picks "new fixtures, then last night's drift, then the stalest") and the opt-in CC-024 run. S1 and S2 acceptance criteria should each require one manual `workflow_dispatch` of the nightly eval and one CC-024 run after merge, with the results written into the story.

---

## 4. Is the ratchet mechanically implementable in this repo's style?

Yes, but not as the literal one-line wording. Existing style (`filter-consumer-no-bypass.ratchet.test.ts`, `no-vendor-call-bypasses-wrapper.ratchet.test.ts`, `explicit-any.ratchet.test.ts`, `account-url-ratchet.test.ts`): `node:test` + `node:assert`, a regex source scan over non-test, non-generated `.ts` files, a reasoned allowlist, positive confirmations that the scan is not vacuous, and negative controls on the regexes themselves. Backend ratchets resolve paths from `process.cwd()`; the domain one climbs from `import.meta.url`.

### Why the literal wording fails

"Fails if either prompt builds its category list from anything but this constant" cannot be a regex ban on `Object.values(EventCategory)`: the same two files legitimately use it for the structured-output enum (E2 `build-gemini-request.ts:27`, E4 `build-filter-extraction-request.ts:82`), and the AJV schemas do too (E5, E6). A ban would fail on day one; an allowlist of those lines would be exactly the kind of brittle line-number allowlist the repo avoids.

### Recommended design (render-and-assert, plus a scoped source scan)

File: `apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts`.

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventCategory, EventType, EVENT_CATEGORY_DEFINITIONS } from '@festgrid/shared-types';
import { renderEventCategoryDefinitions } from './render-event-category-definitions.js';
import { buildFilterExtractionSystemInstruction } from '../ai-event-filters/build-filter-extraction-request.js';
import { buildGeminiExtractionRequest } from '../ai-processor/build-gemini-request.js';

const MEMBERS = Object.values(EventCategory);

// Check A: exhaustive, non-empty, bounded, no extras
test('every EventCategory has exactly one non-empty, bounded, single-line definition', () => {
  assert.deepEqual(Object.keys(EVENT_CATEGORY_DEFINITIONS).sort(), [...MEMBERS].sort());
  for (const c of MEMBERS) {
    const d = EVENT_CATEGORY_DEFINITIONS[c];
    assert.ok(d.trim().length > 0, c);
    assert.ok(d.length <= MAX_DEFINITION_CHARS, c);   // e.g. 280
    assert.ok(!/\n/.test(d), c);
  }
});

// Check B: a definition may only name real categories/types (catches S1 naming S2 values early, and renames/typos)
test('underscored ALL_CAPS tokens inside definitions are real EventCategory or EventType members', () => {
  const known = new Set<string>([...MEMBERS, ...Object.values(EventType)]);
  for (const c of MEMBERS)
    for (const tok of EVENT_CATEGORY_DEFINITIONS[c].match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g) ?? [])
      assert.ok(known.has(tok), `${c} references unknown token ${tok}`);
});

// Check C: both prompts contain the renderer output verbatim (behavioural, not syntactic)
// Check D: outside that block, neither prompt names >= 3 distinct categories (catches a second, name-only list in any format)
test('both prompts render the shared block and carry no other category list', async () => {
  const block = renderEventCategoryDefinitions();
  const filter = buildFilterExtractionSystemInstruction();
  const { request } = await buildGeminiExtractionRequest(MESSAGE);   // same minimal message used in build-gemini-request.test.ts Case A
  for (const prompt of [filter, request.systemInstruction ?? '']) {
    assert.ok(prompt.includes(block));
    const rest = prompt.split(block).join('');
    const stray = MEMBERS.filter((c) => new RegExp(`\\b${c}\\b`).test(rest));
    assert.ok(stray.length < 3, `stray category names outside the shared block: ${stray.join(', ')}`);
  }
});

// Check E: scoped source scan (backend src + packages/domain/src), non-test, non-generated
//   offender if text matches /Object\.(values|keys)\(\s*EventCategory\s*\)\s*\.\s*(join|map|reduce)\b/
//   or contains >= 4 distinct EventCategory names as bare/quoted tokens and is not on the (initially empty) reasoned allowlist
// Check F: positive confirmation: build-gemini-request.ts and build-filter-extraction-request.ts both import renderEventCategoryDefinitions
// Check G: negative controls on the two regexes (a synthetic `.join(', ')` is flagged; a bare `enum: Object.values(EventCategory)` is not)
```

Notes on feasibility: `buildGeminiExtractionRequest(message)` is already called text-only with a minimal `ProcessingJobMessage` in `build-gemini-request.test.ts:23-35`, so no network or image mocking is needed. The backend suite needs Postgres in CI because it runs under the row-count harness (`run-tests-with-row-count-ratchet.ts`), but this test writes no rows.

### False-positive risks

- A future legitimate `Object.values(EventCategory).map(...)` in backend code (for example building a schema) trips Check E's regex. Mitigation: the regex is limited to `.join/.map/.reduce` on the raw enum **and** the allowlist mechanism ("can only shrink", each entry with a reason), as in the z-index and schedule-time ratchets.
- The "4 distinct names" cluster detector (Check E) would trip on seed-style files. Scope it to `apps/backend/src` and `packages/domain/src`; `seed.ts`, `seed-volume.ts` and `schema.ts` are in `packages/database` and out of scope. Verified: in those two scopes no non-test file currently holds 4 category names.
- Check B: acronyms like `DIY`, `B2B`, `UMKM` are not underscored, so they are not matched. Single-word members (`MUSIC`, `OTHER`) written in a definition are not checked; acceptable.
- Check D: the filter prompt's few-shot examples contain no category names today. If a future example uses one, the `< 3` threshold absorbs it.

### False-negative risks

- A third prompt placed outside the scanned roots (a script in `apps/backend/scripts/`, a new package) is invisible. Mitigation: also scan `apps/backend/scripts` and `packages/*/src` for `systemInstruction`, and require any file that both contains `systemInstruction` and mentions `EventCategory` to import the renderer.
- A category list in prose (for example "music, arts, food") without enum tokens is undetectable by any scan. Check D only sees enum tokens.
- Check C proves the block is present, not that Gemini follows it. No deterministic test can.
- A dev renders the block but wraps the definitions in a second, stale copy inside the same prompt: Check D catches the name echo; a copied sentence without names does not trip it.
- Compile-time exhaustiveness (`Record<EventCategory,string>`) catches a missing key; the runtime test catches only empty strings and extras. Both are needed.

---

## 5. Backend and web test impact of going 18 -> 20

- **Nothing asserts a count of 18.** Searched test files for 18 near category/enum/length: no hits except an unrelated slide count. Nothing pins a list of category names except the two consistency tests below.
- Fail-until-fixed (good): `apps/web/locales/locales.test.ts:37-41` (en keys) and `:19-23` (id mirrors en); `apps/backend/src/schema/schema-consistency.test.ts:39-43` (SDL vs enum).
- Auto-adjusting: `filter-node-schema.ts:96` (`.max(length)`); `seed.integration.test.ts` `FIXTURE_COUNTS` (derived from array lengths); AJV enums.
- Unchanged: golden-prompt fixtures (model-free); `build-gemini-request.test.ts` and `build-filter-extraction-request.test.ts` substring checks; domain, UI and e2e tests using `MUSIC`/`OTHER`/`FAMILY_AND_KIDS`.
- Coverage gate: a new file in `packages/domain` would have to be 100% covered; the recommended placement (shared-types constant + backend renderer) adds nothing under that gate.
- Row-count ratchet (project-context.md:178): the new tests write no rows. A new seed event row does not affect it (seed runs before the baseline snapshot).
- New tests this work should add are listed in section 8.

---

## 6. Codegen pipeline

- Two independent outputs, both committed: `apps/web` (`pnpm --filter web codegen` = `graphql-codegen --config codegen.ts && node fix-codegen.js`; plugins typescript, typescript-operations, typescript-react-query; **enum**, alphabetical, PascalCase member names) and `apps/backend` (`pnpm --filter backend codegen`; `enumsAsTypes: true`, so a string-literal union). Both read `apps/backend/src/schema/*.graphql`. Adding two SDL values changes exactly two lines per file (web: `FashionAndBeauty = 'FASHION_AND_BEAUTY'`, `HomeAndLiving = 'HOME_AND_LIVING'`; backend: two union members). Review the diff to confirm nothing else moved.
- `fix-codegen.js` needs **no** change: line 22 strips a duplicate `export type EventCategory = ...;` that the current output does not even contain (the web file emits only `export enum EventCategory`, :318), and line 100 patches `ProposedEventCorrectionInput`, which references the type but not its values. After regenerating, confirm `fix-codegen.js` is a no-op for `EventCategory` (no `export type EventCategory` remains and the enum is present once).
- CI behaviour: `turbo build` depends on `codegen`, so CI regenerates both files before building. Result: a forgotten codegen run does **not** fail CI, and a stale committed file is silently replaced in the CI workspace but stays stale in the repo. The web correction dialog consumes the generated enum (`correction-dialog.tsx:8,68`), so stale committed output affects local runs and any deploy path that does not run codegen.
- Cheap fix, in the 0.34 style: a web Vitest case importing `EventCategory as GeneratedEventCategory` from `@/generated/graphql` and comparing `Object.values` to shared-types (sets equal); and a type-level assertion in `schema-consistency.test.ts` that the backend generated union equals `` `${EventCategory}` `` (compiled by backend `tsc`, whose `include` is `["."]`).
- Ordering note: `codegen` needs only the SDL, so S2 can regenerate before or after the locale edits; the order does not matter for correctness.

---

## 7. Findings by severity

### Critical
None. The mechanism works with existing packages and conventions.

### High

**H1. Rule 5 over-claims what the 0.34 tests catch.**
Evidence: `locales.test.ts:37-41` and `schema-consistency.test.ts:39-43` are the only two category guards. Not guarded: generated web enum (D3), generated backend union (D4), pgEnum (D7), migration (D8) and its `meta/` (D9), PRD block (D10), seed fixtures (D11). The 0.34 story itself says generated output is "a build-process concern" and "not something this story's tests need to check" (story 0.34 Dev Notes), and CI's `turbo build` regenerates rather than checks.
Effect: S2 can merge with six of nine sources stale and CI green.
Fix wording for Rule 5, last sentence: "The 0.34 tests plus the checks added by Story 2 fail if any of the following is missed: shared-types, SDL, both generated outputs, both locale files, the `schema.ts` pgEnum, a migration naming each pgEnum value, the definitions constant, and every seed `categories` string. The PRD block and prose comments are reviewed by hand and listed in the story's checklist."

**H2. Rule 5's ripple list omits hand-maintained sources and creates a second definitions source in comments.**
Evidence: D7 (`schema.ts:54`), D9, D12 (`seed-volume.ts:99`), D13 (four comment copies of the old one-line definitions). `TECHNOLOGY`'s comments ("Tech product promos, hackathons, tech meetups/conferences") contradict the widened definition and sit in the files a reader opens first. AD-44's "One definitions source" promise is false while four prose copies remain.
Fix wording: add to Rule 3: "The per-value comments in `shared-types`, `events.graphql`, `schema.ts` and the PRD block are replaced by `// see EVENT_CATEGORY_DEFINITIONS` (or removed); they are not definitions."

**H3. The ratchet as worded is unimplementable and, implemented naively, vacuous.**
Evidence: section 4. Both prompt files use `Object.values(EventCategory)` for response-schema `enum:` (E2, E4), and E5/E6 do likewise.
Fix wording for Rule 3, last sentence: "A ratchet test fails if (a) any `EventCategory` member lacks a non-empty, bounded definition or the record has extra keys, (b) a definition names an underscored token that is not an `EventCategory` or `EventType` member, (c) either prompt, as built, does not contain the shared renderer's output verbatim, or (d) outside that block either built prompt names three or more distinct `EventCategory` values. Structured-output `enum:` lists remain `Object.values(EventCategory)`."

**H4. The two prompts need one renderer, not two copies of a template.**
Evidence: the two builders already differ in shape (a numbered list item at `build-gemini-request.ts:223` and a dash-bullet field at `build-filter-extraction-request.ts:19`). Two inline `.map(c => `${c} — ${d}`)` calls will drift (separator, ordering, blank lines) and the ratchet would have to hard-code both.
Fix wording: "Both prompts call the single `renderEventCategoryDefinitions()`; the NAME/definition separator is defined only there."

**H5. S1 and S2 cannot share Rule 4's text, and S1 is a live behaviour change.**
Evidence: Rule 4 text names `HOME_AND_LIVING` in `TECHNOLOGY`, `BUSINESS_AND_NETWORKING` (property) and plants-as-décor boundaries. If S1 ships those sentences, the model is told to use a value its structured-output `enum` does not contain (it will pick something else, or `transformGeminiResponseToEventInfo` drops it). Also S1 widens `TECHNOLOGY` (gadgets) and tightens `BUSINESS_AND_NETWORKING` (professional/trade audience) for all new extractions, before any new category exists.
Fix wording: "Story 1 writes definitions that are correct for the 18 values and names only existing values; Story 2 amends `TECHNOLOGY`, `BUSINESS_AND_NETWORKING`, `HOBBIES_AND_INTERESTS` and `AUTOMOTIVE` with the cross-references and adds the two new entries. Story 1's interim effect (a consumer furniture bazaar tags `OTHER`/`HOBBIES_AND_INTERESTS` until Story 2) is accepted."

### Medium

**M1. Rule 3 "one sentence per value, including exclusions" collides with Rule 4's content.** `BUSINESS_AND_NETWORKING` (professional audience, trade expos, franchise, UMKM matching, investor seminars, property, plus the "carries it as well only when a trade purpose is stated" clause) and `FASHION_AND_BEAUTY` (menswear, womenswear, streetwear, sneakers, barbershop, grooming, skincare, cosmetics) are long. Fix: "one to two sentences, at most 280 characters" and enforce the cap in Check A so the prompt budget (section 3) stays measurable.

**M2. Generated outputs have no freshness check (section 6).** Add the two comparison tests; cost is a few lines each.

**M3. `project-context.md:86` already states "20 values" and "a ratchet test enforces it" before either story ships.** Agents reading it today are told something false (repo has 18, no ratchet). Fix: reword to "18 today; 20 after AD-44 story 2" and flip it in the S2 change; or add "[planned]" until S1 merges.

**M4. A seed fixture is not a one-line change.** `seed.ts` events are tied to posts by array index (`postId: FIXTURE_POSTS[31].id`) and `seed.integration.test.ts:87` requires one post join per event, plus schedules. Adding an event means a post, a schedule, appended (not inserted) indices, and any date-window-sensitive test must still pass. Safer: append `'HOME_AND_LIVING'` / `'FASHION_AND_BEAUTY'` to the `categories` of two existing fixture events (for example the Pakuwon Mall fixtures at `seed.ts:885-925`), and add a seed-integrity check that every `FIXTURE_EVENTS[*].categories` entry is an `EventCategory` member (seed strings are untyped today). Rule 5 should say "an existing fixture's categories" unless the owner explicitly wants a new event row.

**M5. pgEnum is a hand copy where the repo has a derivation precedent.** `schema.ts:93,103,104,611` build pgEnums from domain constants. `eventCategoryEnum` could be `pgEnum('event_category', Object.values(EventCategory) as [EventCategory, ...EventCategory[]])` (shared-types is already imported at `schema.ts:4`), removing D7 as a drift source. Caveats: `drizzle-kit generate` still emits a snapshot/journal pair and its `ADD VALUE` needs the hand adjustment to `IF NOT EXISTS ... BEFORE 'OTHER'` (precedent `0003`, `0038`); keep OTHER last. If the owner prefers not to touch the schema loader, keep the hand array and add the pgEnum-vs-enum test instead (section 8).

**M6. Definitions are English, the corpus is Indonesian.** Gemini handles mixed language, but recall for `HOME_AND_LIVING` and `FASHION_AND_BEAUTY` improves with bilingual cue words (for example "perabot, dekorasi, rumah tangga", "busana, kosmetik, perawatan kulit, barbershop"). Add this to the definition-writing guidance in Rule 3; it also fits the 280-char cap if used sparingly.

**M7. Prompt-change verification is manual.** Nothing deterministic gates prompt quality (section 3). Require one `workflow_dispatch` of the nightly golden eval and one opt-in CC-024 run in each story's DoD, with results pasted into the story record. Consider adding two golden fixtures for the filter prompt ("promo gadget", "pameran furnitur") in S2 so the nightly ledger picks them up first ("new fixtures" rank first).

### Low

**L1. Client bundle.** No `sideEffects` flag on shared-types; the record is dropped by tree-shaking when unimported and is about 3 KB if included. No action beyond the "never render in UI" comment.

**L2. `buildEnumLabels` fallback (five copies) hides a missing locale key at runtime.** Out of scope for AD-44; the locale test is the guard. `locales.test.ts` should also assert key-set **equality** (not `arrayContaining`) so stale keys after a future removal are caught.

**L3. Deploy skew.** If the backend (new extraction output) deploys before the web bundle with new locale keys, a card briefly shows the raw token `HOME_AND_LIVING`. CI orders `db-migrate` before `deploy-infrastructure`; web and API are separate deploys. Accepted risk: new tags only exist on newly extracted events (Rule 7, no backfill).

**L4. Facet size.** 20 chips is fine; Rule 8's "revisit at 24" has no mechanical trigger. Optional: a one-line assertion `Object.values(EventCategory).length <= 24` whose failure message points at the grouping review.

**L5. Removed-value protection is prose only (Rule 6).** No test prevents deleting a member that stored rows still carry; acceptable because nothing is removed by this AD.

**L6. Rule 1's naming constraints (no catch-all names, no form-named categories) are not mechanically enforced.** A denylist regex test (`LIFESTYLE|GENERAL|MISC|SHOPPING|PROMO|MARKET|TOOL$`) would be cheap but is of marginal value with a single owner approving each addition; mention only.

---

## 8. Recommended file-change list per story

### Story 1 (S1): definitions source, renderer, both prompts, ratchet

Create:
- `packages/shared-types/src/event-category-definitions.ts` exporting `EVENT_CATEGORY_DEFINITIONS: Readonly<Record<EventCategory, string>>` (18 entries, English, 1-2 sentences, at most 280 chars, bilingual cue words, no references to values that do not exist yet; header comment: LLM-facing, never rendered in UI). Import `EventCategory` from `./index`; to avoid a cycle, either define the record in `index.ts` below the enum or import the enum type via a small `enums.ts`. Simplest: add it to `index.ts` directly beside the enum (the AD's "beside the enum" read literally) and skip the new file.
- `apps/backend/src/lib/ai-gateway/render-event-category-definitions.ts` (+ `.test.ts`: order, one line per value, exact separator, deterministic across calls).
- `apps/backend/src/lib/ai-gateway/event-category-definitions.ratchet.test.ts` (Checks A-G, section 4).

Modify:
- `packages/shared-types/src/index.ts`: add the export (or the record); replace the per-value trailing comments (:42-49) with a pointer.
- `apps/backend/src/lib/ai-processor/build-gemini-request.ts`: line 199 and the item-3 line (:223) use the renderer; keep :27 untouched.
- `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`: line 19 uses the renderer; keep :82 untouched.
- `apps/backend/src/schema/events.graphql:53-58`, `packages/database/schema.ts:47-52`, PRD block `prd.md:370-375`: comments become pointers (comment-only; no generated-file change). Note: the SDL comment change is read by codegen only as descriptions if written with `"""`; `#` comments produce no output, so no regeneration is needed. Confirm with a no-diff codegen run.
- `_bmad-output/project-context.md:86`: make the count conditional ("18 today, 20 after story 2").

Do not touch: enum members, SDL values, locales, pgEnum, migrations, generated files, seeds.

Acceptance criteria that make S1 independently verifiable:
1. `git diff --stat` shows no change to enum membership, `events.graphql` enum body, `en.json`, `id.json`, `schema.ts` array, `migrations/`, `generated/`, or seeds (S1 is revertible alone).
2. `pnpm --filter backend build` fails if a key is deleted from the record (demonstrate once in the PR description); the ratchet fails on an empty string, an extra key, an unknown underscored token, a prompt built without the block, and a synthetic `.join(', ')` (negative controls).
3. Both built prompts contain the renderer output byte-for-byte; neither contains another list of category names; the structured-output `enum:` lists are unchanged.
4. Recorded in Dev Notes: instruction length in characters before/after for each prompt (expected +2.4-4.4 KB), and that the block precedes the `${publishDate}` text.
5. Behaviour gate: `workflow_dispatch` of the nightly golden eval and one CC-024 live run (`RUN_LIVE_GEMINI_TESTS=true`) show no regression; results attached.
6. `pnpm --filter backend test` (with Postgres, row-count ratchet clean) and `pnpm --filter @festgrid/domain test` (100% gate) pass.
7. States explicitly: no `docs/infrastructure` diagram change is needed (CLAUDE.md section 4 not triggered).

### Story 2 (S2): HOME_AND_LIVING and FASHION_AND_BEAUTY across every source

Modify:
- `packages/shared-types/src/index.ts`: add both members before `OTHER` (declaration order is facet order and OTHER stays last); add two definitions plus the Rule 4 amendments to `TECHNOLOGY`, `BUSINESS_AND_NETWORKING`, `HOBBIES_AND_INTERESTS`, `AUTOMOTIVE` (and `OTHER`'s "no single subject" sentence).
- `apps/backend/src/schema/events.graphql`: two enum values before `OTHER` (:59).
- Regenerate and commit `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (diff must be two lines each); confirm `fix-codegen.js` stays a no-op for `EventCategory`.
- `apps/web/locales/en.json:533-552` and `id.json:533-552`: "Home & Living" / "Rumah & Hunian", "Fashion & Beauty" / "Fashion & Gaya".
- `packages/database/schema.ts:54-60`: two values before `'OTHER'` (or derive from the enum, M5).
- `packages/database/migrations/0081_<name>.sql`: two `ALTER TYPE "event_category" ADD VALUE IF NOT EXISTS '...' BEFORE 'OTHER';` statements separated by `--> statement-breakpoint`, plus the drizzle-kit `meta/0081_snapshot.json` and `meta/_journal.json` entry (run `pnpm --filter @festgrid/database generate`, then hand-adjust the SQL as in `0003`/`0038`). The type is unused by any column, so the migration cannot affect row data.
- `packages/database/seed.ts`: add the new values to two existing fixture events' `categories` (M4); optionally `seed-volume.ts:99`.
- PRD block `prd.md:358-377`: two members.
- `_bmad-output/project-context.md:86`: drop the conditional wording.
- `_bmad-output/implementation-artifacts/deferred-work.md:255` and the spine: fix the "Postgres enum irreversibility" note (type unused) per AD-44 follow-up 3.
- Spine AD-42 Rule 7 on its own branch: "18 values" -> 20 when both land.

Create / extend tests (so Rule 5's claim becomes true):
- `apps/web/locales/locales.test.ts`: add the generated-enum equality case (D3) and switch `arrayContaining` to key-set equality for `EventCategory`/`EventType`.
- `apps/backend/src/schema/schema-consistency.test.ts`: add the type-level generated-union equality (D4).
- `packages/database` (Vitest, no DB needed): `eventCategoryEnum.enumValues` set equals `Object.values(EventCategory)`; every value appears in some `migrations/*.sql` `ADD VALUE`/`CREATE TYPE` text; every `FIXTURE_EVENTS[*].categories` entry is a member.
- Optional: a PRD-block parser test (precedent for tests reading `_bmad-output`: the CC-024 live test), and an e2e assertion extending `apps/web/e2e/locale.spec.ts` for the new labels (cannot be run in the sandbox).

Acceptance criteria that make S2 independently verifiable:
1. `Object.values(EventCategory)` has 20 members, `OTHER` last; SDL, both generated outputs, pgEnum, en/id keys and the definitions record all contain exactly the same 20 (asserted by the tests above, not by reading).
2. The PR removes a key from each source in turn (locally) and shows the corresponding test or `tsc` failure (a short table in the PR description).
3. Migration: applies on the CI Postgres (`pnpm --filter @festgrid/database run migrate`) and is idempotent when re-run (`IF NOT EXISTS`).
4. Seed: `pnpm --filter @festgrid/database test:seed` passes; counts unchanged if only existing fixtures were edited.
5. Prompt behaviour: the nightly golden eval and CC-024 run after merge show no regression; two spot extractions (a furniture/appliance expo post, a fashion/beauty sale post) tag as intended and a mall-wide sale tags `OTHER` with type `PROMOTION` or `MARKET` (Rule 4).
6. Rule 5's evidence sample query is run and its result recorded (the AD says it is a sanity check, not a veto).
7. No `docs/infrastructure` change needed; say so.

---

## 9. Sequencing risks, S1 before S2

1. **S1 first is correct.** With the exhaustive `Record<EventCategory,string>` in place, S2's compiler fails until the two definitions exist, so the new values can never reach Gemini by name only (AD follow-up 2's concern). The reverse order would ship two undefined categories to a model that has no definitions.
2. **S1 is not a no-op** (H5). Treat it as a prompt-quality release: gate on the live evals, announce the interim tagging shift, do not bundle S2 into the same deploy.
3. **Interim state.** Between S1 and S2, definitions for `TECHNOLOGY`/`BUSINESS_AND_NETWORKING` describe boundaries to categories that do not exist yet. Keep S1's wording self-contained (H5) and let S2 amend.
4. **Ratchet strictness at S1 vs S2.** If Check B (unknown-token) is in S1, an S1 author who copies Rule 4 verbatim fails CI immediately, which is the desired guard. If it is deferred to S2 the guard arrives too late.
5. **Migration is independent of runtime.** Because `events.categories` is `text[]`, S2's code deploy does not depend on the migration having run; `db-migrate` still precedes `deploy-infrastructure` in `ci.yml`, so no ordering hazard.
6. **Sample-evidence gate (Rule 5).** The AD says the production query is a pre-build sanity check; make it an explicit S2 task so it is not forgotten, and keep it off the S1 critical path.
7. **Hand-off between stories.** S1's ratchet should be written so S2 changes no test code except the new consistency cases; otherwise the stories are not independently verifiable.

---

## 10. Proposed AD-44 edits (consolidated)

- **Binds:** add `packages/database/schema.ts` (`eventCategoryEnum`), `packages/database/migrations/` (including `meta/`), `packages/database/seed.ts` and `seed-volume.ts`, and the web/backend generated outputs as separate bound sources.
- **Rule 3:** replace the final two sentences with H3's wording and H4's renderer sentence; add "one to two sentences, at most 280 characters, English with Indonesian cue words, never rendered in UI"; add H2's comment-pointer sentence.
- **Rule 5:** replace the last sentence with H1's wording; replace "a seed fixture" with "the `categories` of an existing seed fixture event, plus a check that every seed category string is a member"; add "the `schema.ts` pgEnum and its drizzle `meta/` files".
- **Follow-ups:** split follow-up 1/2 per H5 (S1 definitions are self-contained for the 18; S2 amends the cross-references).
- **Deferred:** add "freshness test for generated outputs" if the owner wants it out of S2 (not recommended; it is cheap).
