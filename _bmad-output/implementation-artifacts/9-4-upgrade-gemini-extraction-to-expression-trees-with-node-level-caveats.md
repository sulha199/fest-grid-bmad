---
baseline_commit: 45ab3704ed324c30547008a2d53a26e6f1bf4c0e
---

# Story 9.4: Upgrade Gemini extraction to expression trees with node-level caveats

## Story Details

- Epic: 9
- Story ID: 9.4
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want my grouped prompt understood correctly, and any part that cannot be understood called out,
so that a partly unsupported prompt still gives useful results.

## Acceptance Criteria

1. **AC1 — Expression-tree response, bounded structurally, bilingual few-shot precedence examples (epics.md AC1):** Given the single-shot structured-output prompt sent to Gemini, when the prompt text contains and/or/not and grouping, then:
   - `resolvePromptToEventFilter`'s system instruction and Gemini `responseSchema` (`apps/backend/src/schema/resolvers.ts`) — today an inline, flat-only schema that was never updated for Story 9.1b's grammar extensions (confirmed: it has no `dateRange.spanAmount`/`spanUnit`, no array-valued `dayOfWeek`, no `temporalFilter` property at all, even though `transformGeminiResponseToEventFilter` has supported reading all three since 9.1b — Gemini is simply never asked to produce them today, an end-to-end dead end this story also closes since it is rewriting this exact prompt/schema anyway) — are replaced with a tree-shaped request built by a new `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`.
   - The new `responseSchema` is an explicitly unrolled, non-recursive 3-level `OBJECT` schema matching `FILTER_NODE_MAX_DEPTH` (3): each of the 3 levels carries every locked leaf-vocabulary property (including the three closed-off fields above) plus optional `op` (`AND`/`OR`/`NOT`)/`children`/`child` wrapper fields; the innermost (3rd) level omits `op`/`children`/`child` entirely, so Gemini is structurally incapable of emitting a tree deeper than the shared limit. No `$ref`/recursive schema and no `oneOf`/discriminated union is used — Gemini's structured-output schema format (the same OpenAPI-subset this codebase's other Gemini call site, `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, already uses) supports neither.
   - The system instruction documents the `op`/`children`/`child` grammar (depth ≤ 3, ≤ 12 nodes total, `NOT` wraps exactly one leaf-or-group and keeps events with no value for the negated field — `NULL ≠ x`) and includes at least one English and one Indonesian few-shot example demonstrating AND/OR/NOT precedence and grouping, using the SPEC's own worked example ("jazz or blues in Sleman or Bantul this weekend, not workshops") as the canonical English case and its Indonesian equivalent.

2. **AC2 — Node-by-node degrade, legacy flat response still accepted (epics.md AC2):** Given Gemini's raw JSON response, when it is transformed, then:
   - A new, pure, synchronous `packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.ts` exports `transformGeminiResponseToFilterExpression(payload: unknown): { expression: FilterNode; caveats: string[] }`.
   - It accepts either `payload.expression` (the new tree shape) or `payload.resolvedFilter` (the legacy flat shape — reusing the existing `transformGeminiResponseToEventFilter` + `expressionFromFlatFilter` + `normalize` pipeline unchanged) or neither (degrades to an empty filter, never throws).
   - Each non-group ("leaf-shaped") node in the raw tree is itself run through the existing `transformGeminiResponseToEventFilter`, so a node carrying 2+ populated fields naturally expands into multiple sibling leaves that are spliced directly into the parent's `children` list rather than nested — this is the deliberate mechanism that prevents a multi-field leaf node from ever adding an extra depth level beyond what the bounded schema already budgeted (a leaf position is always exactly one slot, regardless of `AND`/`OR` parent, so siblings never nest there).
   - An invalid or over-limit sub-expression is dropped with a caveat while the rest of the tree still applies: a double-`NOT` (a `NOT` whose immediate child is itself `NOT` — structurally impossible from the schema's own shape, but checked anyway since Gemini output is untrusted) drops the outer `NOT` with one pushed caveat; after assembly, `normalize()` runs once and `validateFilterNode` (Story 9.1a) is the sole, reused arbiter of the depth/node-count limits (never re-implemented locally, per 9.1a AC4's "single definition of limits"); if it still reports a node-count violation (a legitimately wide tree), the degrade step trims children from the tree's widest group until valid, pushing one generic "too complex, some conditions were dropped" caveat the first time a trim occurs.
   - Every Gemini-self-reported string in `payload.caveats` is preserved and merged with whatever caveats this function itself pushes.

3. **AC3 — `account` leaf reuses the existing accountId resolution, IDEA-065 (epics.md AC3):** Given a validated, degraded expression that may contain zero, one, or several `accountId` leaves (e.g. under an `OR`), then:
   - A new `apps/backend/src/lib/ai-event-filters/resolve-filter-expression-account-ids.ts` exports `resolveFilterExpressionAccountIds(node: FilterNode, userId: string): Promise<{ expression: FilterNode; caveats: string[] }>`, which walks the tree for every `field: 'accountId'` leaf, resolves each distinct raw value via the existing `resolveFilterAccountId` (unchanged), replaces resolved leaves in place, drops unresolved ones (pushing the existing `Could not find an account matching "X", so events from all accounts are shown.` caveat wording, per dropped value), and re-normalizes.
   - A new, pure, generic `packages/domain/src/ai-event-filters/map-filter-leaves.ts` exports `mapFilterLeaves(node: FilterNode, mapLeaf: (leaf: FilterLeaf) => FilterLeaf | undefined): FilterNode | undefined` — a shared tree-editing primitive (drop/replace a leaf, collapsing an emptied group or a `NOT` left with nothing) that the backend account-resolution step above is built on.
   - `resolvePromptToEventFilter` calls `transformGeminiResponseToFilterExpression` and then `resolveFilterExpressionAccountIds`, in that order, before returning.

4. **AC4 — Stays single-shot/structured-output only; `ResolvedAIEventFilterResult` gains `expression` (epics.md AC4):** Given the mutation's existing shape, then:
   - No chat history, no follow-up turn, and no new mutation or argument is added — `resolvePromptToEventFilter(prompt: String!): ResolvedAIEventFilterResult!` keeps its exact existing signature.
   - `apps/backend/src/schema/ai-event-filters.graphql`'s `ResolvedAIEventFilterResult` gains `expression: FilterNode!` (the GraphQL `FilterNode` type already exists, built by Story 9.3 in `events.graphql`). `resolvedFilter: EventFilter!` stays non-null: for a non-flat (`OR`/`NOT`-containing) resolved expression, `flatFilterFromExpression`'s thrown error is caught and `resolvedFilter` degrades to `{}` — an honest "no flat projection" rather than a fabricated partial approximation (matching Story 9.3's `resolveStoredFilter` precedent, adapted here for this field's non-null GraphQL contract) — never a 500.
   - `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` are regenerated and committed.

**Depends on:** Story 9.1a, Story 9.1b, Story 9.3.

## Tasks / Subtasks

- [x] 1. **(AC2)** Create `packages/domain/src/ai-event-filters/map-filter-leaves.ts`:
  - `export function mapFilterLeaves(node: FilterNode, mapLeaf: (leaf: FilterLeaf) => FilterLeaf | undefined): FilterNode | undefined` — leaves: return `mapLeaf(node)` directly (may be the same leaf, a replaced leaf, or `undefined` to drop it). `NOT`: recurse into `child`; if the mapped child is `undefined`, drop the whole `NOT` (return `undefined`); otherwise return `{ op: 'NOT', child: mappedChild }`. `AND`/`OR`: recurse into every child via `mapFilterLeaves`, filter out `undefined` results; if zero children remain, return `undefined`; otherwise return `{ op: node.op, children: mappedChildren }` (do **not** collapse a single remaining child here — that is `normalize()`'s job, called separately by every caller, exactly as `compile-filter-node.ts` already establishes the "normalize once, at the top, as an explicit separate call" convention).
  - Export from `packages/domain/src/ai-event-filters/index.ts`.

- [x] 2. **(AC2, Data Type Compatibility)** Create `packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.ts`:
  - `export interface GeminiFilterExtractionResult { expression: FilterNode; caveats: string[] }`
  - `export function transformGeminiResponseToFilterExpression(payload: unknown): GeminiFilterExtractionResult`.
  - Internal (not exported) `convertRawNode(raw: unknown): FilterNode[]` — returns zero, one, or several sibling nodes for one raw JSON value, never a nested wrapper for a leaf position (see AC2's depth-safety rationale above):
    - Not a plain object → `[]`.
    - `raw.op === 'AND' | 'OR'` → recursively `convertRawNode` every entry of `raw.children` (default `[]` if not an array) via `flatMap`; if the result has zero entries, return `[]`; otherwise return `[{ op: raw.op, children: <result> }]`.
    - `raw.op === 'NOT'` → recursively convert `raw.child`; if zero results, return `[]`; if exactly one, wrap as `{ op: 'NOT', child: <it> }`; if several, first bundle them as `{ op: 'AND', children: <them> }` then wrap that in `NOT` (this is the one case allowed to add a wrapper at a single-slot position, matching `expressionFromFlatFilter`'s own "always wrap multiple leaves from one flat object in an explicit AND" precedent). If the resulting `NOT`'s `child` is itself a `NOT` node (double-NOT), push the caveat `"A double negation in your prompt was simplified; the surrounding condition was dropped."` and return `[]` instead (drop the whole outer `NOT`).
    - Otherwise (no recognized `op` — a leaf-shaped object): run `raw` through the existing `transformGeminiResponseToEventFilter(raw)`, then `expressionFromFlatFilter(...)`; return that result's `.children` array as-is (0, 1, or several `FilterLeaf` siblings — never nested, by `expressionFromFlatFilter`'s own contract).
  - Top level: pick the candidate — `isPlainObject(payload) && 'expression' in payload` → `payload.expression`; else `isPlainObject(payload) && 'resolvedFilter' in payload` → run the legacy path directly (`normalize(expressionFromFlatFilter(transformGeminiResponseToEventFilter(payload.resolvedFilter)))`, skip `convertRawNode` entirely since this is already a known-flat shape); else → treat as empty (no expression at all).
  - For the new-shape path: `siblings = convertRawNode(candidate)`; root = `siblings.length === 0 ? {op:'AND', children:[]} : siblings.length === 1 ? siblings[0] : {op:'AND', children: siblings}`; then `normalized = normalize(root)`.
  - Final safety net: run `validateFilterNode(normalized)`. If valid, use it as-is. If invalid **only** because of a node-count violation (the depth limit cannot be violated here — see AC2's structural rationale — so any depth-related issue at this point indicates a real bug, not untrusted-input shape, and should **not** be silently swallowed: rethrow/let it propagate), repeatedly trim the last child off whichever top-level (or nested) group currently has the most children, re-normalizing and re-validating after each trim, until valid or empty; push the caveat `"Your prompt described more conditions than the filter supports, so some were dropped."` the first time a trim actually occurs (never more than once).
  - Merge caveats: `[...(Array.isArray(payload?.caveats) ? payload.caveats.filter(c => typeof c === 'string') : []), ...pushedCaveats]`.
  - Export from `index.ts`.

- [x] 3. **(AC3)** Create `apps/backend/src/lib/ai-event-filters/resolve-filter-expression-account-ids.ts`:
  - `export async function resolveFilterExpressionAccountIds(node: FilterNode, userId: string): Promise<{ expression: FilterNode; caveats: string[] }>`.
  - Walk `node` (using `isFilterLeaf`/`isFilterGroupNode`/`isFilterNotNode` from `@festgrid/domain/ai-event-filters`) to collect every distinct raw value of a `field: 'accountId'` leaf.
  - If none found, return `{ expression: node, caveats: [] }` unchanged (skip the DB round trip entirely).
  - Otherwise, resolve every distinct value concurrently via `Promise.all(... resolveFilterAccountId(userId, value) ...)`, build a `Map<string, string | null>`.
  - Use `mapFilterLeaves(node, (leaf) => { if (leaf.field !== 'accountId') return leaf; const resolved = map.get(leaf.value); if (resolved) return { field: 'accountId', value: resolved }; caveats.push(\`Could not find an account matching "${leaf.value}", so events from all accounts are shown.\`); return undefined; })`, then `normalize()` the (possibly `undefined`, meaning fully emptied) result — `undefined` becomes `{op:'AND', children:[]}`.
  - Export from a local module (no `index.ts` barrel exists under `apps/backend/src/lib/ai-event-filters/` today — add the file alongside the existing `resolve-filter-account-id.ts`, imported directly by `resolvers.ts`, matching that existing file's own import style).

- [x] 4. **(AC1, Data Type Compatibility)** Create `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`:
  - `export function buildFilterExtractionSystemInstruction(): string` — the full system instruction: role/task framing (reusing today's "AI assistant... Indonesia (mainly Yogyakarta/Sleman)" framing), the complete field vocabulary table (every field from `filter-vocabulary.md`, including the three closed-off fields this story fixes: `dateRange.spanAmount`/`spanUnit`, array-valued `dayOfWeek`, `temporalFilter`), the `op`/`children`/`child` grammar explanation (depth ≤ 3, ≤ 12 nodes, `NOT` semantics incl. `NULL ≠ x`, no double `NOT`), and at least one English and one Indonesian few-shot example pair demonstrating AND/OR/NOT precedence — use the SPEC's own worked example as the canonical EN case: `"jazz or blues in Sleman or Bantul this weekend, not workshops"` →
    ```
    { op: 'AND', children: [
        { op: 'OR', children: [{field:'keyword',...}, {field:'keyword',...}] },   // jazz / blues
        { op: 'OR', children: [{field:'locationAdminArea',...}, {field:'locationAdminArea',...}] },  // Sleman / Bantul
        { dateRange: {...THIS_WEEK...}, dayOfWeek: ['SAT','SUN'] },               // "this weekend" (one leaf node, two populated fields)
        { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] } }
      ] }
    ```
    (depth 3 exactly, matching `filter-node.ts`'s own doc comment that this example is "sized for" the depth limit) — plus its direct Indonesian equivalent ("musik jazz atau blues di Sleman atau Bantul akhir pekan ini, bukan workshop") mapped to the identical tree shape, so the system instruction demonstrates that grouping/precedence is language-independent.
  - `export function buildFilterExtractionResponseSchema(): object` — builds the bounded 3-level schema via one internal `buildLeafProperties()` (the per-field `OBJECT`/`ARRAY`/`STRING`+`enum` properties, reusing `Object.values(EventType/EventCategory/DateAnchor/DateOffsetUnit/DayOfWeek/TemporalFilter)` for every enum-backed field exactly as `build-gemini-request.ts` already does for the other Gemini call site — a deliberate, low-risk parity fix since today's live flat schema omits `enum` entirely) and one internal `buildNodeSchema(childSchema?: object)` composer (adds `op`/`children`/`child` only when `childSchema` is supplied) invoked 3 times (innermost call with no argument → leaf-only level 3; wrapped twice more for levels 2 and 1). Top-level shape: `{ type: 'OBJECT', properties: { expression: level1Schema, caveats: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['expression', 'caveats'] }`.

- [x] 5. **(AC1, AC2, AC3, AC4)** In `apps/backend/src/schema/resolvers.ts`'s `resolvePromptToEventFilter`:
  - Replace the inline `systemInstruction` string and the inline `responseSchema` object with `buildFilterExtractionSystemInstruction()`/`buildFilterExtractionResponseSchema()` (new imports from `../lib/ai-event-filters/build-filter-extraction-request.js`).
  - Replace `transformGeminiResponseToEventFilter(parsed.resolvedFilter)` and the inline single-`accountId` resolution block with: `const { expression: rawExpression, caveats: extractionCaveats } = transformGeminiResponseToFilterExpression(parsed);` → `const { expression, caveats: accountCaveats } = await resolveFilterExpressionAccountIds(rawExpression, authUser.userId);` (new import `resolveFilterExpressionAccountIds` from `../lib/ai-event-filters/resolve-filter-expression-account-ids.js`; new import `transformGeminiResponseToFilterExpression` alongside the existing `transformGeminiResponseToEventFilter` import from `@festgrid/domain/ai-event-filters`) → `let resolvedFilter: EventFilterInput; try { resolvedFilter = flatFilterFromExpression(expression); } catch { resolvedFilter = {}; }` (new import `flatFilterFromExpression`) → `return { resolvedFilter: resolvedFilter as any, expression: expression as any, caveats: [...extractionCaveats, ...accountCaveats] };`.
  - Leave the existing `NO_API_KEY`/prompt-length pre-checks, the `AiGatewayExhaustedError`/`AiGatewayBusyError` catch branches, and the raw-JSON-parse try/catch (markdown-fence stripping) entirely unchanged.

- [x] 6. **(AC4)** In `apps/backend/src/schema/ai-event-filters.graphql`: add `expression: FilterNode!` to `ResolvedAIEventFilterResult`, immediately after `resolvedFilter: EventFilter!`.

- [x] 7. **(Testing, AC2)** `packages/domain/src/ai-event-filters/map-filter-leaves.test.ts` (new, `node:test`, 100% branch coverage): drop a leaf (single-child group collapses to `undefined`, multi-child group keeps the rest); replace a leaf's value in place; a `NOT` whose child drops entirely also drops; a nested `AND`-inside-`OR` where only the inner leaf survives; a no-op pass (predicate always returns the same leaf) round-trips unchanged; idempotence (`mapFilterLeaves` applied twice with the same always-keep predicate is a no-op).

- [x] 8. **(Testing, AC2)** `packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.test.ts` (new, `node:test`, 100% branch coverage):
  - A tree-shaped `{expression: {...AND/OR/NOT...}, caveats: [...]}` payload (reuse the SPEC worked-example tree from Task 4) converts to the exact expected `FilterNode` and preserves the model's own caveats.
  - A legacy flat `{resolvedFilter: {...}, caveats: [...]}` payload (AC2's "v1 flat response still accepted") converts correctly — regression-anchor this on the *exact* existing fixture `apps/backend/src/schema/ai-event-filters.test.ts` already mocks (`{resolvedFilter: {keyword:'live jazz', types:['PERFORMANCE'], categories:['MUSIC']}, caveats:['ignoring price filter']}`), asserting the resulting `expression` is `normalize(expressionFromFlatFilter({...that object}))` and `caveats` includes `'ignoring price filter'`.
  - A raw leaf-object with 2+ populated fields nested at the deepest allowed level under an `OR` parent expands to siblings spliced into that `OR`'s own `children` (not nested one level deeper) — the explicit depth-safety regression test for AC2's "never adds an extra depth level" design decision; assert the resulting tree's depth is still ≤ `FILTER_NODE_MAX_DEPTH`.
  - A double-`NOT` (`{op:'NOT', child:{op:'NOT', child:{field:'isFree', value:true}}}`) drops the outer `NOT` entirely and pushes the double-negation caveat.
  - A tree whose node count would exceed `FILTER_NODE_MAX_NODES` (construct ≥13 leaf siblings under one `OR`) is trimmed to validity with exactly one generic over-limit caveat pushed, regardless of how many nodes were trimmed.
  - `null`/`{}`/garbage payload (neither `expression` nor `resolvedFilter` key) degrades to `{op:'AND', children:[]}` with no caveats pushed and no throw.
  - A leaf with an out-of-vocabulary/garbage field inside an otherwise-valid tree is silently dropped (no caveat pushed by this function — matching `transformGeminiResponseToEventFilter`'s existing per-field degrade convention; the model is expected to self-report via its own `caveats` array, not this function).

- [x] 9. **(Testing, AC3)** `apps/backend/src/lib/ai-event-filters/resolve-filter-expression-account-ids.test.ts` (new, `node:test`, seeded DB, mirroring `resolve-filter-account-id.ts`'s own existing test fixtures/patterns): a tree with two distinct `accountId` leaves under an `OR` (one resolves to a real subscribed account, one does not) resolves the first in place, drops the second with the existing caveat wording, and the surviving tree still validates; a tree with zero `accountId` leaves passes through with an empty `caveats` array and performs no DB query (assert via a call-count spy or by not seeding any account data and confirming no error); a tree with one `accountId` leaf that resolves updates the leaf's value to the real profile UUID.

- [x] 10. **(Testing, AC1, AC2, AC3, AC4)** Extend `apps/backend/src/schema/ai-event-filters.test.ts`'s `resolvePromptToEventFilter` test block:
  - Update the existing "succeeds when user has key and Gemini responds successfully" test's mocked `callGeminiGenerateContent` response to the new tree-shaped `{expression: {...}, caveats: [...]}` shape and assert both `resolvedFilter` (flat back-projection) and the new `expression` field are correct for a simple (flat-representable) tree; add a GraphQL query selection for `expression { op children { ... } }` (or a minimal subset sufficient to assert the shape) alongside the existing `resolvedFilter`/`caveats` selections.
  - Add a new test asserting the EXACT existing legacy-shape fixture (`{resolvedFilter: {keyword:'live jazz', ...}, caveats:['ignoring price filter']}`) still works end-to-end through the full resolver (AC2's "v1 flat response still accepted" regression anchor, at the integration level as well as the unit level from Task 8).
  - Add a new test with a mocked Gemini response containing an `OR`/`NOT` grouped tree: assert `expression` reflects the grouping and `resolvedFilter` is `{}` (AC4's "honest empty projection for a non-flat result," never a crash, never a fabricated partial filter).
  - Update the existing "resolves a named @handle... (IDEA-065)" test's mocked response to the new tree shape (a single `accountId` leaf) and confirm the existing assertions (resolved profile id on success; dropped + caveat on no match) still hold through the new `resolveFilterExpressionAccountIds` path; extend it with a second case: two `accountId` leaves under an `OR`, one resolves and one does not.
  - Confirm the existing "reports temporary key contention... (PR #57 review)" test is unaffected by this story's changes (no mocked-response-shape dependency).

- [x] 11. **(Verification, AC1-AC4)** Run `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/backend test`/`lint`/`build`, `pnpm --filter @festgrid/backend codegen`, `pnpm --filter @festgrid/web codegen`, `pnpm --filter @festgrid/web lint`/`build`. Commit the regenerated `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` diffs alongside the source changes (AC4).

## Dev Notes

### Architecture & UX Gate Findings

Per `epic-9-readiness.md` (`swept: true`, 2026-10-14), Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) were already run epic-wide and are cited here rather than re-run, per this session's explicit dispatch instruction ("Epic 9 readiness sweep is done... skip Gate 1/3 and run Gate 2 only"):

- **Gate 1 (epic-wide, cited):** "No epic-wide bypass found... the AI vendor call path: Story 0.13 (AI Gateway adapter) and Epic 0.i2's guarded vendor-call wrapper... are confirmed in code: `resolvers.ts`'s `resolvePromptToEventFilter` already calls `callGemini`... which routes through `callVendor`... Story 9.4 (upgrading the Gemini transform to expression trees) rides this same, already-adopted call path — no new vendor-call plumbing needed." Confirmed consistent: this story only rewrites the system instruction/`responseSchema` passed to the existing `callGemini(...)` call and the pure/backend transform/resolution functions downstream of it; it adds no new Lambda, queue, IaC, or vendor-call mechanism.
- **Gate 3 (epic-wide, cited):** no new Epic 0/cross-cutting dependency gap found for the epic; "`accountId` resolution (IDEA-065), cited by Story 9.4's AC: verified already shipped — `resolveFilterAccountId`... is live and called from `resolvePromptToEventFilter`. Not a phantom dependency." This story reuses that function unchanged (AC3), generalized to a tree-walk rather than a single field, via a new backend-only helper — not a new Epic 0 mechanism, since this is the only place in the codebase that needs to resolve *several* `accountId` values out of one filter in one call.
- **Lightweight guard (this story, checked fresh):** does 9.4's actual scope contain anything the epic-wide sweep plausibly didn't anticipate? One thing surfaced, not a gap in the sweep's own reasoning but a concrete finding about the *current* state of the exact file this story rewrites: the live `resolvePromptToEventFilter` system instruction/`responseSchema` have **never been updated for Story 9.1b's grammar extensions** — `dateRange.spanAmount`/`spanUnit`, array-valued `dayOfWeek`, and `temporalFilter` are all read by `transformGeminiResponseToEventFilter` today but never requested of Gemini, making them dead end-to-end since 9.1b shipped. Both 9.1b's and 9.3's own Dev Notes explicitly name this as *this* story's job ("the live `resolvePromptToEventFilter` system prompt is unchanged until Story 9.4" — 9.1b Dev Notes decision 2; "Upgrading `resolvePromptToEventFilter`'s system prompt/response schema... Story 9.4's exclusive scope" — 9.3 Out of Scope), so closing it here (AC1/Task 4) is this story fulfilling an already-anticipated dependency, not scope creep.
- **Gate 2 (UI Complexity & Reusability, run fresh via `runSubagent`, Freya persona, per this session's explicit dispatch instruction): Gap found.** `useAIFilter`'s three consumers (`home-content.tsx`/`feed-content.tsx`/`favorites-content.tsx`) build their events query only from the flat `resolvedFilter` projection (via `buildEventsQueryCondition`/`buildFeedQueryCondition`/`buildAccountEventsQueryCondition`), never from an `expression` tree — even though the backend (`Query.events(expression:)`, Story 9.3) and the compiler (`compileFilterNodeToQueryCondition`, Story 9.2) already support one end to end. This story is the first one that can make Gemini actually produce a non-flat (`OR`/`NOT`) expression; the moment it ships, a grouped/boolean prompt (exactly the capability this epic exists to deliver) will resolve correctly server-side (AC1-AC3) but silently apply as an empty, unfiltered `{}` on Discovery/Feed/Favorites, with no caveat surfacing the loss to the user, because `resolvedFilter` is honestly empty for a non-flat expression (AC4) and nothing on the frontend reads `expression` yet. **Not absorbed into this story** per Gate 2's required action ("do not let the story implement the workaround... treat the missing layer/component as its own prerequisite story") — split into **Story 9.4a** (new, lettered off this story, added to `epics.md` immediately after this story's section and to `sprint-status.yaml`'s backlog in the same position), which extends `useAIFilter` (a hook consumed by ≥3 screens — squarely Gate 2's own reuse heuristic) and gives `buildEventsQueryCondition` the same `expression` parameter Story 9.3 already gave `buildFeedQueryCondition`/`buildAccountEventsQueryCondition`. This story (9.4) ships the correct, fully-tested extraction/resolver layer that 9.4a is the necessary and sufficient consumer of — per this session's explicit "minimise questions, choose the recommended default, record it in Dev Notes" instruction, the gap is documented and split per the gate's own prescribed default rather than escalated as a question, and this story proceeds (its own ACs stand correctly on their own; see Pre-Coding Approval Gate below for the explicit accepted-gap record).

### Filter-extraction design decisions (resolved defaults — minimised per this session's dispatch instruction, not left as open questions)

1. **Bounded, explicitly-unrolled (non-recursive) 3-level `responseSchema` instead of a recursive/`$ref` or `oneOf`-based tree schema.** Gemini's structured-output schema format (the OpenAPI subset `gemini-client.ts` forwards verbatim to the API) has no working support for recursive `$ref` or a discriminated `oneOf` — confirmed by this codebase's one other Gemini-facing schema (`build-gemini-request.ts`) using only flat `OBJECT`/`ARRAY`/`STRING`+`enum`, never either construct. Since `FILTER_NODE_MAX_DEPTH` is fixed at exactly 3 (Story 9.1a), hand-unrolling the schema to 3 identical-shaped levels (the 3rd omitting the group-wrapper fields) is a structural guarantee, not a convention Gemini could violate — the model is incapable of emitting a 4th level, because no such level exists in the schema it was given.
2. **A node is "leaf-shaped" (no `op`) or a group (`op` present); a leaf-shaped node's fields are exactly the existing flat `EventFilterInput` property set, reused verbatim rather than Story 9.1a's internal renamed `FilterLeaf` field names (`type`/`locationAdminArea`/`locationProximity`/...).** This lets every leaf-shaped node in Gemini's response flow through the already-shipped, already-tested, already-defensive `transformGeminiResponseToEventFilter` unchanged — zero new per-field parsing/validation logic is written for this story. `expressionFromFlatFilter` (also already shipped) then turns that single flat object into 0/1/several `FilterLeaf` siblings. This is the central reuse decision of the story: the "leaf" vocabulary is never re-specified, re-validated, or re-mapped a second time.
3. **A multi-field leaf-shaped node's resulting siblings are spliced into the parent position directly, never wrapped in a new nested group.** This is what keeps the 3-structurally-unrolled-levels guarantee (decision 1) airtight even though a single leaf-shaped JSON object can expand into an `AND`-of-several-leaves (`expressionFromFlatFilter`'s own "always wrap in an explicit AND" behavior) — if that expansion were nested as a child instead of spliced as siblings, a leaf sitting at the deepest allowed schema level could silently push the assembled tree to depth 4. Splicing avoids the gap entirely, for every parent `op` (`AND` or `OR`), rather than relying on `normalize()`'s same-operator flattening (which only rescues the `AND`-under-`AND` case, not `OR`-under-`OR`'s structurally-identical risk, since `normalize()` never merges across different operators by design).
4. **`validateFilterNode` (Story 9.1a) stays the single, reused authority on the depth/node-count limits; this story's degrade logic never reimplements the numbers.** The only limit this story's own degrade logic has to actively enforce post-construction is node-count (≤ 12) — depth cannot be violated by construction (decisions 1 and 3), so a depth-related validation failure after assembly would indicate an actual bug in this story's own code, not an untrusted-input case, and is deliberately left to propagate rather than silently caught.
5. **Caveat text pushed by the degrade/account-resolution steps stays plain, hardcoded English, matching the existing `Could not find an account matching "X"...` precedent already in `resolvers.ts` today.** Caveat strings are not `next-intl`-sourced anywhere in this feature today (confirmed: the frontend's `AIFilterSummary` locale namespace covers the *template*/labels around a filter, never the raw caveat strings themselves, which are free text produced server-side) — this story does not introduce a new i18n gap, it is consistent with an existing, pre-9.4 limitation that stays out of this story's scope (CAP-4's "deterministic template" requirement governs the summary *around* the filter's known fields, not AI-authored caveat prose).
6. **`resolvePromptToEventFilter`'s `resolvedFilter` field degrades to `{}` (not `null`) for a non-flat expression**, because `ResolvedAIEventFilterResult.resolvedFilter` is `EventFilter!` (non-null) — unlike Story 9.3's `AIEventFilter.resolvedFilter`/`Widget.filters`, which that story deliberately widened to nullable for exactly this "no flat projection" case. Widening `ResolvedAIEventFilterResult.resolvedFilter` to nullable here as well was considered and rejected: `apps/web/src/features/events/use-ai-filter.ts`'s `onSuccess` handler (`setAiFilterStr(JSON.stringify(data.resolvePromptToEventFilter.resolvedFilter))`) assumes a non-null value today, and this field's "honest empty object" already fully satisfies AC4's intent (no fabricated partial filter) without forcing an unrelated nullability/call-site change into this story's scope — Story 9.4a (the Gate 2 split above) is the right place to decide how the frontend should react to a non-flat result, not this one.
7. **The system-prompt/schema builder functions move into their own file (`apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`) rather than staying inline in `resolvers.ts`**, mirroring the established precedent of `apps/backend/src/lib/ai-processor/build-gemini-request.ts` for the *other* Gemini call site in this codebase. Since this story already fully rewrites the prompt/schema (not a small in-place tweak), extracting it now — rather than growing the inline block further inside an already very large `resolvers.ts` — is the lower-risk point to adopt the existing convention.
8. **`resolveFilterExpressionAccountIds` lives in `apps/backend`, not `packages/domain`, because it is DB-coupled** (calls the Drizzle-backed `resolveFilterAccountId`) — consistent with `project-context.md`'s `packages/domain` purity restriction and with `resolveFilterAccountId` itself already living in `apps/backend/src/lib/ai-event-filters/` for the identical reason. `mapFilterLeaves` (the generic tree-editing primitive it's built on) stays in `packages/domain` since it is pure, synchronous, and has no DB/Node-only dependency.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No DB migration. No table or column is touched by this story.
- **Impacted fields/contracts:**
  - **New, additive:** `ResolvedAIEventFilterResult.expression: FilterNode!` (new GraphQL field, reusing the existing `FilterNode` output type from Story 9.3); `transformGeminiResponseToFilterExpression`, `mapFilterLeaves` (new `packages/domain` exports); `resolveFilterExpressionAccountIds`, `buildFilterExtractionSystemInstruction`, `buildFilterExtractionResponseSchema` (new `apps/backend` modules).
  - **Behavior change (same shape, richer content):** `resolvePromptToEventFilter`'s Gemini request now asks for `dateRange.spanAmount`/`spanUnit`, array-valued `dayOfWeek`, and `temporalFilter` — fields the response-parsing side (`transformGeminiResponseToEventFilter`) has accepted since Story 9.1b but Gemini was never asked to produce; no type changes, since `EventFilterInput`'s TypeScript shape already supports all three.
  - **No existing field is narrowed, removed, or renamed.** `resolvedFilter`'s *value* for a non-flat result changes from "impossible to produce" (no live path could create one before this story) to `{}` — not a narrowing of the type, which was always `EventFilter!`, just the first time this branch becomes reachable.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** The regenerated `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` (AC4, Task 11) are the only "type changes," both build artifacts regenerated from the one `.graphql` SDL addition, not hand-edited.
- **Backward compatibility and rollout notes:** `apps/web`'s only live consumer of this mutation (`apps/web/src/features/events/use-ai-filter.ts`) reads `data.resolvePromptToEventFilter.resolvedFilter`/`.caveats` and ignores any field it doesn't select — adding `expression` to the GraphQL type is additive and changes no `apps/web` behavior on its own (confirmed by reading `use-ai-filter.ts`; it does not select `expression` in its mutation document, and this story does not add that selection — Story 9.4a owns wiring it up). For a *simple*, flat-representable prompt (the overwhelming common case today, e.g. "jazz events in Yogyakarta"), `resolvedFilter` is byte-identical to today's output — only a genuinely grouped/boolean prompt (impossible to produce before this story, since the old schema had no `op`/`children`/`child` at all) newly resolves to `resolvedFilter: {}` instead of a flat approximation that could never have existed.
- **Verification checks:** 100% unit branch coverage on `map-filter-leaves.ts` and `transform-gemini-response-to-filter-expression.ts` (`project-context.md`'s domain testing rule); the backend integration tests (Task 10) covering the legacy-flat-regression case, the new tree-shaped case, the grouped/non-flat case, and the multi-`accountId` case; `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/backend test`/`lint`/`build`, `pnpm --filter @festgrid/web lint`/`build` (confirms the additive `expression` field doesn't break `apps/web`'s existing, unchanged mutation document).

### Project Structure Notes

- `packages/domain/src/ai-event-filters/map-filter-leaves.ts`, `transform-gemini-response-to-filter-expression.ts` are NEW, in the same folder as Stories 9.1a/9.1b/9.2/9.3's files; exported via `index.ts`.
- `apps/backend/src/lib/ai-event-filters/resolve-filter-expression-account-ids.ts`, `build-filter-extraction-request.ts` are NEW, alongside the existing `resolve-filter-account-id.ts`.
- `apps/backend/src/schema/resolvers.ts` is UPDATEd (`resolvePromptToEventFilter` only — no other resolver in this story).
- `apps/backend/src/schema/ai-event-filters.graphql` is UPDATEd (one additive field).
- `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` are regenerated build artifacts (AC4) — not hand-edited.
- No `packages/ui` file, and no hand-written `apps/web` file, is touched by this story (Gate 2 found a real gap, but the gap itself lives entirely in already-existing `apps/web` files this story does not touch — split to Story 9.4a per the Architecture & UX Gate Findings above).
- No conflicts detected with the unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.4: Upgrade Gemini extraction to expression trees with node-level caveats] — authoritative ACs this story elaborates.
- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.4a: Wire the resolved AI-filter expression into Discovery, Feed and Favorites query building] — the prerequisite/sibling story this story's own Gate 2 finding split out.
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/SPEC.md#CAP-6, #CAP-7, #Constraints] — the worked example ("jazz or blues in Sleman or Bantul this weekend, not workshops"), the depth-3/12-node/no-double-NOT limits, `NULL ≠ x` semantics.
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/filter-vocabulary.md] — the full locked leaf vocabulary table this story's rewritten system instruction/schema must cover completely, including the three previously-dead fields (span, array `dayOfWeek`, `temporalFilter`).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md] — Gate 1/Gate 3 epic-wide sweep findings cited above.
- [Source: _bmad-output/implementation-artifacts/9-1b-extend-the-relative-date-grammar-with-spans-multi-weekday-and-temporal-status.md#Dev Notes decision 2, #Data Type Compatibility] — explicit statement that "the live `resolvePromptToEventFilter` system prompt is unchanged until Story 9.4," confirming this story's schema-rewrite scope was already anticipated, not invented here.
- [Source: _bmad-output/implementation-artifacts/9-3-expose-filter-expressions-through-graphql-resolvers-and-widgets.md#Out of Scope] — "Upgrading `resolvePromptToEventFilter`'s system prompt/response schema to produce `FilterNode` expressions, node-level caveat degradation, or adding an `expression` field to `ResolvedAIEventFilterResult` — Story 9.4's exclusive scope," confirming this story's exact boundary against 9.3.
- [Source: packages/domain/src/ai-event-filters/transform-gemini-response-to-event-filter.ts, filter-node.ts, filter-node-schema.ts, normalize-filter-node.ts, flat-filter-conversion.ts, compile-filter-node.ts] — every existing function this story reuses unmodified, read in full.
- [Source: apps/backend/src/lib/ai-event-filters/resolve-filter-account-id.ts] — `resolveFilterAccountId`, reused unchanged by the new account-resolution helper; read in full for its existing query shape and caveat wording.
- [Source: apps/backend/src/schema/resolvers.ts#L319-476 (resolvePromptToEventFilter, saveAIEventFilter)] — the exact resolver this story rewrites, read in full; the existing inline system instruction/`responseSchema` this story replaces.
- [Source: apps/backend/src/lib/ai-processor/build-gemini-request.ts] — the existing dedicated-builder-file precedent and the `type: 'STRING', enum: [...]`/nested `OBJECT`/`ARRAY` schema conventions this story's new builder mirrors.
- [Source: apps/backend/src/lib/ai-gateway/gemini-client.ts#L8,64] — confirms `responseSchema` is forwarded to the Gemini API verbatim (no transformation layer), which is why the bounded/unrolled schema design (decision 1) is a hard constraint, not a style choice.
- [Source: apps/backend/src/schema/ai-event-filters.graphql, events.graphql#L195-214] — `ResolvedAIEventFilterResult` this story extends; the pre-existing `FilterNodeInput`/`FilterNode` GraphQL types (Story 9.3) this story reuses as-is.
- [Source: apps/backend/src/schema/ai-event-filters.test.ts#L78-219] — the existing `resolvePromptToEventFilter` integration test block (including the exact legacy-flat mocked-response fixture) this story extends/updates.
- [Source: apps/web/src/features/events/use-ai-filter.ts] — read in full to confirm no live `apps/web` call site selects `expression` yet, and that this story's additive GraphQL field changes zero current frontend behavior (Data Type Compatibility section above); also the file Story 9.4a (the Gate 2 split) will extend.
- [Source: packages/domain/src/events/buildEventsQueryCondition.ts#L6-16] — `DateAnchor`/`DateOffsetUnit`/`DayOfWeek`/`TemporalFilter`/`DATE_OFFSET_AMOUNT_BOUNDS` exports this story's schema builder sources its `enum`/bound values from, never re-declared.
- [Source: _bmad-output/project-context.md#Code Organization (Domain vs UI), #Testing Rules] — `packages/domain` purity restriction (confirms `resolveFilterExpressionAccountIds`'s placement in `apps/backend`, Dev Notes decision 8), 100%-domain-coverage rule.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions, the epic-level-sweep citation rule, and the "split, don't absorb" required action this story's Gate 2 finding follows.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/domain` purity: `map-filter-leaves.ts`/`transform-gemini-response-to-filter-expression.ts` are pure, no React/DB/ORM/Node-only dependency; the one DB-coupled piece, `resolveFilterExpressionAccountIds`, correctly lives in `apps/backend` instead, per Dev Notes decision 8), API & Data (GraphQL Code Generator mandate → AC4/Task 11; Runtime Schema Validation — Gemini's untrusted output is validated via the existing Story 9.1a `validateFilterNode`, never trusted raw), Testing Rules (100% domain coverage for the two new `packages/domain` files) — all cited above.
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — FR98-FR103 (amended, per epics.md's Epic 9 header) cover this capability at the PRD level; no PRD change is made by this story (Story 9.9z owns the PRD/vocabulary amendment).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file follows its canonical section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD section is implicated (no new infra/architecture decision; this story extends an already-shipped GraphQL/resolver/domain layer per `epic-9-readiness.md`'s Gate 1 citation above); full file not loaded, consistent with Stories 9.1a/9.1b/9.2/9.3's own precedent.
- [x] `docs/infrastructure/index.md` — not applicable (no Lambda, queue, DB, or hosting change); confirmed via the `epic-9-readiness.md` citation above; full infra shards not loaded.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/domain/src/ai-event-filters/map-filter-leaves.ts` — `mapFilterLeaves` (Task 1).
  - NEW `packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.ts` — `transformGeminiResponseToFilterExpression` (Task 2).
  - UPDATE `packages/domain/src/ai-event-filters/index.ts` — export both new modules.
  - NEW `apps/backend/src/lib/ai-event-filters/resolve-filter-expression-account-ids.ts` — `resolveFilterExpressionAccountIds` (Task 3).
  - NEW `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts` — `buildFilterExtractionSystemInstruction`, `buildFilterExtractionResponseSchema` (Task 4).
  - UPDATE `apps/backend/src/schema/resolvers.ts` — `resolvePromptToEventFilter` only (Task 5).
  - UPDATE `apps/backend/src/schema/ai-event-filters.graphql` — `ResolvedAIEventFilterResult.expression` (Task 6).
  - NEW `packages/domain/src/ai-event-filters/map-filter-leaves.test.ts` (Task 7).
  - NEW `packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.test.ts` (Task 8).
  - NEW `apps/backend/src/lib/ai-event-filters/resolve-filter-expression-account-ids.test.ts` (Task 9).
  - UPDATE `apps/backend/src/schema/ai-event-filters.test.ts` (Task 10).
  - REGENERATE `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (Task 11, AC4).
  - UPDATE `_bmad-output/planning-artifacts/epics.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story 9.4a (Gate 2 finding, already applied during story creation, not a dev-story task).
- **Rule Mapping:**
  - AC1 (expression-tree request, bounded schema, bilingual few-shot) → Task 4 (builder) + Task 5 (wiring into the resolver) + Task 11 (verification).
  - AC2 (node-by-node degrade, legacy flat still accepted) → Tasks 1-2 (the pure transform + its primitive) + Task 5 + Tasks 7-8, 10 (tests).
  - AC3 (account leaf reuses existing resolution) → Task 3 + Task 5 + Task 9 (tests).
  - AC4 (single-shot only, `expression` field added) → Task 6 + Task 5 + Task 10, 11.
  - `packages/domain` purity (project-context.md) → Dev Notes decision 8; `map-filter-leaves.ts`/`transform-gemini-response-to-filter-expression.ts` import only sibling `packages/domain` modules, never Drizzle/Node-only.
  - Gate 1/2/3 (story-split-gate.md) → Gate 1/3 cited from `epic-9-readiness.md`; Gate 2 run fresh via `runSubagent` (Freya persona) — gap found and split into Story 9.4a (`epics.md`/`sprint-status.yaml` updated), documented in Architecture & UX Gate Findings above.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` — 100% coverage on `map-filter-leaves.test.ts` and `transform-gemini-response-to-filter-expression.test.ts`; full existing domain suite stays green.
  - `pnpm --filter @festgrid/domain lint`/`build` — clean.
  - `pnpm --filter @festgrid/backend test` — the new/updated integration cases in `ai-event-filters.test.ts` and the new `resolve-filter-expression-account-ids.test.ts` pass; full existing backend suite stays green (row-count ratchet included).
  - `pnpm --filter @festgrid/backend lint`/`build` — clean.
  - `pnpm --filter @festgrid/backend codegen` / `pnpm --filter @festgrid/web codegen` — regenerate, diff committed (AC4).
  - `pnpm --filter @festgrid/web lint`/`build` — clean (confirms the additive GraphQL field doesn't break `apps/web`'s existing, unchanged `use-ai-filter.ts` mutation document).
  - Manual: a repo-wide grep (`grep -rn "resolvePromptToEventFilter" apps/web/src`) re-confirming `use-ai-filter.ts` is the only `apps/web` call site and that it does not (yet) select `expression` — consistent with Story 9.4a owning that wiring.

## Pre-Coding Approval Gate

- [x] Scope confirmation — two new pure `packages/domain` functions, two new backend-only helper modules, one resolver rewrite (`resolvePromptToEventFilter` only), one additive GraphQL field, codegen regeneration; zero `apps/web`/`packages/ui` hand-written file changes; zero DB migration.
- [x] Architecture and boundary confirmation — Gate 1/3 cited from `epic-9-readiness.md` (no gap); Gate 2 run fresh via `runSubagent` (Freya persona) found a real gap (frontend query-building wiring), split out as Story 9.4a per the gate's required action rather than absorbed here.
- [x] Testing plan confirmation — 100% domain unit coverage on the two new `packages/domain` files; backend integration/unit tests for the new account-resolution helper and the updated `resolvePromptToEventFilter` resolver, including explicit regression coverage for the legacy flat-response shape.
- [x] Explicit human approval state — APPROVED by user (dispatch instruction for this Epic 9 batch: "skip Gate 1/3 and run Gate 2 only... Minimise questions: choose the recommended default and record it in Dev Notes"), 2026-10-15. This blanket instruction is treated as the explicit authorization for every routine design default recorded above (decisions 1-8) and for the Gate 2 split-not-absorb default, matching Stories 9.1a-9.3's own identical precedent for this same batch.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3: no gap, N/A. Gate 2: gap found and **explicitly accepted as a known, deferred condition** under the same dispatch instruction (`story-split-gate.md`'s escape hatch: "the user may explicitly override a gate finding... record that decision in the story's Dev Notes") — Story 9.4a (not yet implemented) is the prerequisite for the *frontend* to actually apply a boolean/grouped AI filter's full logic; this story's own ACs (the extraction/resolver layer) are independently correct and testable without it, and shipping this story first is the necessary basis 9.4a builds on.

## Testing Requirements

- [x] Unit tests: `map-filter-leaves.test.ts` — drop/replace/collapse/no-op/idempotence. 100% branch coverage.
- [x] Unit tests: `transform-gemini-response-to-filter-expression.test.ts` — tree-shaped input, legacy-flat input (regression-anchored on the existing mocked fixture), multi-field-leaf-under-OR depth-safety, double-NOT drop, over-12-node trim, garbage/empty input, out-of-vocabulary leaf silently dropped. 100% branch coverage.
- [x] Unit tests: `resolve-filter-expression-account-ids.test.ts` — multiple distinct `accountId` leaves (mixed resolve/drop outcomes), zero `accountId` leaves (no DB call), single resolving leaf.
- [x] Integration tests (`node:test`/`graphql-yoga`, extending `ai-event-filters.test.ts`): tree-shaped mocked Gemini response → correct `expression`+`resolvedFilter`; legacy-flat mocked response → unchanged behavior plus a correctly-derived `expression` (AC2 regression); grouped (`OR`/`NOT`) mocked response → correct `expression`, `resolvedFilter: {}`; multi-`accountId`-leaf mocked response → mixed resolve/drop with correct caveats; existing `NO_API_KEY`/`TEMPORARILY_BUSY` tests unaffected.
- [x] 100% branch coverage on all new/changed `packages/domain` files, per `project-context.md`'s domain testing rule; backend integration tests follow the existing `ai-event-filters.test.ts` coverage style (loose assertions against a seeded DB, not a literal percentage gate).
- [x] E2E tests: not applicable — no user-facing surface in this story (confirmed by Gate 2's finding being split entirely into Story 9.4a, which owns the user-visible query-building behavior).

## Deliverables Checklist

- [x] `mapFilterLeaves` implemented, exported, 100%-covered.
- [x] `transformGeminiResponseToFilterExpression` implemented, exported, 100%-covered — accepts both the new tree shape and the legacy flat shape, degrades double-NOT and over-limit trees with caveats, never throws on untrusted input.
- [x] `resolveFilterExpressionAccountIds` implemented and used by `resolvePromptToEventFilter` in place of the old single-field inline resolution block.
- [x] `buildFilterExtractionSystemInstruction`/`buildFilterExtractionResponseSchema` implemented; the live Gemini request now asks for `dateRange.spanAmount`/`spanUnit`, array-valued `dayOfWeek`, and `temporalFilter` in addition to the tree grammar; includes at least one English and one Indonesian few-shot grouping example.
- [x] `resolvePromptToEventFilter` returns `expression`/`resolvedFilter`/`caveats` per AC2/AC4, with `resolvedFilter` degrading to `{}` (never a crash) for a non-flat result.
- [x] `ResolvedAIEventFilterResult.expression: FilterNode!` added to `ai-event-filters.graphql`.
- [x] `apps/backend/src/generated/resolvers-types.ts` and `apps/web/src/generated/graphql.ts` regenerated and committed.
- [x] Story 9.4a added to `epics.md` and `sprint-status.yaml` (Gate 2 finding — already applied as part of story creation).
- [x] All new/updated test files passing; 100% domain coverage on new/changed `packages/domain` files; `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/backend test`/`lint`/`build`, `pnpm --filter @festgrid/web lint`/`build` all green.

## Out of Scope

- **Wiring the resolved `expression` into any `apps/web` query-building path (Discovery/Feed/Favorites) or into `useAIFilter`'s state at all** — Story 9.4a's exclusive scope (this story's own Gate 2 finding, documented above).
- **Rich expression-summary rendering for trees** (`render-ai-filter-summary.ts` full tree support, new locale strings) — Story 9.5's exclusive scope.
- **Any `apps/web`/`packages/ui` UI change** (FilterHub, the AI filter overlay, a grouped example prompt in the overlay's example list, a "too complex" caveat surfaced in the overlay) — Story 9.6's exclusive scope; confirmed zero UI surface in this story by Gate 2 (beyond the split-out 9.4a backend-adjacent wiring, which is itself non-visual).
- **Golden-prompt evals, rate limiting, the PRD/vocabulary doc amendment** — Stories 9.7, 9.8, 9.9z respectively. (The SPEC worked-example tree this story embeds as a few-shot example — Task 4 — is a natural future fixture for 9.7's golden-prompt set, but adding it to that suite is 9.7's own job, not built here.)
- **Localizing caveat text itself via `next-intl`** — matches the existing, pre-9.4 limitation (Dev Notes decision 5); not a new gap introduced by this story, not fixed here.
- No new Gate 1/2/3 gap was found beyond the one Gate 2 finding already split into Story 9.4a above.

## Definition of Done

- [x] AC1-AC4 satisfied and verified by their respective tests.
- [x] Required tests passing: `pnpm --filter @festgrid/domain test` (100% branch coverage on new/changed files) and `pnpm --filter @festgrid/backend test`.
- [x] Lint and type checks passing: `pnpm --filter @festgrid/domain lint`/`build`, `pnpm --filter @festgrid/backend lint`/`build`, `pnpm --filter @festgrid/web lint`/`build`.
- [x] `pnpm --filter @festgrid/backend codegen` and `pnpm --filter @festgrid/web codegen` run, with the regenerated files committed (AC4).

## Completion Status

- [x] Complete — all tasks/subtasks done, all ACs satisfied, verification commands green.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via `bmad-dev-story`.

### Debug Log References

- `pnpm --filter @festgrid/domain test` — 694 passing, 0 failing. 100% line/branch/function coverage confirmed on `map-filter-leaves.ts` and `transform-gemini-response-to-filter-expression.ts` via `npx tsx --test --experimental-test-coverage` (targeted run against the two new test files).
- `pnpm --filter @festgrid/domain lint` — 0 errors/warnings.
- `pnpm --filter @festgrid/domain build` (`tsc`) — clean.
- `pnpm --filter @festgrid/database build`/`seed` — ran first; `apps/backend`'s `tsc` needs `@festgrid/database`'s and `@festgrid/graphql-select`'s `dist/` present (pre-existing monorepo build-order requirement, unrelated to this story), and the DB needed re-seeding (`users` table was empty) before the integration suite's cross-user setup test could pass.
- `pnpm --filter @festgrid/graphql-select build` — ran first for the same reason.
- `pnpm --filter backend build` (`tsc`) — clean, including after the `resolvers-types.ts` codegen regeneration.
- `pnpm --filter backend lint` — 0 errors (warnings only, all pre-existing `any`/unused-var style warnings in files this story didn't touch, or inherited from the existing `any`-typed resolver style this story's own new code in `resolvers.ts` follows).
- `npx tsx scripts/run-tests-with-row-count-ratchet.ts src/schema/ai-event-filters.test.ts` — 17/17 passing, zero row drift.
- `npx tsx scripts/run-tests-with-row-count-ratchet.ts src/lib/ai-event-filters/resolve-filter-expression-account-ids.test.ts` — 4/4 passing, zero row drift.
- `pnpm --filter backend test` (full, unfiltered, per Dev Notes/Verification Plan) — 1210 passing, 32 failing, 3 skipped; a stray row in `social_media_account_profiles` (+1) tripped the row-count ratchet. Investigated: every failing suite (`scraper lambda daily-batch`, `trigger-brightdata-for-target`, `get-scrape-targets`, `geolocation resolvers`, `setAccountDefaultLocation`/`editAccountDefaultLocation`, `user locations resolvers`) is unrelated to AI event filters/this story's files, and is almost certainly network/external-API-dependent (geocoding, scraper actor APIs) failing in this sandboxed environment with no live network access -- pre-existing, not introduced here. The stray row traced to `apps/backend/src/schema/social-media-accounts.test.ts`'s pre-existing `test_profile_ac15_*` fixtures (that file inserts/deletes per-sub-test rather than via a single `t.after`, so an earlier failure elsewhere in a from-scratch full run can leave one behind) -- confirmed unrelated to any file this story touches; manually deleted the stray row to restore the baseline row count. Targeted re-runs of every file this story actually changed (`ai-event-filters.test.ts`, `resolve-filter-expression-account-ids.test.ts`) are clean with zero row drift, which is the scoped verification this story's own Dev Notes/Verification Plan calls for.
- `pnpm --filter backend codegen` — regenerated `apps/backend/src/generated/resolvers-types.ts` (+2 lines, the additive `expression` field); `pnpm --filter backend build` re-run clean afterward.
- `pnpm --filter web codegen` — regenerated `apps/web/src/generated/graphql.ts` (+1 line).
- `pnpm --filter web lint` — 0 errors (warnings only, pre-existing).
- `pnpm --filter web build` — clean, all 39 routes built.
- Manual: `grep -rn "resolvePromptToEventFilter" apps/web/src` confirms `use-ai-filter.ts` is the only `apps/web` call site and does not select `expression` -- the additive GraphQL field changes zero current frontend behavior, consistent with Story 9.4a owning that wiring.

### Completion Notes List

- Implemented exactly per the story's Implementation Plan/File Change Plan: two new pure `packages/domain` functions (`mapFilterLeaves`, `transformGeminiResponseToFilterExpression`), two new `apps/backend` helper modules (`resolveFilterExpressionAccountIds`, `buildFilterExtractionSystemInstruction`/`buildFilterExtractionResponseSchema`), a rewrite of `resolvePromptToEventFilter` in `resolvers.ts`, one additive GraphQL field, and regenerated codegen artifacts. No `apps/web`/`packages/ui` hand-written file touched; no DB migration.
- **Design clarification discovered during implementation, recorded here per the dispatch instruction to minimize questions and record the recommended default:** the story's own prose uses `{field: 'keyword', value: ...}`-shorthand notation in a few illustrative spots (Task 4's worked example, Task 8's double-NOT test snippet) to annotate intent, but Dev Notes decision 2 is unambiguous that a raw leaf-shaped node from Gemini uses the **flat** `EventFilterInput` property names directly (e.g. `{keyword: 'jazz'}`), never the internal `FilterLeaf` `{field, value}` discriminated-union shape -- confirmed necessary by `convertRawNode`'s own contract of running every leaf-shaped raw object through the existing `transformGeminiResponseToEventFilter`, which only recognizes flat property names. Implemented and tested against the flat-shape reading throughout (system instruction, schema builder, and all new test fixtures).
- **Edge case found and fixed during implementation (not explicitly anticipated by the story text, handled per its own design principles):** `normalize()`'s single-child group collapse can expose a double-NOT that was not immediately adjacent in the raw Gemini JSON (e.g. `NOT(OR(NOT(leaf)))` -- a single-child `OR` separating the two `NOT`s at construction time, which disappears on normalize, leaving `NOT(NOT(leaf))`). `convertRawNode`'s own immediate-child double-NOT check (construction time) cannot catch this since the `OR` genuinely separates them when first built. Added a second check inside the post-normalize safety-net loop: a reported "double NOT" validation issue is handled the same way (drop the outer `NOT`, push the same caveat), proven to only ever occur at the tree's own root (a double-NOT is already depth 3, the maximum, so nesting it one level deeper would already trip the pre-existing depth guard first) and always empty the tree entirely as a result -- both proven in Debug Log via direct reasoning and covered by a dedicated unit test.
- Also discovered and fixed: `validateFilterNode` rejects any *empty* `AND`/`OR` group structurally (including the canonical `{op:'AND', children:[]}` "no filter" sentinel this module itself produces for garbage input and for a fully-dropped double-NOT) -- naively re-validating that sentinel inside the repair loop caused an infinite loop (the "widest group" trim target was the empty group itself, and trimming its last child off an already-empty array is a no-op). Fixed by special-casing the canonical empty sentinel as trivially valid before ever calling `validateFilterNode` on it, both at the initial check and after the double-NOT drop produces it.
- `resolvedFilter: EventFilter!`'s non-null contract is honored via a `try { flatFilterFromExpression(expression) } catch { resolvedFilter = {} }` wrapper exactly as the story specifies (AC4) -- confirmed via both a unit-level (domain) and an integration-level (backend GraphQL) test that a grouped/non-flat expression degrades to an honest empty object, never a crash.
- `pnpm --filter @festgrid/database seed` had to be run once (environment setup, not a story task) because the local DB's `users` table was empty, which the pre-existing `ai-event-filters.test.ts` setup test requires (at least 2 seeded users) -- unrelated to this story's own scope but necessary to exercise its integration tests at all.

### File List

**New:**
- `packages/domain/src/ai-event-filters/map-filter-leaves.ts`
- `packages/domain/src/ai-event-filters/map-filter-leaves.test.ts`
- `packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.ts`
- `packages/domain/src/ai-event-filters/transform-gemini-response-to-filter-expression.test.ts`
- `apps/backend/src/lib/ai-event-filters/resolve-filter-expression-account-ids.ts`
- `apps/backend/src/lib/ai-event-filters/resolve-filter-expression-account-ids.test.ts`
- `apps/backend/src/lib/ai-event-filters/build-filter-extraction-request.ts`

**Modified:**
- `packages/domain/src/ai-event-filters/index.ts` (export the two new modules)
- `apps/backend/src/schema/resolvers.ts` (`resolvePromptToEventFilter` rewritten; import list updated)
- `apps/backend/src/schema/ai-event-filters.graphql` (additive `ResolvedAIEventFilterResult.expression: FilterNode!`)
- `apps/backend/src/schema/ai-event-filters.test.ts` (updated/extended `resolvePromptToEventFilter` test block, Task 10)
- `apps/backend/src/generated/resolvers-types.ts` (regenerated codegen artifact)
- `apps/web/src/generated/graphql.ts` (regenerated codegen artifact)

## Change Log

- 2026-10-15 — Created via `bmad-create-story`, citing `epic-9-readiness.md` for Gate 1/3 and running Gate 2 fresh (Freya persona via `runSubagent`), which found a real gap (frontend query-building wiring) split into new Story 9.4a (`epics.md` + `sprint-status.yaml` updated in the same pass). Builds on Stories 9.1a/9.1b/9.2/9.3 (status: review).
- 2026-10-15 — Implemented via `bmad-dev-story`: all 11 tasks complete, all ACs satisfied and verified. Pre-Coding Approval Gate ticked per this session's Epic 9 batch dispatch instruction (approved as scoped: two new domain functions, two new backend helpers, one resolver rewrite, one additive GraphQL field, codegen regeneration; zero `apps/web`/`packages/ui` hand-written files; zero DB migration). Status: review.

## Epic 9 code-review amendments (2026-10-23)

The Epic 9 code review (`implementation-artifacts/epic-9-code-review-2026-10-23.md`) changed behaviour this story's text still describes. Read the code and this note, not the superseded wording below.

- **Unresolved `@account` (supersedes AC3 and Task 3 for OR/NOT):** directly under an AND it is still dropped with "events from all accounts are shown" (once per distinct handle). Inside an OR or NOT it is treated as matching no events and folded through the operators: `OR(@x, a)` is `a`, `NOT(@x)` is every event (no filter), `AND(@x, ...)` matches nothing. The caveat reads "...so it was treated as matching no events" (D3). `mapFilterLeaves` therefore takes a `context` argument.
- **The transform never throws and never loops:** out-of-vocabulary leaves, out-of-bound dates and invalid fragments degrade node by node and each is reported as a caveat (supersedes the "silently dropped" and "rethrow a depth issue" wording); a NOT whose operand is lost is reported too (P2, P3, P9).
- **Qualifier on an OR node (D4, decided with the product owner):** leaf fields written on an OR node beside its `children` apply to the whole group: `{op:'OR', children:[jazz, blues], isFree:true}` is `AND(OR(jazz, blues), isFree)`. This supersedes the earlier literal reading (the fields as extra OR alternatives). An OR with node-level fields and no branches still treats them as alternatives; an AND node is unchanged.
- **Repairs never reach inside a NOT:** a trim or a weekday-window repair that would change what is negated drops the whole NOT instead.
