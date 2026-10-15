---
baseline_commit: 5ac3aa139a8659577716d23a1f90227fb4b7e22a
---

# Story 9.9z: Ratchet — every filter consumer goes through the shared compiler

## Story Details

- Epic: 9
- Story ID: 9.9z
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want a failing test if any `EventFilterInput`/`FilterNode` consumer builds a query condition without going through the Story 9.2 shared compiler,
so that a second, independently-reimplemented filter path cannot silently reappear as the codebase grows.

## Acceptance Criteria

1. **AC1 — a repo-wide sweep test fails if any consumer of `EventFilterInput`/`FilterNode` builds a query condition without the shared compiler (epics.md AC1):** Given the full set of files under `packages/domain/src`, `apps/backend/src`, and `apps/web/src` (excluding `*.test.ts(x)`, `generated/`, `dist/`), when a new automated test runs, then it fails if:
   - **Check 1 (leaf-builder confinement):** any of the ten per-field "leaf builder" identifiers `buildAccountIdCondition`, `buildTypesCondition`, `buildCategoriesCondition`, `buildKeywordCondition`, `buildDateRangeAndDayOfWeekCondition`, `buildLocationCondition`, `buildVenueTypeCondition`, `buildIsFreeCondition`, `buildTemporalCondition`, `resolveZonedToday` (all defined in `packages/domain/src/events/buildEventsQueryCondition.ts`, extracted by Story 9.2) is referenced anywhere outside that file and `packages/domain/src/ai-event-filters/compile-filter-node.ts` (plus either file's own `.test.ts`); **and**
   - **Check 2 (no silent reimplementation):** any file constructs a `QueryCondition`-shaped group literal (`operator: 'and' | 'or' | 'not'` alongside `conditions:`) **and** references `EventFilterInput`/`FilterNode` in the same file, **without** also importing at least one of the four sanctioned shared-compiler entry points (`buildEventsQueryCondition`, `buildFeedQueryCondition`, `buildAccountEventsQueryCondition`, `compileFilterNodeToQueryCondition`) — except the four files that *define* those entry points themselves.
   A positive-confirmation assertion (each allowed file still actually matches its expected pattern) and a negative-control test (a synthetic snippet that must be flagged by each check) accompany both checks, per this repo's established `*.ratchet.test.ts` convention (`apps/backend/src/lib/vendor-gateway/no-vendor-call-bypasses-wrapper.ratchet.test.ts`, `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts`).

2. **AC2 — the flat/expression parity test from Story 9.2 runs in CI (epics.md AC2):** Given `packages/domain/src/ai-event-filters/compile-filter-node.test.ts`'s existing AC2 parity test (every `EVENT_FILTER_FIXTURES` case compiles identically via the flat path and the expression path), when the repo's CI pipeline runs, then that test is confirmed to already execute on every push/PR with zero new code or workflow change — it is a normal file already matched by `packages/domain`'s `test` script (`tsx --test "src/**/*.test.ts"`), which the root `pnpm test` (`turbo run test --filter=!@festgrid/ai-dev-orchestrator`) already runs, which `.github/workflows/ci.yml`'s existing `pnpm run test` step already invokes on every CI run. This story documents and verifies that wiring; it does not modify `ci.yml` or any other `.github/workflows/*` file.

3. **AC3 — PRD §3.15/§4.18 and the `filter-vocabulary.md` companion are amended for expressions and the date grammar, FR98-FR103 (epics.md AC3):** Given the PRD (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`) and `_bmad-output/specs/spec-ai-prompt-event-filter/filter-vocabulary.md`, when amended, then:
   - §3.15 ("AI Prompt-Based Custom Event Filter") documents the boolean/nested-expression capability (AND/OR/NOT, depth ≤3/≤12 nodes, null-inclusive NOT, full backward parity for every pre-existing flat filter, Widget support through the same compiler) and the richer relative-date grammar (rolling spans, multi-weekday recurrence, ongoing/upcoming status) that Stories 9.1a-9.8 already shipped;
   - the stale "Deferred to implementation" compound-day callout (which asked exactly the question Story 9.1b/9.4 answered) is explicitly superseded, not silently deleted, so the PRD's own history stays legible;
   - §4.18 ("EventFilterInput Interface") widens `DateRangeFilter` with `spanAmount`/`spanUnit`, widens `dayOfWeek` to an array, adds the previously-undocumented `temporalFilter`/`TemporalFilter` field (a pre-existing, pre-Epic-9 gap this story also closes), and documents the new `FilterNode`/`FilterLeaf` expression-tree shape plus the `{version: 2, expression}` versioned persistence for saved AI filters and Widgets;
   - `filter-vocabulary.md` gains a clarifying note reconciling its flat-shape `location.proximity`/`location.adminArea` dot-paths with the two separate, mutually-exclusive `FilterNode` leaf field names (`locationProximity`/`locationAdminArea`) actually implemented by Story 9.1a, so the two documents don't silently disagree on naming.

**Depends on:** Stories 9.2, 9.3, 9.4.

## Tasks / Subtasks

- [x] 1. **(AC1, Check 1)** Create `packages/domain/src/ai-event-filters/__tests__/filter-consumer-no-bypass.ratchet.test.ts` (`node:test` + `node:assert`, matching the established `*.ratchet.test.ts` convention). Implement a `collectTsFiles(root)` walker (mirroring `no-vendor-call-bypasses-wrapper.ratchet.test.ts`'s own helper: recurse directories, skip `generated`/`dist`/`node_modules`/`__tests__` for files *other than this one*, skip `*.test.ts(x)` files) over three resolved roots: `packages/domain/src` (this package's own `src`), and `apps/backend/src`/`apps/web/src` reached via a relative climb from `__dirname` (mirroring `ad33-z-index-layering.ratchet.test.ts`'s pattern) — guard each cross-package root with an `fs.existsSync` check that throws a descriptive error if the climb is wrong, exactly as that precedent does. Implement Check 1: for each of the ten leaf-builder identifiers (`buildAccountIdCondition`, `buildTypesCondition`, `buildCategoriesCondition`, `buildKeywordCondition`, `buildDateRangeAndDayOfWeekCondition`, `buildLocationCondition`, `buildVenueTypeCondition`, `buildIsFreeCondition`, `buildTemporalCondition`, `resolveZonedToday`), scan all three roots with a word-boundary regex (`\bidentifier\b`) and assert zero hits outside `packages/domain/src/events/buildEventsQueryCondition.ts` and `packages/domain/src/ai-event-filters/compile-filter-node.ts`. Add the positive-confirmation assertion (the definition file still references each identifier) and a negative-control test (a synthetic snippet referencing one of the identifiers from an unauthorized module must be flagged), per the `no-vendor-call-bypasses-wrapper.ratchet.test.ts` Check A/B/C pattern.

- [x] 2. **(AC1, Check 2)** In the same test file, implement Check 2: scan the same three roots (excluding the four files that define the shared-compiler entry points: `packages/domain/src/events/buildEventsQueryCondition.ts`, `buildFeedQueryCondition.ts`, `buildAccountEventsQueryCondition.ts`, `packages/domain/src/ai-event-filters/compile-filter-node.ts`) for any file that (a) references `EventFilterInput` or `FilterNode` (as a type name or import) **and** (b) contains a `QueryCondition`-shaped group literal matching `operator:\s*['"](and|or|not)['"]` alongside a `conditions:` key nearby, **and** (c) does **not** import any of `buildEventsQueryCondition`, `buildFeedQueryCondition`, `buildAccountEventsQueryCondition`, `compileFilterNodeToQueryCondition` anywhere in the file. Assert the offender list is empty. Add a positive-confirmation pass (spot-check that `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/feed/feed-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx`, `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx`, and `apps/backend/src/schema/resolvers.ts` — the five known live `EventFilterInput`-handling consumers — each satisfy condition (c) today, i.e. the check isn't vacuously passing because nothing ever matches condition (a)/(b)) and a negative-control test (a synthetic snippet satisfying (a)+(b) with no sanctioned import must be flagged).

- [x] 3. **(AC1)** Run the new test file in isolation (`npx tsx --test packages/domain/src/ai-event-filters/__tests__/filter-consumer-no-bypass.ratchet.test.ts` from the repo root, or the package-scoped equivalent) and confirm it passes with zero offenders against the current, already-shipped Epic 9 code, and that both negative-control cases correctly fail when evaluated against their synthetic snippets.

- [x] 4. **(AC2, Verification only — no code/workflow change)** Confirm `packages/domain/src/ai-event-filters/compile-filter-node.test.ts`'s existing AC2 parity test block already runs under `pnpm --filter @festgrid/domain test`; confirm the root `package.json`'s `"test": "turbo run test --filter=!@festgrid/ai-dev-orchestrator"` script includes the `@festgrid/domain` package's `test` task (via `turbo.json`'s `test` task definition and workspace graph); confirm `.github/workflows/ci.yml` invokes `pnpm run test` (already present at or near line 73). Record the exact commands/line numbers checked in the Dev Agent Record. Do not create, edit, or attempt to push any `.github/workflows/*` file.

- [x] 5. **(AC3)** Amend `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` §3.15 ("AI Prompt-Based Custom Event Filter") per the exact replacement text in Dev Notes "PRD §3.15 amendment text" below: extend the "Locked Filter Vocabulary" bullet to mention ongoing/upcoming status; insert a new "Richer Relative Dates" bullet and a new "Boolean, Nested Expressions" bullet; replace the stale "> Deferred to implementation" blockquote with a "> Resolved" blockquote that explicitly supersedes it (never silently delete PRD history).

- [x] 6. **(AC3)** Amend §4.18 ("EventFilterInput Interface") per the exact replacement text in Dev Notes "PRD §4.18 amendment text" below: add `enum TemporalFilter`; widen `DateRangeFilter` with `spanAmount?`/`spanUnit?`; widen `EventFilterInput.dayOfWeek` to `DayOfWeek[]`; add `EventFilterInput.temporalFilter?: TemporalFilter`; insert the new `FilterNode`/`FilterGroupNode`/`FilterNotNode`/`FilterLeaf` type block immediately after the `EventFilterInput` interface; append a closing note on the GraphQL generic encoding and `{version: 2, expression}` persistence.

- [x] 7. **(AC3)** Amend `_bmad-output/specs/spec-ai-prompt-event-filter/filter-vocabulary.md` per the exact replacement text in Dev Notes "filter-vocabulary.md amendment text" below: add the location leaf-field-name reconciliation note under the "Expression operators (CAP-6)" section. Do not rename the existing `location.proximity`/`location.adminArea` table rows — those correctly describe the flat `EventFilterInput` shape; the note clarifies the *different*, already-shipped expression-leaf names without making the table inaccurate.

- [ ] 8. **(Verification)** Run `pnpm --filter @festgrid/domain test`, `pnpm --filter @festgrid/domain lint`, `pnpm --filter @festgrid/domain build`. Confirm the new ratchet test file is picked up and passes. Spot-check (do not full-run) `pnpm --filter @festgrid/backend build`/`lint` and `pnpm --filter @festgrid/web build`/`lint` are unaffected (this story touches zero files in those packages' own `src`, only reads them) — a full `pnpm --filter backend test`/`pnpm --filter web test` run is not required for this story's own verification since no backend/web source file changes, but running the full domain suite plus a lint/build pass on backend/web is a cheap confirmation the new cross-package file reads resolved correctly.

## Dev Notes

### Architecture & UX Gate Findings

Per `epic-9-readiness.md` (`swept: true`, 2026-10-14), Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) were already run epic-wide and are cited here rather than re-run, per this session's explicit dispatch instruction ("skip Gate 1/3 and run Gate 2 only"):

- **Gate 1 (epic-wide, cited):** "No epic-wide bypass found... no new infra is implied anywhere in the epic's stories." This story adds zero new infra, zero new API surface, zero new table — a test file plus prose doc edits.
- **Gate 3 (epic-wide, cited):** no new Epic 0/cross-cutting dependency gap; this story is the epic's own named "ratchet" closer, not a foundational dependency for anything else.
- **Lightweight guard (this story, checked fresh):** does 9.9z's actual scope contain anything the epic-wide sweep plausibly didn't anticipate (new external service, new data entity, new infra dependency)? No — the sweep's own closing line names this exact story by number ("Each will skip Gate 1/3 citing this report and run only Gate 2") and `epics.md`'s own Story 9.9z `Note:` describes it as the epic-formation ratchet. Nothing here introduces a service, entity, or infra dependency; it is a static source-scan test plus documentation.
- **Gate 2 (UI Complexity & Reusability, run fresh via the Agent tool, Freya persona, per this session's explicit dispatch instruction):** **Verdict: no gap found.** Freya's assessment, verbatim: *"This one's a non-starter for Gate 2 by construction: the entire footprint is a source-scan ratchet test under `packages/domain/src/ai-event-filters/__tests__/` (pure Node `fs`/`path` regex checks, no runtime behavior) plus prose edits to the PRD and the filter-vocabulary spec. There's no reusable component, no complex hook/util, and no visual or interaction surface at all — `apps/web/src` and `packages/ui/src` are untouched. Since there's zero UI surface, there's nothing for `DESIGN.md`/`EXPERIENCE.md` to speak to, consistent with how Gate 2 was resolved identically for Stories 9.1a, 9.1b, 9.2, and 9.3 in this same epic. Proceed without splitting out any UI work."*

**No gap found by any gate. No prerequisite story, `epics.md` addition, or new `sprint-status.yaml` entry results from this story.**

### Design decisions (resolved defaults — minimised per this session's dispatch instruction, not left as open questions)

1. **Two complementary, regex-based checks, not a full AST parse** — matching this repo's own established convention ("a pragmatic regex scan over source files, not a full AST parse — the same style already established by `events-postid-write-ratchet.test.ts` and `event-account-match-ratchet.test.ts`," explicitly cited in `no-vendor-call-bypasses-wrapper.ratchet.test.ts`'s own header comment). Check 1 (leaf-builder identifier confinement) directly generalizes Story 9.1a's own AC4 pattern ("the schema is the sole definition of these limits in the repo," verified by a grep returning hits only in its own files) from the two depth/node-count *constants* to the nine per-field *builder functions* Story 9.2 extracted — the exact functions a reimplementation would have to either call (visible, and now confined) or silently duplicate (Check 2's job).
2. **Check 1's allowlist was derived from reading the actual shipped code, not guessed.** `buildEventsQueryCondition.ts` defines all ten identifiers; `compile-filter-node.ts` is the *only* other file in the entire repo that imports any of them (confirmed via `grep -rn` across `apps/web/src`, `apps/backend/src`, `packages/domain/src`, `packages/graphql-select/src` during story drafting). `buildFeedQueryCondition.ts`/`buildAccountEventsQueryCondition.ts` never import the leaf builders directly — they only call the top-level `buildEventsQueryCondition`/`compileFilterNodeToQueryCondition`, which is exactly the delegation pattern this ratchet wants to keep intact, so they are correctly *excluded* from Check 1's allowlist (if they ever started importing a leaf builder directly, that itself would be worth a second look, which Check 1 would now catch).
3. **Check 2 exists because Check 1 alone cannot catch a brand-new file that reimplements field-matching logic without ever referencing the named leaf-builder identifiers at all** (e.g. a naive new resolver hand-rolling `if (filter.types) { conditions.push({field: 'types', operator: 'in', value: filter.types}) }` from scratch). Check 2's three-part trigger (references `EventFilterInput`/`FilterNode` + builds a `QueryCondition` group literal + no sanctioned import) was verified during drafting against every current real file matching parts (a)+(b) in isolation (`favorites-content.tsx`, `navigation-hook.ts`, `EventDetailWrapper.tsx`, `post-events-content.tsx`, `resolvers.ts` all contain an `operator: 'and'` literal for an unrelated ID-batch/forced-visibility condition) and confirmed **zero false positives**: every one of those files either doesn't reference `EventFilterInput`/`FilterNode` at all (`navigation-hook.ts`, `EventDetailWrapper.tsx`, `post-events-content.tsx` — their `operator: 'and'` is a plain `{field:'id', operator:'in', value: batchIds}` lookup, nothing to do with the locked filter vocabulary) or does reference it **and** already imports a sanctioned entry point (`favorites-content.tsx`, `resolvers.ts`). This was confirmed by direct code reading during story drafting, not assumed.
4. **Test file location: `packages/domain/src/ai-event-filters/__tests__/`, not colocated as a plain sibling `.test.ts`.** This mirrors `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts`'s own stated rationale verbatim: "deliberately located under `__tests__/`... so a future reader doesn't mistake it for [a per-component test]... a repo-wide static-analysis sweep." `packages/domain`'s `test` script (`tsx --test "src/**/*.test.ts"`) recurses into subdirectories, so no script change is needed.
5. **Using Node's `fs`/`path` inside a `packages/domain` test file does not violate `project-context.md`'s `packages/domain` purity restriction** ("no DB/ORM-specific modules or other Node-runtime-only dependencies" — `fs`, `net`, `dotenv`, etc.). That restriction protects **production** code that might be bundled into a frontend build; a `.test.ts` file is never bundled or shipped, it only ever runs under the Node-based `tsx --test` harness. `packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts` already establishes this exact precedent one package over (a frontend-framework package whose production code is React/browser-only, yet whose own ratchet test freely uses `fs`/`path`) — this story's test file follows the identical, already-accepted pattern.
6. **AC2 requires no new code.** `compile-filter-node.test.ts` is a normal `*.test.ts` file already matched by `packages/domain`'s existing `test` glob; `turbo.json`'s `test` task already covers every workspace package including `@festgrid/domain`; the root `package.json`'s `test` script already runs `turbo run test`; `.github/workflows/ci.yml` already runs `pnpm run test`. Chaining these four already-shipped facts together is this story's entire AC2 obligation — confirmed, not re-wired. This also respects this session's explicit environment constraint (no `.github/workflows/*` push access — the token lacks the `workflow` OAuth scope, the same constraint Story 9.7 hit verbatim when it had to park `ai-filter-golden-prompt-nightly-eval.yml` unpushed): this story plans **zero** workflow file changes, by design, not by omission.
7. **PRD §3.15's stale "Deferred to implementation" blockquote is superseded with a visible "Resolved" note, never silently deleted.** This matches this PRD's own established house style for documenting a since-resolved open question (e.g. §3.16's "(Added 2026-09-04; revised 2026-09-30)" and "(Added 2026-10-04...)" inline provenance stamps) — a reader following the document's history should be able to see that the compound-day question was asked, then answered, not find it simply vanished.
8. **`filter-vocabulary.md`'s location-field naming is reconciled with a clarifying note, not a destructive rename of the existing table.** The existing `location.proximity`/`location.adminArea` dot-path rows correctly describe the **flat** `EventFilterInput.location: {coordinates, radiusMeters, adminArea}` shape (§4.18) — renaming them to `locationProximity`/`locationAdminArea` would make the flat-shape description wrong. The two separate, mutually-exclusive leaf field names only exist inside a `FilterNode` **expression leaf** (Story 9.1a's own documented design decision: "Location is split into two mutually-exclusive leaf field variants... rather than one `location` field whose inner shape allows both"). A note under "Expression operators (CAP-6)" is the correct, non-destructive fix.
9. **`TemporalFilter`/`temporalFilter` was never in §4.18's `EventFilterInput` interface at all, even before Epic 9** (confirmed: a repo-wide PRD grep for `TemporalFilter`/`temporalFilter` returns zero hits prior to this story's edit) — a pre-existing documentation gap from when "happening now/upcoming" (AD-20) first shipped, not something Epic 9 introduced. Since Epic 9's own FR98-103 amendment is explicitly about keeping §4.18 an accurate, complete picture of the locked AI-filter vocabulary (which now includes `temporalFilter` as AI-extractable per Story 9.1b/9.4), this story closes that pre-existing gap as part of the same pass rather than leaving it half-documented.

### PRD §3.15 amendment text

Apply these edits to `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`:

1. Replace the existing "Locked Filter Vocabulary" bullet (the one beginning "A prompt can populate any combination of: social media account, event type, category, keyword...") with:

   > *   **Locked Filter Vocabulary:** A prompt can populate any combination of: social media account, event type, category, keyword, date range or day-of-week recurrence, ongoing/upcoming status, admin-area/region text match, venue type, and a "free"/"gratis" exact-text match (`isFree`) — a deliberately narrow exception to the numeric price-threshold filtering deferred to Post-MVP (Section 8.5), not a first step toward it. These map onto the shared `EventFilterInput` shape (Section 4.18) — the same structure FilterHub's manual controls and the Embeddable Widget's filters (Section 3.14) use. `EventFilterInput`'s proximity-radius field (reused unchanged from Section 3.3) is not itself prompt-extracted — a prompt cannot productively set precise coordinates — so it stays populated only via FilterHub's existing manual location control, same as today.

   (Only change: "date range or day-of-week recurrence, admin-area" → "date range or day-of-week recurrence, ongoing/upcoming status, admin-area".)

2. Immediately after that bullet, insert two new bullets:

   > *   **Richer Relative Dates (added 2026-10-15, FR98-FR103):** Beyond a single shifted period, the date grammar also supports rolling spans ("next 7 days", "next 2 weeks", "rest of this month"), multiple weekdays in one recurrence (weekends = Saturday+Sunday, weekdays = Monday-Friday), and the existing ongoing/upcoming status (Section 3.12's `temporalFilter`, now also prompt-extractable). Absolute dates, time of day, and holiday names remain outside the locked vocabulary and still produce a caveat.
   > *   **Boolean, Nested Expressions (added 2026-10-15, FR98-FR103):** A prompt can combine any locked-vocabulary fields with AND, OR and NOT, grouped up to depth 3 and 12 total nodes (e.g. "jazz or blues in Sleman or Bantul this weekend, not workshops") — a fragment that cannot be expressed this way, or that exceeds the bound, produces a caveat while the rest of the filter still applies; it never discards the whole prompt. `NOT` keeps events that have no value at all for the negated field rather than excluding them (e.g. `NOT venueType=Cafe` still includes events with no venue type recorded). Every filter that predates this upgrade — a flat manual FilterHub selection, a previously-saved AI filter, or an Embeddable Widget's filter — is still a valid, implicit "AND of its fields" expression and returns identical results; nothing is migrated or re-extracted. The Embeddable Widget (Section 3.14) supports the same boolean expressions as Discovery, through the identical shared compiler — there is no second, widget-specific filtering mechanism.

3. Replace the "> **Deferred to implementation:** whether a future revision of the closed date grammar..." blockquote with:

   > **Resolved (2026-10-15, FR98-FR103 — supersedes the "deferred to implementation" note this replaces):** the closed date grammar now supports compound-day phrasing — multiple weekdays in one recurrence (weekends, weekdays) and rolling spans ("next 7 days") — exactly the gap this note originally flagged when the grammar was first locked. See "Richer Relative Dates" above.

### PRD §4.18 amendment text

Apply these edits to the same PRD file's §4.18 ("EventFilterInput Interface") code block:

1. After the existing `enum DayOfWeek { ... }`, add:

   ```typescript
   /**
    * "Happening now" / "upcoming" status (Section 3.12, Architecture Spine AD-20).
    * Pre-existing field, newly also prompt-extractable (Section 3.15, FR98-FR103).
    */
   enum TemporalFilter {
     TODAY,
     UPCOMING
   }
   ```

2. Replace the `DateRangeFilter` interface with:

   ```typescript
   /**
    * A closed, composable date-range expression — e.g. {THIS_WEEK, +1, WEEK}
    * for "next week". Resolved fresh against the current date whenever the
    * filter is applied; never stored or matched as a frozen absolute date.
    * `spanAmount`/`spanUnit` optionally widen the resolved window further
    * (added 2026-10-15, FR98-FR103) — e.g. {TODAY, 0, DAY, spanAmount: 7,
    * spanUnit: DAY} for "next 7 days".
    */
   interface DateRangeFilter {
     anchor: DateAnchor;
     offsetAmount: number;
     offsetUnit: DateOffsetUnit;
     spanAmount?: number;
     spanUnit?: DateOffsetUnit;
   }
   ```

3. In the `EventFilterInput` interface, replace `dayOfWeek?: DayOfWeek;` with:

   ```typescript
     /**
      * One or more weekdays (added 2026-10-15, FR98-FR103 — was a single
      * DayOfWeek before this amendment). "Weekends" = [SAT, SUN]; "weekdays" =
      * [MON, TUE, WED, THU, FRI]. Composes with dateRange above (AND semantics)
      * exactly as a single value already did.
      */
     dayOfWeek?: DayOfWeek[];
   ```

   and add, after `isFree?: boolean;`:

   ```typescript
     /**
      * Ongoing/upcoming status (Section 3.12, AD-20) — newly also
      * prompt-extractable (Section 3.15, FR98-FR103).
      */
     temporalFilter?: TemporalFilter;
   ```

4. Immediately after the closing `}` of the `EventFilterInput` interface's code block, insert:

   ```typescript
   /**
    * Boolean, nested composition of EventFilterInput's locked fields (Section
    * 3.15, FR98-FR103, added 2026-10-15). Groups compose with AND/OR; NOT wraps
    * a single leaf or group and is null-inclusive (an event with no value for
    * the negated field is kept, not excluded). Bounded to depth 3 and 12 total
    * nodes. Leaves use the same locked field names as EventFilterInput, except
    * location, which splits into two mutually-exclusive leaf kinds —
    * locationProximity / locationAdminArea — since OR can place proximity and
    * admin-area in separate branches, which EventFilterInput's single
    * `location` object cannot express (see filter-vocabulary.md). A flat
    * EventFilterInput is always a valid, implicit AND-of-leaves FilterNode and
    * compiles to identical results — nothing that predates this amendment is
    * migrated or behaves differently.
    */
   type FilterNode = FilterGroupNode | FilterNotNode | FilterLeaf;

   interface FilterGroupNode {
     op: 'AND' | 'OR';
     children: FilterNode[];
   }

   interface FilterNotNode {
     op: 'NOT';
     child: FilterNode;
   }

   /**
    * One leaf per locked field (Section 3.15). `field` is one of: accountId,
    * type, category, keyword, dateRange, dayOfWeek, locationAdminArea,
    * locationProximity, venueType, isFree, temporalFilter — see
    * filter-vocabulary.md for the exact value shape of each.
    */
   interface FilterLeaf {
     field: string;
     value: unknown;
   }
   ```

   followed by a closing prose note (not a code block):

   > At the GraphQL layer, `FilterNode` is carried by a generic `op`/`children`/`child`/`field`/`value` input/output pair (the same flat-recursive encoding `EventQueryConditionInput` already uses, since GraphQL has no input-union type) — see `events.graphql`. A saved AI filter or Widget carrying an expression persists as `{version: 2, expression: FilterNode}` in its existing `jsonb` column; a flat-shaped save stores the plain `EventFilterInput` object exactly as before, with no `version` key, so every pre-existing row is unaffected.

### filter-vocabulary.md amendment text

Apply this edit to `_bmad-output/specs/spec-ai-prompt-event-filter/filter-vocabulary.md`, appending to the end of the existing "Expression operators (CAP-6)" section:

> **Field naming note (added 2026-10-15, FR98-FR103):** the `location.proximity`/`location.adminArea` dot-paths in the table above describe the **flat** `EventFilterInput.location` object (PRD §4.18). Inside a `FilterNode` expression leaf, these become two separate, mutually-exclusive leaf field names instead — `locationProximity` and `locationAdminArea` — so a single leaf can never represent both at once (the type-level guarantee behind "within one leaf the combination is a caveat, not an error," above). This is why multiple locations are expressed only as OR branches of separate leaves, never as one combined leaf.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No DB/migration impact. This story adds one new `.test.ts` file (pure source-text scanning, zero runtime import of any production type) and edits three Markdown documentation files. No TypeScript interface, GraphQL schema, or Drizzle table is touched.
- **Impacted fields/contracts:** None changed. The PRD/vocabulary edits are documentation catching up to already-shipped code (Stories 9.1a-9.8) — they describe existing `DateRangeFilter`/`EventFilterInput`/`FilterNode` shapes, they do not define new ones that code must then implement.
- **Required DB migration changes:** None.
- **Required TypeScript type changes:** None.
- **Backward compatibility and rollout notes:** The new ratchet test is additive and, per Task 3, already passes against today's shipped code with zero offenders — merging it changes no runtime behavior anywhere. The doc edits are prose-only.
- **Verification checks:** `pnpm --filter @festgrid/domain test`/`lint`/`build`; the new ratchet test's own positive-confirmation and negative-control assertions (Tasks 1-3); a manual read-through confirming the PRD/vocabulary edits land exactly as specified above and don't break any existing cross-reference (e.g. "Section 4.18" / "Section 3.15" section-number citations elsewhere in the PRD, which are unaffected since no section is renumbered, only extended in place).

### Project Structure Notes

- `packages/domain/src/ai-event-filters/__tests__/filter-consumer-no-bypass.ratchet.test.ts` is NEW — the first file in this `__tests__/` subdirectory for this package (a new, but already-precedented-elsewhere, convention: `packages/ui/src/__tests__/`).
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` is UPDATEd (§3.15, §4.18 only — no other section touched, no section renumbered).
- `_bmad-output/specs/spec-ai-prompt-event-filter/filter-vocabulary.md` is UPDATEd (one appended note).
- No `apps/web`, `apps/backend`, or `packages/ui` **source** file is created or modified by this story — those two roots are only *read* (never written) by the new ratchet test.
- No conflicts detected with the unified project structure.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 9.9z: Ratchet — every filter consumer goes through the shared compiler] — authoritative ACs this story elaborates, including the epic-formation `Note:` on why the ratchet was included.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md] — Gate 1/Gate 3 epic-wide sweep findings cited above.
- [Source: _bmad-output/implementation-artifacts/9-1a-build-the-filter-expression-tree-types-zod-schema-and-normalizer.md#Tasks, #Dev Notes] — AC4's "sole definition" grep pattern, generalized here into Check 1.
- [Source: _bmad-output/implementation-artifacts/9-2-compile-filter-expressions-to-query-conditions-with-not-and-null-semantics.md#Tasks 1, 3, #Dev Notes decisions 1, 6] — the exact leaf-builder function names/signatures and the `compileFilterNodeToQueryCondition` entry point this ratchet confines.
- [Source: _bmad-output/implementation-artifacts/9-3-expose-filter-expressions-through-graphql-resolvers-and-widgets.md, 9-4a-wire-the-resolved-ai-filter-expression-into-discovery-feed-and-favorites-query-building.md] — confirms `buildFeedQueryCondition`/`buildAccountEventsQueryCondition`/`resolvers.ts`/the three content pages' actual, as-built delegation to the shared compiler (read directly during this story's drafting).
- [Source: apps/backend/src/lib/vendor-gateway/no-vendor-call-bypasses-wrapper.ratchet.test.ts] — the established repo convention for a permanent, allowlist-plus-negative-control source-scan ratchet (read in full for this story).
- [Source: packages/ui/src/__tests__/ad33-z-index-layering.ratchet.test.ts] — the established convention for a `__tests__/`-located, cross-package-root-climbing source-scan ratchet (read in full for this story).
- [Source: packages/domain/package.json#test, turbo.json#test, package.json#test, .github/workflows/ci.yml#L73] — the already-shipped CI wiring chain AC2 confirms rather than rebuilds.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.15, #4.18] — read in full for this story; exact current text quoted/replaced above.
- [Source: _bmad-output/specs/spec-ai-prompt-event-filter/filter-vocabulary.md, SPEC.md] — read in full for this story.
- [Source: _bmad-output/implementation-artifacts/9-7-add-golden-prompt-evals-for-the-ai-filter.md#Out of Scope, #Orchestrator verification note] — the precedent for this exact session's "cannot push `.github/workflows/*`, token lacks `workflow` scope" constraint, already hit once in this epic.
- [Source: _bmad-output/project-context.md#Code Organization (Domain vs UI), #Testing Rules] — `packages/domain` purity restriction (Dev Notes decision 5 explains why a `fs`/`path`-using test file does not violate it).
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and the epic-level-sweep citation rule applied above.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/domain` purity restriction, and why a test-only `fs`/`path` use doesn't violate it per the AD-33 precedent — Dev Notes decision 5), Testing Rules (this repo's established `*.ratchet.test.ts` source-scan convention).
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — FR98-FR103, §3.15, §4.18 — this story's own primary subject (AC3); amended, not just referenced.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file follows its canonical section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD section is implicated (no API/data/infra architecture decision touched or overridden — this story is a test + doc story); full file not loaded, consistent with every other Epic 9 mechanism-layer story's precedent.
- [x] `docs/infrastructure/index.md` — not applicable (no Lambda, queue, DB, or hosting change); full infra shards not loaded.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/domain/src/ai-event-filters/__tests__/filter-consumer-no-bypass.ratchet.test.ts` — Checks 1 and 2, positive confirmations, negative controls (Tasks 1-3).
  - UPDATE `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — §3.15, §4.18 (Tasks 5-6).
  - UPDATE `_bmad-output/specs/spec-ai-prompt-event-filter/filter-vocabulary.md` — one appended note (Task 7).
  - No change to `.github/workflows/*`, `sprint-status.yaml`'s story-tracking structure (beyond the normal status-transition mechanics), or `backlog.yaml` (explicitly out of scope — see Out of Scope).
- **Rule Mapping:**
  - AC1 (sweep test fails on bypass) → Tasks 1-3; Dev Notes decisions 1-3 document the two-check design and its false-positive analysis against real, current code.
  - AC2 (parity test runs in CI, no workflow change) → Task 4; Dev Notes decision 6 traces the already-shipped wiring chain.
  - AC3 (PRD/vocabulary amendment) → Tasks 5-7; exact replacement text given verbatim in Dev Notes, including the "supersede, don't delete" treatment of the stale blockquote and the non-destructive location-naming reconciliation.
  - `packages/domain` purity (project-context.md) → Dev Notes decision 5 (test-file-only `fs`/`path` use, AD-33 precedent).
  - Gate 1/2/3 (story-split-gate.md) → Gate 1/3 cited from `epic-9-readiness.md`; Gate 2 run fresh via the Agent tool (Freya persona, no gap); documented in Architecture & UX Gate Findings above.
  - Environment constraints (this session) → no network/live-Gemini call anywhere in this story's scope (it never touches Gemini); no DB/local-sandbox-Postgres involvement (no schema/migration in scope); no `.github/workflows/*` touch (Task 4's explicit scope limit); no `backlog.yaml` edit (Out of Scope); no push performed by the dev agent.
- **Verification Plan:**
  - `pnpm --filter @festgrid/domain test` — the new ratchet test passes with zero offenders against current code; its own negative-control assertions correctly fail against synthetic bypass snippets; full existing domain suite stays green.
  - `pnpm --filter @festgrid/domain lint`/`build` — clean.
  - Manual: re-read the amended PRD §3.15/§4.18 and `filter-vocabulary.md` sections end-to-end to confirm the exact text above landed correctly and no adjacent section/cross-reference was disturbed.
  - Manual: confirm (Task 4) the CI wiring chain by reading `turbo.json`, root `package.json`, and `.github/workflows/ci.yml` directly — no command execution needed, no network call, no workflow file write.

## Pre-Coding Approval Gate

- [x] Scope confirmation — one new `packages/domain` test file (pure source-text scanning, zero production code change) + three documentation-file edits (PRD, SPEC companion); zero DB migration, zero GraphQL schema change, zero `.github/workflows/*` change, zero `backlog.yaml` edit, zero `apps/web`/`apps/backend`/`packages/ui` **source** file change (read-only access to those roots for the ratchet's scan).
- [x] Architecture and boundary confirmation — Gate 1/3 cited from `epic-9-readiness.md` (no gap) plus a documented lightweight-guard analysis (no gap); Gate 2 run fresh via the Agent tool (Freya persona, no gap — see Architecture & UX Gate Findings above).
- [x] Testing plan confirmation — the new ratchet test's two checks, each with a positive-confirmation assertion and a negative-control case, verified against current shipped code during story drafting (Dev Notes decisions 2-3) to be false-positive-free.
- [x] Explicit human approval state — APPROVED by user (dispatch instruction for this Epic 9 batch and for this specific ratchet story: "skip Gate 1/3 and run Gate 2 only," "minimise questions: choose the recommended default and record it in Dev Notes," plus this story's own explicit environment constraints — the dev agent works only against the LOCAL sandbox Postgres [N/A, no DB touch in this story], has NO network, must not call the live Gemini API [N/A, this story never touches Gemini], cannot push `.github/workflows` files [N/A by design — Task 4 plans zero workflow changes, matching Story 9.7's identical precedent], and must not edit `backlog.yaml` [honored — see Out of Scope and the skipped backlog-promotion intake step below]), 2026-10-15. This blanket instruction is treated as the explicit authorization for every routine design default recorded above, matching Stories 9.1a-9.8's own identical precedent for this same batch.
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A, no gap found by any gate.

## Testing Requirements

- [ ] Unit/static tests: `filter-consumer-no-bypass.ratchet.test.ts` — Check 1 (leaf-builder confinement: zero offenders, positive confirmation on the two allowed files, negative-control snippet flagged); Check 2 (no-silent-reimplementation: zero offenders, positive confirmation on the five known live consumers, negative-control snippet flagged).
- [ ] Regression: full existing `pnpm --filter @festgrid/domain test` suite passes unmodified alongside the new file.
- [ ] Manual verification: PRD §3.15/§4.18 and `filter-vocabulary.md` read back end-to-end against the exact replacement text specified in Dev Notes.
- [ ] E2E tests: not applicable — no user-facing surface in this story (confirmed by Gate 2 above).

## Deliverables Checklist

- [ ] `packages/domain/src/ai-event-filters/__tests__/filter-consumer-no-bypass.ratchet.test.ts` implementing Check 1 and Check 2 with positive confirmations and negative controls, passing with zero offenders against current code.
- [ ] Confirmed (no code change) that Story 9.2's `compile-filter-node.test.ts` AC2 parity test already runs in CI via the existing `pnpm test` → `turbo run test` → `ci.yml` chain.
- [ ] PRD §3.15 amended per the exact text in Dev Notes (vocabulary bullet extended; two new bullets inserted; stale blockquote superseded, not deleted).
- [ ] PRD §4.18 amended per the exact text in Dev Notes (`TemporalFilter` enum added; `DateRangeFilter` widened; `dayOfWeek` widened to array; `temporalFilter` field added; `FilterNode`/`FilterGroupNode`/`FilterNotNode`/`FilterLeaf` block inserted; closing GraphQL/persistence note appended).
- [ ] `filter-vocabulary.md` amended with the location-leaf-naming reconciliation note.
- [ ] `pnpm --filter @festgrid/domain test`/`lint`/`build` all green.

## Out of Scope

- **Guarding the `QueryCondition` → SQL translation layer** (`packages/graphql-select/drizzle-where.ts`'s `'not'`/null-inclusive `ne`/`notIn` translation) against a parallel, bypassing SQL translator — the epics.md AC1 text is specifically about the `EventFilterInput`/`FilterNode` → `QueryCondition` step (the shared compiler), not the subsequent SQL-translation step; out of this story's literal scope.
- **Promoting a backlog-board row, or editing `_bmad-output/implementation-artifacts/backlog.yaml` in any way** — explicitly skipped per this session's dispatch instruction ("Skip the backlog-promotion intake step... must not edit backlog.yaml"). This story's own `on_complete` workflow step is directed to skip that intake entirely.
- **Any `.github/workflows/*` file creation, edit, or push** — explicitly out of scope per this session's environment constraint (the token lacks the `workflow` OAuth scope, the exact same limitation Story 9.7 already hit and worked around by never pushing its own new workflow file). AC2 is satisfied entirely by confirming already-existing wiring, never by adding a new workflow.
- **Pushing any commit this story produces** — explicitly out of scope per this session's dispatch instruction ("Do not push").
- **Running `bmad-epic-readiness-review` or `bmad-retrospective` for Epic 9** — this story is the epic's last planned story; closing the epic out (readiness review, retrospective) is a separate, subsequent skill invocation, not part of this story.
- No Gate 1/2/3 gap was found, so no prerequisite story, backlog entry, or `epics.md` addition results from this story.

## Definition of Done

- [ ] AC1-AC3 satisfied and verified by their respective tests/edits.
- [ ] Required tests passing: `pnpm --filter @festgrid/domain test` (including the new ratchet test, zero offenders).
- [ ] Lint and type checks passing: `pnpm --filter @festgrid/domain lint`/`build`.
- [ ] PRD §3.15/§4.18 and `filter-vocabulary.md` amended exactly per the Dev Notes text, with the stale blockquote superseded (not deleted) and no other section disturbed.
- [ ] Zero `.github/workflows/*` file created, edited, or pushed. Zero `backlog.yaml` edit. Zero network or live-Gemini call made by the dev agent at any point. Zero push performed.

## Completion Status

- [ ] Not started.

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-10-15 (bmad-create-story): Story drafted, ready for dev. Epic 9 readiness sweep (`epic-9-readiness.md`) cited for Gate 1/3; Gate 2 run fresh via the Agent tool (Freya persona, no gap — zero UI surface). Built on Stories 9.1a-9.8 (all `review`; their Dev Notes/Dev Agent Records/File Lists read in full, and the actual as-shipped code cross-checked via direct `grep`/`Read` of `buildEventsQueryCondition.ts`, `buildFeedQueryCondition.ts`, `buildAccountEventsQueryCondition.ts`, `compile-filter-node.ts`, `resolvers.ts`, and the four live `apps/web` consumer pages) so the ratchet's allowlists encode what was actually built, not an assumed shape. Ratchet-mechanism design (two regex-based source-scan checks, test file location, `fs`/`path`-in-domain-test-file purity question, AC2's "already wired, no new code" resolution, the PRD blockquote-supersession and vocabulary-naming-reconciliation treatment) resolved to recommended defaults in Dev Notes rather than left as open questions, per this session's explicit dispatch instruction to minimise questions. Environment constraints (local-sandbox-Postgres-only, no network, no live Gemini, no `.github/workflows` push access, no `backlog.yaml` edit, no push) baked into Pre-Coding Approval Gate and Out of Scope, mirroring Stories 9.7/9.8's identical precedent for the same constraints.
