---
baseline_commit: 28f477b5a658f4a27d2dfd70f635250dc84e879a
---

# Story 0.50: Add a locale-parity ratchet test for EventDetailViewLabels (FIND-032)

## Story Details

- Epic: 0
- Story ID: 0.50
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

<!--
Sourced from backlog.yaml's FIND-032 (created 2026-09-15, deferred from find-011-cruft-cleanup).
The user made three explicit decisions during this session's drafting pass (2026-10-06), each
via AskUserQuestion, before this story file was finalized:
  1. Scope: ratchet ONLY `EventDetailViewLabels` -- NOT the ~19 other similarly-shaped `*Labels`
     interfaces this session found elsewhere in packages/ui/packages/domain/apps/web. Carved out
     as child backlog finding FIND-073. See Dev Notes "Why this story is scoped to
     EventDetailViewLabels only".
  2. Check direction: one-directional subset (interface keys -> locale JSON), with a small
     named allow-list for deliberately-unlocalized props -- NOT bidirectional full equality.
     See Dev Notes "Check direction and the allow-list".
  3. Test location: `apps/web` (extending the existing `mapper.test.ts`, which already tests
     this exact interface's real wiring) -- NOT `packages/ui`, which would have been the first
     ever reverse-direction reference from packages/ui into apps/web in this monorepo. See Dev
     Notes "Why apps/web, not packages/ui".
-->

## Story

As a developer,
I want `apps/web`'s existing `mapper.test.ts` (which already unit-tests `mapGraphQLEventToDetailViewProps`, the function next to `useEventDetailViewLabels()` in `mapper.ts`) extended with a new test that parses `EventDetailViewLabels`' real property names (via the TypeScript compiler API, reading `packages/ui`'s actual interface source at test-run time -- not a hand-maintained list that can itself drift) and asserts every one of them (minus a small, explicitly-named exception list) exists as a key in both `apps/web/locales/en.json`'s and `id.json`'s `EventDetailsPage` namespace,
So that a future prop added to or removed from this label interface can never again silently desync from the translations the way it did today -- caught only by manual diligence during FIND-011's own symmetric `postedByLabel` removal across the type and both locale files, with nothing automated enforcing that symmetry before or since.

## Acceptance Criteria

1. **Given** `EventDetailViewLabels` (`packages/ui/src/features/events/EventDetailView.types.ts`) has 45 real property-signature keys today, mapped 1:1 by literal name onto `apps/web/locales/en.json`'s `"EventDetailsPage"` namespace via `apps/web/src/features/events/mapper.ts`'s `useEventDetailViewLabels()` -- confirmed the sole production wiring point for this interface (`EventDetailWrapper.tsx` is the only real caller that renders `EventDetailView` with it; `event-preview-card.tsx`'s two "EventDetailView" mentions are comments only, not a second render path) -- **When** this story ships, **Then** `apps/web/src/features/events/mapper.test.ts` (the existing file that already unit-tests `mapGraphQLEventToDetailViewProps` from the same `mapper.ts` module) gains a new `describe` block containing a helper that parses `EventDetailView.types.ts`'s real source at test-run time via the `typescript` package's compiler API (`ts.createSourceFile` + an AST walk for an `InterfaceDeclaration` named `EventDetailViewLabels`, collecting each `PropertySignature` member's name) to produce the actual, current list of interface keys -- not a literal array copy-pasted once and left to drift. `typescript` is already an `apps/web` devDependency (`^6.0.3`, same version already used by `packages/ui`); no new dependency, no `pnpm install` of any kind.

2. **Given** `scheduleCheckboxLabel` and `videoUnavailableLabel` are two optional properties on the interface that are deliberately never localized today -- confirmed absent from both `en.json`'s and `id.json`'s `EventDetailsPage` namespace, with `EventImage.tsx` (line ~115) rendering a hardcoded English fallback string (`"This video isn't available — view it on the original post"`) when `videoUnavailableLabel` is absent, and `scheduleCheckboxLabel` having no production wiring in `mapper.ts`'s `useEventDetailViewLabels()` at all -- **When** the new test asserts key parity, **Then** exactly these two keys are excluded via a small, explicitly-named `const` allow-list in the test file (e.g. `DELIBERATELY_UNLOCALIZED_KEYS`), each with an inline comment citing why, not a blanket "ignore missing" fallback that would silently swallow a real future gap on some other key.

3. **Given** the test's purpose is to catch a prop silently added to or removed from the interface without a matching translation, not to police the ~18 other keys `EventDetailsPage`'s JSON namespace already legitimately holds for strings used via direct `t()` calls elsewhere on the event-detail page outside this component's `labels` prop contract (e.g. `next`, `previous`, `closeModal`, `notFoundTitle`, `notFoundBody`, `backToHome`, `backToList`, `hiddenAfterReportTitle`, `hiddenAfterReportBody`, `favoriteSuccessAnnouncement`, `favoriteErrorAnnouncement`, `unfavoriteSuccessAnnouncement`, `subscribeSuccessAnnouncement`, `subscribeErrorAnnouncement`, `addToCalendarSuccessAnnouncement`, `calendarErrorAnnouncement`, `relatedEventsGroupLabel`, `relatedEventsGroupTitleLabel`), **When** the test runs, **Then** it asserts **one direction only**: every extracted interface key (minus the AC2 allow-list) must exist as a key in `en.json`'s `EventDetailsPage` namespace, and separately must exist as a key in `id.json`'s `EventDetailsPage` namespace. It does **not** assert the reverse (that every `EventDetailsPage` JSON key appears on the interface) -- a bidirectional check would fail today on those ~18 legitimately-interface-external keys and is explicitly out of scope (see Out of Scope).

4. **Given** a test that only exercises today's already-correct real data would pass vacuously without ever proving the check mechanism actually catches a real desync, **When** this story ships, **Then** the new `describe` block also includes a non-vacuous "the check is actually tuned correctly" proof test, matching this repo's existing convention (`apps/backend/src/lib/events/event-account-match-ratchet.test.ts`'s own "the scan is actually tuned correctly" test) -- using a small embedded fixture interface source string (e.g. `interface FixtureLabels { knownKey: string; rogueKey: string; }`) and a fixture locale-namespace object containing only `knownKey`, proving the extraction-and-diff logic correctly reports `rogueKey` as missing and does **not** false-positive on `knownKey`.

5. **Given** this session's drafting pass directly verified (2026-10-06, see Dev Notes "Verified violation inventory") that extracting `EventDetailViewLabels`' real 45 keys, excluding the AC2 pair, and diffing the remaining 43 against the real `en.json`/`id.json` `EventDetailsPage` namespaces today reports **zero missing keys in either locale**, **When** `pnpm --filter web test` runs after this story ships, **Then** the new test passes against the real, unmodified `EventDetailView.types.ts`, `en.json`, and `id.json` -- proving the ratchet is non-regressive on day one, not merely theoretically correct.

6. **Given** `en.json` and `id.json` are two separate, independently hand-maintained files that could each drift from the interface on their own (a translator could update one and miss the other), **When** the test runs, **Then** it reads and checks both files independently within the same test run -- not only `en.json`, and not relying on some other existing test's en/id mirroring guarantee (`apps/web/locales/locales.test.ts` already guarantees `en.json` and `id.json` share the same namespace/key shape as each other, but that proves en↔id agree with *each other* -- not that either one agrees with the `packages/ui` interface, which is this story's actual gap).

7. i18n: N/A -- this story adds no new user-facing string of any kind; it only guards the existing ones against future silent drift. Verified by Gate 2 below (zero UI/component/prop surface touched).

## Tasks / Subtasks

- [ ] Task 1 — Build the AST-based key-extractor helper (AC: #1)
  - [ ] In `apps/web/src/features/events/mapper.test.ts`, add a `describe('EventDetailViewLabels locale parity ratchet', ...)` block alongside the file's existing tests.
  - [ ] Read `packages/ui/src/features/events/EventDetailView.types.ts` via `fs.readFileSync` at the relative path `../../../../../packages/ui/src/features/events/EventDetailView.types.ts` from `mapper.test.ts`'s own directory -- a plain filesystem read of TypeScript source text (not a module import), directionally consistent with the one real dependency edge this monorepo already has (`apps/web` already imports `EventDetailViewLabels` as a compiled type from `@festgrid/ui` at the top of this same file; reading its source text for AST parsing just reaches the same already-depended-upon file through a different mechanism).
  - [ ] Use `ts.createSourceFile` (from the `typescript` package, already an `apps/web` devDependency) to parse it, then walk the AST (`ts.forEachChild`, recursively as needed) to find the `InterfaceDeclaration` node whose `name.text === 'EventDetailViewLabels'`.
  - [ ] Collect that interface's `members`, filter to `ts.isPropertySignature`, and map each to `member.name.getText(sourceFile)` to get the real property name list.
  - [ ] Keep this helper inline in this one test file -- Gate 3 (Dev Notes below) found no existing precedent for this AST-parsing technique anywhere in the repo and exactly one confirmed consumer today; extracting a shared helper package now would be speculative generality. Revisit only if/when a second `*Labels` interface actually adopts the same check (tracked by child finding FIND-073).

- [ ] Task 2 — Wire the parity assertions (AC: #2, #3, #5, #6)
  - [ ] Read `apps/web/locales/en.json` and `apps/web/locales/id.json` via `fs.readFileSync` + `JSON.parse` at the relative path `../../../locales/en.json` / `id.json` from `mapper.test.ts`'s own directory -- both files live inside `apps/web` itself, matching the existing precedent of other `apps/web/src/app/[locale]/**/*.test.tsx` files that already `import`/read these same locale files directly.
  - [ ] Define `const DELIBERATELY_UNLOCALIZED_KEYS = ['scheduleCheckboxLabel', 'videoUnavailableLabel'] as const;` with an inline comment citing AC2's reasoning for each.
  - [ ] For each locale (`en`, `id`) independently: compute `missing = extractedKeys.filter(k => !DELIBERATELY_UNLOCALIZED_KEYS.includes(k)).filter(k => !(k in localeJson.EventDetailsPage))`; assert `missing` is an empty array, with a descriptive failure message naming exactly which keys are missing and from which locale file (so a future failure is immediately actionable, matching this repo's existing ratchet-test convention of descriptive `assert`/`expect` failure messages rather than a bare boolean).

- [ ] Task 3 — Add the non-vacuous "check is actually tuned correctly" proof test (AC: #4)
  - [ ] Embed a small fixture TS interface source string and a fixture locale-namespace object (plain JS object literal in the test, not a real file) as described in AC4.
  - [ ] Run the same extraction-and-diff logic against the fixture; assert the known-missing key (`rogueKey`) is reported and the known-present key (`knownKey`) is not.

- [ ] Task 4 — Verification (AC: #5)
  - [ ] Run `pnpm --filter web test` (targeted, package-scoped) and confirm the new `describe` block passes alongside the full existing `mapper.test.ts` suite and the rest of `apps/web`'s tests, with zero changes to `EventDetailView.types.ts`, `mapper.ts` (other than the new test additions to its sibling `mapper.test.ts`), `en.json`, or `id.json` themselves -- this story is a test-only addition that proves today's real state is already correct, not a fix to any of those files.
  - [ ] Run `pnpm --filter web lint` and confirm it stays clean against `apps/web`'s existing `next lint` configuration.

## Dev Notes

### Why this story is scoped to `EventDetailViewLabels` only

This session's drafting pass found ~20 similarly-named `*Labels` prop interfaces across the monorepo: ~18 more in `packages/ui` (e.g. `WeeklyCalendarViewLabels`, `CorrectionFormLabels`, `PwaInstallBannerLabels`, `PwaInstallIosModalLabels`, `AmbientLocationBannerLabels`, `WizardNavigationLabels`, `EventCardLabels`, `PostCardLabels`, `InstagramEmbedLabels`, `LocationPickerFieldLabels`, `AccountLocationFieldLabels`, `LocationPickerMapPanelLabels`, `CalendarOverflowDialogLabels`, `TemporalFilterToggleLabels`, `EventCardFavoriteBadgeLabels`, `EventCardNearbyBadgeLabels`, `SoftDeleteToastLabels`, `MapViewLabels`, `EventStatusLabels`), one in `packages/domain` (`AIFilterSummaryLabels`), and one defined directly in `apps/web` itself rather than `packages/ui` (`AiAssistedCorrectionTriggerLabels`, with `React.ReactNode`-typed props that may hold JSX rather than plain translatable strings).

Spot-checking several of these during drafting found real heterogeneity that makes a single blanket mechanism risky to build in one `effort: s` story:
- `CorrectionFormLabels` maps to a namespace with a **different name entirely** (`EventCorrectionForm`, confirmed via `correction-dialog.tsx`'s `useTranslations("EventCorrectionForm")`) -- the interface-name-to-namespace-name mapping is not derivable by convention and would need an explicit, hand-built table, one entry per interface.
- `PwaInstallBannerLabels` and `PwaInstallIosModalLabels` **share one namespace** (`PwaInstallPrompt`), with **renamed** keys (interface `message` → JSON `bannerMessage`; `title`/`shareStepText`/`addToHomeScreenStepText`/`closeLabel` → `iosModalTitle`/`iosModalShareStep`/`iosModalAddToHomeScreenStep`/`iosModalCloseLabel`) -- no key-name match at all between these interfaces and their namespace.
- `WeeklyCalendarViewLabels` is split across **two** namespaces with renaming (`WeeklyCalendarView` for most keys, but `DiscoveryPage` with a `calendar`-prefixed rename for others, e.g. `prevWeekLabel` ← `t('calendarPrevWeekLabel')`), has at least one field (`nearbyBadge`) computed via a formatting function with no JSON key at all, and has call-site-dependent wiring (some fields are left unwired at some call sites).
- `EventCardLabels` similarly mixes exact-name scalar fields from an `EventCard` namespace with per-enum-member `Record<string,string>` fields built from entirely separate `EventCategory`/`EventType`/`DayOfWeek` namespaces via a `buildEnumLabels` helper -- not matched by the interface's own field name at all.
- `AIFilterSummaryLabels` (`packages/domain`) uses **nested/dotted** JSON paths (e.g. `tSummary('anchors.TODAY')` reads `AIFilterSummary.anchors.TODAY`), not flat top-level keys.
- `WizardNavigationLabels` is sourced from **root-level** translation keys (no namespace argument to `useTranslations()` at all) -- a structurally different shape.
- `AiAssistedCorrectionTriggerLabels` lives in `apps/web`, not `packages/ui`, and several of its props are typed `React.ReactNode`.

The user was presented this breakdown via `AskUserQuestion` during drafting and explicitly chose to scope this story to `EventDetailViewLabels` only (the interface `FIND-032`'s own backlog note names explicitly, and the one with the cleanest, already-proven 1:1 name-matched single-namespace mapping via `mapper.ts`'s dedicated `useEventDetailViewLabels()` hook) -- establishing the AST-parsing mechanism and test pattern this story builds, rather than attempting to map all ~20 interfaces (each needing its own namespace-mapping and exception-list judgment call) in one pass. Widening to the other interfaces is real, legitimate future work, carved out into child backlog finding **FIND-073** (`parent: FIND-032`) rather than built here.

### Check direction and the allow-list

Also presented via `AskUserQuestion`: given `EventDetailsPage`'s JSON namespace holds ~18 keys that are **not** props on `EventDetailViewLabels` at all (used via direct `t()` calls elsewhere on the page), and given 2 interface props (`scheduleCheckboxLabel`, `videoUnavailableLabel`) are deliberately never localized, a **bidirectional** full-equality check would fail immediately and permanently on both of those pre-existing, intentional conditions -- requiring either moving 18 strings out of the shared namespace or growing the interface to cover them, a much bigger refactor outside this story's `effort: s` sizing. The user explicitly chose the one-directional subset check (AC3) plus a small named allow-list (AC2) instead, which directly targets the finding's actual stated failure mode ("a prop add/remove can silently desync the translations") without demanding an unrelated namespace reorganization.

### Why apps/web, not packages/ui

This story was initially drafted with the new test living inside `packages/ui` (co-located with the interface under test). A second research pass during drafting surfaced a real architectural conflict with that placement: this monorepo's dependency direction is strictly `apps/web → packages/ui`, **never** the reverse -- `project-context.md`'s Adapter/decoupling principle explicitly keeps `packages/ui` framework-agnostic (no direct `next-intl` dependency), and `packages/ui/src/hooks/useWeeklyCalendarController.ts` carries an explicit in-code comment: *"packages/ui must not depend on apps/web's generated types/mapping module."* A `packages/ui` test reaching into `apps/web/locales/*.json` by relative path would be the **first-ever** instance of that reversed direction in this repo (confirmed: no existing `packages/ui` test imports or reads anything from `apps/web` today), and it would hardcode the `"EventDetailsPage"` namespace name a second time, duplicated from `mapper.ts`'s own copy of that same fact, with no compiler link keeping the two in sync.

Presented to the user via `AskUserQuestion`, who chose `apps/web` instead: `apps/web` already depends on `packages/ui` (the one real, established direction) and already has direct precedent for tests reading locale JSON by relative path (several `apps/web/src/app/[locale]/**/*.test.tsx` files already do this). `apps/web/src/features/events/mapper.test.ts` specifically already unit-tests `mapGraphQLEventToDetailViewProps`, a sibling export in the exact same `mapper.ts` module that defines `useEventDetailViewLabels()` and already imports `EventDetailViewLabels` as a type from `@festgrid/ui` at the top of the file -- extending this file keeps the new test next to the real wiring code and the namespace-mapping fact (`"EventDetailsPage"`) it's actually checking, rather than duplicating that fact in a different package.

### Why source-parsing via the TypeScript compiler API, not a hand-maintained array + `satisfies`

The common alternative pattern for this kind of check is a hand-maintained key list in the test file, kept honest by a TypeScript `satisfies Record<keyof EventDetailViewLabels, true>` type-level assertion (so an interface change that isn't mirrored in the list is a compile error). That pattern is insufficient here regardless of which package hosts the test: this repo has **no** `next-intl` message-type augmentation configured anywhere (confirmed via repo-wide search for `IntlMessages`/`declare module 'next-intl'` -- no hits), so a `t('someKey')` call's string argument is never statically checked against the real JSON message catalog's actual content by `tsc`, even inside `apps/web`, which (unlike `packages/ui`, whose `package.json` has no `"build"` script at all) does have a real `next build` type-checking step in CI. A type-level `satisfies` check can only ever prove a hand-written key list matches the *interface's shape* -- it can never prove that list (or the interface) matches the real *JSON file content*, because next-intl's `t()` signature doesn't carry that information into the type system here. Reading the real interface source and the real JSON content at `vitest run` time (AC1, AC2-3) is therefore not a style preference but the only mechanism, in either package, that can actually detect a real desync between the two.

### Architecture & UX Gate Findings

No `epic-{N}-readiness.md` sweep covers this story -- `epic-0-readiness.md`'s `swept: true` report's `stories_covered` list stops at `0.19`, the same gap Story 0.41 and Story 0.49 already found and handled by running all three gates fresh. All three were run fresh this session (via `runSubagent`, one-shot analysis prompts, not the full interactive persona workflow) against the story's scope -- re-confirmed applicable after the location moved from `packages/ui` to `apps/web`, since the change is still a pure test-tooling addition with zero architecture/UI-surface implications regardless of which existing, already-depended-upon package hosts the new test:

- **Gate 1 (Winston lens, Architecture/Infrastructure Completeness): No gap found.** The story only adds test code that reads source/locale files at test-time; it never calls the backend, never touches auth/secrets/business logic, and introduces no API surface or infra dependency.
- **Gate 3 (Winston lens, Foundational/Cross-Cutting Dependency Completeness): No gap found.** i18n (locale JSON) and the `typescript` devDependency are already established in `apps/web`, so nothing foundational is implicitly assumed. On reusability: the AST-parsing technique has zero existing precedent anywhere in the repo (this repo's two existing "ratchet" tests, `apps/backend/src/lib/events/event-account-match-ratchet.test.ts` and `apps/backend/src/schema/events-postid-write-ratchet.test.ts`, use plain regex source-text scanning under `node:test`, not AST parsing, and run under a different test runner entirely) and exactly one confirmed consumer today (`EventDetailViewLabels`, per this story's narrowed scope) -- extracting a shared helper now would be speculative generality for an unproven-beyond-one-case pattern. Keep it inlined in this one test file; revisit extraction only if/when FIND-073's widening actually lands a second consumer.
- **Gate 2 (Freya/Sally lens, UI Complexity & Reusability): No gap found.** The scope adds zero components, hooks, or utils (no new UI surface, variants, or shared logic) and touches no `DESIGN.md`/`EXPERIENCE.md`-governed visual/interaction detail -- it only runtime-reads an existing types file and two existing locale JSONs in a new test. No `DESIGN.md`/`EXPERIENCE.md`/`EVENT-CARD-DESIGN.md` load was needed for this story (consistent with Story 0.40/0.41's own precedent for a story with zero UX-artifact-relevant surface).
- **Lightweight escape-hatch guard:** reasoned through whether this story's scope contains anything an epic-wide sweep plausibly wouldn't have anticipated (new external service, new data entity, new infra dependency) -- it does not; this is a closed-scope test-tooling addition with no external dependencies beyond the already-established `typescript` devDependency. No further gate re-run warranted.

### Verified violation inventory (static + direct verification performed during story drafting, 2026-10-06)

Read `EventDetailView.types.ts` directly: `EventDetailViewLabels` has **45** real property-signature keys today. Read `apps/web/locales/en.json` and `id.json` directly and confirmed (a) both already define the exact same 48 top-level namespaces as each other, (b) both already define the exact same key set under `"EventDetailsPage"` as each other (59 keys each), and (c) diffing the interface's 45 keys (minus the 2-key `DELIBERATELY_UNLOCALIZED_KEYS` allow-list, leaving 43) against each locale's `EventDetailsPage` namespace keys reports **zero missing keys in either locale** -- confirming AC5's "non-regressive on day one" claim is real, not assumed. `scheduleCheckboxLabel` and `videoUnavailableLabel` were independently confirmed absent from both locale files' `EventDetailsPage` namespace (not merely assumed from the interface's own `?` optionality marker).

### Package boundary / testing-framework notes

This story is confined entirely to `apps/web`'s own existing Vitest setup (`vitest.config.ts`, already present; `"test": "vitest run"` already the package's test script) -- it adds one new `describe` block to an existing file, no new dependency (`typescript` is already a devDependency at `^6.0.3`), and no config change. The cross-package read of `packages/ui/src/features/events/EventDetailView.types.ts` is a plain `fs.readFileSync` at a relative path (for AST parsing of its source text), not a new module import -- `apps/web` already has a `@festgrid/ui` dependency in its `package.json` and already imports `EventDetailViewLabels` as a compiled type from it in this exact file; this is the same already-accepted dependency edge, reached by a different (source-text) mechanism for this one check.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: **No changes required.** This story adds test code only; it does not change `EventDetailView.types.ts`, `mapper.ts`'s production logic, any Drizzle schema, any GraphQL contract, or any other shared TypeScript type/interface.
- Impacted fields/contracts: None.
- Required DB migration changes: None.
- Required TypeScript type changes: None.
- Backward compatibility and rollout notes: N/A -- purely additive test-only change; no runtime behavior of any shipped component or page changes.
- Verification checks: `pnpm --filter web test` (confirms the new test passes against the real, unmodified interface and locale files) and `pnpm --filter web lint` (confirms the extended file satisfies `apps/web`'s current `next lint` configuration).

### File/path expectations

- `apps/web/src/features/events/mapper.test.ts` — extended with a new `describe` block (all ACs). No new file.
- **Do not touch:** `packages/ui/src/features/events/EventDetailView.types.ts`, `apps/web/src/features/events/mapper.ts`'s production code, `apps/web/locales/en.json`, `apps/web/locales/id.json` (this story proves today's real state is already correct; it does not fix or change any of them), `.github/workflows/ci.yml`, `turbo.json` (CI already runs `pnpm --filter web test` transitively via `pnpm run test` → `turbo run test`; no workflow/pipeline edit is needed for an extended existing test file to be picked up).

### Project Structure Notes

- Fully aligned with `apps/web/src/features/events/mapper.test.ts`'s existing role as the direct Vitest unit-test home for `mapper.ts`'s exports -- this story adds a second concern (`EventDetailViewLabels` locale parity) to that same file via its own `describe` block, rather than introducing a new file or a new testing pattern location.
- No conflicts or variances detected.

### References

- [Source: `_bmad-output/implementation-artifacts/backlog.yaml#FIND-032`] — originating finding, deferred from `find-011-cruft-cleanup` (2026-09-15).
- [Source: `_bmad-output/implementation-artifacts/backlog.yaml#FIND-073`] — child finding carved out this session, tracking the deferred widening to the other ~19 `*Labels` interfaces.
- [Source: `_bmad-output/implementation-artifacts/deferred-work.md`, "Deferred from: find-011-cruft-cleanup (2026-09-15)"] — full original context: found via Blind Hunter review of that session's manual, symmetric `postedByLabel` removal across the type and both locale files.
- [Source: `packages/ui/src/features/events/EventDetailView.types.ts`] — `EventDetailViewLabels` interface, the subject of this story's ratchet.
- [Source: `apps/web/src/features/events/mapper.ts#useEventDetailViewLabels`] — the sole production wiring point from the interface to the `EventDetailsPage` next-intl namespace.
- [Source: `apps/web/src/features/events/mapper.test.ts`] — the file this story extends.
- [Source: `apps/web/src/features/events/EventDetailWrapper.tsx`] — the sole real caller of `EventDetailView` with real labels.
- [Source: `apps/web/locales/en.json`, `apps/web/locales/id.json`] — the two locale files checked.
- [Source: `apps/web/locales/locales.test.ts`] — existing, separate en/id mirroring + enum-sync ratchet; its `expect.arrayContaining` subset-check style for the enum-sync tests is the direct style precedent for this story's own one-directional check (AC3).
- [Source: `apps/backend/src/lib/events/event-account-match-ratchet.test.ts`] — style precedent for a "the check is actually tuned correctly" non-vacuous proof test (AC4).
- [Source: `_bmad-output/project-context.md`, Internationalization section] — Adapter/decoupling principle (packages/ui framework-agnostic, no direct next-intl dependency) motivating the apps/web placement decision.
- [Source: `packages/ui/src/hooks/useWeeklyCalendarController.ts`] — in-code precedent for the "packages/ui must not depend on apps/web" direction rule.
- [Source: `_bmad-output/planning-artifacts/story-split-gate.md`] — Gate 1/2/3 definitions and execution protocol applied fresh above.
- [Source: `_bmad-output/planning-artifacts/story-content-structure.md`] — canonical section order and status vocabulary this file follows.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Internationalization section (next-intl, locale-key conventions, Adapter/decoupling principle motivating the apps/web placement); Testing Rules section (apps/web's "testing trophy" / Vitest approach, consistent with this story's addition to an existing Vitest file).
- [x] `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` — no direct feature/business-logic requirement implicated by a pure test-tooling story; cited for completeness per the project's mandatory-reference rule.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — no AD section implicated by a pure test-only addition; cited for completeness, full file not loaded (no AD lookup needed, matching Story 0.41's own precedent for a zero-architecture-impact story).
- [x] `docs/infrastructure/index.md` — not applicable (no backend compute, queue, EventBridge, API Gateway, or DB-provisioning change); confirmed via the index summary, full shard files not loaded.

## Implementation Plan (Rule-Compliant)

### File Change Plan

- `apps/web/src/features/events/mapper.test.ts` — extended with a new `describe('EventDetailViewLabels locale parity ratchet', ...)` block. Contains: (1) the AST-based key-extractor helper (Task 1), (2) the two locale-file reads plus the `DELIBERATELY_UNLOCALIZED_KEYS` allow-list and the per-locale missing-key assertions (Task 2), (3) the non-vacuous fixture-based proof test (Task 3).

### Rule Mapping

- AC1 → Task 1 (AST-based extraction from the real source, not a hand-maintained list).
- AC2 → Task 2's `DELIBERATELY_UNLOCALIZED_KEYS` allow-list.
- AC3/AC6 → Task 2's per-locale, one-directional missing-key assertions.
- AC4 → Task 3's fixture-based non-vacuous proof.
- AC5 → Task 4's real-suite verification run.

### Verification Plan

- `pnpm --filter web test` → full existing suite green, including the extended `mapper.test.ts` (AC1, AC3, AC4, AC5, AC6).
- `pnpm --filter web lint` → clean against `apps/web`'s current `next lint` configuration (unchanged by this story).
- Manual diff review confirming `EventDetailView.types.ts`, `mapper.ts`'s production code, `en.json`, and `id.json` are byte-for-byte unchanged by this story (it is a test-only addition).
- Both run in the foreground, targeted/package-scoped (`--filter web`), never a bare repo-wide `pnpm test`/`pnpm lint`, and no `pnpm install` of any kind (no new dependency is introduced).

## Pre-Coding Approval Gate

- [ ] Scope confirmation — ratchet `EventDetailViewLabels` only (not the ~19 other `*Labels` interfaces, carved into child finding FIND-073), one-directional subset check with a 2-key named allow-list, test lives in `apps/web`'s existing `mapper.test.ts` -- all per the user's 2026-10-06 `AskUserQuestion` decisions (Dev Notes).
- [ ] Architecture and boundary confirmation — Gate 1/2/3 all ran fresh this session, all three report "No gap found" (Dev Notes).
- [ ] Testing plan confirmation — AC5's real-suite run against the unmodified interface/locale files is the non-regression proof; AC4's fixture-based proof is the mechanism-correctness proof.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — N/A, no gaps found by any gate, nothing deferred to a prerequisite story.

## Testing Requirements

- [ ] Unit/guardrail test — the new `describe` block in `mapper.test.ts` itself, covering both the real-data assertions (AC1, AC3, AC5, AC6) and the fixture-based non-vacuous proof (AC4).
- [ ] Regression — full existing `apps/web` Vitest suite (including the rest of `mapper.test.ts`) re-run and confirmed green alongside the new block.
- [ ] E2E tests — N/A (pure dev-tooling/test-hygiene addition; no user-facing flow).

## Deliverables Checklist

- [ ] `apps/web/src/features/events/mapper.test.ts` gains the new `describe` block implementing AC1-AC6.
- [ ] The `DELIBERATELY_UNLOCALIZED_KEYS` allow-list contains exactly `scheduleCheckboxLabel` and `videoUnavailableLabel`, each with an inline rationale comment.
- [ ] The non-vacuous fixture proof test (AC4) passes.
- [ ] `pnpm --filter web test` and `pnpm --filter web lint` both pass.
- [ ] `EventDetailView.types.ts`, `mapper.ts`'s production code, `en.json`, `id.json` are unmodified.

## Out of Scope

- Widening this ratchet to any of the other ~19 `*Labels` interfaces found during drafting (`WeeklyCalendarViewLabels`, `CorrectionFormLabels`, `PwaInstallBannerLabels`/`PwaInstallIosModalLabels`, `WizardNavigationLabels`, `AiAssistedCorrectionTriggerLabels`, `AIFilterSummaryLabels`, and the rest) — explicitly deferred by the user's 2026-10-06 scoping decision and carved out as child backlog finding **FIND-073** (Dev Notes).
- A bidirectional full-equality check between the interface and the `EventDetailsPage` namespace — explicitly rejected by the user (Dev Notes "Check direction and the allow-list"); the namespace legitimately holds strings used outside this component's prop contract.
- Any change to `EventDetailView.types.ts` itself (adding/removing/renaming a prop), `mapper.ts`'s wiring, or either locale file's actual content — this story only adds a test that verifies today's already-correct state; it fixes nothing because nothing is currently broken.
- Placing the test inside `packages/ui` — explicitly rejected by the user after this session's architecture-direction finding (Dev Notes "Why apps/web, not packages/ui").
- Adding a `"build"`/type-check step to `packages/ui`'s CI pipeline, or any `next-intl` message-type augmentation to `apps/web`, as a second, belt-and-suspenders guard against interface/locale drift — a separate, larger concern than this one interface's ratchet; noted in Dev Notes as context for why a type-level `satisfies` trick alone would not suffice, but not something this story builds.

## Definition of Done

- [ ] AC1-7 satisfied.
- [ ] `pnpm --filter web test` and `pnpm --filter web lint` both pass.
- [ ] `EventDetailView.types.ts`, `mapper.ts`'s production code, `en.json`, `id.json` confirmed unmodified by diff review.
- [ ] The new test's fixture-based proof (AC4) demonstrates the check mechanism is non-vacuous.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
