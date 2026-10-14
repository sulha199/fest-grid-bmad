# Plan: AI Filter Upgrade — Complex Operators & Nested Queries

Status: PLAN (no code changed). Builds on `_bmad-output/specs/spec-ai-prompt-event-filter/SPEC.md` (v1).

## 1. Why

v1 `EventFilterInput` is a flat AND of single-valued fields. Prompts such as
"jazz **or** blues in Sleman **or** Bantul this weekend, **not** workshops, free **or** under a festival"
cannot be expressed: the model must collapse them, or they become caveats. Gaps found in code:

| Gap | Where |
|---|---|
| Only implicit AND across fields; no OR / NOT | `buildEventsQueryCondition.ts` (always `{operator:'and'}`) |
| `types`/`categories` are "in" (OR) only; no exclusion | same, `in` operator; `notIn` exists in DSL but unused by filter |
| `dayOfWeek` is a single value, though `getDays` already accepts an array | `EventFilterInput.dayOfWeek`, `getDays(…, dow[])` |
| `location` allows one place; "Sleman or Bantul" impossible | `LocationFilter` |
| `keyword` single phrase; no multi-term | `keyword` |
| Flat `transformGeminiResponseToEventFilter` silently drops what it cannot parse | transform file |
| Summary renderer concatenates clauses, no grouping words | `render-ai-filter-summary.ts` |

The query DSL (`packages/domain/src/query/queryDsl.ts`) is **already recursive** (`GroupCondition` with `and`/`or`, terminals incl. `ne`, `notIn`). The upgrade is mostly: a typed filter tree on the input side, a tree-to-DSL compiler, and tree-aware extraction / validation / summary. No new infra.

## 2. Target model: `EventFilterExpr` (recursive, closed)

```
FilterNode =
  | { op: AND | OR, children: FilterNode[] }       // depth ≤ 3, ≤ 12 total nodes
  | { op: NOT, child: FilterNode }                  // only wraps a leaf or group; no double NOT
  | { leaf: LeafFilter }                            // exactly one v1 vocabulary field
LeafFilter = one of the v1 fields (account, type, category, keyword, dateRange,
             dayOfWeek, location.proximity | location.adminArea, venueType, isFree, temporalFilter)
```

- **Backward compat:** the existing flat `EventFilterInput` stays valid and is treated as an implicit `AND` of leaves. Add `expr: FilterNodeInput` as an optional sibling; if both are set, `expr` is ANDed with the flat fields. Saved v1 filters and Widgets need no migration.
- **Vocabulary stays closed** (SPEC CAP-2): operators combine only locked fields. Anything else is still a caveat — no new field types in this upgrade.
- **GraphQL:** GraphQL inputs cannot be recursive-union, so use a bounded shape: `FilterNodeInput { op, leaf, children: [FilterNodeInput!] }` with server-side validation of "exactly one of leaf/children", depth and size caps. Mirror in `EventFilter` output type.
- **Validation:** a Zod schema in `packages/domain` is the single source of truth (depth, node count, NOT rules, leaf validity), used by the resolver (`saveAIEventFilter` / `events`) and by the Gemini transform.

## 3. Semantics decisions (need user sign-off — see §8)

1. **NOT on time/location leaves.** NOT over `scheduleDateRange` overlaps = "events that do not overlap range" — fine for `dateRange`; for multi-day events it excludes any overlap. Document, don't special-case.
2. **NOT on fields where the event has no value** (e.g. NOT venueType=CAFE when venueType is null): include or exclude nulls? Recommend **include** (NULL ≠ CAFE) and make the SQL translation explicit (`IS DISTINCT FROM`).
3. **Within-field OR shorthand:** keep `types: [A,B]` = OR as today; `NOT` on it = `notIn`.
4. **Two locations with proximity + adminArea:** now legal under OR (today it throws). Under AND it stays an error/caveat.
5. **Time-of-day / price threshold remain out of vocabulary** (v2).

## 4. Work breakdown (proposed stories; one epic "AI Filter v1.1 — Boolean & Nested Queries")

| # | Story | Package | Key points |
|---|---|---|---|
| S1 | **Domain: `FilterNode` types + Zod schema + limits** | `packages/domain/src/ai-event-filters/` | Pure types, depth/size/NOT caps, `normalize()` (flatten nested same-op, collapse single-child groups, de-dup leaves), exhaustive unit tests. |
| S1b | **Date grammar upgrade** | `buildEventsQueryCondition.ts`, transform, GraphQL `DateRangeFilter` | Add optional `spanAmount`/`spanUnit` to `dateRange` (rolling "next 7 days / 2 weeks", "rest of month" via span-to-period-end); `dayOfWeek` becomes an array (weekends = SAT+SUN, weekdays = MON–FRI; `getDays` already supports arrays); extract `temporalFilter` (TODAY/UPCOMING) from prompts; fix THIS_MONTH + DAY/WEEK offset semantics. Still relative-only: absolute dates, time-of-day, holidays stay caveats (v2). |
| S2 | **Compiler: `FilterNode → QueryCondition`** | `packages/domain/src/events/buildEventsQueryCondition.ts` | Extract per-leaf builder from the current monolith (reused by flat path → no behavior drift); add `NOT` via `ne`/`notIn` where possible, and a `not` group operator in DSL only if a leaf can't be negated natively. Extend DSL type `DSLOperator` with `not`; update SQL translator + `explain-events-queries.ts`. Remove the throw for coordinates+adminArea inside OR branches. Property tests: flat filter ≡ tree of ANDed leaves. |
| S3 | **SQL translation for `not` / null semantics** | `apps/backend` query translator | Per §3.2. Check index use with `explain-events-queries.ts` (OR of `scheduleDateRange` overlaps is already used for dayOfWeek, so pattern is proven). |
| S4 | **GraphQL schema + resolvers** | `events.graphql`, `ai-event-filters.graphql`, `widgets.graphql`, `resolvers.ts`, codegen | Add `FilterNodeInput`/`FilterNode`; resolver validates via S1; `dayOfWeek` becomes `[DayOfWeek!]` (backward-compatible input coercion from single value); persist `resolvedFilter` JSON as `{version: 2, expr, …flat}`; `buildFeed`/`buildAccountEvents` conditions get the same support. |
| S5 | **Gemini extraction v2** | `resolvers.ts` prompt + `transform-gemini-response-to-event-filter.ts` | New structured-output schema with `expr` tree; few-shot examples for AND/OR/NOT/nesting ("A or B, but not C"); keep single-shot, no chat (SPEC constraint). Transform validates tree via S1 and **degrades node-by-node**: invalid sub-tree → drop that node and emit a caveat, never fail the whole prompt. Fallback to flat output if the model returns the v1 shape. |
| S6 | **Summary renderer for trees** | `render-ai-filter-summary.ts` + `en.json`/`id.json` | Still deterministic template (CAP-4). Add labels `and`, `or`, `not`, bracket/grouping rules ("(jazz or blues) in Sleman or Bantul, not workshops"). Locale-safe join words for `id`. Snapshot tests per locale. |
| S7 | **UI: overlay & FilterHub line** | `AIFilterOverlay.tsx`, `FilterHub.tsx`, `ai-filters-content.tsx` | No edit UI (SPEC non-goal) — only the summary line; make it wrap/truncate well for long expressions with expand. Example prompts in overlay updated. Add caveat chip for "too complex" (limits exceeded). |
| S8 | **Evals + quality gate** | `review-rubric-ai-filter.md`, test-artifacts | Golden-prompt set (≥40 en/id prompts: AND/OR/NOT/nesting/ambiguous/over-limit/off-topic) asserting tree shape + caveats; run against Gemini behind a flag in CI nightly, stubbed in PR CI. |
| S9 | **Docs/spec** | SPEC, `filter-vocabulary.md`, architecture spine | Update via `bmad-spec` (update). Architecture diagram doc only if infra changes (none expected). |

Order: S1 → S1b → S2 → S3 → S4 → (S5 ∥ S6) → S7 → S8; S9 first (spec) and last (reconcile).

## 5. Risks & mitigations

- **LLM mis-nesting** ("A and B or C" precedence): prompt rules + always show the rendered summary (the sentence is the trust surface); eval set (S8) tracks precedence cases.
- **Query cost** from wide OR trees: size caps (depth 3, 12 nodes), `explain` checks in S3, cap date-expanded OR lists (dayOfWeek over 90 days already generates up to ~13 branches — switch to a single `dayOfWeekIn` terminal if it grows).
- **Saved-filter compatibility:** versioned JSON + flat fallback; migration-free.
- **BYOK abuse vector:** unchanged — structured output only, still single-shot.
- **Generated GraphQL/codegen churn:** isolate in S4.

## 6. Acceptance criteria (epic level)

1. "jazz or blues in Sleman or Bantul this weekend, not workshops" yields the correct tree, results, and a deterministic summary sentence in en and id.
2. Every v1 flat filter (saved, Widget, manual) yields byte-identical `QueryCondition` as before (regression test).
3. Over-limit or invalid sub-expressions produce caveats, not errors; the rest of the filter still applies.
4. No UI path edits a saved filter (CAP-3 holds).

## 7. BMad routing (from `bmad-help`)

Current position: implementation phase; this is a change to an existing, specced feature. Recommended sequence, each in a fresh chat:

1. **Optional** `bmad-forge-idea` — pressure-test the semantics in §3 (NOT/null behavior, precedence).
2. **Next** `bmad-spec` (update) on `spec-ai-prompt-event-filter` — add CAP-6 "boolean & nested expressions", update the vocabulary and constraints.
3. `bmad-create-epics-and-stories` (or `bmad-form-epics`) — turn §4 into epic + stories.
4. `bmad-epic-readiness-check` → `bmad-create-story` → `bmad-dev-story` → `bmad-code-review` per story.

## 8. Decisions (resolved 2026-10-14)

1. Caps: depth 3 / 12 nodes — adopted.
2. NOT includes events with no value for the field (NULL ≠ x) — adopted.
3. `dayOfWeek` becomes an array; multiple locations only via OR in `expr` — adopted.
4. Widgets get tree support in this epic (S4 covers `widgets.graphql`; add Widget regression tests) — adopted.
5. Date grammar upgrade (S1b) included in this epic; absolute dates and time-of-day remain v2.
