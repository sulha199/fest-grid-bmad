---
baseline_commit: 7ea15393da2dd48e3bc0e800607b42fc7f852920
---

# Story 9.4a: Wire the resolved AI-filter expression into Discovery, Feed and Favorites query building

## Story Details

- Epic: 9
- Story ID: 9.4a
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a boolean/grouped AI filter to actually apply its full logic to the events I see,
so that a prompt like "jazz or blues in Sleman or Bantul this weekend, not workshops" filters correctly instead of silently showing unfiltered results.

## Acceptance Criteria

1. **AC1 — the hook stores/exposes the resolved `FilterNode` expression, not just the lossy flat projection (epics.md AC1):** Given `apps/web/src/features/events/use-ai-filter.ts`, when `resolvePromptToEventFilter` or a loaded `AIEventFilter` resolves to a non-flat expression (contains OR/NOT, or is otherwise not representable by the flat `resolvedFilter` projection), then:
   - The hook stores and exposes that `FilterNode` expression as part of its active-filter state (`activeExpression`), not just the lossy flat projection (`activeFilter`).
   - This covers **both** live-prompt resolution (`resolvePromptToEventFilter`'s mutation response, which has carried `expression: FilterNode!` since Story 9.4) **and** loading a previously-saved filter from "My AI Filters" (`ai-filters-content.tsx`'s `handleRowClick`, which navigates to `/?ai_filter=...` today and must also forward the saved `AIEventFilter.expression`, populated by Story 9.3's `resolveStoredFilter` for every row, flat or not).

2. **AC2 — `buildEventsQueryCondition` gains `expression?: FilterNode`; Discovery/Feed/Favorites all pass it through (epics.md AC2):** Given `packages/domain/src/events/buildEventsQueryCondition.ts` (the Home/Discovery query-building function), when called with an optional `expression?: FilterNode` input, then:
   - It compiles `expression` via `compileFilterNodeToQueryCondition` and returns that compiled condition directly — mirroring Story 9.3's `buildFeedQueryCondition`/`buildAccountEventsQueryCondition` precedent exactly (expression short-circuits the flat-filter/search branches entirely; it is never merged with `filter`/`search`/`types`/`categories`/`nearby`/`temporalFilter` in the same call, matching both sibling functions' own established shape and CAP-5's existing "AI filter replaces manual controls wholesale" semantics, which the flat-filter branch already implements today).
   - Discovery (`home-content.tsx`), Feed (`feed-content.tsx`) and Favorites (`favorites-content.tsx`) all pass the hook's active expression through to their respective query-building call whenever one is present, instead of only ever passing the flat filter — Feed already has an `expression` parameter on `buildFeedQueryCondition` (Story 9.3); Favorites' local `buildFavoritesQueryCondition` wrapper and Discovery's direct `buildEventsQueryCondition` call both gain it here.

3. **AC3 — no silent empty-filter fallback once an active filter's expression is non-flat (epics.md AC3):** Given an active AI filter whose expression is non-flat, then:
   - The previous silent fallback (an effectively empty/unfiltered flat `{}`) never happens on any of the three screens — the expression path is used end to end instead.
   - Every React Query cache key / `useListPaginationController` `filterKey` that already tracks `aiFilter.activeFilter` as a cache-key field also tracks `aiFilter.activeExpression`, so two different non-flat prompts (which can both flatten to an identical `activeFilter: {}`) are never treated as the same cached/paginated query.

4. **AC4 — no new UI/visual surface (epics.md AC4):** Given this story's scope, then no new component, no new display, no new copy is introduced — this is query-building and cache-key wiring only; display/summary rendering for a grouped expression stays Story 9.5/9.6's scope.

**Depends on:** Story 9.2, Story 9.3, Story 9.4.

## Tasks / Subtasks

- [x] 1. **(AC1)** In `apps/web/src/features/events/mutations.graphql`'s `resolvePromptToEventFilter` mutation, add an `expression { ... }` selection to the existing `resolvedFilter { ... } / caveats` selection set — a 3-level-unrolled selection matching `FILTER_NODE_MAX_DEPTH = 3` exactly (the same unrolling precedent Story 9.4's backend `buildFilterExtractionResponseSchema` already established for the Gemini-facing schema):
   ```graphql
   expression {
     op
     field
     value
     children {
       op
       field
       value
       children { op field value }
       child { op field value }
     }
     child {
       op
       field
       value
       children { op field value }
       child { op field value }
     }
   }
   ```
   No fragment is introduced (this codebase has zero `.graphql` fragment definitions today — a grep of `apps/web/src/**/*.graphql` for `^fragment ` returns nothing; inlining matches the established convention and keeps this story's diff minimal).

- [x] 2. **(AC1)** In `apps/web/src/features/events/queries.graphql`'s `getMyAIEventFilters` query, add the identical 3-level-unrolled `expression { ... }` selection (from Task 1) to the existing `myAIEventFilters { ... resolvedFilter { ... } }` selection set, immediately after `resolvedFilter`'s closing brace. `AIEventFilter.expression: FilterNode!` has been populated for every row (flat or not) since Story 9.3's `resolveStoredFilter`, but no client document selects it yet.

- [x] 3. **(AC1)** In `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx`'s `handleRowClick`: alongside the existing `ai_filter` URL param, add a second `ai_expression` param carrying `encodeURIComponent(JSON.stringify(filter.expression))`:
   ```ts
   const handleRowClick = (filter: any) => {
     if (isPending(filter.id)) return;
     const filterParam = encodeURIComponent(JSON.stringify(filter.resolvedFilter));
     const expressionParam = encodeURIComponent(JSON.stringify(filter.expression));
     router.push(`/?ai_filter=${filterParam}&ai_expression=${expressionParam}`);
   };
   ```
   This is the "loaded `AIEventFilter`" half of AC1 — without it, re-opening a saved grouped/boolean filter from "My AI Filters" would keep silently applying as empty, exactly the bug this story exists to close, just reached via the save/load path instead of the live-prompt path.

- [x] 4. **(AC1)** In `apps/web/src/features/events/use-ai-filter.ts`:
   - Add `const [aiExpressionStr, setAiExpressionStr] = useQueryState('ai_expression', parseAsString);` alongside the existing `aiFilterStr`/`aiCaveatsStr` declarations.
   - Add an `aiExpression` `useMemo` that `JSON.parse`s `aiExpressionStr` into a `FilterNode | null`, degrading to `null` on a missing/unparseable value (mirroring `aiFilter`'s/`aiCaveats`'s existing `try { JSON.parse } catch { return null }` shape exactly). Import `type { FilterNode } from '@festgrid/domain/ai-event-filters'`.
   - Extend `resolvedData`'s state shape with an `expression: FilterNode` field, and set it (plus `setAiExpressionStr(JSON.stringify(data.resolvePromptToEventFilter.expression))`) inside `resolvePrompt`'s `onSuccess` handler, alongside the existing `resolvedFilter`/`caveats` assignments.
   - Add `setAiExpressionStr(null)` to every one of the five existing call sites that already clear `aiFilterStr`/`aiCaveatsStr` together: `handleApply`, `handleRePrompt`, `handleClose`, `handleAIClear`, `handleAIExpand` — so the three fields are always set/cleared as one atomic bundle, never partially.
   - Add `activeExpression: aiExpression` to the hook's top-level returned object, alongside the existing `activeFilter: aiFilter`.
   - Leave the existing `q`/`aiFilterStr` auto-expand effect (the one comparing `currentQ`/`filterQ`) unchanged — it already degrades correctly for a non-flat filter today (`aiFilter.keyword` is `undefined` when `resolvedFilter` is `{}`), and this story does not change what triggers that effect.

- [x] 5. **(AC2, Data Type Compatibility)** In `packages/domain/src/events/buildEventsQueryCondition.ts`:
   - Import `compileFilterNodeToQueryCondition` from `'../ai-event-filters/compile-filter-node.js'` and `type { FilterNode }` from `'../ai-event-filters/filter-node.js'`.
   - Add `expression?: FilterNode` to `BuildEventsQueryConditionInput`.
   - At the top of `buildEventsQueryCondition`'s body, before the existing `if (filter) {...} else {...}` branch: `if (expression) { return compileFilterNodeToQueryCondition(expression, { currentDate, timezone }); }` — short-circuits everything else (`filter`/`search`/`types`/`categories`/`nearby`/`temporalFilter` are all ignored when `expression` is supplied, matching `buildFeedQueryCondition`/`buildAccountEventsQueryCondition`'s own expression-branch shape, which likewise never threads a separately-supplied `temporalFilter` into the compiled expression — an embedded `temporalFilter` leaf inside the expression tree itself is the only way a non-flat filter's temporal constraint is expressed, consistent with `temporalFilter` already being one of Story 9.1a's locked `FilterLeaf` fields).
   - This introduces a two-file circular import (`buildEventsQueryCondition.ts` ↔ `compile-filter-node.ts`, which already imports several named functions from `buildEventsQueryCondition.ts`) — see Dev Notes decision 6 for why this is safe and already an established pattern one layer up (`buildFeedQueryCondition.ts`/`buildAccountEventsQueryCondition.ts` already depend on both files today).

- [x] 6. **(AC2, AC3)** In `apps/web/src/app/[locale]/home-content.tsx`:
   - Replace the `queryFn`'s `const condition = aiFilter.activeFilter ? buildEventsQueryCondition({ filter: { ...aiFilter.activeFilter, temporalFilter } }) : buildEventsQueryCondition({ search: q, types, categories, nearby: resolvedNearby, temporalFilter })` with a three-way branch that checks `aiFilter.activeExpression` first:
     ```ts
     const condition = aiFilter.activeExpression
       ? buildEventsQueryCondition({ expression: aiFilter.activeExpression })
       : aiFilter.activeFilter
         ? buildEventsQueryCondition({ filter: { ...aiFilter.activeFilter, temporalFilter } })
         : buildEventsQueryCondition({ search: q, types, categories, nearby: resolvedNearby, temporalFilter })
     ```
   - Add `aiExpression: aiFilter.activeExpression` to both the `useListPaginationController`'s `filterKey` object and the `useInfiniteQuery`'s `queryKey` array's filter object (both currently include `aiFilter: aiFilter.activeFilter` only).

- [x] 7. **(AC2, AC3)** In `apps/web/src/app/[locale]/feed/feed-content.tsx`:
   - In the `queryCondition` `useMemo`, pass exactly one of `filter`/`expression` to `buildFeedQueryCondition` — never both in the same call (matching the documented mutual-exclusivity expectation `buildFeedQueryCondition`'s own JSDoc already states):
     ```ts
     const queryCondition = useMemo(() => {
       return buildFeedQueryCondition({
         search: q, types, categories, subscriptions: subscriptionsQuery, nearby: resolvedNearby,
         filter: aiFilter.activeExpression ? undefined : aiFilter.activeFilter ?? undefined,
         expression: aiFilter.activeExpression ?? undefined,
         temporalFilter,
       });
     }, [q, types, categories, subscriptionsQuery, resolvedNearby, aiFilter.activeFilter, aiFilter.activeExpression, temporalFilter]);
     ```
   - Add `aiExpression: aiFilter.activeExpression` to both `useListPaginationController`'s `filterKey` and `useInfiniteQuery`'s `queryKey` filter object (both currently include `aiFilter: aiFilter.activeFilter` only).

- [x] 8. **(AC2, AC3)** In `apps/web/src/app/[locale]/favorites/favorites-content.tsx`:
   - Add an `expression?: FilterNode | null` parameter to the local `buildFavoritesQueryCondition` helper (import `type { FilterNode }` from `@festgrid/domain/ai-event-filters`), and branch on it first, mirroring Task 6's three-way shape:
     ```ts
     function buildFavoritesQueryCondition(
       q: string, types: string[], categories: string[],
       filter?: EventFilterInput | null, nearby?: NearbyFilterInput,
       temporalFilter?: "TODAY" | "UPCOMING" | null,
       expression?: FilterNode | null
     ): EventQueryConditionInput {
       const dynamicQuery = (expression
         ? buildEventsQueryCondition({ expression })
         : filter
           ? buildEventsQueryCondition({ filter: { ...filter, temporalFilter: temporalFilter ?? filter.temporalFilter } })
           : buildEventsQueryCondition({ search: q, types, categories, nearby, temporalFilter })) as
         | EventQueryConditionInput
         | undefined
       // ...unchanged wrapping logic below
     }
     ```
   - Update the `favoritesQuery` `useMemo`'s call site to pass `aiFilter.activeExpression ?? undefined` as the new last argument, and add `aiFilter.activeExpression` to its dependency array.
   - Apply the identical three-way branch (expression first, then filter, then search) to the inline `filterCondition` built inside `useInfiniteQuery`'s `queryFn` (the second, independent call site that builds the `favoriteEvents` page's own event-detail query).
   - Add `expression: aiFilter.activeExpression` to: the `idSnapshotData` `useQuery`'s `queryKey` filter object, `useListPaginationController`'s `filterKey`, and the `favoriteEvents` `useInfiniteQuery`'s `queryKey` filter object (all three currently include `filter: aiFilter.activeFilter` / `aiFilter: aiFilter.activeFilter` only).

- [x] 9. **(Testing, AC2, Data Type Compatibility)** Extend `packages/domain/src/events/buildEventsQueryCondition.test.ts` (`node:test`, 100% branch coverage per `project-context.md`'s domain testing rule):
   - An `expression`-only call (no `filter`) returns the exact same compiled condition as calling `compileFilterNodeToQueryCondition(expression)` directly (parity, mirroring `buildFeedQueryCondition.test.ts`'s existing `expression`-only test shape).
   - When both `filter` and `expression` are supplied, `expression` wins and `filter`/`search`/`types`/`categories`/`nearby`/`temporalFilter` are all ignored (documents the short-circuit behavior Task 5 implements).
   - An `expression` that compiles to `undefined` (e.g. an empty `{op:'AND', children:[]}`) returns `undefined`, matching the existing "no conditions" return shape.

- [x] 10. **(Testing, AC1)** Extend `apps/web/src/features/events/use-ai-filter.test.ts` (Vitest):
   - Update the mocked `useResolvePromptToEventFilterMutation`'s `onSuccess` payload to include an `expression` field (e.g. `{ op: 'OR', children: [{ field: 'type', value: ['FESTIVAL'] }, { field: 'type', value: ['CONCERT'] }] }`) alongside the existing `resolvedFilter`/`caveats`, and assert `result.current.activeExpression` equals that value after `overlayProps.onSubmit(...)`.
   - Assert `activeExpression` is cleared (`null`) after `onAIExpand()`, `onAIClear()`, and after a fresh `onSubmit()` following a prior one (the existing "re-prompt" pattern), matching the existing `activeFilter`-clearing assertions' shape.

- [x] 11. **(Testing, AC2, AC3)** Extend `apps/web/src/app/[locale]/home-content.test.tsx`, `feed-content.test.tsx` and `favorites-content.test.tsx` (Vitest, using each file's existing `nuqs` mock, which is a generic shared-store keyed by query-param name — no special-casing needed for the new `ai_expression` key): seed `ai_expression` (and, for parity, a non-empty `ai_filter` reflecting the same expression's lossy flat projection, exactly as the real backend would produce) directly into the mocked `nuqs` store before render, then assert the `query`/`query` variable the page sends via `graphqlClient.request(GetEventsDocument, { query: ... })` reflects the compiled expression's condition shape (e.g. an `operator: 'or'` group over two `type` conditions for the OR-of-two-types fixture above) rather than an empty/absent filter. Also assert that changing `ai_expression` alone (same `ai_filter` value, i.e. simulating two different non-flat prompts that both flatten to `{}`) produces a distinct query/cache key — the AC3 regression test for the cache-key fix.

- [x] 12. **(Verification, AC1-AC4)** Run `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/web codegen` (regenerating `apps/web/src/generated/graphql.ts` from Tasks 1-2's `.graphql` changes), `pnpm --filter @festgrid/web test`/`lint`/`build`. Commit the regenerated `apps/web/src/generated/graphql.ts` diff alongside the source changes.

## Dev Notes

### Architecture & UX Gate Findings

Per `epic-9-readiness.md` (`swept: true`, 2026-10-14), Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) were already run epic-wide and are cited here rather than re-run, per this session's explicit dispatch instruction ("Epic 9 readiness sweep is done... skip Gate 1/3 and run Gate 2 only"):

- **Gate 1 (epic-wide, cited):** "No epic-wide bypass found... The upgrade is confined to `packages/domain` (types/schema/compiler), existing GraphQL resolvers, the existing Gemini transform, and existing UI (`FilterHub`)." Confirmed consistent for this story specifically: it touches zero new API surface, zero new resolver, zero new Lambda/queue/IaC — only a `packages/domain` function signature addition (`buildEventsQueryCondition`'s new optional `expression` param, mirroring an already-shipped sibling-function shape), two already-shipped-schema client `.graphql` document additions (selecting a field that has existed since Stories 9.3/9.4), and `apps/web` hook/page wiring to use data the backend already returns.
- **Gate 3 (epic-wide, cited):** no new Epic 0/cross-cutting dependency gap found for the epic; this story is exactly the "adoption" layer Gate 3 already anticipated (the shared `FilterNode`/`compileFilterNodeToQueryCondition` mechanism, owned entirely within Epic 9, now reaching its last remaining unwired consumers).
- **Lightweight guard (this story, checked fresh):** does 9.4a's actual scope contain anything the epic-wide sweep plausibly didn't anticipate (a new external service, a new data entity, a new infra dependency)? No — this story's own origin (Story 9.4's Gate 2 finding) already fully scoped it to the three query-building call sites plus the hook; the one addition beyond that original finding's literal wording — `ai-filters-content.tsx`'s `handleRowClick` and `getMyAIEventFilters`'s selection set (Tasks 2-3) — was surfaced by this session re-reading epics.md Story 9.4a's own AC1 text closely ("or a loaded `AIEventFilter`"), not by any new infra/service dependency; it is the same `FilterNode`/`compileFilterNodeToQueryCondition` mechanism reached via the save/load path instead of the live-prompt path, not a new one. No Gate 1/3 re-run is warranted.
- **Gate 2 (UI Complexity & Reusability, run fresh via `runSubagent`, Freya persona, per this session's explicit dispatch instruction): No gap found.** Freya read `design-artifacts/UX-festgrid-run-1/DESIGN.md` and `EXPERIENCE.md` in full and confirmed neither specifies anything about AI-filter expression-tree rendering, grouped/boolean prompt display, or summary copy for compound filters — the only `FilterHub`-adjacent content in either file is the unrelated Today/Upcoming temporal-filter segmented control. Verdict: extending `useAIFilter.ts` with one more parallel `nuqs`-backed field (structurally identical to the hook's existing `ai_filter`/`ai_caveats` pair, cleared at the same five call sites) does not cross into "complex hook warranting its own story," and the `buildEventsQueryCondition`/page-wiring/cache-key changes are backend-data-layer and cache-key mechanics, not UI — no reuse-across-components or visual-spec concern applies. The story stays as one unit; no split, no prerequisite, no `epics.md`/`sprint-status.yaml` change from this gate.

**No gap found by any gate.** This story proceeds as scoped.

### Query-building/wiring design decisions (resolved defaults — minimised per this session's dispatch instruction, not left as open questions)

1. **Always prefer `activeExpression` over `activeFilter` whenever present, never conditionally only when "non-flat."** AC2's literal wording ("pass the hook's active expression through... whenever one is present, instead of only ever passing the flat filter") and Story 9.2's flat/expression compile-parity guarantee (AC2: "a flat filter and its expression form compile to identical conditions") together mean there is no behavioral difference between always preferring expression and conditionally preferring it only for non-flat results — always-prefer is simpler, has one code path per screen instead of two, and matches the literal AC text exactly.
2. **`buildEventsQueryCondition`'s new `expression` branch short-circuits everything else in the same call** (mirrors `buildFeedQueryCondition`/`buildAccountEventsQueryCondition`'s exact shape from Story 9.3, and also matches the flat-filter branch's own pre-existing "all-or-nothing" precedent: today, when `aiFilter.activeFilter` is set, `search`/`types`/`categories`/`nearby` are already dropped entirely on all three screens, per SPEC CAP-5 — "an active AI filter replaces FilterHub's manual controls... never both the summary and the full manual control set at once"). The expression branch is the identical semantic, just for the non-flat case the flat branch could never represent before this story.
3. **A separately-supplied `temporalFilter` is not merged into the `expression` branch** — matches `buildFeedQueryCondition`/`buildAccountEventsQueryCondition`'s own established behavior (neither threads a page-level `temporalFilter` into their `expression` branch either). A resolved expression's own `temporalFilter` leaf (one of Story 9.1a's locked `FilterLeaf` fields) is the only way a non-flat filter's temporal constraint is expressed; this is pre-existing, not a new gap introduced here.
4. **New `nuqs` query-state key: `ai_expression`**, parsed/cleared identically to the existing `ai_filter`/`ai_caveats` pair (same `useQueryState('<key>', parseAsString)` + `JSON.parse`-in-`useMemo`-with-`try/catch` shape) — the lowest-risk option, since it's a verbatim structural copy of an already-shipped, already-tested pattern in the same file, not a new state-management approach.
5. **No GraphQL fragment introduced for the new `expression { ... }` selection** — this codebase has zero `.graphql` fragment definitions anywhere under `apps/web/src` today (confirmed via a repo-wide grep for `^fragment `), so inlining the 3-level-unrolled selection in both `mutations.graphql` and `queries.graphql` (Tasks 1-2) matches the established convention rather than introducing a new one for a single reused shape used in exactly two documents.
6. **The `buildEventsQueryCondition.ts` ↔ `compile-filter-node.ts` circular import (Task 5) is safe and not a new risk class.** `compile-filter-node.ts` already imports several named function exports (`buildAccountIdCondition`, `resolveZonedToday`, etc.) from `buildEventsQueryCondition.ts`; this story adds the reverse edge (`buildEventsQueryCondition.ts` importing `compileFilterNodeToQueryCondition` from `compile-filter-node.ts`). Both modules export only function declarations (hoisted) and the new call (`compileFilterNodeToQueryCondition(...)`) only ever executes at runtime, inside `buildEventsQueryCondition`'s own function body — never at module-top-level evaluation time — which is the standard safe shape for a circular ESM/CommonJS-compiled-from-TS import; `buildFeedQueryCondition.ts`/`buildAccountEventsQueryCondition.ts` already depend on both files simultaneously today without issue, one layer up. `pnpm --filter @festgrid/domain build` (Task 12) empirically confirms no bundler/TS resolution issue results.
7. **`handleSave`/`saveAIEventFilter` (the "My AI Filters" save path) is deliberately NOT touched by this story.** `handleSave` in `use-ai-filter.ts` still calls `saveFilter({ prompt, resolvedFilter: resolvedData.resolvedFilter })` — only the flat projection, which is `{}` for a non-flat resolved expression. Saving a grouped/boolean AI filter today therefore still persists as an effectively empty filter (even though `saveAIEventFilter(..., expression:)` has accepted an expression argument since Story 9.3). This is a real, known gap, but it sits outside AC2/AC3's explicit scope (the three *live-query* screens: Discovery/Feed/Favorites), not the save/load-a-new-filter path — and it compounds with a second, separately-scoped gap: `ai-filters-content.tsx`'s list-row summary (`renderAIFilterSummary(filter.resolvedFilter, [], summaryLabels)`) also only reads the flat projection, so even a correctly-saved non-flat filter wouldn't render a meaningful summary in the list without Story 9.5/9.6's rich expression-summary work landing first. Flagged forward as a known, accepted, out-of-scope condition (see Out of Scope below) rather than absorbed — fixing `handleSave` without also fixing the list's summary rendering would be a half-measure, and the summary-rendering half is explicitly Story 9.5/9.6's territory per this epic's own story boundaries.
8. **The hook's existing `q`-vs-`aiFilter.keyword` auto-collapse effect is left unchanged.** For a non-flat expression, `aiFilter.keyword` (the flat projection) is already `undefined` today, pre-dating this story — this effect's behavior for that case is unchanged by anything in this story's scope and is not newly introduced or newly worsened here.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No DB migration. No schema (GraphQL or DB) is touched by this story — `FilterNode`/`FilterNodeInput`, `ResolvedAIEventFilterResult.expression`, and `AIEventFilter.expression` were all already added to the GraphQL schema by Stories 9.3/9.4; this story only adds client-side *selections* of already-existing schema fields, never new schema.
- **Impacted fields/contracts:**
  - **New, additive:** `BuildEventsQueryConditionInput.expression?: FilterNode` (new optional domain-function parameter); `useAIFilter()`'s returned `activeExpression: FilterNode | null` field; the new `ai_expression` URL query parameter; the `expression { ... }` GraphQL selections added to `mutations.graphql`/`queries.graphql` (both additive — selecting more fields of an already-nullable-safe, always-populated schema field changes no existing field's shape).
  - **No existing field is narrowed, removed, or renamed.** `activeFilter`/`resolvedFilter`'s existing value/shape is completely unchanged by this story — this story only adds a parallel field alongside it.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** The regenerated `apps/web/src/generated/graphql.ts` (Task 12) is the only "type change," a build artifact regenerated from the `.graphql` SDL selection additions (Tasks 1-2), not hand-edited.
- **Backward compatibility and rollout notes:** Every change is additive. A flat-representable prompt's behavior is byte-identical to before this story (the `activeExpression`-first branch compiles to the exact same condition the `activeFilter` branch already produced, per Story 9.2's flat/expression parity guarantee) — only a genuinely non-flat (`OR`/`NOT`-containing) prompt, which previously silently applied as an empty filter on all three screens, newly applies its real, full logic. No existing saved "My AI Filter" row's behavior changes unless that row's `expression` is itself non-flat (impossible before Story 9.4 shipped, since nothing could produce one).
- **Verification checks:** 100% unit branch coverage (via extension) on `buildEventsQueryCondition.test.ts`'s new `expression` branches, per `project-context.md`'s domain testing rule; the extended Vitest suites for `use-ai-filter.test.ts`/`home-content.test.tsx`/`feed-content.test.tsx`/`favorites-content.test.tsx` (Tasks 10-11); `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/web codegen`/`test`/`lint`/`build` (Task 12).

### Project Structure Notes

- `apps/web/src/features/events/mutations.graphql`, `queries.graphql` are UPDATEd (additive selections only, no removals).
- `apps/web/src/features/events/use-ai-filter.ts` is UPDATEd (`activeExpression`, new `ai_expression` query-state field, extended `resolvedData` shape).
- `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx` is UPDATEd (`handleRowClick` only — the "loaded `AIEventFilter`" half of AC1).
- `packages/domain/src/events/buildEventsQueryCondition.ts` is UPDATEd (additive `expression` parameter).
- `apps/web/src/app/[locale]/home-content.tsx`, `feed/feed-content.tsx`, `favorites/favorites-content.tsx` are UPDATEd (query-building branch + cache-key additions only — no JSX/visual change).
- `apps/web/src/generated/graphql.ts` is a regenerated build artifact (Task 12) — not hand-edited.
- No `packages/ui` file is touched by this story (Gate 2 confirmed zero UI surface).
- No conflicts detected with the unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.4a: Wire the resolved AI-filter expression into Discovery, Feed and Favorites query building] — authoritative ACs this story elaborates, and the Gate 2 finding note (from Story 9.4's own creation) that split this story out.
- [Source: _bmad-output/implementation-artifacts/9-4-upgrade-gemini-extraction-to-expression-trees-with-node-level-caveats.md#Architecture & UX Gate Findings, #Out of Scope] — the originating Gate 2 finding this story resolves; confirms `resolvePromptToEventFilter`'s `expression` field was additive and changed zero `apps/web` behavior on its own until this story's wiring lands.
- [Source: _bmad-output/implementation-artifacts/9-3-expose-filter-expressions-through-graphql-resolvers-and-widgets.md#Tasks 5-6, #Data Type Compatibility] — `buildFeedQueryCondition`/`buildAccountEventsQueryCondition`'s exact `expression?: FilterNode` shape and merge precedent this story mirrors for `buildEventsQueryCondition`; also confirms `AIEventFilter.expression`/`resolveStoredFilter` were already shipped and populated for every saved-filter row.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md] — Gate 1/Gate 3 epic-wide sweep findings cited above.
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/SPEC.md#CAP-5, #CAP-6] — "an active AI filter replaces FilterHub's manual controls... never both the summary and the full manual control set at once" (CAP-5, the UX rationale behind the expression branch's all-or-nothing short-circuit), and the grouped-prompt worked example (CAP-6) this story's wiring finally makes end-to-end correct on the frontend.
- [Source: packages/domain/src/ai-event-filters/compile-filter-node.ts, filter-node.ts] — `compileFilterNodeToQueryCondition`'s exact signature/behavior and the `FilterNode`/`FilterLeaf` shapes this story's domain-function change and GraphQL selections are built against, read in full.
- [Source: packages/domain/src/events/buildEventsQueryCondition.ts, buildFeedQueryCondition.ts, buildAccountEventsQueryCondition.ts] — read in full; the exact function this story extends and its two already-shipped sibling precedents.
- [Source: apps/web/src/features/events/use-ai-filter.ts, use-ai-filter.test.ts] — read in full; the exact hook this story extends and its existing test conventions.
- [Source: apps/web/src/app/[locale]/home-content.tsx, feed/feed-content.tsx, favorites/favorites-content.tsx] — read in full; every call site this story rewires, including the two additional cache-key arrays (`useListPaginationController`'s `filterKey`, each page's `useInfiniteQuery`'s `queryKey`) per screen, and Favorites' extra `idSnapshotData` query.
- [Source: apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx] — read in full; confirms `handleRowClick`'s existing `ai_filter`-only URL-param mechanism this story extends with `ai_expression`.
- [Source: apps/web/src/features/events/mutations.graphql, queries.graphql] — read in full; the exact client documents Tasks 1-2 extend, and confirms the "no fragment convention exists" finding behind Dev Notes decision 5.
- [Source: apps/backend/src/schema/events.graphql#L208-214] — `FilterNode`'s exact recursive GraphQL shape (`op`/`children`/`child`/`field`/`value`), confirming the 3-level-unrolled selection depth needed.
- [Source: _bmad-output/project-context.md#Code Organization (Domain vs UI), #Testing Rules, #State Management Architecture] — `packages/domain` purity restriction (the `buildEventsQueryCondition.ts` change stays pure), 100%-domain-coverage rule, the nuqs-for-URL-state convention this story's new `ai_expression` param follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions, the epic-level-sweep citation rule, and Gate 2's required action this story's own originating finding (in Story 9.4) followed.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/domain` purity: `buildEventsQueryCondition.ts`'s new `expression` branch stays pure, no React/DB/ORM/Node-only dependency), State Management Architecture (URL State: the new `ai_expression` nuqs param follows the exact established pattern), Testing Rules (100% domain coverage for the changed `packages/domain` file) — all cited above.
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — FR98-FR103 (amended, per epics.md's Epic 9 header) cover this capability at the PRD level; no PRD change is made by this story (Story 9.9z owns the PRD/vocabulary amendment).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file follows its canonical section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD section is implicated (no new infra/architecture decision; this story wires already-shipped backend/domain capability into already-shipped frontend screens, per `epic-9-readiness.md`'s Gate 1 citation above); full file not loaded, consistent with Stories 9.1a-9.4's own precedent.
- [x] `docs/infrastructure/index.md` — not applicable (no Lambda, queue, DB, or hosting change); confirmed via the `epic-9-readiness.md` citation above; full infra shards not loaded.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - UPDATE `apps/web/src/features/events/mutations.graphql` — `resolvePromptToEventFilter`'s `expression { ... }` selection (Task 1).
  - UPDATE `apps/web/src/features/events/queries.graphql` — `getMyAIEventFilters`'s `expression { ... }` selection (Task 2).
  - UPDATE `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx` — `handleRowClick`'s `ai_expression` URL param (Task 3).
  - UPDATE `apps/web/src/features/events/use-ai-filter.ts` — `activeExpression`, `ai_expression` query state, extended `resolvedData` (Task 4).
  - UPDATE `packages/domain/src/events/buildEventsQueryCondition.ts` — `expression?: FilterNode` parameter (Task 5).
  - UPDATE `apps/web/src/app/[locale]/home-content.tsx`, `feed/feed-content.tsx`, `favorites/favorites-content.tsx` — query-building branch + cache-key wiring (Tasks 6-8).
  - UPDATE `packages/domain/src/events/buildEventsQueryCondition.test.ts` (Task 9).
  - UPDATE `apps/web/src/features/events/use-ai-filter.test.ts` (Task 10).
  - UPDATE `apps/web/src/app/[locale]/home-content.test.tsx`, `feed/feed-content.test.tsx`, `favorites/favorites-content.test.tsx` (Task 11).
  - REGENERATE `apps/web/src/generated/graphql.ts` (Task 12).
- **Rule Mapping:**
  - AC1 (hook stores/exposes `expression`, both live-prompt and loaded-filter paths) → Tasks 1-4, 10.
  - AC2 (`buildEventsQueryCondition` gains `expression`; all three screens wired) → Tasks 5-8, 9, 11.
  - AC3 (no silent empty-filter fallback; cache keys track expression) → Tasks 6-8, 11.
  - AC4 (no new UI/visual surface) → confirmed by Gate 2 finding above; zero `packages/ui` changes, zero new JSX in Tasks 6-8.
  - `packages/domain` purity (project-context.md) → Dev Notes decision 6 (circular-import safety) + Task 5's import list (sibling `packages/domain` modules only).
  - Gate 1/2/3 (story-split-gate.md) → Gate 1/3 cited from `epic-9-readiness.md`; Gate 2 run fresh via `runSubagent` (Freya persona) — no gap found, documented in Architecture & UX Gate Findings above.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` — 100% coverage on `buildEventsQueryCondition.test.ts`'s new branches; full existing domain suite stays green.
  - `pnpm --filter @festgrid/domain lint`/`build` — clean (confirms the circular import resolves cleanly, Dev Notes decision 6).
  - `pnpm --filter @festgrid/web codegen` — regenerate `graphql.ts` from Tasks 1-2's `.graphql` changes, diff committed.
  - `pnpm --filter @festgrid/web test` — the new/updated cases in `use-ai-filter.test.ts`, `home-content.test.tsx`, `feed-content.test.tsx`, `favorites-content.test.tsx` pass; full existing web suite stays green.
  - `pnpm --filter @festgrid/web lint`/`build` — clean.
  - Manual: a repo-wide grep (`grep -rn "activeFilter\b" apps/web/src --include="*.tsx"`) re-confirming every consumer of `aiFilter.activeFilter` was reviewed for whether it also needs `activeExpression` (the three pages plus `ai-filters-content.tsx`'s load path) and that none was missed.

## Pre-Coding Approval Gate

- [x] Scope confirmation — one new `packages/domain` optional function parameter (pure, additive), one hook extension (mirroring an existing established pattern), two client `.graphql` selection additions, three page-level query-building/cache-key rewires, one settings-page URL-param addition; zero new components, zero new schema, zero DB migration.
- [x] Architecture and boundary confirmation — Gate 1/3 cited from `epic-9-readiness.md` (no gap); Gate 2 run fresh via `runSubagent` (Freya persona) found no gap (confirmed via direct read of `DESIGN.md`/`EXPERIENCE.md`, and confirmed the hook extension does not cross into "complex hook" territory).
- [x] Testing plan confirmation — 100% domain unit coverage (via extension) on `buildEventsQueryCondition.test.ts`; Vitest coverage extended on `use-ai-filter.test.ts` and all three content-page test files, including the AC3 cache-key-distinctness regression test.
- [x] Explicit human approval state — APPROVED by user (dispatch instruction for this Epic 9 batch: "skip Gate 1/3 and run Gate 2 only... Minimise questions: choose the recommended default and record it in Dev Notes"), 2026-10-15. This blanket instruction is treated as the explicit authorization for every routine design default recorded above (decisions 1-8), matching Stories 9.1a-9.4's own identical precedent for this same batch.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3: no gap, N/A. Gate 2: no gap, N/A. This story is itself the prerequisite Story 9.4's own Gate 2 finding named; no further prerequisite is created by this story.

## Testing Requirements

- [x] Unit tests: `buildEventsQueryCondition.test.ts` — `expression`-only parity with direct `compileFilterNodeToQueryCondition`, `expression` wins when both `filter` and `expression` are supplied, an empty-compiling `expression` returns `undefined`. 100% branch coverage (via extension) on the new code paths.
- [x] Unit tests: `use-ai-filter.test.ts` — `activeExpression` populated on a mocked non-flat mutation response; cleared on expand/clear/re-prompt, mirroring the existing `activeFilter`-clearing assertions.
- [x] Integration tests (Vitest, extending each page's existing test file): a seeded non-flat `ai_expression` (via the shared `nuqs` mock) produces a `graphqlClient.request` call whose `query` variable reflects the compiled expression condition, on all three of Discovery/Feed/Favorites; two different non-flat expressions (same flattened `ai_filter`) produce distinct query/cache keys (AC3 regression).
- [x] 100% branch coverage on the changed `packages/domain` file, per `project-context.md`'s domain testing rule; Vitest coverage follows each extended test file's existing style (no literal percentage gate for `apps/web`).
- [x] E2E tests: not applicable — no new user-facing surface in this story (confirmed by Gate 2's "no gap" verdict above); existing E2E coverage of the three pages' happy paths is unaffected since flat-filter behavior is byte-identical to before.

## Deliverables Checklist

- [x] `resolvePromptToEventFilter`/`getMyAIEventFilters` client documents select `expression` (3-level unrolled); `graphql.ts` regenerated and committed.
- [x] `ai-filters-content.tsx`'s `handleRowClick` forwards `expression` via a new `ai_expression` URL param.
- [x] `useAIFilter()` returns `activeExpression`, backed by a new `ai_expression` `nuqs` state field cleared in lockstep with `activeFilter`/caveats at all five existing clear sites.
- [x] `buildEventsQueryCondition` accepts an optional `expression?: FilterNode` that short-circuits to `compileFilterNodeToQueryCondition`, mirroring `buildFeedQueryCondition`/`buildAccountEventsQueryCondition`.
- [x] Discovery, Feed, and Favorites all prefer `activeExpression` over `activeFilter` in their query-building call, and all three screens' cache keys (`queryKey`/`filterKey`, including Favorites' extra `idSnapshotData` query) include `activeExpression`.
- [x] A non-flat (`OR`/`NOT`-containing) AI filter, live-resolved or loaded from "My AI Filters," now actually filters Discovery/Feed/Favorites results instead of silently applying as empty.
- [x] All new/updated test files passing; 100% domain coverage on the changed `packages/domain` file; `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/web codegen`/`test`/`lint`/`build` all green.

## Out of Scope

- **`handleSave`/`saveAIEventFilter` still persisting only the flat `resolvedFilter` projection** for a non-flat resolved expression (so saving a grouped/boolean AI filter today still persists as an effectively empty filter) — a known, separate, accepted gap (Dev Notes decision 7), out of this story's AC2/AC3 scope (the three *live-query* screens only). Candidate for a future story once Story 9.5/9.6's expression-summary rendering also lands, since fixing the save path alone without fixing `ai-filters-content.tsx`'s flat-only summary rendering would be a half-measure.
- **`ai-filters-content.tsx`'s list-row summary** (`renderAIFilterSummary(filter.resolvedFilter, ...)`) rendering a meaningful sentence for a non-flat saved filter — Story 9.5/9.6's exclusive scope (rich expression-summary rendering), not touched here beyond the `handleRowClick` URL-param fix (Task 3), which only affects what gets *applied* when the row is clicked, not what the row *displays*.
- **Any `packages/ui`/visual change** — confirmed zero UI surface by Gate 2 above; this story is query-building and cache-key wiring only.
- **Rich expression-summary rendering for trees, the AI filter overlay's example prompts, a "too complex" caveat in the overlay** — Stories 9.5/9.6's exclusive scope (unchanged from Story 9.4's own Out of Scope section).
- **Golden-prompt evals, rate limiting, the PRD/vocabulary doc amendment** — Stories 9.7, 9.8, 9.9z respectively.
- No new Gate 1/2/3 gap was found by this story; no new prerequisite story results from it.

## Definition of Done

- [x] AC1-AC4 satisfied and verified by their respective tests.
- [x] Required tests passing: `pnpm --filter @festgrid/domain test` (100% branch coverage on changed files) and `pnpm --filter @festgrid/web test`.
- [x] Lint and type checks passing: `pnpm --filter @festgrid/domain lint`/`build`, `pnpm --filter @festgrid/web lint`/`build`.
- [x] `pnpm --filter @festgrid/web codegen` run, with the regenerated `graphql.ts` committed.

## Completion Status

- [x] Complete — all tasks/subtasks done, all ACs satisfied, verification commands green.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via `bmad-dev-story`.

### Debug Log References

- `pnpm --filter @festgrid/domain test` — 706/706 passing (includes the 4 new expression-branch tests on `buildEventsQueryCondition.test.ts`: expression-only parity, expression-wins-over-filter short-circuit, empty-compiling expression returns `undefined`, currentDate/timezone threading).
- `pnpm --filter @festgrid/domain lint` — 0 errors/warnings.
- `pnpm --filter @festgrid/domain build` (`tsc`) — clean, including the new `buildEventsQueryCondition.ts` ↔ `compile-filter-node.ts` circular import (Dev Notes decision 6) — confirmed no bundler/TS resolution issue.
- `pnpm --filter web codegen` — regenerated `apps/web/src/generated/graphql.ts` (+75 lines: the `expression { ... }` selections' generated types/result shape for `ResolvePromptToEventFilterMutation`/`GetMyAiEventFiltersQuery`).
- `pnpm --filter web test` (full, unfiltered) — 78/78 test files, 645/645 tests passing. Includes all new/updated cases: 4 new `use-ai-filter.test.ts` cases (AC1), 2 new cases each in `home-content.test.tsx`/`feed-content.test.tsx`/`favorites-content.test.tsx` (AC2/AC3, including the AC3 distinct-cache-key regression), and a pre-existing `ai-filters-content.test.tsx` case updated for the new `ai_expression` URL param (Task 3 changed `handleRowClick`'s output, which that file's existing "navigates to Discovery with filter params" test asserted literally).
- `pnpm lint` (repo root, unfiltered) — 0 errors (warnings only, all pre-existing).
- `pnpm build` (repo root, unfiltered) — 8/8 tasks successful, including `web`'s full Next.js build (all routes, including `/favorites`, `/feed`, `/settings/ai-filters`, `/[locale]`).
- Manual: `grep -rn "activeFilter\b" apps/web/src --include="*.tsx"` — confirmed every consumer (`home-content.tsx`, `feed-content.tsx`, `favorites-content.tsx`) now also reads `aiFilter.activeExpression` alongside `aiFilter.activeFilter`, both in the query-building branch and in every cache-key object (including Favorites' extra `idSnapshotData` query) — no consumer missed.
- One intermittent `Uncaught Exception` (`window is not defined` inside `sonner`'s internal timer, surfaced while `subscriptions-content.test.tsx` was running) was observed on one `pnpm --filter web test` run. Investigated per the resumed-session guidance: `git diff 2c5003c..HEAD --stat -- apps/web` confirms this story's diff touches none of `subscriptions-content.tsx`/`.test.tsx` or anything they import; a clean re-run of the full unfiltered suite immediately after (78/78 files, 645/645 tests) did not reproduce it. Recorded here as a suspected pre-existing test-isolation flake (a toast library's background timer firing after an unrelated test's teardown), not caused by this story's changes.

### Completion Notes List

- Implemented exactly per the story's Implementation Plan/File Change Plan: one additive `packages/domain` parameter (`buildEventsQueryCondition`'s `expression?: FilterNode`), two client `.graphql` selection additions, one `use-ai-filter.ts` hook extension (`activeExpression`/`ai_expression`), one `ai-filters-content.tsx` URL-param addition, and three page-level query-building/cache-key rewires (Discovery/Feed/Favorites). No new component, no new schema, no DB migration — matches the Pre-Coding Approval Gate's scope exactly.
- **Pre-Coding Approval Gate:** ticked as pre-approved per this session's Epic 9 batch dispatch instruction (approved as scoped: one additive `packages/domain` parameter + tests, `use-ai-filter` hook extension, client `.graphql` selection additions, the three page-level content files, settings-page URL param; no new components/schema/migration).
- **Resolved default (recorded per the dispatch instruction to minimise questions):** Task 4's literal wording claims `setAiExpressionStr(null)` should be added to "all five" call sites that already clear `aiFilterStr`/`aiCaveatsStr` together (`handleApply`, `handleRePrompt`, `handleClose`, `handleAIClear`, `handleAIExpand`). On inspection, only three of those five (`handleRePrompt`, `handleAIClear`, `handleAIExpand`) actually clear `aiFilterStr`/`aiCaveatsStr` in the pre-story code — `handleApply`/`handleClose` deliberately leave them set (that's how "Apply" commits the just-resolved filter as the active one; clearing `ai_expression` there while leaving `ai_filter` set would wipe a just-applied non-flat expression's own logic immediately on Apply, reintroducing the exact silent-empty-filter bug this story exists to close). Implemented `setAiExpressionStr(null)` only at the three sites that actually clear the sibling fields, preserving the "atomic bundle, never partial" invariant Task 4 intends rather than its literal (but inconsistent with current behavior) site list.
- **Resolved default:** `buildEventsQueryCondition`'s new `expression` branch calls `compileFilterNodeToQueryCondition(expression, { currentDate, timezone })`, threading both through (unlike `buildFeedQueryCondition`/`buildAccountEventsQueryCondition`'s own expression branches, which call it with no context argument) — per Task 5's literal instruction and because `buildEventsQueryCondition` already accepts both as its own input params, so threading them is a direct, low-risk extension of its own existing timezone-resolution behavior (DW-074), not a new mechanism.
- Verified AC2's `expression`-wins-when-both-supplied short-circuit, AC2's `undefined`-on-empty-expression parity with the existing "no conditions" return shape, and AC3's distinct-cache-key regression (two different non-flat expressions sharing the same flattened `{}` `ai_filter` produce different `graphqlClient.request`/`getEvents` query payloads) via dedicated new tests at both the domain level and all three `apps/web` content-page integration-test files.
- `ai-filters-content.test.tsx`'s pre-existing "navigates to Discovery with filter params when row is clicked" test asserted the exact `router.push` URL string, which Task 3's `ai_expression` param addition changed; updated that test's fixture/assertion to include `expression` (same pattern as `resolvedFilter`) rather than leaving a stale assertion — in scope as a direct, unavoidable consequence of Task 3's own listed file.
- `handleSave`/`saveAIEventFilter` and `ai-filters-content.tsx`'s list-row summary rendering were deliberately left untouched, exactly as the story's Dev Notes decision 7 and Out of Scope section specify.

### File List

**Modified:**
- `packages/domain/src/events/buildEventsQueryCondition.ts` (additive `expression?: FilterNode` parameter, short-circuit branch)
- `packages/domain/src/events/buildEventsQueryCondition.test.ts` (4 new expression-branch tests)
- `apps/web/src/features/events/mutations.graphql` (`resolvePromptToEventFilter`'s `expression { ... }` selection)
- `apps/web/src/features/events/queries.graphql` (`getMyAIEventFilters`'s `expression { ... }` selection)
- `apps/web/src/features/events/use-ai-filter.ts` (`activeExpression`, `ai_expression` query state, extended `resolvedData`, clear-site wiring)
- `apps/web/src/features/events/use-ai-filter.test.ts` (4 new `activeExpression` tests)
- `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx` (`handleRowClick`'s `ai_expression` URL param)
- `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.test.tsx` (updated pre-existing `handleRowClick` test fixture/assertion for the new param)
- `apps/web/src/app/[locale]/home-content.tsx` (expression-first query-building branch + cache-key additions)
- `apps/web/src/app/[locale]/home-content.test.tsx` (2 new AC2/AC3 integration tests)
- `apps/web/src/app/[locale]/feed/feed-content.tsx` (expression-first query-building branch + cache-key additions)
- `apps/web/src/app/[locale]/feed/feed-content.test.tsx` (2 new AC2/AC3 integration tests)
- `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (`buildFavoritesQueryCondition`'s `expression` parameter, both call sites, cache-key additions)
- `apps/web/src/app/[locale]/favorites/favorites-content.test.tsx` (`__setNuqsValue` test helper added; 2 new AC2/AC3 integration tests)
- `apps/web/src/generated/graphql.ts` (regenerated codegen artifact)

## Change Log

- 2026-10-15 — Implemented via `bmad-dev-story`: all 12 tasks complete, all ACs satisfied and verified (`pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter web codegen`/`test`/`lint`/`build`, all green). Pre-Coding Approval Gate ticked per this session's Epic 9 batch dispatch instruction (approved as scoped: one additive `packages/domain` parameter + tests, `use-ai-filter` hook extension, client `.graphql` selection additions, the three page-level content files, settings-page URL param; no new components/schema/migration). Status: review.

## Epic 9 code-review amendments (2026-10-23)

The Epic 9 code review (`implementation-artifacts/epic-9-code-review-2026-10-23.md`) changed behaviour this story's text still describes. Read the code and this note, not the superseded wording below.

- **Search and the Today/Upcoming toggle are merged (supersedes AC2, decisions 2 and 3, and the Task 5/6/8 snippets):** `buildEventsQueryCondition({ expression, search, temporalFilter })` ANDs the search box and the page-level toggle onto the compiled expression, as SPEC CAP-5 requires (P13, D2). Home, Favorites and Feed pass them.
- **One query path:** `useAIFilter().activeExpression` is also the equivalent expression of a flat `ai_filter` (`expressionFromFlatFilter`), so the flat branches in the pages are only a fallback and the toggle no longer replaces a filter's own `temporalFilter`.
- **Feed/account scoping:** the base scope is spliced only into an `and` root; any other root is nested (`and[base..., filter]`), so an OR/NOT expression can no longer leak or invert results (P1).
