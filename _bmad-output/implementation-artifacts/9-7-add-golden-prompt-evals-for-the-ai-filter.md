---
baseline_commit: 686400628c57d1f7e1edd2b26dc3d6c074dcefdd
---

# Story 9.7: Add golden-prompt evals for the AI filter

## Story Details

- Epic: 9
- Story ID: 9.7
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want a fixed prompt set with expected tree shapes and caveats,
so that prompt or schema changes cannot silently regress extraction quality.

## Acceptance Criteria

1. **AC1 — a ≥40-prompt golden fixture suite, asserted deterministically in PR CI, with zero network/live-model calls (epics.md AC1):** Given at least 40 English and Indonesian prompts covering AND, OR, NOT, nesting, precedence, over-limit, out-of-vocabulary and off-topic, when the suite runs in PR CI, then:
   - Each fixture pairs a human-readable `prompt` string with a **hand-authored raw Gemini response payload** (`geminiResponse`, the same JSON shape `resolvePromptToEventFilter` would receive from the live model per `buildFilterExtractionSystemInstruction`/`buildFilterExtractionResponseSchema`) — never an actual call to Gemini or any other external/network service.
   - The suite feeds each fixture's `geminiResponse` directly into the real, already-shipped `transformGeminiResponseToFilterExpression` (`packages/domain`) and asserts the exact resulting `FilterNode` expression tree and `caveats` array against the fixture's hand-captured `expected` value. This is the "stub" the AC refers to: the stub is the hand-authored Gemini response, not a mocked HTTP layer — there is no HTTP layer in this test path at all.
   - The suite runs via `pnpm --filter @festgrid/domain test` (the existing `tsx --test "src/**/*.test.ts"` runner, zero DB, zero network), and is therefore already picked up by the existing root `pnpm run test` or `pnpm run test`/CI `ci.yml` run step with **no `ci.yml` edit required** — any new `*.test.ts` file under `packages/domain/src/**` is automatically included today.
   - A second, independent meta-test (fixture-integrity check) asserts the fixture *set itself* is not degenerate: ≥40 total fixtures, ≥15 tagged `en` and ≥15 tagged `id`, every one of the 8 required categories represented by ≥2 `en` and ≥2 `id` fixtures, no duplicate `id`s, no duplicate `prompt` text, and every fixture's `expected.expression` independently re-validates as `valid` via `validateFilterNode`.

2. **AC2 — an opt-in, flag-gated nightly live-Gemini run reports drift, and is never invoked by `dev-story`, its tests, or any required CI job (epics.md AC2; this session's explicit environment constraint — the dev agent has NO network and must NOT call the live Gemini API or any external service):** Given the same fixture prompts, when a human or a scheduled job explicitly opts in, then:
   - A new standalone script (`apps/backend/scripts/run-golden-prompt-live-eval.ts`) sends each fixture's real `prompt` text through the live Gemini API (via `callGeminiGenerateContent`, reusing the exact same `buildFilterExtractionSystemInstruction`/`buildFilterExtractionResponseSchema` the production resolver uses), runs the real response through the same `transformGeminiResponseToFilterExpression`, and reports per-fixture drift against each fixture's golden `expected` value — using a **pure, independently unit-tested** comparison helper (`summarizeGoldenPromptDrift`, `packages/domain`) so the drift logic itself has deterministic, network-free test coverage even though the script that calls it does not.
   - The script is a strict no-op (exits 0 immediately, prints a message, calls Gemini zero times) unless `RUN_LIVE_GEMINI_EVAL=true` is set in its environment — this is the "behind a flag" gate.
   - A new, repo-first scheduled GitHub Actions workflow (`.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`) wires the script to run nightly (`schedule:`) and on-demand (`workflow_dispatch:`), entirely separate from `ci.yml`'s push/pull_request triggers — a PR can never trigger a live Gemini call through this path.
   - **This story's own Definition of Done, `dev-story`'s test run, and PR CI never execute this script or this workflow** — the live path is documented (Dev Notes) and wired (exists, is flag-gated, type-checks, lints) but not run as part of verifying this story, consistent with this session's explicit no-network/no-live-Gemini constraint for the dev agent.

3. **AC3 — this story closes sprint action item `retro-7-1` (epics.md AC3):** `sprint-status.yaml`'s `action_items` entry `retro-7-1` ("Refine AI Prompts: Monitor user behavior with AI filters to tune the system prompt for better date/location extraction accuracy... Folded into backlog IDEA-069 (Epic 9, Story 9.7)") is updated to `status: closed`, with its description left intact and a trailing note recording that it closes via this story's fixed golden-prompt regression suite + nightly live-drift report — a narrower, concrete mechanism than the action item's original open-ended "monitor user behavior" framing, and that narrowing is recorded explicitly rather than left implicit (see Dev Notes decision 6).

**Depends on:** Story 9.4 (`review`/implemented — see Previous Story Intelligence; this story's fixtures are authored against 9.4's real `transformGeminiResponseToFilterExpression` behavior, including its Story 9.1b-upgraded date/weekday/temporal vocabulary).

## Tasks / Subtasks

- [x] 1. **(AC1)** Create `packages/domain/src/ai-event-filters/golden-prompts/golden-prompt-fixtures.ts`:
  - Define and export:
    ```ts
    import type { FilterNode } from '../filter-node.js';

    export const GOLDEN_PROMPT_CATEGORIES = [
      'AND',
      'OR',
      'NOT',
      'nesting',
      'precedence',
      'over-limit',
      'out-of-vocabulary',
      'off-topic',
    ] as const;
    export type GoldenPromptCategory = (typeof GOLDEN_PROMPT_CATEGORIES)[number];

    export interface GoldenPromptFixture {
      /** Unique, stable, kebab-case id (e.g. `and-en-01`, `off-topic-id-03`). */
      id: string;
      lang: 'en' | 'id';
      category: GoldenPromptCategory;
      /** The human-readable prompt text this fixture represents. Documentation/traceability for
       * this suite, and the literal input the opt-in live-eval script (Task 4) sends to Gemini --
       * NOT consumed by this suite's own test (Task 2), which feeds `geminiResponse` directly to
       * `transformGeminiResponseToFilterExpression` and never calls a model. */
      prompt: string;
      /** Hand-authored raw Gemini response payload for `prompt`, shaped exactly as
       * `buildFilterExtractionSystemInstruction`/`buildFilterExtractionResponseSchema`
       * (`apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`) specify:
       * `{ expression: <node>, caveats: string[] }` (tree shape) or `{ resolvedFilter: {...},
       * caveats: string[] }` (legacy flat shape, Story 9.4 AC2's "v1 flat response still
       * accepted" -- at least one fixture should exercise this branch). */
      geminiResponse: unknown;
      /** The exact, byte-for-byte return value of
       * `transformGeminiResponseToFilterExpression(geminiResponse)` -- see the mandatory
       * authoring method in this task's final bullet. */
      expected: {
        expression: FilterNode;
        caveats: string[];
      };
    }

    export const GOLDEN_PROMPT_FIXTURES: GoldenPromptFixture[] = [ /* ... */ ];
    ```
  - Seed the array with the following 8 fully worked, hand-verified fixtures (one per required category; copy these literally -- they were traced by hand against the real `transformGeminiResponseToFilterExpression`/`transformGeminiResponseToEventFilter`/`expressionFromFlatFilter`/`normalize` code paths and must not be altered):
    ```ts
    {
      id: 'and-en-01',
      lang: 'en',
      category: 'AND',
      prompt: 'free jazz concerts in Sleman this weekend',
      geminiResponse: {
        expression: {
          op: 'AND',
          children: [
            { keyword: 'jazz' },
            { types: ['PERFORMANCE'] },
            { location: { adminArea: 'Sleman' } },
            { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
            { isFree: true },
          ],
        },
        caveats: [],
      },
      expected: {
        expression: {
          op: 'AND',
          children: [
            { field: 'keyword', value: 'jazz' },
            { field: 'type', value: ['PERFORMANCE'] },
            { field: 'locationAdminArea', value: 'Sleman' },
            { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
            { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
            { field: 'isFree', value: true },
          ],
        },
        caveats: [],
      },
    },
    {
      id: 'or-id-01',
      lang: 'id',
      category: 'OR',
      prompt: 'konser jazz atau blues di Sleman akhir pekan ini',
      geminiResponse: {
        expression: { op: 'OR', children: [{ keyword: 'jazz' }, { keyword: 'blues' }] },
        caveats: [],
      },
      expected: {
        expression: {
          op: 'OR',
          children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }],
        },
        caveats: [],
      },
    },
    {
      id: 'not-en-01',
      lang: 'en',
      category: 'NOT',
      prompt: 'music events this weekend, not workshops',
      geminiResponse: {
        expression: {
          op: 'AND',
          children: [
            { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
            { op: 'NOT', child: { types: ['WORKSHOP'] } },
          ],
        },
        caveats: [],
      },
      expected: {
        expression: {
          op: 'AND',
          children: [
            { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
            { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
            { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } },
          ],
        },
        caveats: [],
      },
    },
    {
      // Reuses the SPEC CAP-6 worked example verbatim (already proven correct by
      // transform-gemini-response-to-filter-expression.test.ts's first test case) -- the exact
      // same tree shape is claimed by buildFilterExtractionSystemInstruction's own Indonesian
      // few-shot example to apply "regardless of the prompt's language", so this fixture pairs
      // the Indonesian prompt text with that already-proven expected tree.
      id: 'nesting-id-01',
      lang: 'id',
      category: 'nesting',
      prompt: 'musik jazz atau blues di Sleman atau Bantul akhir pekan ini, bukan workshop',
      geminiResponse: {
        expression: {
          op: 'AND',
          children: [
            { op: 'OR', children: [{ keyword: 'jazz' }, { keyword: 'blues' }] },
            { op: 'OR', children: [{ location: { adminArea: 'Sleman' } }, { location: { adminArea: 'Bantul' } }] },
            { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
            { op: 'NOT', child: { types: ['WORKSHOP'] } },
          ],
        },
        caveats: [],
      },
      expected: {
        expression: {
          op: 'AND',
          children: [
            { op: 'OR', children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }] },
            {
              op: 'OR',
              children: [
                { field: 'locationAdminArea', value: 'Sleman' },
                { field: 'locationAdminArea', value: 'Bantul' },
              ],
            },
            { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
            { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
            { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } },
          ],
        },
        caveats: [],
      },
    },
    {
      id: 'precedence-en-01',
      lang: 'en',
      category: 'precedence',
      prompt: 'jazz or blues in Sleman this weekend',
      geminiResponse: {
        expression: {
          op: 'AND',
          children: [
            { op: 'OR', children: [{ keyword: 'jazz' }, { keyword: 'blues' }] },
            { location: { adminArea: 'Sleman' } },
            { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
          ],
        },
        caveats: [],
      },
      expected: {
        expression: {
          op: 'AND',
          children: [
            { op: 'OR', children: [{ field: 'keyword', value: 'jazz' }, { field: 'keyword', value: 'blues' }] },
            { field: 'locationAdminArea', value: 'Sleman' },
            { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
            { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
          ],
        },
        caveats: [],
      },
    },
    {
      // Deliberately synthetic, mirroring transform-gemini-response-to-filter-expression.test.ts's
      // own existing "trims a tree exceeding FILTER_NODE_MAX_NODES" precedent exactly (13 keyword
      // leaves under one OR -- real users don't type 13 alternatives, but this is the established,
      // already-proven way this repo exercises the trim algorithm). nodeCount starts at 1+13=14;
      // the trim loop removes the OR's LAST child twice (14 -> 13 -> 12), each time re-validating,
      // landing on exactly 11 surviving children (kw-0..kw-10) with nodeCount 1+11=12 (valid).
      id: 'over-limit-en-01',
      lang: 'en',
      category: 'over-limit',
      prompt: 'events about kw-0 or kw-1 or kw-2 or kw-3 or kw-4 or kw-5 or kw-6 or kw-7 or kw-8 or kw-9 or kw-10 or kw-11 or kw-12',
      geminiResponse: {
        expression: {
          op: 'OR',
          children: Array.from({ length: 13 }, (_, i) => ({ keyword: `kw-${i}` })),
        },
        caveats: [],
      },
      expected: {
        expression: {
          op: 'OR',
          children: Array.from({ length: 11 }, (_, i) => ({ field: 'keyword' as const, value: `kw-${i}` })),
        },
        caveats: ['Your prompt described more conditions than the filter supports, so some were dropped.'],
      },
    },
    {
      id: 'out-of-vocabulary-en-01',
      lang: 'en',
      category: 'out-of-vocabulary',
      prompt: 'jazz events under IDR 200K this weekend',
      geminiResponse: {
        expression: {
          op: 'AND',
          children: [
            { keyword: 'jazz' },
            { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: ['SAT', 'SUN'] },
          ],
        },
        caveats: ['A specific price threshold ("under IDR 200K") is not supported yet, so it was ignored.'],
      },
      expected: {
        expression: {
          op: 'AND',
          children: [
            { field: 'keyword', value: 'jazz' },
            { field: 'dateRange', value: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' } },
            { field: 'dayOfWeek', value: ['SAT', 'SUN'] },
          ],
        },
        caveats: ['A specific price threshold ("under IDR 200K") is not supported yet, so it was ignored.'],
      },
    },
    {
      id: 'off-topic-id-01',
      lang: 'id',
      category: 'off-topic',
      prompt: 'siapa presiden Indonesia sekarang?',
      geminiResponse: {
        expression: { op: 'AND', children: [] },
        caveats: ['Prompt ini tidak terkait dengan pencarian acara, sehingga tidak ada filter yang diterapkan.'],
      },
      expected: {
        expression: { op: 'AND', children: [] },
        caveats: ['Prompt ini tidak terkait dengan pencarian acara, sehingga tidak ada filter yang diterapkan.'],
      },
    },
    ```
  - **Mandatory authoring method for every additional fixture beyond the 8 above:** write `prompt` and `geminiResponse` by hand (grounded in `buildFilterExtractionSystemInstruction`'s documented leaf vocabulary and `filter-vocabulary.md`), then **derive `expected` by actually running the real function, never by hand-deriving/inspecting the algorithm** -- e.g. temporarily add a throwaway `tmp-capture.test.ts` in this same directory:
    ```ts
    import { test } from 'node:test';
    import { transformGeminiResponseToFilterExpression } from '../transform-gemini-response-to-filter-expression.js';
    test('capture', () => {
      console.log(JSON.stringify(transformGeminiResponseToFilterExpression(/* paste geminiResponse here */), null, 2));
    });
    ```
    run it with `pnpm --filter @festgrid/domain exec tsx --test tmp-capture.test.ts`, paste the printed `expression`/`caveats` verbatim into the fixture's `expected`, then **delete `tmp-capture.test.ts`** (never commit it). This is deliberately a capture-not-derive workflow: the trim-to-node-limit and double-NOT-collapse algorithms are order-dependent (see the worked `over-limit-en-01` comment above), so hand-deriving a wrong "expected" value would silently defeat the entire point of a regression ratchet.
  - Author enough additional fixtures (using the method above) to satisfy, across the full `GOLDEN_PROMPT_FIXTURES` array: **≥40 fixtures total; ≥15 with `lang: 'en'`; ≥15 with `lang: 'id'`; every one of the 8 `GOLDEN_PROMPT_CATEGORIES` represented by ≥2 `en` and ≥2 `id` fixtures** (8 categories × 4 ≥ 32, comfortably inside the ≥40/≥15/≥15 totals with room for a few extra, e.g. a combined fixture exercising both a model-reported caveat AND a pushed over-limit caveat together, proving the `[...modelCaveats, ...pushedCaveats]` ordering). Distribute realistic vocabulary from `filter-vocabulary.md` across fixtures (`accountId`, `venueType`, `temporalFilter`, `dateRange.spanAmount`/`spanUnit` e.g. "next 7 days"/"next 2 weeks", multi-value `dayOfWeek` e.g. "weekdays" = MON-FRI) -- do not restrict every fixture to only the fields the 8 worked examples already cover. For `out-of-vocabulary`, draw only from `filter-vocabulary.md`'s three documented always-caveat cases (numeric price threshold, floor/room-level location detail, or an absolute date/time-of-day/holiday name) so this category stays grounded in the SPEC, not invented. For `off-topic`, use generic chit-chat/off-topic content unrelated to events (mirroring `off-topic-id-01`'s pattern: empty `expression`, one model-reported caveat, resulting `expected.expression` of `{ op: 'AND', children: [] }`).

- [x] 2. **(AC1, Testing)** Create `packages/domain/src/ai-event-filters/golden-prompts/golden-prompt-fixtures.test.ts`:
  - Main suite (`node:test`/`tsx --test`, matching every sibling test file's existing convention -- see `transform-gemini-response-to-filter-expression.test.ts`): `describe('golden-prompt fixtures (Story 9.7 AC1)', ...)`, one `it(fixture.id, ...)` per fixture in `GOLDEN_PROMPT_FIXTURES`, each calling `transformGeminiResponseToFilterExpression(fixture.geminiResponse)` and asserting `assert.deepEqual(result.expression, fixture.expected.expression)` and `assert.deepEqual(result.caveats, fixture.expected.caveats)`.
  - A second `describe('golden-prompt fixture-set integrity (Story 9.7 AC1)', ...)` block asserting, over the whole `GOLDEN_PROMPT_FIXTURES` array (not any single fixture):
    - `GOLDEN_PROMPT_FIXTURES.length >= 40`.
    - At least 15 fixtures have `lang === 'en'`; at least 15 have `lang === 'id'`.
    - For every category in `GOLDEN_PROMPT_CATEGORIES`, at least 2 fixtures of that category have `lang === 'en'` and at least 2 have `lang === 'id'`.
    - Every `id` is unique (`new Set(fixtures.map(f => f.id)).size === fixtures.length`).
    - Every `prompt` is unique.
    - Every fixture's `expected.expression` independently re-validates: `validateFilterNode(fixture.expected.expression).valid === true`.
    - Every fixture tagged `category: 'over-limit'` has `expected.caveats` containing the exact string `'Your prompt described more conditions than the filter supports, so some were dropped.'`.
    - Every fixture tagged `category: 'off-topic'` has `expected.expression` deep-equal to `{ op: 'AND', children: [] }` and `expected.caveats.length > 0`.

- [x] 3. **(AC2)** Create `packages/domain/src/ai-event-filters/golden-prompts/compute-golden-prompt-drift.ts` -- the pure, network-free comparison logic the opt-in live-eval script (Task 4) delegates to, kept in `packages/domain` specifically so it carries its own deterministic unit-test coverage independent of the network-touching script:
  ```ts
  import { isFilterGroupNode, isFilterLeaf, isFilterNotNode, type FilterNode } from '../filter-node.js';
  import type { GeminiFilterExtractionResult } from '../transform-gemini-response-to-filter-expression.js';
  import type { GoldenPromptFixture } from './golden-prompt-fixtures.js';

  /** Sorted, de-duplicated list of every leaf `field` name present anywhere in the tree
   * (flattening AND/OR/NOT) -- a coarse, non-brittle shape signature deliberately insensitive to
   * exact free-text leaf values (`keyword`, `accountId`) or array ordering, since a live model's
   * wording legitimately varies run to run even when it extracted the same fields. */
  export function computeFilterNodeFieldSignature(node: FilterNode): string[] {
    const fields = new Set<string>();
    function visit(current: FilterNode): void {
      if (isFilterLeaf(current)) {
        fields.add(current.field);
      } else if (isFilterGroupNode(current)) {
        current.children.forEach(visit);
      } else if (isFilterNotNode(current)) {
        visit(current.child);
      }
    }
    visit(node);
    return Array.from(fields).sort();
  }

  export interface GoldenPromptDriftResult {
    fixtureId: string;
    drifted: boolean;
    expectedFieldSignature: string[];
    actualFieldSignature: string[];
    expectedHadCaveats: boolean;
    actualHadCaveats: boolean;
    details: string;
  }

  /** Best-effort drift check for the opt-in live-eval script (Story 9.7 AC2) -- deliberately NOT
   * an exact deepEqual against `fixture.expected` (a live model's free-text wording for
   * `keyword`/`accountId` leaves, or its exact caveat sentence, legitimately varies run to run
   * without being a real regression). Flags drift only on the two signals that *do* indicate a
   * real extraction-quality regression: the set of leaf fields the model populated changed, or
   * whether it produced any caveat at all changed. */
  export function summarizeGoldenPromptDrift(
    fixture: GoldenPromptFixture,
    liveResult: GeminiFilterExtractionResult
  ): GoldenPromptDriftResult {
    const expectedFieldSignature = computeFilterNodeFieldSignature(fixture.expected.expression);
    const actualFieldSignature = computeFilterNodeFieldSignature(liveResult.expression);
    const expectedHadCaveats = fixture.expected.caveats.length > 0;
    const actualHadCaveats = liveResult.caveats.length > 0;
    const fieldsMatch = JSON.stringify(expectedFieldSignature) === JSON.stringify(actualFieldSignature);
    const caveatPresenceMatches = expectedHadCaveats === actualHadCaveats;
    const drifted = !fieldsMatch || !caveatPresenceMatches;
    const details = drifted
      ? `fields expected=[${expectedFieldSignature.join(',')}] actual=[${actualFieldSignature.join(',')}]; caveatPresence expected=${expectedHadCaveats} actual=${actualHadCaveats}`
      : 'no drift';
    return { fixtureId: fixture.id, drifted, expectedFieldSignature, actualFieldSignature, expectedHadCaveats, actualHadCaveats, details };
  }
  ```

- [x] 4. **(AC1, AC2, Testing)** Create `packages/domain/src/ai-event-filters/golden-prompts/compute-golden-prompt-drift.test.ts` (`node:test`): unit-test `computeFilterNodeFieldSignature` against a leaf, a NOT-wrapped leaf, and a nested AND/OR tree (assert sorted, deduplicated field names); unit-test `summarizeGoldenPromptDrift` with: (a) a synthetic `liveResult` identical in field-signature and caveat-presence to a fixture's `expected` -> `drifted: false`; (b) a `liveResult` with a different field set -> `drifted: true`, `details` naming both signatures; (c) a `liveResult` with matching fields but caveat presence flipped (expected none, actual has one, and vice versa) -> `drifted: true`. Zero network, zero DB -- pure data in, pure data out, matching this package's 100%-unit-test-coverage convention (`project-context.md`).

- [x] 5. **(AC1, Project Structure)** Update `packages/domain/src/ai-event-filters/index.ts`: add
  ```ts
  export * from './golden-prompts/golden-prompt-fixtures.js';
  export * from './golden-prompts/compute-golden-prompt-drift.js';
  ```
  (alongside the existing `export * from './transform-gemini-response-to-filter-expression.js';` line), so both are reachable externally as `@festgrid/domain/ai-event-filters` -- the import path Task 6's backend script uses.

- [x] 6. **(AC2)** Create `apps/backend/scripts/run-golden-prompt-live-eval.ts` -- an opt-in, manually/nightly-invoked script, following this repo's existing `apps/backend/scripts/*.ts` convention (e.g. `run-tests-with-row-count-ratchet.ts`) of a standalone script outside the resolver/Lambda control flow, never imported by production code:
  ```ts
  /*
   * Opt-in live-Gemini drift eval for the golden-prompt fixture suite (Story 9.7 AC2).
   *
   * NOT part of `pnpm --filter @festgrid/backend test`, `dev-story`'s verification, or PR CI --
   * this script makes real, billable calls to the live Gemini API and is a strict no-op unless
   * explicitly opted into via RUN_LIVE_GEMINI_EVAL=true. Invoked by
   * .github/workflows/ai-filter-golden-prompt-nightly-eval.yml (schedule + workflow_dispatch) or
   * manually: `RUN_LIVE_GEMINI_EVAL=true GEMINI_NIGHTLY_EVAL_API_KEY=... BACKEND_PORT=4001
   * pnpm --filter @festgrid/backend exec tsx scripts/run-golden-prompt-live-eval.ts`.
   *
   * Deliberately bypasses the full callGemini()/BYOK key-selection orchestration
   * (apps/backend/src/lib/ai-gateway/adapter.ts) -- this script has no authenticated user and no
   * DB-stored key to select from. It calls callGeminiGenerateContent (gemini-client.ts) directly
   * with a dedicated, platform-funded GEMINI_NIGHTLY_EVAL_API_KEY, structurally isolated from
   * both BYOK keys and SYSTEM_GEMINI_API_KEY (see SETUP_WALKTHROUGH.md #8).
   */
  import {
    GOLDEN_PROMPT_FIXTURES,
    summarizeGoldenPromptDrift,
    transformGeminiResponseToFilterExpression,
  } from '@festgrid/domain/ai-event-filters';
  import { buildFilterExtractionSystemInstruction, buildFilterExtractionResponseSchema } from '../src/lib/ai-event-filters/build-filter-extraction-request.js';
  import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';

  async function main(): Promise<void> {
    if (process.env.RUN_LIVE_GEMINI_EVAL !== 'true') {
      console.log('RUN_LIVE_GEMINI_EVAL is not "true" -- skipping live Gemini golden-prompt eval (this is the expected no-op state for every PR/dev-story run).');
      return;
    }
    const apiKey = process.env.GEMINI_NIGHTLY_EVAL_API_KEY;
    if (!apiKey) {
      throw new Error('RUN_LIVE_GEMINI_EVAL=true but GEMINI_NIGHTLY_EVAL_API_KEY is not set.');
    }

    const systemInstruction = buildFilterExtractionSystemInstruction();
    const responseSchema = buildFilterExtractionResponseSchema();
    const results = [];

    for (const fixture of GOLDEN_PROMPT_FIXTURES) {
      const response = await callGeminiGenerateContent(apiKey, {
        contents: `Parse this prompt: "${fixture.prompt}"`,
        systemInstruction,
        responseSchema,
        responseMimeType: 'application/json',
      });
      let parsed: unknown;
      try {
        const rawText = response.text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim();
        parsed = JSON.parse(rawText);
      } catch {
        results.push({ fixtureId: fixture.id, drifted: true, details: 'live response was not valid JSON' });
        continue;
      }
      const liveResult = transformGeminiResponseToFilterExpression(parsed);
      results.push(summarizeGoldenPromptDrift(fixture, liveResult));
    }

    const drifted = results.filter((r) => r.drifted);
    console.log(`Golden-prompt live eval: ${results.length} fixtures, ${drifted.length} drifted.`);
    for (const r of drifted) {
      console.log(`::warning::Golden-prompt drift on "${r.fixtureId}": ${r.details}`);
    }
    if (drifted.length > 0) {
      process.exitCode = 1;
    }
  }

  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
  ```
  - This file lives under `apps/backend/tsconfig.json`'s `include: ["."]`, so `pnpm --filter @festgrid/backend build`/`lint` type-check and lint it statically -- neither executes it, so neither requires network.

- [x] 7. **(AC2)** Create `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml` -- the repo's first scheduled (`schedule:`) workflow; every existing non-`ci.yml` workflow today is `workflow_dispatch`-only (manual backfills/triggers), so this introduces (not reuses) the nightly-trigger pattern, entirely separate from `ci.yml`'s `push`/`pull_request` triggers:
  ```yaml
  name: Golden-Prompt Live Gemini Eval (nightly)

  # Opt-in, nightly drift report for the AI filter's golden-prompt fixture suite (Story 9.7
  # AC2). Entirely separate from ci.yml -- a pull_request or push NEVER triggers this workflow,
  # and apps/backend/scripts/run-golden-prompt-live-eval.ts is itself a no-op unless
  # RUN_LIVE_GEMINI_EVAL=true is set (set only here, never in ci.yml).
  on:
    schedule:
      - cron: '17 19 * * *' # nightly, off-peak UTC
    workflow_dispatch: {}

  jobs:
    golden-prompt-live-eval:
      name: Golden-Prompt Live Gemini Eval (nightly)
      runs-on: ubuntu-latest
      environment: production
      steps:
        - name: Checkout Repository
          uses: actions/checkout@v4

        - name: Setup pnpm
          uses: pnpm/action-setup@v3
          with:
            run_install: false

        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
            node-version-file: 'package.json'
            cache: 'pnpm'

        - name: Install dependencies
          run: pnpm install --frozen-lockfile

        # Workspace packages (@festgrid/domain) resolve to their gitignored dist/ output, so they
        # must be built before the eval script can import them (same rationale as
        # backfill-post-media-keys.yml's own "Build workspace packages" step).
        - name: Build workspace packages
          run: pnpm run build

        - name: Run golden-prompt live eval
          env:
            RUN_LIVE_GEMINI_EVAL: 'true'
            GEMINI_NIGHTLY_EVAL_API_KEY: ${{ secrets.GEMINI_NIGHTLY_EVAL_API_KEY }}
            # loadBackendEnv() (invoked inside callGeminiGenerateContent) requires this; this
            # script never binds a port, so any valid number works (same note as
            # backfill-post-media-keys.yml's BACKEND_PORT usage).
            BACKEND_PORT: '4001'
          run: pnpm --filter @festgrid/backend exec tsx scripts/run-golden-prompt-live-eval.ts
  ```

- [x] 8. **(AC2, Setup Docs)** Update `SETUP_WALKTHROUGH.md` section 8 ("AI Gateway (Google Gemini API)"), immediately after the existing "Fallback System Key (`SYSTEM_GEMINI_API_KEY`)" subsection, adding a new subsection documenting the new secret this story introduces:
  ```markdown
  #### Nightly Golden-Prompt Eval Key (`GEMINI_NIGHTLY_EVAL_API_KEY`)

  To support the opt-in nightly drift report for the AI filter's golden-prompt fixture suite
  (Story 9.7, `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`), a third, separate
  Gemini API key is required. Obtained the same way as the personal test key described above
  (Google AI Studio free-tier key), funded by the platform, and configured as a **GitHub Actions
  repository secret** (`GEMINI_NIGHTLY_EVAL_API_KEY`) -- not an AWS Secrets Manager entry, since
  this key is consumed only by a CI workflow, never by a deployed Lambda. Structurally isolated
  from both BYOK keys and `SYSTEM_GEMINI_API_KEY`: it is never used for post extraction or
  default-location inference, only for the nightly eval script's own calls.
  ```

- [x] 9. **(AC3)** In `_bmad-output/implementation-artifacts/sprint-status.yaml`'s `action_items` list, update the `retro-7-1` entry's `status` from `open` to `closed`, and append (do not replace) its `description` with a trailing clause: `" Closed by Story 9.7's golden-prompt fixture regression suite + opt-in nightly live-drift report -- a fixed-suite/report mechanism, narrower than this item's original open-ended 'monitor user behavior' framing (see Story 9.7 Dev Notes decision 6)."` Do not touch any other `action_items` entry (`correct-course-2026-09-02-1`, `retro-7-2`) or any `backlog.yaml` content -- this task is a `sprint-status.yaml` `action_items` edit only, unrelated to this session's backlog-promotion skip instruction.

- [x] 10. **(Verification)** Run, each once:
  - `pnpm --filter @festgrid/domain test` -- the new `golden-prompt-fixtures.test.ts` (all fixture cases + the fixture-set-integrity meta-test) and `compute-golden-prompt-drift.test.ts` pass; full existing `domain` suite stays green.
  - `pnpm --filter @festgrid/domain lint`/`build` -- clean.
  - `pnpm --filter @festgrid/backend lint`/`build` -- clean (type-checks/lints the new `run-golden-prompt-live-eval.ts` statically; never executes it).
  - `pnpm --filter @festgrid/backend test` -- full existing suite stays green (local Postgres only; confirms this story's backend-side addition introduces no DB-touching regression -- it does **not** exercise `run-golden-prompt-live-eval.ts`, which is not a `*.test.ts` file and is never invoked by this command).
  - **Never run** `run-golden-prompt-live-eval.ts` itself, with or without `RUN_LIVE_GEMINI_EVAL=true` -- doing so would call the live Gemini API over the network, violating this session's explicit no-network/no-live-Gemini constraint. Its correctness is established statically (type-check/lint) and through `compute-golden-prompt-drift.test.ts`'s coverage of the pure logic it delegates to.

## Dev Notes

### Architecture & UX Gate Findings

Per `epic-readiness/epic-9-readiness.md` (`swept: true`, 2026-10-14, `stories_covered` explicitly includes `'9.7'`), Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) were already run epic-wide and are cited here rather than re-run, per this session's explicit dispatch instruction ("skip Gate 1/3 and run Gate 2 only"):

- **Gate 1 (epic-wide, cited):** "No epic-wide bypass found... The upgrade is confined to `packages/domain` (types/schema/compiler), existing GraphQL resolvers, the existing Gemini transform, and existing UI (`FilterHub`)... No new infra: no new Lambda, queue, or IaC is implied anywhere in the epic's stories."
- **Gate 3 (epic-wide, cited):** "No new Epic 0 (or cross-epic) dependency gap found... i18n/analytics/testing/codegen foundations: all pre-existing and already adopted by Epic 7's shipped stories; Epic 9 only adds translation keys and golden-prompt fixtures (Story 9.5, 9.7) within those existing systems, nothing foundational." This story is literally named in the epic-wide Gate 3 analysis as an anticipated, non-foundational addition.
- **Lightweight guard (this story, checked fresh -- per the workflow's "reason whether this story's scope contains anything the epic-wide sweep plausibly didn't anticipate" instruction):** this story's scope does introduce two things the epic-wide sweep's Gate 1 analysis did not explicitly discuss, since that analysis was scoped to application/resolver/vendor-call architecture, not CI tooling: (a) the repo's first `schedule:`-triggered GitHub Actions workflow, and (b) a new CI-only secret (`GEMINI_NIGHTLY_EVAL_API_KEY`). Reasoned through directly rather than re-running a full Gate 1 subagent pass, because both are mechanically identical to already-established, already-reviewed precedent in this exact repo: the `workflow_dispatch`-gated manual-workflow pattern (`trigger-scraper.yml`, `backfill-post-media-keys.yml` et al.) already exists and this story only adds a `schedule:` trigger alongside the same `workflow_dispatch:`; and the "a dedicated, platform-funded, structurally-isolated Gemini key, obtained the same way as the existing personal test key, documented in `SETUP_WALKTHROUGH.md` #8" pattern already exists verbatim for `SYSTEM_GEMINI_API_KEY` -- this story adds a sibling key under the same pattern, not a new credential-management mechanism. No new vendor, no new AWS resource, no new IaC. Not treated as requiring its own Gate 1 subagent re-run or a new prerequisite story.
- **Gate 2 (UI Complexity & Reusability, run fresh via `runSubagent`/Agent tool, Freya persona, per this session's explicit dispatch instruction): No gap found.** Freya's verdict, verbatim: "Story 9.7's implementation surface is entirely a TypeScript fixtures file, a `node:test` test file, an opt-in Node script, and a GitHub Actions workflow — none of which touch `apps/web`, `packages/ui`, or any rendered surface. Gate 2's three triggers (a reusable UI component with non-trivial states, a complex hook/util shared across multiple UI components, or a UX-spec'd visual/interaction detail omitted from the draft) all presuppose a UI surface in scope to evaluate against; here there is none to check... Given zero UI footprint, absence of UI scope is sufficient grounds to close Gate 2 without a DESIGN.md/EXPERIENCE.md search." No `DESIGN.md`/`EXPERIENCE.md` load was performed for this story (confirmed appropriate by Freya, not skipped by default) since this story has zero `apps/web`/`packages/ui` footprint.

**No gap found by any gate.** This story proceeds as scoped.

### Design decisions (resolved defaults -- minimised per this session's dispatch instruction, not left as open questions)

1. **The PR-CI-required "stub" (AC1) is a hand-authored raw Gemini response fed straight into `transformGeminiResponseToFilterExpression`, never a mocked network/HTTP layer or the `setCallGeminiGenerateContent` DB-backed resolver-integration seam.** `transformGeminiResponseToFilterExpression` is a pure function in `packages/domain` with zero DB/network dependency by construction (confirmed: no `db/client.ts`-equivalent import anywhere in `packages/domain`). The alternative -- a full resolver-level integration test using `setCallGeminiGenerateContent` (the pattern `apps/backend/src/schema/ai-event-filters.test.ts` already uses) -- would work but inherits `apps/backend`'s `run-tests-with-row-count-ratchet.ts` wrapper, which establishes a live DB connection *unconditionally* before any test runs, regardless of whether the specific test touches the DB. Given this session's explicit requirement that the deterministic suite be the one the ACs/tests require, and that it must not need network (DB is a separate, already-available local resource, not the restricted thing, but adding an unnecessary DB dependency to a feature that doesn't need one is still the wrong default), `packages/domain` is the correct, lower-dependency home -- consistent with this project's own "packages/domain must be pure, 100%-unit-tested" convention and this epic's own Gate-3-cited precedent of keeping golden-prompt fixtures "within existing systems, nothing foundational."
2. **`expected` values are captured by executing the real function once during authoring, never hand-derived by inspecting the trim/double-NOT algorithms.** Verified necessary, not just convenient: the node-count trim loop (`findWidestGroupNode`/`trimNodeByIdentity`) removes a group's *last* child repeatedly until the tree validates, and the double-NOT collapse can be exposed only after `normalize()` runs -- both are order-dependent in ways a human reviewer could plausibly get subtly wrong (this story's own worked `over-limit-en-01` fixture required tracing two trim iterations by hand to land on exactly 11 of 13 surviving leaves). A "golden" fixture whose `expected` was itself wrong would silently defeat the entire regression-ratchet purpose of this story -- worse than no fixture at all, since a reviewer would trust it. Capturing the real function's actual output removes this risk category entirely.
3. **The opt-in live-eval script's drift comparison (`summarizeGoldenPromptDrift`) checks leaf-field-signature and caveat-presence, not exact `deepEqual` against each fixture's `expected`.** A live, non-deterministic model's exact wording for a `keyword`/`accountId` leaf's free-text value, or its exact self-reported caveat sentence, legitimately varies run to run without being a real extraction-quality regression -- an exact-match nightly check would be perpetually noisy (false "drift" on every run) rather than a useful signal. The two signals that *do* indicate a real regression -- which fields the model populated, and whether it produced any caveat at all -- are what the comparison checks. This is intentionally coarser than the PR-CI suite's exact `deepEqual` (which is correct there, since that suite's input is deterministic hand-authored data, not a live model).
4. **The live-eval script bypasses `callGemini`'s full BYOK/DB key-selection orchestration (`adapter.ts`) and calls `callGeminiGenerateContent` (`gemini-client.ts`) directly with a dedicated env-var API key.** `callGemini` exists to select among per-user BYOK keys stored encrypted in the database for an authenticated request; this script has no authenticated user and runs from a GitHub Actions job with no DB connection at all (a deliberate simplification, not an oversight -- it keeps the nightly job from needing `DATABASE_URL`/Postgres provisioning purely to run an eval). A dedicated, platform-funded key matches this project's own `SYSTEM_GEMINI_API_KEY` precedent (a structurally-isolated, platform-funded fallback key, documented in `SETUP_WALKTHROUGH.md` #8) rather than introducing a new credential-management pattern.
5. **A new secret (`GEMINI_NIGHTLY_EVAL_API_KEY`) is introduced rather than reusing `SYSTEM_GEMINI_API_KEY`.** `SETUP_WALKTHROUGH.md` #8 explicitly scopes `SYSTEM_GEMINI_API_KEY` as "used exclusively as the final fallback for default-location inference... structurally isolated and never used for general post extraction." Reusing it for a second, unrelated purpose (nightly filter-extraction drift eval) would quietly violate that documented isolation guarantee. A sibling dedicated key, following the exact same "platform-funded, free-tier, obtained via Google AI Studio" pattern, preserves the isolation guarantee for both.
6. **AC3's closure of `retro-7-1` is recorded as a deliberate scope-narrowing, not treated as if the action item's original wording were satisfied literally.** The action item's original text ("Monitor user behavior with AI filters to tune the system prompt for better date/location extraction accuracy") describes open-ended production monitoring; this story delivers a fixed, versioned regression suite plus an opt-in nightly drift report against that same fixed suite -- useful for catching regressions when the prompt/schema changes, but not literal live production-traffic monitoring. `ai-filter-boolean-nested-query-upgrade-plan.md` and `epic-formation/formation-2026-10-14.md` both already record this exact folding ("Closes via S5/S8: action item `retro-7-1` (prompt-refinement)"; "Sprint action item `retro-7-1` closes with Story 9.7"), so this narrowing is pre-existing planning intent, not a new decision this story is making unilaterally -- Task 9 makes the closure traceable in `sprint-status.yaml` itself rather than leaving it implicit across three separate planning documents.
7. **No `docs/infrastructure/architecture-diagram.md`/`high-level-overview.md` update is made.** CLAUDE.md's upkeep rule triggers on a service, queue, Lambda, scraper, database, hosting provider, or major library being added/removed/replaced. This story adds CI/test tooling (a fixtures file, two pure helper functions, a `node:test` suite, an opt-in script, a scheduled GitHub Actions workflow) -- none of which is a shipped product-architecture component in the sense that document tracks (confirmed by precedent: none of the existing `workflow_dispatch` backfill/trigger workflows are documented there either).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No changes required.** This story touches no database schema, no GraphQL schema/operation, and no existing `packages/domain` type's shape. It adds two new, independent pure modules (`golden-prompt-fixtures.ts`'s `GoldenPromptFixture`/`GoldenPromptCategory` types, `compute-golden-prompt-drift.ts`'s `GoldenPromptDriftResult` type) that are new, additive exports -- nothing existing is renamed, narrowed, or removed.
- **Impacted fields/contracts:** None existing. The two new type exports above are new additions to `@festgrid/domain/ai-event-filters`'s public surface.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond the new additive exports above -- no `graphql.ts` regeneration, since no `.graphql` operation document changes.
- **Backward compatibility and rollout notes:** Purely additive test/tooling change with no runtime production code path touched (the new `apps/backend/scripts/run-golden-prompt-live-eval.ts` is never imported by, nor does it import into, any Lambda handler, resolver, or other production entry point). A stale deployed backend bundle mid-rollout is entirely unaffected.
- **Verification checks:** `node:test`/`tsx --test` coverage on `golden-prompt-fixtures.test.ts` (fixture-level exact assertions + fixture-set-integrity meta-test) and `compute-golden-prompt-drift.test.ts` (pure drift-logic unit tests); static type-check/lint only (no execution) on `run-golden-prompt-live-eval.ts` and the new GitHub Actions workflow YAML.

### Previous Story Intelligence

Story 9.4 (`review`, implemented) is this story's direct and only dependency: it built the exact `transformGeminiResponseToFilterExpression` function (`packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.ts`) this story's entire fixture suite is written against, including its node-level degrade-to-caveat behavior (double-NOT collapse, over-limit trim) that this story's worked `over-limit-en-01` fixture exercises. Story 9.4's own test file (`transform-gemini-response-to-filter-expression.test.ts`) already established the `node:test`/`assert.deepEqual`-against-exact-expected-tree convention this story's `golden-prompt-fixtures.test.ts` directly follows, and its "trims a tree exceeding FILTER_NODE_MAX_NODES" test case (13-keyword-leaf OR) is the literal pattern `over-limit-en-01` mirrors. Story 9.1b (`review`, implemented, a dependency of 9.4) is why this story's fixtures can exercise `dateRange.spanAmount`/`spanUnit`, array-valued `dayOfWeek`, and `temporalFilter` -- all absent from the pre-9.1b flat-only vocabulary. No prior story in this epic created any fixture/golden-data file, so this story establishes the pattern fresh rather than extending an existing one (confirmed: no `__fixtures__`/golden-data directory exists yet under `packages/domain/src/ai-event-filters/` or `apps/backend/src/lib/ai-event-filters/`).

### Git Intelligence Summary

Recent commits (`git log --oneline -8`) are all `wip(9.6): dev-story progress` / `chore(9.6): tick ... checklists`, confirming 9.6 is the immediately-preceding, now-`review` work in this batch, with a clean working tree (`git status --short` empty) and no other concurrent epic work to reconcile against. Commit message convention observed across this batch: `type(scope): short description` (e.g. `wip(9.7): ...`, `feat(9.7): ...`, `chore(9.7): ...`).

### Project Structure Notes

- `packages/domain/src/ai-event-filters/golden-prompts/golden-prompt-fixtures.ts` is NEW (Task 1).
- `packages/domain/src/ai-event-filters/golden-prompts/golden-prompt-fixtures.test.ts` is NEW (Task 2).
- `packages/domain/src/ai-event-filters/golden-prompts/compute-golden-prompt-drift.ts` is NEW (Task 3).
- `packages/domain/src/ai-event-filters/golden-prompts/compute-golden-prompt-drift.test.ts` is NEW (Task 4).
- `packages/domain/src/ai-event-filters/index.ts` is UPDATEd (Task 5, two new `export *` lines, additive only).
- `apps/backend/scripts/run-golden-prompt-live-eval.ts` is NEW (Task 6).
- `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml` is NEW (Task 7).
- `SETUP_WALKTHROUGH.md` is UPDATEd (Task 8, new subsection appended under section 8, additive only).
- `_bmad-output/implementation-artifacts/sprint-status.yaml` is UPDATEd (Task 9, `action_items.retro-7-1` status/description only -- `development_status` entries and `backlog.yaml` are untouched by this task; this story's own `development_status['9-7-...']` entry is updated separately by `bmad-create-story`/`bmad-dev-story`'s own standard status-transition mechanics, not by a story Task).
- No `apps/web`, `packages/ui`, GraphQL schema, or database schema file is touched by this story (confirmed by Gate 1/2 findings above).
- No conflicts detected with the unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.7: Add golden-prompt evals for the AI filter] -- authoritative ACs this story elaborates.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md] -- Gate 1/3 epic-wide sweep findings cited above; confirms `9.7` is in `stories_covered`.
- [Source: _bmad-output/implementation-artifacts/sprint-status.yaml#action_items, retro-7-1] -- the exact action item this story closes (Task 9).
- [Source: _bmad-output/planning-artifacts/epic-formation/formation-2026-10-14.md] -- "Sprint action item `retro-7-1` closes with Story 9.7," corroborating Dev Notes decision 6.
- [Source: _bmad-output/planning-artifacts/ai-filter-boolean-nested-query-upgrade-plan.md#8] -- "Closes via S5/S8: action item `retro-7-1` (prompt-refinement)," corroborating Dev Notes decision 6.
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/SPEC.md#CAP-6, CAP-7] -- CAP-6's worked example (reused verbatim in `nesting-id-01`); CAP-7's date-grammar scope this suite's additional fixtures should exercise.
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/filter-vocabulary.md] -- the locked leaf vocabulary and the three documented always-caveat "out of vocabulary" cases this story's `out-of-vocabulary` fixtures must draw from.
- [Source: packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.ts, .test.ts] -- read in full; the exact function this entire story tests, and the existing test conventions (exact `assert.deepEqual`, the 13-leaf over-limit pattern) this story's fixtures/tests mirror.
- [Source: packages/domain/src/ai-event-filters/filter-node.ts, filter-node-schema.ts, normalize-filter-node.ts, flat-filter-conversion.ts, transform-gemini-response-to-event-filter.ts] -- read in full; the exact field-mapping/normalization behavior every worked fixture in Task 1 was hand-traced against.
- [Source: apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts] -- read in full; the exact raw-response shape (`{expression, caveats}`) fixtures mimic, and the functions Task 6's live-eval script reuses verbatim (no new system-prompt/schema logic introduced by this story).
- [Source: apps/backend/src/schema/resolvers.ts#resolvePromptToEventFilter] -- read in full; confirms the production call path this story's fixtures/live-eval script mirror (JSON-fence-stripping parse logic reused identically in Task 6).
- [Source: apps/backend/src/lib/ai-gateway/gemini-client.ts, adapter.test.ts] -- read in full; `callGeminiGenerateContent`'s exact signature (Task 6) and this repo's existing dependency-injection-seam mocking convention for Gemini calls (confirms Design decision 1's reasoning for why that DB-backed seam is not this story's PR-CI path).
- [Source: apps/backend/scripts/run-tests-with-row-count-ratchet.ts, apps/backend/src/env.ts] -- read in full; confirms `apps/backend test`'s unconditional live-DB-connection requirement (grounds Design decision 1) and `loadBackendEnv()`'s only hard-required var (`BACKEND_PORT`, grounds Task 6/7's env wiring).
- [Source: apps/backend/scripts/measure-ai-processor-runtime.cjs] -- the closest existing precedent for an "opt-in, not part of the default test run, never invoked by CI automatically" script; this story's Task 6 follows the same framing.
- [Source: .github/workflows/ci.yml, trigger-scraper.yml, backfill-post-media-keys.yml] -- read in full; confirms no existing `schedule:`-triggered workflow exists in this repo (Task 7 introduces the first one) and the exact `workflow_dispatch`/secrets/build-workspace-packages step conventions Task 7 mirrors.
- [Source: SETUP_WALKTHROUGH.md#8. AI Gateway (Google Gemini API)] -- read in full; the exact `SYSTEM_GEMINI_API_KEY` precedent (platform-funded, structurally isolated, Google-AI-Studio-obtained) Task 8/Design decision 5 extends with a sibling key rather than reuses.
- [Source: packages/domain/src/events/__fixtures__/ended-cases.ts] -- the repo's existing precedent for a committed TypeScript (not raw JSON) fixture file under `packages/domain`, confirming this story's `golden-prompt-fixtures.ts` format choice.
- [Source: packages/domain/package.json, apps/backend/package.json] -- confirms both packages' `test` scripts (`tsx --test "src/**/*.test.ts"` / the row-count-ratchet wrapper respectively) and that no `vitest.config.ts`/numeric coverage tool exists for either, grounding the "100%-coverage is a PR-review convention, not a tool gate" framing in Dev Notes decision 1.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] -- Gate 1/2/3 definitions, the epic-level-sweep citation rule, and the lightweight-guard instruction this story's Architecture & UX Gate Findings section follows.

## Global Rules References

- [x] `_bmad-output/project-context.md` -- Code Organization (`packages/domain` purity: both new modules are pure, dependency-free TypeScript -- no DB/ORM/Node-runtime-only imports); Testing Rules (100%-unit-test-coverage convention for `packages/domain`, satisfied by Tasks 2/4; the "testing trophy" convention does not apply here since nothing in this story's `apps/*` footprint beyond the statically-checked, never-executed `run-golden-prompt-live-eval.ts` needs a runtime test); Credential Management (`GEMINI_NIGHTLY_EVAL_API_KEY` is a `.env`/CI-secret-only credential, never hardcoded).
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` -- no PRD section is implicated by this story directly (Story 9.9z owns the PRD/vocabulary amendment for Epic 9's expression/date grammar; this story is pure test/CI tooling with no user-facing behavior change).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` -- this file follows its canonical 15-section order, status vocabulary, and Pre-Coding Approval Gate/Implementation Plan structure exactly.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` -- no AD section is implicated (no new infra/architecture decision; pure `packages/domain` test/fixture code plus an opt-in, never-executed-in-CI `apps/backend` script and a new CI-only workflow), per `epic-9-readiness.md`'s Gate 1 citation above; full file not loaded, consistent with Stories 9.1a-9.6's own precedent.
- [x] `docs/infrastructure/index.md` -- not applicable (no Lambda, queue, DB, or hosting change; the new GitHub Actions workflow is CI tooling, not a deployed infrastructure component -- see Dev Notes decision 7); confirmed via the `epic-9-readiness.md` citation above; full infra shards not loaded.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/domain/src/ai-event-filters/golden-prompts/golden-prompt-fixtures.ts` (Task 1) + `.test.ts` (Task 2).
  - NEW `packages/domain/src/ai-event-filters/golden-prompts/compute-golden-prompt-drift.ts` (Task 3) + `.test.ts` (Task 4).
  - UPDATE `packages/domain/src/ai-event-filters/index.ts` (Task 5).
  - NEW `apps/backend/scripts/run-golden-prompt-live-eval.ts` (Task 6).
  - NEW `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml` (Task 7).
  - UPDATE `SETUP_WALKTHROUGH.md` (Task 8).
  - UPDATE `_bmad-output/implementation-artifacts/sprint-status.yaml` (`action_items.retro-7-1` only, Task 9).
- **Rule Mapping:**
  - AC1 (≥40-prompt deterministic PR-CI suite, zero network) → Task 1 (fixtures), Task 2 (test + integrity meta-test), Design decisions 1-2.
  - AC2 (opt-in nightly live-Gemini drift report, never run by dev-story/CI-required path) → Task 3-4 (pure drift helper + its tests), Task 6 (script), Task 7 (workflow), Task 8 (secret docs), Design decisions 3-5, 7.
  - AC3 (closes `retro-7-1`) → Task 9, Design decision 6.
  - `packages/domain` purity/100%-coverage convention (project-context.md) → every new module in Tasks 1-5 is pure TypeScript with full `node:test` coverage; zero DB/ORM/Node-only import.
  - Gate 1/2/3 (story-split-gate.md) → Gate 1/3 cited from `epic-9-readiness.md` plus the lightweight-guard reasoning above; Gate 2 run fresh via `runSubagent` (Freya persona) -- no gap found, documented in Architecture & UX Gate Findings above.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` -- new fixture-exact-match cases, the fixture-set-integrity meta-test, and `compute-golden-prompt-drift.test.ts` all pass; full existing `domain` suite stays green.
  - `pnpm --filter @festgrid/domain lint`/`build` -- clean.
  - `pnpm --filter @festgrid/backend lint`/`build` -- clean (statically type-checks/lints the new script; never executes it).
  - `pnpm --filter @festgrid/backend test` -- full existing suite stays green (confirms zero regression; does not exercise the new script).
  - Manual: confirm `run-golden-prompt-live-eval.ts` is never invoked by any command run during this story's verification, and that `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml`'s only triggers are `schedule:`/`workflow_dispatch:` (never `push`/`pull_request`) -- the literal "no network, no live Gemini" check for this session's environment constraint.

## Pre-Coding Approval Gate

- [x] Scope confirmation -- two new `packages/domain` pure modules + their tests (fixtures + a drift-signature helper), one `packages/domain` barrel-export update, one new opt-in `apps/backend` script (never executed by this story's own verification), one new CI-only scheduled GitHub Actions workflow, one `SETUP_WALKTHROUGH.md` addition, one `sprint-status.yaml` `action_items` edit; zero DB migration, zero GraphQL schema/operation change, zero `apps/web`/`packages/ui` touch, zero live-network call made by the dev agent at any point.
- [x] Architecture and boundary confirmation -- Gate 1/3 cited from `epic-9-readiness.md` (no gap) plus a lightweight-guard reasoning pass for the new CI/secret surface (no gap, mirrors existing `workflow_dispatch`/`SYSTEM_GEMINI_API_KEY` precedent); Gate 2 run fresh via `runSubagent` (Freya persona) found no gap (zero UI surface in scope).
- [x] Testing plan confirmation -- `node:test`/`tsx --test` coverage on `golden-prompt-fixtures.test.ts` (≥40 exact fixture assertions + a fixture-set-integrity meta-test) and `compute-golden-prompt-drift.test.ts` (pure drift-logic unit tests); the live-eval script and its workflow are verified only statically (type-check/lint), by explicit environment-constraint design, never executed.
- [x] Explicit human approval state -- APPROVED by user (dispatch instruction for this Epic 9 batch: "skip Gate 1/3 and run Gate 2 only... Minimise questions: choose the recommended default and record it in Dev Notes," plus this story's own explicit environment constraint that the dev agent has no network and must not call the live Gemini API or any external service), 2026-10-15. This blanket instruction is treated as the explicit authorization for every routine design default recorded above (decisions 1-7), matching Stories 9.1a-9.6's own identical precedent for this same batch. No decision in this story carries the kind of real, non-mechanical tradeoff that would otherwise warrant a standalone question (the closest candidates -- whether to reuse `SYSTEM_GEMINI_API_KEY` vs. introduce a new secret, and exact-match vs. field-signature drift comparison -- are both resolved toward the documented, lower-risk, precedent-matching default, per Design decisions 3 and 5).
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted -- Gate 1/3: no gap, N/A (cited, plus lightweight-guard reasoning above). Gate 2: no gap, N/A (run fresh). No prerequisite story is created by this story.

## Testing Requirements

- [x] Unit/integration tests (`node:test`/`tsx --test`, `packages/domain`): `golden-prompt-fixtures.test.ts` -- one exact `assert.deepEqual` case per fixture (≥40) against the real `transformGeminiResponseToFilterExpression`, plus a fixture-set-integrity meta-test (count/language/category-distribution/uniqueness/re-validation assertions).
- [x] Unit tests (`node:test`/`tsx --test`, `packages/domain`): `compute-golden-prompt-drift.test.ts` -- `computeFilterNodeFieldSignature` against leaf/NOT/nested-group inputs; `summarizeGoldenPromptDrift` against matching, field-mismatched, and caveat-presence-mismatched synthetic inputs.
- [x] Static verification only (no execution): `apps/backend/scripts/run-golden-prompt-live-eval.ts` type-checks and lints cleanly (`pnpm --filter @festgrid/backend build`/`lint`); `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml` is valid YAML with only `schedule:`/`workflow_dispatch:` triggers.
- [x] E2E tests: not applicable -- no new route/page/critical-flow surface (confirmed by Gate 2's "no gap" verdict above); this story adds test/CI infrastructure only.
- [x] Regression check: `pnpm --filter @festgrid/domain test` and `pnpm --filter @festgrid/backend test` (full existing suites) stay green.

## Deliverables Checklist

- [x] `packages/domain/src/ai-event-filters/golden-prompts/golden-prompt-fixtures.ts` exports `GOLDEN_PROMPT_FIXTURES` with ≥40 entries satisfying the ≥15 `en`/≥15 `id`/≥2-per-category-per-language distribution, each entry's `expected` captured by actually executing `transformGeminiResponseToFilterExpression`, never hand-derived.
- [x] `golden-prompt-fixtures.test.ts` asserts every fixture exactly and the fixture-set-integrity meta-test passes.
- [x] `compute-golden-prompt-drift.ts`/`.test.ts` provide independently-unit-tested, pure drift-signature logic.
- [x] `packages/domain/src/ai-event-filters/index.ts` re-exports both new modules.
- [x] `apps/backend/scripts/run-golden-prompt-live-eval.ts` exists, is a strict no-op without `RUN_LIVE_GEMINI_EVAL=true`, type-checks and lints cleanly, and is never executed during this story's own verification.
- [x] `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml` exists with `schedule:`+`workflow_dispatch:` triggers only, separate from `ci.yml`.
- [x] `SETUP_WALKTHROUGH.md` documents the new `GEMINI_NIGHTLY_EVAL_API_KEY` secret.
- [x] `sprint-status.yaml`'s `retro-7-1` action item is `closed` with the recorded closure note.
- [x] All new/updated test files passing; `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/backend test`/`lint`/`build` all green; no live Gemini call made at any point.

## Out of Scope

- **Any actual execution of `run-golden-prompt-live-eval.ts`, with or without a real API key** -- by this session's explicit environment constraint, the dev agent never runs this script; its correctness is established statically plus through `compute-golden-prompt-drift.test.ts`'s coverage of its pure delegate logic. A human (or the nightly schedule, once a real `GEMINI_NIGHTLY_EVAL_API_KEY` secret is configured) runs it outside this story's verification.
- **Actually obtaining/configuring a real `GEMINI_NIGHTLY_EVAL_API_KEY` secret value** -- this story documents the setup step (Task 8) and wires the workflow to read it, but provisioning the actual Google AI Studio key and adding it to the GitHub repository's secrets is an operator action outside a dev agent's local, network-free session.
- **Any change to `resolvePromptToEventFilter`, `transformGeminiResponseToFilterExpression`, or any other already-shipped Story 9.1a-9.6 production code** -- this story is a pure addition of tests/fixtures/tooling against the existing, unchanged behavior.
- **A full resolver-level (DB-backed, `setCallGeminiGenerateContent`-seamed) integration test for `resolvePromptToEventFilter`** -- already exists from Stories 9.3/9.4 (`apps/backend/src/schema/ai-event-filters.test.ts`); this story does not duplicate or extend it (see Design decision 1).
- **Stories 9.8 (rate limiting), 9.9z (ratchet + PRD amendment)** -- unrelated, independent scope.
- No new Gate 1/2/3 gap was found by this story; no new prerequisite story results from it.

## Definition of Done

- [x] AC1-AC3 satisfied and verified by their respective tests/edits.
- [x] Required tests passing: `pnpm --filter @festgrid/domain test` and `pnpm --filter @festgrid/backend test`.
- [x] Lint and type checks passing: `pnpm --filter @festgrid/domain lint`/`build`, `pnpm --filter @festgrid/backend lint`/`build`.
- [x] Zero network call, zero live Gemini API call, made by the dev agent at any point during implementation or verification.

## Completion Status

- [x] Complete -- implementation done and independently verified by the orchestrator (see Dev Agent Record)

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

### Orchestrator verification note (2026-10-15)

The dev-story session ended before running the last verification item, so the orchestrator ran it independently:

- `@festgrid/domain`: 795/795 tests pass; lint and build exit 0. `backend`: lint and build exit 0.
- Full `pnpm --filter backend test`: 1245 tests, 1240 pass, 2 fail (1 subtest + its parent suite), 3 skipped. The failure is `trigger-brightdata-for-target` "returns CAPACITY_EXHAUSTED when capacity unavailable"; it reproduces in isolation and this branch changes nothing under `apps/backend/src/lib/scraper` or the lambdas, so it is not caused by Story 9.7. It is not in the previously documented baseline list.
- The row-count ratchet flagged `user_locations: 0 -> 1`. Story 9.7's backend additions (and the other Epic 9 backend tests, run alone through the ratchet) leave no rows behind: 21/21 pass with exit 0.
- No live Gemini call or network call was made at any point; `run-golden-prompt-live-eval.ts` was never executed.
- The workflow file `.github/workflows/ai-filter-golden-prompt-nightly-eval.yml` could not be pushed from the agent session (its token lacked the `workflow` OAuth scope), so the repo owner added it through the GitHub web UI (commit `1614720f`, identical to the corrected copy the orchestrator had parked). It is now applied and the parked copy has been removed. On review the orchestrator had fixed its last step: `pnpm --filter @festgrid/backend exec ...` matched no project (the package is named `backend`), so it is `pnpm --filter backend exec tsx scripts/run-golden-prompt-live-eval.ts`. The repo secret `GEMINI_NIGHTLY_EVAL_API_KEY` must exist before the first nightly run.
