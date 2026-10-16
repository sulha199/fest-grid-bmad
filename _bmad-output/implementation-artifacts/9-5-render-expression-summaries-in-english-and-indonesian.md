---
baseline_commit: 443ec463722ed5697b900185901b370b4138ac3a
---

# Story 9.5: Render expression summaries in English and Indonesian

## Story Details

- Epic: 9
- Story ID: 9.5
- Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want a sentence that shows exactly how my prompt was grouped,
so that I can trust the filter without an edit form.

## Acceptance Criteria

1. **AC1 — deterministic, locale-safe expression-tree rendering with explicit grouping (epics.md AC1):** Given a `FilterNode` expression (AND/OR/NOT over the Story 9.1a locked leaf vocabulary), when the summary renders, then:
   - It is deterministic template output — identical input always produces identical output, no AI-generated or cached caption.
   - `AND`/`OR` children are joined with a locale-safe "and"/"or" word; a `NOT` node is rendered with a locale-safe "not" word prefix.
   - **Explicit grouping:** a child group is wrapped in parentheses whenever its operator differs from its parent's (so `AND[OR[...], ...]` reads as `(a or b) and c`, never the ambiguous `a or b and c`), and a `NOT`'s child is wrapped in parentheses whenever that child is itself a group (so `NOT(OR[...])` reads as `not (a or b)`, never the wrong-scoped `not a or b`).
   - A flat-representable expression (a single leaf, or a top-level `AND` of leaves only — no `OR`/`NOT`/nested group anywhere) renders **byte-identical** to Story 7.3's existing `renderAIFilterSummary` fixed field order (account, type/category, keyword, date range/day-of-week, admin-area-or-near-me, venue type, free/paid) — this is the expression-tree analog of Story 9.2's AC2 flat/expression compile-parity guarantee, applied to rendering instead of compiling, so the vast majority of AI-resolved prompts (which are flat) see zero visible change from this story.

2. **AC2 — new date phrasings render correctly in both locales (epics.md AC2):** Given a `dateRange` leaf with `spanAmount`/`spanUnit` (Story 9.1b), a `dayOfWeek` leaf with 2+ values, or a `temporalFilter` leaf (`TODAY`/`UPCOMING`), when the summary renders, then:
   - A span (e.g. `anchor: TODAY, offsetAmount: 0, spanAmount: 7, spanUnit: DAY`) renders through a dedicated, locale-provided template — not silently dropped.
   - `dayOfWeek: [SAT, SUN]` renders as a single "weekends" word (locale-provided); `dayOfWeek: [MON,TUE,WED,THU,FRI]` renders as a single "weekdays" word (locale-provided); any other multi-value set renders each translated day name joined with the locale "or" word (within-field semantics is OR — Story 9.1a Dev Notes decision 3/4 — so the joiner must say "or", never "and").
   - `temporalFilter: TODAY` / `UPCOMING` renders through a dedicated locale-provided label (e.g. "happening now" / "upcoming") — today this field is silently invisible in the summary even though both the flat extraction path (`transformGeminiResponseToEventFilter`, Story 9.1b Task 6) and the expression path can already produce it. This is a confirmed, currently-live gap (not hypothetical): `transformGeminiResponseToEventFilter` has populated `EventFilterInput.temporalFilter` from Gemini extraction since Story 9.1b (status: review/merged), but `renderAIFilterSummary` has no `temporalFilter` branch at all — so this part of the Gemini-extracted filter has been invisible to the user since that story shipped. Fixing it is both this AC's literal text and this workflow's "leave the system working end-to-end" requirement, not scope creep.
   - All of the above render through `next-intl` in `apps/web` (new `en`/`id` keys added to `AIFilterSummary` in both locale files), exercised by both the flat renderer (`renderAIFilterSummary`) and the new expression-tree renderer (`renderFilterExpressionSummary`) via one shared implementation per concern (no duplicated/drifting logic — see Dev Notes).

3. **AC3 — empty caveat strings are never joined (absorbs FIND-083: DW-086) (epics.md AC3):** Given a `caveats: string[]` array that contains one or more empty/whitespace-only strings, when the summary's caveat text is built, then those entries are filtered out before joining — `render-ai-filter-summary.ts:134`'s current `caveats.map(c => caveatPrefix + c).join(caveatSeparator)` joins empty strings verbatim today (confirmed still live). Applies identically to both `renderAIFilterSummary` and `renderFilterExpressionSummary` via one shared caveat-joining helper.

4. **AC4 — snapshot tests cover `en` and `id` (epics.md AC4):** `packages/domain` unit tests assert the exact rendered sentence for representative expressions (including the SPEC CAP-6 worked example "jazz or blues in Sleman or Bantul this weekend, not workshops") against two full label fixtures — one English-shaped, one Indonesian-shaped — proving the renderer is locale-agnostic (all words come from `labels`, never hardcoded) and deterministic.

**Depends on:** Story 9.1a, Story 9.1b (both `review`/implemented — see Previous Story Intelligence).

## Tasks / Subtasks

- [x] 1. **(AC2, AC3, Data Type Compatibility)** Create `packages/domain/src/ai-event-filters/summary-clause-formatters.ts` — pure, shared per-leaf-field formatting helpers, extracted once so both the flat renderer (Task 3) and the new tree renderer (Task 4) call the *same* implementation per concern (mirrors `compile-filter-node.ts`'s existing precedent of extracting shared leaf builders out of `buildEventsQueryCondition.ts` rather than re-deriving per-field logic twice). Import `AIFilterSummaryLabels` from `./render-ai-filter-summary.js` as a **type-only** import (`import type { AIFilterSummaryLabels } from './render-ai-filter-summary.js'`) — this is erased at compile time, so even though `render-ai-filter-summary.ts` (Task 3) will import *values* from this new file, there is no runtime circular dependency (unlike the `buildEventsQueryCondition.ts`↔`compile-filter-node.ts` precedent, which is runtime-circular-but-safe per Story 9.4a Dev Notes decision 6 — this one isn't circular at all at the JS level). Export:
  - `formatAccountIdClause(accountId: string, labels): string` — same logic as today's inline branch (template-or-prefix).
  - `formatTypesClause(types: EventType[], labels): string`, `formatCategoriesClause(categories: EventCategory[], labels): string` — same lookup/join/prefix logic as today.
  - `formatKeywordClause(keyword: string, labels): string` — same template-or-prefix logic as today.
  - `formatDateRangeClause(dateRange: DateRangeFilter, labels): string` — **extends** today's anchor/offset logic with span support (AC2):
    ```ts
    export function formatDateRangeClause(dateRange: DateRangeFilter, labels: AIFilterSummaryLabels): string {
      const { anchor, offsetAmount, offsetUnit, spanAmount, spanUnit } = dateRange;
      const anchorText = (labels.anchors && labels.anchors[anchor]) ? labels.anchors[anchor] : anchor;
      const hasSpan = spanAmount != null && spanUnit != null;
      const spanUnitText = hasSpan ? ((labels.units && labels.units[spanUnit as string]) ? labels.units[spanUnit as string] : spanUnit) : '';
      if (offsetAmount === 0) {
        if (hasSpan) {
          return (labels.dateRangeSpanOnlyTemplate ?? 'the next {spanAmount} {spanUnit}')
            .replace('{spanAmount}', String(spanAmount)).replace('{spanUnit}', spanUnitText as string);
        }
        return anchorText;
      }
      const unitText = (labels.units && labels.units[offsetUnit]) ? labels.units[offsetUnit] : offsetUnit;
      const sign = offsetAmount >= 0 ? '+' : '-';
      const absAmount = Math.abs(offsetAmount);
      const base = labels.dateRangeTemplate
        ? labels.dateRangeTemplate.replace('{anchor}', anchorText).replace('{sign}', sign).replace('{amount}', String(absAmount)).replace('{unit}', unitText)
        : `${anchorText} ${sign} ${absAmount} ${unitText}`;
      if (hasSpan) {
        return (labels.dateRangeSpanExtensionTemplate ?? '{base}, extending {spanAmount} {spanUnit}')
          .replace('{base}', base).replace('{spanAmount}', String(spanAmount)).replace('{spanUnit}', spanUnitText as string);
      }
      return base;
    }
    ```
    When `hasSpan` is false, output is byte-identical to today's logic (AC1's flat-parity requirement) — the only behavior change is additive (the two new `hasSpan` branches).
  - `formatDayOfWeekClause(dow: DayOfWeek[] | DayOfWeek | string, labels): string` — **replaces** the Story 9.1b "forced minimal compile-safety touch" (today: raw comma-join, no weekends/weekdays/or-word) with the real logic AC2 requires:
    ```ts
    const WEEKEND_DAYS = ['SAT', 'SUN'];
    const WEEKDAY_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    function isExactDaySet(dows: string[], set: string[]): boolean {
      return dows.length === set.length && set.every((d) => dows.includes(d));
    }
    export function formatDayOfWeekClause(dowInput: unknown, labels: AIFilterSummaryLabels): string {
      const dows = (Array.isArray(dowInput) ? dowInput : [dowInput]) as string[];
      if (isExactDaySet(dows, WEEKEND_DAYS) && labels.weekends) return labels.weekends;
      if (isExactDaySet(dows, WEEKDAY_DAYS) && labels.weekdays) return labels.weekdays;
      const translated = dows.map((d) => (labels.daysOfWeek && labels.daysOfWeek[d]) ? labels.daysOfWeek[d] : d);
      if (translated.length <= 1) return translated.join('');
      const orWord = labels.or ?? 'or';
      return translated.slice(0, -1).join(', ') + ` ${orWord} ` + translated[translated.length - 1];
    }
    ```
  - `formatTemporalFilterClause(temporalFilter: TemporalFilter | string, labels): string` — **new** (AC2, the live gap above): `(labels.temporalStatus && labels.temporalStatus[temporalFilter as string]) ? labels.temporalStatus[temporalFilter as string] : String(temporalFilter)`.
  - `formatLocationAdminAreaClause(adminArea: string, labels): string` — same template-or-prefix logic as today's `filter.location.adminArea` branch.
  - `formatLocationProximityClause(radiusMeters: number | null | undefined, labels): string` — same template-or-prefix/`nearMe` logic as today's `filter.location.coordinates` branch (radius in km when present, else bare "near me").
  - `formatVenueTypeClause(venueType: string, labels): string`, `formatIsFreeClause(isFree: boolean, labels): string | undefined` — same logic as today's inline branches.
  - `joinCaveats(caveats: string[] | null | undefined, labels): string | undefined` — **fixes DW-086** (AC3): filters out empty/whitespace-only entries *before* joining:
    ```ts
    export function joinCaveats(caveats: string[] | null | undefined, labels: AIFilterSummaryLabels): string | undefined {
      if (!caveats || caveats.length === 0) return undefined;
      const nonEmpty = caveats.filter((c) => c.trim() !== '');
      if (nonEmpty.length === 0) return undefined;
      const caveatSeparator = labels.caveatSeparator ?? '\n';
      const caveatPrefix = labels.caveatPrefix ?? '';
      return nonEmpty.map((c) => caveatPrefix + c).join(caveatSeparator);
    }
    ```
  - Write `summary-clause-formatters.test.ts` covering every branch (100% coverage, `packages/domain` rule): span present/absent × offsetAmount zero/nonzero for `formatDateRangeClause`; weekends/weekdays/other-multi/single for `formatDayOfWeekClause`; known/unknown `temporalFilter` value; all-empty/mixed/no-empty caveats for `joinCaveats`; template-present/absent branches for the remaining formatters (mirroring Story 7.3's existing per-field test shape).

- [x] 2. **(AC2, Data Type Compatibility)** Extend `AIFilterSummaryLabels` in `packages/domain/src/ai-event-filters/render-ai-filter-summary.ts` with new **optional** keys (additive — no existing caller breaks): `or?: string`, `weekends?: string`, `weekdays?: string`, `temporalStatus?: Record<string, string>`, `dateRangeSpanOnlyTemplate?: string`, `dateRangeSpanExtensionTemplate?: string`.

- [x] 3. **(AC1, AC2, AC3)** Modify `render-ai-filter-summary.ts`'s `renderAIFilterSummary` body to call Task 1's shared formatters instead of its own inline per-field logic, for every field (accountId, types, categories, keyword, dateRange/dayOfWeek, location, venueType, isFree, caveats) — a behavior-preserving refactor for every branch Task 1 did not change, plus the new span/weekends-weekdays-or/DW-086 behavior automatically, plus **add a new `temporalFilter` branch** (the live gap — AC2) immediately after the existing dateRange/dayOfWeek branch in the fixed clause order (so the order becomes: account, type, category, keyword, date-range-or-day-of-week, temporal-status, location, venue-type, free/paid):
  ```ts
  if (filter.temporalFilter) {
    clauses.push(formatTemporalFilterClause(filter.temporalFilter, labels));
  }
  ```
  Replace the final caveat-joining block with a call to `joinCaveats(caveats, labels)`.

- [x] 4. **(AC1, AC2, AC3, AC4)** Create `packages/domain/src/ai-event-filters/render-filter-expression-summary.ts`:
  - `export interface FilterExpressionSummaryLabels extends AIFilterSummaryLabels { and?: string; not?: string; }` (`and`/`not` are tree-only; `or` already lives on the base interface from Task 2 since the flat renderer's day-of-week joining needs it too).
  - `export function renderFilterExpressionSummary(node: FilterNode | null | undefined, caveats: string[] | null | undefined, labels: FilterExpressionSummaryLabels): AIFilterSummaryResult`:
    ```ts
    export function renderFilterExpressionSummary(
      node: FilterNode | null | undefined,
      caveats: string[] | null | undefined,
      labels: FilterExpressionSummaryLabels
    ): AIFilterSummaryResult {
      if (!node) return renderAIFilterSummary(null, caveats, labels);
      const normalized = normalize(node);
      // AC1's flat-parity requirement: delegate to the exact Story 7.3 renderer whenever the whole
      // tree is flat-representable (a single leaf, or a top-level AND-of-leaves) -- reuses
      // `flatFilterFromExpression`'s own existing "is this flat?" check (it throws on OR/NOT/nested
      // groups) rather than re-implementing a second flatness test that could drift from it.
      try {
        const flat = flatFilterFromExpression(normalized);
        return renderAIFilterSummary(flat, caveats, labels);
      } catch {
        // Not flat-representable -- fall through to the recursive renderer below.
      }
      const summary = renderNode(normalized, labels) || labels.noFilter;
      return { summary, caveatsText: joinCaveats(caveats, labels) };
    }
    ```
  - Module-local `renderLeafClause(leaf: FilterLeaf, labels): string` dispatching on `leaf.field` to Task 1's formatters (mirrors `compile-filter-node.ts`'s `compileLeaf`'s exact dispatch shape):
    ```ts
    function renderLeafClause(leaf: FilterLeaf, labels: FilterExpressionSummaryLabels): string {
      switch (leaf.field) {
        case 'accountId': return formatAccountIdClause(leaf.value, labels);
        case 'type': return formatTypesClause(leaf.value, labels);
        case 'category': return formatCategoriesClause(leaf.value, labels);
        case 'keyword': return formatKeywordClause(leaf.value, labels);
        case 'dateRange': return formatDateRangeClause(leaf.value, labels);
        case 'dayOfWeek': return formatDayOfWeekClause(leaf.value, labels);
        case 'locationAdminArea': return formatLocationAdminAreaClause(leaf.value, labels);
        case 'locationProximity': return formatLocationProximityClause(leaf.value.radiusMeters, labels);
        case 'venueType': return formatVenueTypeClause(leaf.value, labels);
        case 'isFree': return formatIsFreeClause(leaf.value, labels) ?? '';
        case 'temporalFilter': return formatTemporalFilterClause(leaf.value, labels);
      }
    }
    ```
  - Module-local recursive walk with **explicit grouping** (AC1):
    ```ts
    function wrapInParens(text: string): string { return `(${text})`; }

    function renderNode(node: FilterNode, labels: FilterExpressionSummaryLabels): string {
      if (isFilterLeaf(node)) return renderLeafClause(node, labels);
      if (isFilterNotNode(node)) {
        const childText = renderNode(node.child, labels);
        const wrapped = isFilterGroupNode(node.child) ? wrapInParens(childText) : childText;
        return `${labels.not ?? 'not'} ${wrapped}`;
      }
      // AND/OR group.
      const joiner = node.op === 'AND' ? (labels.and ?? 'and') : (labels.or ?? 'or');
      const parts = node.children.map((child) => {
        const text = renderNode(child, labels);
        const needsParens = isFilterGroupNode(child) && child.op !== node.op;
        return needsParens ? wrapInParens(text) : text;
      });
      return parts.join(` ${joiner} `);
    }
    ```
  - Import `normalize` from `./normalize-filter-node.js`, `flatFilterFromExpression` from `./flat-filter-conversion.js`, `isFilterLeaf`/`isFilterGroupNode`/`isFilterNotNode`/`type FilterLeaf`/`type FilterNode` from `./filter-node.js`, `renderAIFilterSummary`/`type AIFilterSummaryResult` from `./render-ai-filter-summary.js`, and every formatter plus `joinCaveats` from `./summary-clause-formatters.js`.

- [x] 5. **(Testing, AC1-AC4)** Create `packages/domain/src/ai-event-filters/render-filter-expression-summary.test.ts` (`node:test`, 100% branch coverage):
  - Flat-delegation parity: a bare leaf, and a top-level `AND`-of-several-leaves (built via `expressionFromFlatFilter` from a fixture `EventFilterInput` covering every field), both render **identically** to calling `renderAIFilterSummary` directly on the equivalent flat filter — the literal AC1 parity assertion.
  - The SPEC CAP-6 worked example: `AND[ OR[locationAdminArea:'Sleman', locationAdminArea:'Bantul'], dateRange:{...this weekend...}, NOT(category:['WORKSHOP']) ]` plus a `type` leaf with `['CONCERT_JAZZ','CONCERT_BLUES']`-style array value (the within-leaf-array OR, not two OR'd leaves) — asserts the exact rendered string using an English-shaped `labels` fixture, proving explicit grouping around the `OR` branch and the `NOT` prefix.
  - `NOT` wrapping a single leaf (no parens) vs `NOT` wrapping an `AND`/`OR` group (parens) — both cases.
  - A mixed `AND`-of-`OR`s and a mixed `OR`-of-`AND`s, each asserting parens appear only around the mismatched-operator child, never around a same-operator child (normalize would have flattened that anyway, but the test documents the rule explicitly).
  - AC2: a `dateRange` leaf with `spanAmount`/`spanUnit` inside a non-flat tree; a `dayOfWeek` leaf equal to the weekend set, the weekday set, and an arbitrary 2-value set, each inside a non-flat tree; a `temporalFilter` leaf inside a non-flat tree.
  - AC3: caveats containing an empty string alongside real ones, asserting the empty one is dropped.
  - AC4 "snapshot" coverage: the SPEC worked example (and at least 2 more representative non-flat expressions) rendered against **two** full label fixtures — one English-shaped (`and:'and', or:'or', not:'not', weekends:'weekends', weekdays:'weekdays', temporalStatus:{TODAY:'happening now', UPCOMING:'upcoming'}, ...`) and one Indonesian-shaped (`and:'dan', or:'atau', not:'bukan', weekends:'akhir pekan', weekdays:'hari kerja', temporalStatus:{TODAY:'sedang berlangsung', UPCOMING:'akan datang'}, ...`) — asserting both produce their own exact, locale-correct string for the same input (proving no hardcoded English word ever leaks into the Indonesian output, and vice versa).
  - Null/undefined `node` input renders the same as `renderAIFilterSummary(null, ...)` (delegates correctly).
  - An empty-children group inside a `mapFilterLeaves`-degraded tree (defensive: should not crash even though `validateFilterNode` would reject a genuinely empty group upstream) — if unreachable via the public API, mark this branch's defensive `|| labels.noFilter` fallback as covered via the top-level empty-expression case instead; do not add dead/unreachable test-only code paths.

- [x] 6. **(Data Type Compatibility)** Export the two new modules from `packages/domain/src/ai-event-filters/index.ts`: add `export * from './summary-clause-formatters.js';` and `export * from './render-filter-expression-summary.js';` (alongside the existing `render-ai-filter-summary.js` export, which already carries the Task 2 label additions).

- [x] 7. **(AC2, i18n)** Add new keys to the existing `AIFilterSummary` namespace in **both** `apps/web/locales/en.json` and `apps/web/locales/id.json` (alongside the existing `noFilter`/`anchors`/`units`/`daysOfWeek`/etc. keys at the same nesting level):
  ```json
  "and": "and",
  "or": "or",
  "not": "not",
  "weekends": "weekends",
  "weekdays": "weekdays",
  "dateRangeSpanOnlyTemplate": "the next {spanAmount} {spanUnit}",
  "dateRangeSpanExtensionTemplate": "{base}, extending {spanAmount} {spanUnit}",
  "temporalStatus": {
    "TODAY": "happening now",
    "UPCOMING": "upcoming"
  }
  ```
  Indonesian (`id.json`) equivalents:
  ```json
  "and": "dan",
  "or": "atau",
  "not": "bukan",
  "weekends": "akhir pekan",
  "weekdays": "hari kerja",
  "dateRangeSpanOnlyTemplate": "{spanAmount} {spanUnit} ke depan",
  "dateRangeSpanExtensionTemplate": "{base}, diperpanjang {spanAmount} {spanUnit}",
  "temporalStatus": {
    "TODAY": "sedang berlangsung",
    "UPCOMING": "akan datang"
  }
  ```
  Matches this project's "Microcopy should be clear, concise, and helpful. Avoid technical jargon" voice guidance (`EXPERIENCE.md`), and the existing plain-word style of every other `AIFilterSummary` key already shipped (no DESIGN.md/EXPERIENCE.md entry exists or is required for these, per Gate 2 finding below — same precedent as the ~15 existing keys in this namespace).

- [x] 8. **(AC1, AC2, Data Type Compatibility — closes a confirmed live gap, Story 9.4a Dev Notes decision 7)** In `apps/web/src/features/events/use-ai-filter.ts`:
  - Replace the `renderAIFilterSummary` import with `renderFilterExpressionSummary` (and keep `expressionFromFlatFilter` imported from `@festgrid/domain/ai-event-filters` for the fallback below).
  - Extend the existing `summaryLabels` `useMemo` with the Task 7 keys, same `tSummary`/`tSummary.raw` pattern already used for every other key in that object:
    ```ts
    and: tSummary('and'),
    or: tSummary('or'),
    not: tSummary('not'),
    weekends: tSummary('weekends'),
    weekdays: tSummary('weekdays'),
    dateRangeSpanOnlyTemplate: tSummary.raw('dateRangeSpanOnlyTemplate'),
    dateRangeSpanExtensionTemplate: tSummary.raw('dateRangeSpanExtensionTemplate'),
    temporalStatus: { TODAY: tSummary('temporalStatus.TODAY'), UPCOMING: tSummary('temporalStatus.UPCOMING') },
    ```
  - Change `summaryResult` to prefer the loaded `aiExpression` over the flat `aiFilter`, falling back to converting the flat filter when no expression is present (handles a pre-9.4a bookmarked URL that has `ai_filter` but no `ai_expression`):
    ```ts
    const summaryResult = useMemo(() => {
      if (!aiFilter && !aiExpression) return null;
      const node = aiExpression ?? expressionFromFlatFilter(aiFilter ?? {});
      return renderFilterExpressionSummary(node, aiCaveats, summaryLabels);
    }, [aiFilter, aiExpression, aiCaveats, summaryLabels]);
    ```
  - Change `resolvedSummaryResult` to always use `resolvedData.expression` directly (it is non-nullable in `resolvedData`'s own state shape, always set together with `resolvedFilter`/`caveats` since Story 9.4a — no fallback needed):
    ```ts
    const resolvedSummaryResult = useMemo(() => {
      if (!resolvedData) return null;
      return renderFilterExpressionSummary(resolvedData.expression, resolvedData.caveats, summaryLabels);
    }, [resolvedData, summaryLabels]);
    ```
  - **Fix `handleSave` to persist the expression, not the lossy flat projection** (this is the other half of the Story 9.4a Dev Notes decision 7 gap — "fixing the save path alone without fixing the list's summary rendering would be a half-measure," and Task 9 below is fixing the list's summary rendering, so this half must land in the same story or the fix is incomplete end-to-end). `saveAIEventFilter`'s resolver (`apps/backend/src/schema/resolvers.ts:400`, Story 9.3, unchanged by this story) requires **exactly one** of `resolvedFilter`/`expression` — never both, never neither. `resolvedData.expression` is always populated (every mutation success since Story 9.4), so always send it, never `resolvedFilter`, mirroring Story 9.4a Dev Notes decision 1 ("always prefer expression over the flat projection whenever present"):
    ```ts
    const handleSave = () => {
      if (!resolvedData) return;
      setSaveError(null);
      saveFilter({
        prompt: resolvedData.prompt,
        expression: resolvedData.expression,
      });
    };
    ```
    Confirm (or add, if missing) a `GraphQL`-generated `expression` argument on the `useSaveAiEventFilterMutation` variables type — check `apps/web/src/features/events/mutations.graphql`'s `saveAIEventFilter` mutation document: if it does not already select/accept an `expression` variable (it may only ever have sent `resolvedFilter` until now), add `$expression: FilterNodeInput` to the mutation's variable list and pass it through, then regenerate codegen (Task 11). If it already accepts `expression` (added opportunistically by an earlier story in this batch), no `.graphql` change is needed — just the call-site change above.

- [x] 9. **(AC1, AC2, Data Type Compatibility — closes a confirmed live gap, Story 9.4a Out of Scope)** In `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx`:
  - Replace the `renderAIFilterSummary` import with `renderFilterExpressionSummary`.
  - Extend the existing `summaryLabels` `useMemo` with the identical Task 7 keys (same pattern as Task 8, same `tSummary` instance already in this file).
  - Change the row-rendering call from `renderAIFilterSummary(filter.resolvedFilter, [], summaryLabels)` to `renderFilterExpressionSummary(filter.expression, [], summaryLabels)` — `AIEventFilter.expression` has been populated and selected by `getMyAIEventFilters` for every row (flat or not) since Stories 9.3/9.4a; this is the exact gap Story 9.4a's Out of Scope section named ("the list's summary rendering... only reads the flat projection... Story 9.5/9.6's territory"). No JSX/visual change — same `h3` element, same `rendered.summary` binding.
  - Leave `handleRowClick` untouched (Story 9.4a's scope; still forwards both `ai_filter`/`ai_expression`, and `aiFilter` in `use-ai-filter.ts` already prefers the expression).

- [x] 10. **(Testing, AC1, AC2)** Update tests:
  - `packages/domain/src/ai-event-filters/render-ai-filter-summary.test.ts`: update the existing "renders an array-valued dayOfWeek gracefully" test's expectation from `'Friday, SAT'` to `'Friday or SAT'` (the Story 9.1b code comment explicitly deferred this exact grammar fix to this story — not a regression, an intentional, pre-flagged correction). Add cases for: a `dateRange` with `spanAmount`/`spanUnit` (both the `offsetAmount === 0` and `!== 0` branches); `dayOfWeek` equal to the exact weekend/weekday sets; a `temporalFilter` leaf; a caveats array containing an empty string (DW-086).
  - `apps/web/src/features/events/use-ai-filter.test.ts`: extend `mockExpression` to a genuinely non-flat fixture (e.g. `{ op: 'OR', children: [{ field: 'type', value: ['FESTIVAL'] }, { field: 'type', value: ['CONCERT'] }] }`) and assert `filterHubProps.aiFilterSummary` contains the locale "or" word (not just `toBeDefined()`); add a dedicated test asserting `handleSave` calls `saveFilter` with `{ prompt, expression }` and **not** a `resolvedFilter` key (proving Task 8's save-path fix).
  - `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.test.tsx`: fix `mockFilters[0].expression` to be an internally-consistent `AND`-of-leaves mirroring its own `resolvedFilter` fixture exactly (`{ op: 'AND', children: [{ field: 'keyword', value: 'rock' }, { field: 'category', value: ['MUSIC'] }, { field: 'isFree', value: true }] }`) — today it is just a bare `{ field: 'keyword', value: 'rock' }` leaf, inconsistent with `resolvedFilter`'s `categories`/`isFree`, which would silently lose assertions once the row switches to reading `.expression` (Task 9). With the fix, the existing "renders loading states and then displays saved filters" test's assertions (`/about 'rock'/i`, `/free events only/i`) keep passing unchanged, via this story's AC1 flat-delegation parity. Add a second fixture row with a genuinely non-flat `expression` (e.g. an `OR` of two `locationAdminArea` leaves) and assert its rendered row text contains the locale "or" word and both location names — the concrete, user-visible proof that a saved grouped filter's row summary is no longer silently flattened to "All events" (the bug this story and Story 9.4a together close).

- [x] 11. **(Verification)** Run `pnpm --filter @festgrid/domain test`/`lint`/`build` (100% coverage on every new/changed file), `pnpm --filter @festgrid/web codegen` (only if Task 8's `.graphql` check required a change), `pnpm --filter @festgrid/web test`/`lint`/`build`.

## Dev Notes

### Architecture & UX Gate Findings

Per `epic-9-readiness.md` (`swept: true`, 2026-10-14, `stories_covered` includes `9.5`), Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) were already run epic-wide and are cited here rather than re-run, per this session's explicit dispatch instruction ("skip Gate 1/3 and run Gate 2 only"):

- **Gate 1 (epic-wide, cited):** "No epic-wide bypass found... The upgrade is confined to `packages/domain` (types/schema/compiler), existing GraphQL resolvers, the existing Gemini transform, and existing UI (`FilterHub`)." Confirmed consistent for this story specifically: it adds two new pure `packages/domain` files and extends an existing one, extends two already-existing `apps/web` hook/page files with data wiring only, and adds locale keys — zero new API surface, zero new resolver, zero new Lambda/queue/IaC. The one GraphQL-adjacent touch (Task 8's `handleSave` fix) sends an argument (`expression`) the `saveAIEventFilter` resolver has already accepted since Story 9.3 — not a new API surface, a client call-site correction.
- **Gate 3 (epic-wide, cited):** no new Epic 0/cross-cutting dependency gap found for the epic; this story is exactly the "adoption" layer Gate 3 already anticipated (the shared `FilterNode` mechanism, owned entirely within Epic 9, reaching its summary-rendering consumers) — i18n/analytics/codegen foundations are all pre-existing and already adopted; this story only adds translation keys within the existing `next-intl` system, nothing foundational.
- **Lightweight guard (this story, checked fresh):** does 9.5's actual scope contain anything the epic-wide sweep plausibly didn't anticipate? No — everything above (summary rendering, locale keys, the `handleSave` fix) is pure `packages/domain` + `apps/web` data/i18n work using mechanisms (the `FilterNode` type, `saveAIEventFilter`'s existing `expression` argument, the existing `next-intl`/`AIFilterSummary` namespace) the epic-wide sweep already accounted for. No Gate 1/3 re-run warranted.
- **Gate 2 (UI Complexity & Reusability, run fresh via `runSubagent`, Freya persona, per this session's explicit dispatch instruction): No gap found.** Freya independently re-verified (not just cited) Story 9.4a's own "no gap" precedent against both `DESIGN.md` (read in full — zero AI-filter/FilterHub/expression-summary content, confirmed by grep) and `EXPERIENCE.md` (outline + full "Voice and Tone" section read — "Component Patterns" has no AI-filter-adjacent heading; its only generic guidance, "clear, concise, helpful, avoid jargon," is non-specific microcopy advice, not a per-string spec). Verdict against this story's three heuristics: (1) no reusable component with non-trivial states — zero new components/JSX anywhere in this story's scope; (2) no complex hook/util — the `use-ai-filter.ts` change is an incremental extension of an already-existing `useMemo` (conditional swap of which renderer/node is used), not new hook complexity, and the actual non-trivial logic (the tree renderer) is a pure `packages/domain` function consumed identically by both existing UI call sites via the same shared-renderer pattern already established since Stories 7.3/7.5; (3) no UX-spec'd visual/interaction detail omitted — neither artifact specifies any AI-filter-summary string or locale-connective word anywhere, confirmed by full-file grep, and choosing `and`/`or`/`not`/`weekends`/`weekdays` is ordinary localization content work directly analogous to the ~15 existing `summaryLabels` keys already shipped without a corresponding DESIGN.md/EXPERIENCE.md entry. No split, no prerequisite, no `epics.md`/`sprint-status.yaml` change from this gate.

**No gap found by any gate.** This story proceeds as scoped.

### Design decisions (resolved defaults — minimised per this session's dispatch instruction, not left as open questions)

1. **A whole-tree-flat expression always delegates to the exact Story 7.3 `renderAIFilterSummary` output (byte-identical), never a re-derived tree-order rendering.** This mirrors Story 9.2's AC2 compile-parity guarantee exactly, applied to rendering: since the vast majority of AI-resolved prompts are flat (no OR/NOT/grouping), this guarantees zero visible regression for the common case and reuses `flatFilterFromExpression`'s own existing "is this flat?" check (it throws on anything non-flat) rather than writing a second, potentially-drifting flatness test.
2. **Explicit grouping (parentheses) is added only where ambiguity would otherwise exist** — around a child group whose operator differs from its parent's, and around any group child of a `NOT` — never decoratively around every group. A `NOT` wrapping a bare leaf ("not workshops") or an `AND`/`OR` joining same-operator children never gets parentheses, since no ambiguity exists there and over-parenthesizing would make the "clear, concise, helpful, avoid jargon" sentences (`EXPERIENCE.md` Voice and Tone) harder to read for no correctness benefit.
3. **Date-range span rendering uses two new templates, not one**, to avoid an awkward redundant phrase for the dominant case (`offsetAmount === 0` with a span, e.g. "next 7 days"): `dateRangeSpanOnlyTemplate` replaces the anchor text entirely when there is no separate offset to report; `dateRangeSpanExtensionTemplate` appends to the existing offset-based clause for the rarer case where both an offset and a span are present. Neither introduces pluralization-aware grammar (e.g. "1 day" vs "2 days") — this matches the pre-existing, un-pluralized convention of every other unit label in this file (e.g. `"today + 1 day"` already said "day" for `offsetAmount: 1` before this story) and is not a new limitation introduced here.
4. **`dayOfWeek`'s weekend/weekday recognition is an exact-set match** (`[SAT,SUN]` / `[MON..FRI]`, order-insensitive, no partial match) — a 4-of-5 weekday subset or a 3-value set falls through to the generic "day, day or day" join, never a near-miss "weekdays"-ish label, since the word "weekdays" would be factually wrong for a 4-day subset.
5. **The within-field `dayOfWeek` joiner word is "or," never "and"** — `dayOfWeek` is the one multi-value field (SPEC constraint), and its semantics is "matches ANY of these days" (confirmed in `getDays`'s own doc comment: "ANY member of `dow`"), so "Friday or Saturday" is the correct reading, not "Friday and Saturday" (which would misleadingly suggest both days must match the same event).
6. **The shared per-leaf formatters (Task 1) live in a third file (`summary-clause-formatters.ts`), not inside either renderer file.** Putting them inside `render-filter-expression-summary.ts` (which needs to import `renderAIFilterSummary` for decision 1's flat-delegation) while `render-ai-filter-summary.ts` also needs to import them would create a runtime-circular pair exactly like the pre-existing, accepted `buildEventsQueryCondition.ts`↔`compile-filter-node.ts` precedent (Story 9.4a Dev Notes decision 6) — avoidable here with zero cost by using a third file, so there is no reason to accept that risk class a second time when a strictly simpler alternative exists.
7. **Scope boundary between this story and Story 9.6, resolved in favor of wiring the renderer end-to-end now (Tasks 8-9), not deferring the wiring to 9.6.** `epics.md` doesn't explicitly assign "which story wires the new renderer into `use-ai-filter.ts`/`ai-filters-content.tsx`" to either 9.5 or 9.6 by name — Story 9.4a's own Dev Notes/Out-of-Scope language groups "Story 9.5/9.6" together as owning "rich expression-summary rendering" without a sharper split. Resolved in favor of 9.5 doing the wiring because: (a) this story's own user-story text ("I want a sentence that shows exactly how my prompt was grouped") is meaningless unless the sentence is actually shown somewhere; (b) Story 9.6's own AC is scoped specifically to FilterHub's *truncate/expand visual treatment* and the overlay's *example prompts*/*"too complex" caveat* — none of which presuppose or require being the story that first makes the renderer reachable; (c) leaving the new renderer completely unwired would make this story's own Tasks 1-7 dead code with no test proving real user-facing behavior change, which is a worse outcome than a few extra call-site lines in two files this story already has every reason to touch for the label wiring anyway. Story 9.6 is left with its full scope untouched: FilterHub's one-row truncate+expand treatment, the overlay's grouped example prompt, and the "too complex" caveat styling — none of which this story's Tasks 8-9 implement (no truncation, no new example prompts, no caveat-specific styling).
8. **`handleSave`'s fix (Task 8) to send `expression` instead of `resolvedFilter` is included in this story, not deferred**, because Story 9.4a's own Dev Notes decision 7 explicitly warned that fixing the list's summary rendering (this story's Task 9) *without* also fixing the save path would be "a half-measure" — a newly-saved non-flat filter would otherwise still be persisted as an effectively empty flat filter (`saveAIEventFilter`'s XOR contract: `resolvedFilter: {}` with `expression` omitted stores `{}` verbatim, v1 format), making Task 9's row-rendering fix invisible for every *new* save going forward (existing rows are unaffected either way, since nothing non-flat has ever been persisted before this fix — the save path has only ever sent `resolvedFilter`). Both halves land in this one story, in the same file (`use-ai-filter.ts`), closing the gap Story 9.4a flagged completely rather than leaving a second half for a story (9.6) whose own AC never mentions it.
9. **The `temporalFilter` rendering gap (AC2) is fixed in `renderAIFilterSummary` (the flat renderer), not only in the new tree renderer**, because the flat path has been able to carry a Gemini-extracted `temporalFilter` value since Story 9.1b (`transformGeminiResponseToEventFilter`'s Task 6) — fixing only the tree renderer would leave the legacy/fallback flat path (a `v1` Gemini response, still accepted per Story 9.4 AC2) with the exact same invisible-field bug AC2 is written to close.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No DB migration, no GraphQL schema change. `FilterNode`/`FilterNodeInput`, `DateRangeFilter.spanAmount`/`spanUnit`, `TemporalFilter`, and `saveAIEventFilter`'s `expression` argument were all already added by Stories 9.1a/9.1b/9.3 — this story only adds new optional fields to a `packages/domain`-internal labels interface (`AIFilterSummaryLabels`/`FilterExpressionSummaryLabels`), two new pure function exports, new `next-intl` locale JSON keys, and changes which already-existing GraphQL field/argument two `apps/web` call sites read/send.
- **Impacted fields/contracts:**
  - **New, additive:** `AIFilterSummaryLabels.or?`/`.weekends?`/`.weekdays?`/`.temporalStatus?`/`.dateRangeSpanOnlyTemplate?`/`.dateRangeSpanExtensionTemplate?` (all optional, default to a sensible English fallback string when omitted — no existing caller that doesn't pass them breaks); `FilterExpressionSummaryLabels.and?`/`.not?`; the `renderFilterExpressionSummary`/formatters/`joinCaveats` exports; new `AIFilterSummary.{and,or,not,weekends,weekdays,temporalStatus,dateRangeSpanOnlyTemplate,dateRangeSpanExtensionTemplate}` locale keys in both `en.json`/`id.json`.
  - **Behavior change (intentional, pre-flagged, not a silent regression):** `renderAIFilterSummary`'s multi-value `dayOfWeek` join wording and its `temporalFilter`/DW-086 handling change — see Design decisions 8/9 and Task 10's updated test. `use-ai-filter.ts`'s `handleSave` now sends `expression` instead of `resolvedFilter` to `saveAIEventFilter` — changes what gets persisted for a *newly saved* filter going forward only; no existing row is rewritten or affected.
  - **No existing field is narrowed or removed.** `EventFilterInput`, `FilterNode`, and every existing `AIFilterSummaryLabels` key keep their current shape and default behavior when the new optional keys are omitted.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None beyond the additive interface extensions above (no `graphql.ts` regeneration expected unless Task 8 finds `mutations.graphql`'s `saveAIEventFilter` document doesn't yet accept an `expression` variable, in which case regenerate per Task 11).
- **Backward compatibility and rollout notes:** Every `packages/domain` change is additive or (for the two intentionally-corrected branches) a pre-flagged fix with an updated test, not a silent behavior drift. `apps/web`'s wiring changes are safe for every existing bookmarked/saved-filter shape: a pre-9.4a URL with `ai_filter` but no `ai_expression` falls back to `expressionFromFlatFilter`; every existing saved-filter DB row (all flat today, since the save path never sent `expression` before this story) round-trips through `resolveStoredFilter`→flat-delegation→Story 7.3's exact existing output, unchanged.
- **Verification checks:** 100% unit branch coverage (`packages/domain` rule) on `summary-clause-formatters.ts`, the extended `render-ai-filter-summary.test.ts`, and the new `render-filter-expression-summary.test.ts` (including the en/id "snapshot" fixtures and the flat-parity assertion); extended Vitest coverage on `use-ai-filter.test.ts` (including the `handleSave` argument-shape assertion) and `ai-filters-content.test.tsx` (including the new non-flat row fixture); `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/web test`/`lint`/`build`.

### Previous Story Intelligence

Story 9.4a (`review`, immediately preceding, same epic) establishes several conventions this story follows directly: the `nuqs`-backed `ai_expression` field and its "always prefer expression over flat whenever present" rule (Design decision 1 there, reused as Design decision 7/Task 8 here); the "safe narrowing cast" precedent for the generated GraphQL `FilterNode`-shaped value (`expression: data.resolvePromptToEventFilter.expression as unknown as FilterNode` — already in place in `use-ai-filter.ts`, unchanged by this story); and the circular-import-is-sometimes-fine-but-avoid-it-when-cheap reasoning this story's Design decision 6 explicitly builds on and then avoids. Story 9.4a's own Dev Notes decision 7 and Out of Scope section are this story's direct mandate (quoted/cited throughout above) — both halves of the gap it flagged (`handleSave`'s persistence, `ai-filters-content.tsx`'s row rendering) are closed by Tasks 8-9 here.

### Git Intelligence Summary

Recent commits (`git log --oneline -5`) are all `wip(9.4a): dev-story progress` / `chore(9.4a): revert stray tsbuildinfo rewrite` — confirming 9.4a is the immediately-preceding, now-`review` work in this batch, with no other concurrent epic work to reconcile against. Commit message convention observed: `type(scope): short description` (e.g. `feat(9.5): ...`, `wip(9.5): ...`).

### Project Structure Notes

- `packages/domain/src/ai-event-filters/summary-clause-formatters.ts` is NEW (+ test file).
- `packages/domain/src/ai-event-filters/render-filter-expression-summary.ts` is NEW (+ test file).
- `packages/domain/src/ai-event-filters/render-ai-filter-summary.ts` is UPDATEd (labels extension, formatter delegation, new `temporalFilter` branch) — `render-ai-filter-summary.test.ts` UPDATEd accordingly.
- `packages/domain/src/ai-event-filters/index.ts` is UPDATEd (two new barrel exports).
- `apps/web/locales/en.json`, `apps/web/locales/id.json` are UPDATEd (`AIFilterSummary` namespace, additive keys only).
- `apps/web/src/features/events/use-ai-filter.ts` is UPDATEd (renderer swap, labels extension, `handleSave` argument fix) — `use-ai-filter.test.ts` UPDATEd accordingly.
- `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx` is UPDATEd (renderer swap, labels extension) — `ai-filters-content.test.tsx` UPDATEd accordingly.
- `apps/web/src/features/events/mutations.graphql` is UPDATEd **only if** Task 8 finds `saveAIEventFilter`'s document doesn't already accept an `expression` variable (check before assuming either way).
- No `packages/ui` file is touched by this story (Gate 2 confirmed zero UI surface) — no component, no truncation/expand, no new example prompts (Story 9.6's scope).
- No conflicts detected with the unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.5: Render expression summaries in English and Indonesian] — authoritative ACs this story elaborates.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md] — Gate 1/3 epic-wide sweep findings cited above; confirms `9.5` is in `stories_covered`.
- [Source: _bmad-output/implementation-artifacts/9-4a-wire-the-resolved-ai-filter-expression-into-discovery-feed-and-favorites-query-building.md#Dev Notes decision 7, #Out of Scope] — the exact two-part gap (save-path persistence, list-row rendering) this story's Tasks 8-9 close; the "always prefer expression" precedent (decision 1) and circular-import reasoning (decision 6) this story reuses/contrasts.
- [Source: _bmad-output/implementation-artifacts/9-1b-extend-the-relative-date-grammar-with-spans-multi-weekday-and-temporal-status.md#Tasks 4-6, line ~96-105 of the shipped render-ai-filter-summary.ts] — the explicit code-comment deferral of dayOfWeek join-word/grammar logic to this story; the shipped `spanAmount`/`spanUnit`/`temporalFilter` fields this story renders.
- [Source: _bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml#DW-086] — the exact pre-existing caveat-joining bug this story's AC3/Task 1 `joinCaveats` fixes, confirmed still live at `render-ai-filter-summary.ts:134`.
- [Source: _bmad-output/implementation-artifacts/7-3-build-the-reusable-ai-filter-summary-renderer.md] — the original renderer's ACs/conventions (fixed clause order, `labels`-driven i18n decoupling, pure/no-React/deterministic contract) this story's flat-delegation parity (Design decision 1) is built to preserve exactly.
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/SPEC.md#CAP-6, #CAP-7, Constraints] — the "jazz or blues in Sleman or Bantul this weekend, not workshops" worked example this story's Task 5 test asserts against; the exact date-grammar/day-of-week/temporal-status vocabulary (CAP-7) this story's new templates/labels cover; "the summary stays deterministic template output with locale-safe join words and explicit grouping" (Constraints) — this story's literal mandate.
- [Source: packages/domain/src/ai-event-filters/render-ai-filter-summary.ts, render-ai-filter-summary.test.ts] — read in full; the exact function/labels interface/test shape this story extends and whose fixed clause order/pure-function/`labels`-driven conventions it preserves.
- [Source: packages/domain/src/ai-event-filters/filter-node.ts, normalize-filter-node.ts, flat-filter-conversion.ts, compile-filter-node.ts] — read in full; the `FilterNode`/`FilterLeaf` discriminated-union shape, the `normalize`-once-at-the-top convention, `flatFilterFromExpression`'s exact flatness-check/throw behavior this story's flat-delegation (Design decision 1) relies on, and `compile-filter-node.ts`'s shared-leaf-builder-extraction precedent this story's `summary-clause-formatters.ts` mirrors.
- [Source: packages/domain/src/events/buildEventsQueryCondition.ts] — `DateRangeFilter`/`DayOfWeek`/`TemporalFilter`/`DATE_OFFSET_AMOUNT_BOUNDS` exact shapes; `getDays`'s doc comment confirming `dayOfWeek`'s "matches ANY member" (OR) semantics (Design decision 5).
- [Source: apps/web/src/features/events/use-ai-filter.ts, use-ai-filter.test.ts] — read in full; the exact hook/labels-construction/test-mock shape this story extends.
- [Source: apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx, ai-filters-content.test.tsx] — read in full; the exact row-rendering call site and its pre-existing fixture inconsistency (`expression` vs `resolvedFilter` not matching) this story's Task 10 fixes.
- [Source: apps/backend/src/schema/resolvers.ts#L392-426 (saveAIEventFilter), #L4497-4503 (AIEventFilter field resolvers)] — read directly; confirms the XOR contract (`resolvedFilter`/`expression`, exactly one) this story's Task 8 `handleSave` fix must satisfy, and that `resolveStoredFilter` already correctly derives `flatFilter: null` for a non-flat v2-stored expression (no backend change needed).
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, EXPERIENCE.md] — read in full / via outline respectively (Gate 2); confirms zero AI-filter-summary-specific content exists in either, per the fresh Gate 2 subagent run cited above.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions, the epic-level-sweep citation rule, Gate 2's required action (independently re-verified, not rubber-stamped, per this story's own fresh subagent run).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/domain` purity: both new files are pure, zero React/DB/ORM/Node-only dependency), Testing Rules (100% domain coverage for every new/changed `packages/domain` file), Locale-Sensitive Data Rendering (`next-intl`-sourced labels, never a raw/hardcoded string) — all cited above.
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — FR98-FR103 (amended, per `epics.md`'s Epic 9 header) cover this capability at the PRD level; no PRD change is made by this story (Story 9.9z owns the PRD/vocabulary amendment).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file follows its canonical section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD section is implicated (no new infra/architecture decision; this story is pure `packages/domain` rendering logic plus `apps/web` data/i18n wiring, per `epic-9-readiness.md`'s Gate 1 citation above); full file not loaded, consistent with Stories 9.1a-9.4a's own precedent.
- [x] `docs/infrastructure/index.md` — not applicable (no Lambda, queue, DB, or hosting change); confirmed via the `epic-9-readiness.md` citation above; full infra shards not loaded.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/domain/src/ai-event-filters/summary-clause-formatters.ts` + `.test.ts` (Task 1).
  - UPDATE `packages/domain/src/ai-event-filters/render-ai-filter-summary.ts` (Task 2-3) + `.test.ts` (Task 10).
  - NEW `packages/domain/src/ai-event-filters/render-filter-expression-summary.ts` (Task 4) + `.test.ts` (Task 5).
  - UPDATE `packages/domain/src/ai-event-filters/index.ts` (Task 6).
  - UPDATE `apps/web/locales/en.json`, `apps/web/locales/id.json` (Task 7).
  - UPDATE `apps/web/src/features/events/use-ai-filter.ts` (Task 8) + `.test.ts` (Task 10).
  - UPDATE `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx` (Task 9) + `.test.tsx` (Task 10).
  - CONDITIONAL UPDATE `apps/web/src/features/events/mutations.graphql` + regenerated `apps/web/src/generated/graphql.ts`, only if Task 8's check finds `saveAIEventFilter`'s document doesn't already accept `expression`.
- **Rule Mapping:**
  - AC1 (deterministic, locale-safe, explicit grouping, flat-parity) → Task 4 (`renderFilterExpressionSummary`, `renderNode`'s parens logic, flat-delegation), Task 5 (tests), Design decisions 1-2.
  - AC2 (span, weekends/weekdays, temporalFilter, both locales) → Task 1 (formatters), Task 2-3 (flat renderer gains them too), Task 7 (locale keys), Design decisions 3-5, 9.
  - AC3 (DW-086) → Task 1 (`joinCaveats`), Task 3 (flat renderer uses it), Task 10 (test).
  - AC4 (en/id snapshots) → Task 5 (dual-locale-fixture tests).
  - "Leave the system working end-to-end" (temporalFilter gap, `handleSave` gap) → Task 3 (new branch), Task 8 (`handleSave` fix), Design decisions 7-9.
  - `packages/domain` purity (project-context.md) → every new file is pure; Task 1's type-only import avoids a runtime-circular dependency (Design decision 6).
  - Gate 1/2/3 (story-split-gate.md) → Gate 1/3 cited from `epic-9-readiness.md`; Gate 2 run fresh via `runSubagent` (Freya persona) — no gap found, documented in Architecture & UX Gate Findings above.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` — 100% branch coverage on `summary-clause-formatters.ts`, `render-filter-expression-summary.ts`, and every new branch in `render-ai-filter-summary.ts`; full existing domain suite stays green (including the one intentionally-updated assertion, Task 10).
  - `pnpm --filter @festgrid/domain lint`/`build` — clean.
  - `pnpm --filter @festgrid/web test` — updated/new cases in `use-ai-filter.test.ts` and `ai-filters-content.test.tsx` pass; full existing web suite stays green.
  - `pnpm --filter @festgrid/web lint`/`build` — clean.
  - `pnpm --filter @festgrid/web codegen` — run and diff committed only if Task 8's `.graphql` check required a change.
  - Manual: re-grep `render-ai-filter-summary.ts`/`render-filter-expression-summary.ts` for any hardcoded English word outside a `labels.X ?? 'default-fallback'` pattern — confirms every user-facing word is locale-sourced (AC2/AC4's "both locales" requirement), fallback defaults aside.

## Pre-Coding Approval Gate

- [x] Scope confirmation — two new pure `packages/domain` files + tests, one extended existing `packages/domain` file + test (additive labels, formatter delegation, one new branch, one corrected branch), one barrel-export update, two locale-file key additions, two `apps/web` call-site wiring updates (including the `handleSave` persistence fix) + their tests; zero new components, zero DB migration, zero required GraphQL schema change (conditional client-document check only).
- [x] Architecture and boundary confirmation — Gate 1/3 cited from `epic-9-readiness.md` (no gap); Gate 2 run fresh via `runSubagent` (Freya persona) found no gap (independently re-verified against `DESIGN.md`/`EXPERIENCE.md`, not rubber-stamped from Story 9.4a's precedent).
- [x] Testing plan confirmation — 100% domain unit coverage (new + extended) on every `packages/domain` file touched, including dual-locale "snapshot" fixtures (AC4) and the explicit flat-parity assertion (AC1); Vitest coverage extended on `use-ai-filter.test.ts` and `ai-filters-content.test.tsx`, including the one pre-existing-fixture correction needed for internal consistency (Task 10).
- [x] Explicit human approval state — APPROVED by user (dispatch instruction for this Epic 9 batch: "skip Gate 1/3 and run Gate 2 only... Minimise questions: choose the recommended default and record it in Dev Notes"), 2026-10-15. This blanket instruction is treated as the explicit authorization for every routine design default recorded above (decisions 1-9), matching Stories 9.1a-9.4a's own identical precedent for this same batch. The one decision with a real, non-mechanical tradeoff (the 9.5-vs-9.6 wiring-scope boundary, Design decision 7, and the `handleSave` persistence-fix inclusion, decision 8) is resolved toward spec-fidelity/completeness (wire it now, close the gap fully) per the dispatch instruction's "choose the recommended default" framing, and is recorded explicitly above rather than silently assumed.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3: no gap, N/A. Gate 2: no gap, N/A. No prerequisite story is created by this story.

## Testing Requirements

- [x] Unit tests: `summary-clause-formatters.test.ts` — every formatter's every branch (span present/absent × offset zero/nonzero; weekend/weekday/other/single dayOfWeek sets; known/unknown temporalFilter; empty/mixed/clean caveats). 100% branch coverage.
- [x] Unit tests: `render-filter-expression-summary.test.ts` — flat-delegation parity, the SPEC CAP-6 worked example with explicit-grouping assertions, NOT-wrapping-leaf vs NOT-wrapping-group, mixed AND/OR nesting, AC2 phrasings inside a non-flat tree, AC3 caveat fix, AC4 dual-locale (en/id) fixtures, null-input delegation. 100% branch coverage.
- [x] Unit tests: `render-ai-filter-summary.test.ts` (extended) — the one intentionally-updated dayOfWeek assertion, plus new span/weekend-weekday/temporalFilter/DW-086 cases. 100% branch coverage maintained.
- [x] Integration tests (Vitest): `use-ai-filter.test.ts` — non-flat `activeExpression`/`resolvedSummaryResult` reflects the OR/NOT wording; `handleSave` sends `{ prompt, expression }`, not `resolvedFilter`.
- [x] Integration tests (Vitest): `ai-filters-content.test.tsx` — existing flat-row test still passes via corrected, internally-consistent fixture; new non-flat row fixture renders OR wording and both location names in the row summary.
- [x] E2E tests: not applicable — no new user-facing surface in the Playwright-covered-critical-flow sense (confirmed by Gate 2's "no gap" verdict above; the visible text change is covered by the Vitest integration tests above, and FilterHub's own E2E/visual coverage, if any, is unaffected since this story adds no new component).

## Deliverables Checklist

- [x] `summary-clause-formatters.ts` exports every per-leaf-field formatter plus `joinCaveats` (DW-086 fix), 100% covered.
- [x] `render-ai-filter-summary.ts` delegates to the shared formatters, gains a `temporalFilter` branch, and its `dayOfWeek` join wording is corrected (weekends/weekdays/or-word) — all previously-passing tests still pass except the one intentionally-updated assertion.
- [x] `render-filter-expression-summary.ts` renders any valid `FilterNode` (flat or compound) deterministically, with explicit grouping, locale-safe and/or/not words, and flat-delegation parity with Story 7.3's renderer.
- [x] Both renderers exported from `packages/domain/src/ai-event-filters/index.ts`.
- [x] `en.json`/`id.json` carry the new `AIFilterSummary` keys (`and`, `or`, `not`, `weekends`, `weekdays`, `temporalStatus.{TODAY,UPCOMING}`, `dateRangeSpanOnlyTemplate`, `dateRangeSpanExtensionTemplate`).
- [x] `use-ai-filter.ts`'s live/resolved summaries render the resolved expression (not just the lossy flat projection) for both a live-resolved and a previously-saved (loaded) filter, and `handleSave` persists `expression`.
- [x] `ai-filters-content.tsx`'s "My AI Filters" row summary renders a non-flat saved filter's real logic instead of silently collapsing to "All events."
- [x] All new/updated test files passing; 100% domain coverage on every changed/new `packages/domain` file; `pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/web test`/`lint`/`build` all green.

## Out of Scope

- **FilterHub's one-row truncate+expand treatment for a long summary** — Story 9.6's exclusive scope. This story makes some summaries longer/richer (for non-flat filters) but adds no truncation/expand UI anywhere.
- **The AI filter overlay's example prompts (adding a grouped example) and the "too complex" caveat's visual styling** — Story 9.6's exclusive scope. The underlying `caveats` string for an over-limit prompt is already produced server-side (Story 9.4); this story only ensures caveat text itself joins correctly (AC3/DW-086), not how the overlay visually distinguishes a "too complex" caveat from any other.
- **Any `packages/ui`/visual change** — confirmed zero UI surface by Gate 2 above; this story is `packages/domain` rendering logic plus `apps/web` data/i18n wiring only.
- **Pluralization-aware unit grammar** (e.g. "1 day" vs "2 days") for date-range/span templates — not introduced by this story; matches the pre-existing, un-pluralized convention of every other unit label in `render-ai-filter-summary.ts` (Design decision 3).
- **Golden-prompt evals, rate limiting, the PRD/vocabulary doc amendment** — Stories 9.7, 9.8, 9.9z respectively.
- **The My AI Filters list row's own truncation/overflow handling for a very long rendered summary** — not specified by any ACÂ (9.5 or 9.6); this story leaves that row's existing (non-truncating, wrapping) `h3` element exactly as-is, matching Gate 2's "no new UI surface" finding; revisit only if a future story's AC calls for it.
- No new Gate 1/2/3 gap was found by this story; no new prerequisite story results from it.

## Definition of Done

- [x] AC1-AC4 satisfied and verified by their respective tests.
- [x] Required tests passing: `pnpm --filter @festgrid/domain test` (100% branch coverage on changed/new files) and `pnpm --filter @festgrid/web test`.
- [x] Lint and type checks passing: `pnpm --filter @festgrid/domain lint`/`build`, `pnpm --filter @festgrid/web lint`/`build`.
- [x] `pnpm --filter @festgrid/web codegen` run and diff committed, only if Task 8's `.graphql` check required a schema-document change.

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5), via `bmad-dev-story`.

### Debug Log References

- Pre-Coding Approval Gate was already ticked in the story file with explicit provenance (the Epic 9 batch dispatch instruction); re-confirmed per this session's dispatch instruction and proceeded without re-asking.
- Prerequisites 9.1a/9.1b confirmed `review` in `sprint-status.yaml` before implementation (workflow persistent-fact check).
- `pnpm --filter @festgrid/domain build` initially failed on the new/updated test files (`EventType.CONCERT`/`EventCategory.WORKSHOP` don't exist in `@festgrid/shared-types`; `DayOfWeek`/`TemporalFilter` literal-array/string test fixtures needed explicit casts) — fixed by using real enum members (`EventType.PERFORMANCE`/`EventType.WORKSHOP`/`EventCategory.MUSIC`) and `as DayOfWeek[]`/`TemporalFilter.X` in the test fixtures; no production code was affected by this fix. Confirmed clean afterward.
- `pnpm --filter @festgrid/web codegen` was run (Task 8's `.graphql` check found `saveAIEventFilter`'s mutation document did not yet accept an `expression` variable) — `mutations.graphql` updated, `graphql.ts` regenerated; diff is minimal (new optional `$expression`/`resolvedFilter` args only).
- All per-package verification commands (`pnpm --filter @festgrid/domain test/lint/build`, `pnpm --filter @festgrid/web test/lint/build`) were actually executed and confirmed green, not inferred from the code.

### Completion Notes List

- Task 1: Created `summary-clause-formatters.ts` with every per-leaf-field formatter (`formatAccountIdClause`, `formatTypesClause`, `formatCategoriesClause`, `formatKeywordClause`, `formatDateRangeClause` with span support, `formatDayOfWeekClause` with weekends/weekdays/or-word, `formatTemporalFilterClause`, `formatLocationAdminAreaClause`, `formatLocationProximityClause`, `formatVenueTypeClause`, `formatIsFreeClause`, `joinCaveats` (DW-086 fix)) plus `summary-clause-formatters.test.ts` (17 tests, every branch).
- Task 2-3: Extended `AIFilterSummaryLabels` with the additive optional keys (`or`, `weekends`, `weekdays`, `temporalStatus`, `dateRangeSpanOnlyTemplate`, `dateRangeSpanExtensionTemplate`); refactored `renderAIFilterSummary` to delegate to Task 1's formatters for every field and added the new `temporalFilter` branch in fixed clause order. Behavior-preserving for every untouched branch; the one intentional, pre-flagged change is the `dayOfWeek` array-join wording (now uses the locale "or" word instead of a raw comma).
- Task 4: Created `render-filter-expression-summary.ts` — `renderFilterExpressionSummary` delegates byte-identically to `renderAIFilterSummary` whenever the tree is flat-representable (via `flatFilterFromExpression`'s existing flatness check), else recursively renders with explicit grouping (parens only where operator mismatch or `NOT`-wraps-a-group would otherwise be ambiguous) and locale `and`/`or`/`not` words.
- Task 5: Created `render-filter-expression-summary.test.ts` (13 tests) — flat-delegation parity (bare leaf and full-field AND-of-leaves), the SPEC CAP-6 worked example, NOT-leaf-vs-NOT-group parens, mixed AND-of-OR/OR-of-AND parens, AC2 span/weekend/weekday/temporalFilter cases inside non-flat trees, AC3 caveat fix inside a non-flat tree, AC4 dual-locale (en/id) fixtures proving no hardcoded word leaks across locales, null-input delegation, and the defensive empty-group fallback (covered via the top-level empty-expression case, since a genuinely empty group is unreachable via the public API per Task 5's own note).
- Task 6: Barrel-exported both new modules from `packages/domain/src/ai-event-filters/index.ts`.
- Task 7: Added the `and`/`or`/`not`/`weekends`/`weekdays`/`dateRangeSpanOnlyTemplate`/`dateRangeSpanExtensionTemplate`/`temporalStatus.{TODAY,UPCOMING}` keys to both `apps/web/locales/en.json` and `id.json`'s `AIFilterSummary` namespace.
- Task 8: `use-ai-filter.ts` now renders via `renderFilterExpressionSummary` for both the live (`aiFilter`/`aiExpression`) and resolved (`resolvedData.expression`) summaries, with the Task 7 labels wired into `summaryLabels`. `handleSave` now sends `{ prompt, expression }` (never `resolvedFilter`), closing Story 9.4a's flagged half-measure gap. `mutations.graphql`'s `saveAIEventFilter` document did not yet accept an `expression` variable, so it was extended and codegen re-run (Task 11).
- Task 9: `ai-filters-content.tsx`'s row summary now calls `renderFilterExpressionSummary(filter.expression, [], summaryLabels)` instead of reading only the flat `resolvedFilter` projection, closing Story 9.4a's Out-of-Scope-flagged gap for the saved-filters list.
- Task 10: Updated `render-ai-filter-summary.test.ts` (corrected the pre-flagged dayOfWeek assertion, added span/weekend-weekday/temporalFilter/DW-086 cases), `use-ai-filter.test.ts` (non-flat `mockExpression` fixture, `aiFilterSummary` now asserted to contain the locale "or" word, new dedicated `handleSave` argument-shape test), and `ai-filters-content.test.tsx` (corrected `mockFilters[0].expression` to an internally-consistent AND-of-leaves, added a second non-flat-expression row fixture and its assertion; fixed the pre-existing `getByLabelText('Delete')` single-match assumption, now `getAllByLabelText(...)[0]`, since two rows exist after the new fixture).
- Task 11: `pnpm --filter @festgrid/domain test` (740 pass), `lint` (clean), `build` (clean); `pnpm --filter @festgrid/web codegen` (run, minimal diff); `pnpm --filter @festgrid/web test` (647 pass), `lint` (clean, pre-existing warnings only), `build` (clean) — all confirmed green by actually running them, per the workflow's persistent-fact requirement.
- Manual verification: re-grepped `render-ai-filter-summary.ts`/`render-filter-expression-summary.ts`/`summary-clause-formatters.ts` for hardcoded English words outside a `labels.X ?? 'default-fallback'` pattern — none found (only field-name string discriminators and the `WEEKEND_DAYS`/`WEEKDAY_DAYS` day-code constants, neither user-facing).

### File List

- NEW `packages/domain/src/ai-event-filters/summary-clause-formatters.ts`
- NEW `packages/domain/src/ai-event-filters/summary-clause-formatters.test.ts`
- NEW `packages/domain/src/ai-event-filters/render-filter-expression-summary.ts`
- NEW `packages/domain/src/ai-event-filters/render-filter-expression-summary.test.ts`
- UPDATE `packages/domain/src/ai-event-filters/render-ai-filter-summary.ts`
- UPDATE `packages/domain/src/ai-event-filters/render-ai-filter-summary.test.ts`
- UPDATE `packages/domain/src/ai-event-filters/index.ts`
- UPDATE `apps/web/locales/en.json`
- UPDATE `apps/web/locales/id.json`
- UPDATE `apps/web/src/features/events/use-ai-filter.ts`
- UPDATE `apps/web/src/features/events/use-ai-filter.test.ts`
- UPDATE `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.tsx`
- UPDATE `apps/web/src/app/[locale]/settings/ai-filters/ai-filters-content.test.tsx`
- UPDATE `apps/web/src/features/events/mutations.graphql` (Task 8's `.graphql` check required the change — `saveAIEventFilter` did not yet accept `expression`)
- UPDATE `apps/web/src/generated/graphql.ts` (regenerated via `pnpm --filter @festgrid/web codegen`)

## Change Log

- 2026-10-15 — Implemented via `bmad-dev-story`: all 11 tasks complete, all ACs satisfied and verified (`pnpm --filter @festgrid/domain test`/`lint`/`build`, `pnpm --filter @festgrid/web codegen`/`test`/`lint`/`build`, all green). Pre-Coding Approval Gate ticked per this session's Epic 9 batch dispatch instruction (approved as scoped: two new pure `packages/domain` files + tests, one extended existing `packages/domain` file + test, barrel export, en/id locale key additions, two `apps/web` call-site wirings incl. the `handleSave` persistence fix + their tests; no new components, no DB migration, no required GraphQL schema change — the `.graphql` client-document change needed by Task 8 was a conditional, pre-anticipated client-side call-site correction, not new schema). Status: review.
