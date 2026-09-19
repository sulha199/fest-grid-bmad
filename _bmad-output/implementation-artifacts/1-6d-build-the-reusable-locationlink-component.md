---
baseline_commit: 81c07e4428ed7a7b027d63e46b180b2e7ff7a003
---
# Story 1.6d: Build the reusable LocationLink component

## Story Details

- Epic: 1
- Story ID: 1.6d
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable `LocationLink` component in `packages/ui/src/core/` that renders a pin icon plus a location's name, always opening a map in a new tab, with a confidence-based icon choice reusing the existing location-trustworthiness predicate,
so that every place that displays a resolved location (the event-detail schedule, Story 1.6e, and the reusable account element, Story 0.i6e) stops duplicating Google-Maps-URL-building and confidence-gating logic, and a low-confidence match is never presented identically to a confirmed one.

## Acceptance Criteria

1. **AC1 — Base render, always clickable:** Given a `locationDetail` prop shaped `{ name: string; coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?: string | null }`, when `LocationLink` renders, then it displays a pin-location icon (`MapPin`, `lucide-react`) followed by `name` as text, the whole element wrapped in a single `<a>` with `target="_blank"` and `rel="noopener noreferrer"` — the entire component is always clickable and always opens a map in a new tab, regardless of confidence state.
2. **AC2 — Trustworthy coordinate link:** Given `coordinates` is present and `isLocationTrustworthy({ confidence, matchType })` (imported directly from `@festgrid/domain/geolocation` — the exact predicate and `MIN_TRUSTWORTHY_CONFIDENCE`/`TRUSTWORTHY_MATCH_TYPE` threshold `apps/web`'s `mapper.ts` already uses to gate the event-detail map link) is `true`, when `LocationLink` computes its `href`, then it links directly to the coordinate (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`) and renders a trailing open-in-new-tab icon (`ExternalLink`, `lucide-react`).
3. **AC3 — Untrustworthy/absent-coordinate fallback link:** Given `coordinates` is absent, or present but `isLocationTrustworthy` returns `false`, when `LocationLink` computes its `href`, then it links to a text-query search built from `name` (`https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(name)>`) and renders a trailing search icon (`Search`, `lucide-react`) instead — never the open-in-new-tab icon. This includes the boundary case of a `null` `confidence`/`matchType` (the GraphQL-codegen-generated shape `isLocationTrustworthy` is designed to accept, per its own `LocationConfidenceSignal` type), which resolves to untrustworthy exactly like `undefined`.
4. **AC4 — Domain-agnostic, no i18n dependency:** The component is domain-agnostic beyond reusing `isLocationTrustworthy`: no `next-intl` import, no FestGrid-specific business logic, no hardcoded translatable copy. An optional `ariaLabel` prop lets a caller supply localized accessible text (set as `aria-label` on the wrapping `<a>` when provided); when omitted, the `<a>` carries no explicit `aria-label` and falls back to the browser's default accessible-name computation from its visible text content (`name`) — matching how every other plain `<a>` link already rendered in this codebase (e.g. `EventDetailView.tsx`'s private-contact and additional-links rows) is exposed to assistive tech today, i.e. this story introduces no new accessible-naming mechanism beyond what a caller opts into via `ariaLabel`.
5. **AC5 — Documented and exported for reuse:** `LocationLink` (and its `LocationLinkProps` type) is exported from `packages/ui`'s public entry point (`packages/ui/src/index.ts`) with TSDoc prop documentation, and has component tests proving the trustworthy/untrustworthy/absent-coordinate states, the `ariaLabel` override, and the always-clickable/always-new-tab behavior — so it is discoverable and reusable across features (first two consumers: Story 1.6e's event-detail schedule, Story 0.i6e's `SubscribedAccountCard`, both out of scope for this story).

## Tasks / Subtasks

- [ ] 1. Create `packages/ui/src/core/LocationLink.tsx` with an inline, exported `LocationLinkProps` interface (`name: string; coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?: string | null; ariaLabel?: string`) — following the PascalCase-filename, inline-props convention already used by `WeekPicker.tsx`/`RawJsonViewer.tsx` (not the kebab-case `.tsx`/`.types.ts` split used by `blocking-loader.tsx`/`multi-select.tsx`), matching the exact filename `LocationLink.tsx` epics.md's Story 1.6d Note specifies. (AC1, AC4)
- [ ] 2. Implement the base render: `MapPin` icon (`lucide-react`) + `name` text inside a single `<a target="_blank" rel="noopener noreferrer">`. (AC1)
- [ ] 3. Implement the href/trailing-icon computation: import `isLocationTrustworthy` from `@festgrid/domain/geolocation`; when `coordinates` is present and `isLocationTrustworthy({ confidence, matchType })` is `true`, set `href` to the coordinate-query Google Maps URL and render a trailing `ExternalLink` icon; otherwise set `href` to the `encodeURIComponent(name)` text-query Google Maps URL and render a trailing `Search` icon. (AC2, AC3)
- [ ] 4. Thread the optional `ariaLabel` prop to `aria-label` on the wrapping `<a>` only when provided (no fallback aria-label synthesized when omitted — see AC4's reasoning). (AC4)
- [ ] 5. Add TSDoc comments to the component and its props documenting purpose, the confidence-gating behavior, and reuse guidance. (AC5)
- [ ] 6. Export `LocationLink`, `LocationLinkProps` from `packages/ui/src/core/LocationLink.tsx`, and add `export * from './core/LocationLink';` to `packages/ui/src/index.ts` (alongside the existing `export * from './core/WeekPicker';` line, same PascalCase-file export style). (AC5)
- [ ] 7. Write component tests (Vitest + `@testing-library/react`, `packages/ui/src/core/LocationLink.test.tsx`, via `@festgrid/testing-config/vitest-react` per Testing Requirements) covering: pin icon + name always render; the wrapping `<a>` always has `target="_blank"`/`rel="noopener noreferrer"`; trustworthy coordinate case (`confidence: 0.9, matchType: 'full_match'`) renders the coordinate-query `href` and the `ExternalLink` icon (not `Search`); the exact boundary confidence `0.5` is still trustworthy (`>=`, not `>`); untrustworthy cases (confidence below `0.5`, `matchType` not `'full_match'`, `coordinates` entirely absent, `confidence`/`matchType` explicitly `null`) all render the `encodeURIComponent(name)` text-query `href` and the `Search` icon (never `ExternalLink`); a `name` containing characters requiring encoding (e.g. spaces/`&`) is correctly `encodeURIComponent`-escaped in the fallback `href`; `ariaLabel` is applied as `aria-label` when provided and absent from the DOM when omitted. (AC1–AC5)

## Dev Notes

### Architecture & UX Gate Findings

- **Epic-1-readiness sweep not cited.** `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` is marked `swept: true`, but its `stories_covered` frontmatter list (`1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6, 1.7, 1.8`) predates Stories 1.6b–1.6f entirely (sweep date 2026-07-31; this story's governing proposal CC-021 is dated 2026-09-15) — matching the exact same "sweep predates this story" situation already resolved for Stories 1.6c/1.6f by running all three gates fresh via subagent dispatch rather than citing the stale report.
- **Gate 1 (run fresh, persona Winston) — No gap found.** The component reads only caller-supplied props (no data fetching, no auth, no secrets) — same shape as the already-shipped `BlockingLoader`/`WeekPicker` primitives. `isLocationTrustworthy` is an existing, already-exported domain predicate (`@festgrid/domain/geolocation`), and `@festgrid/domain` is already a declared `packages/ui` dependency (`packages/ui/package.json`), so no new cross-package or backend dependency is introduced. The Google Maps URL is pure client-side string construction — no network call, no API key, no SDK — a straight extraction of logic already living inline in `apps/web/src/features/events/mapper.ts` (lines 60-66), not a new external-service integration. Touches nothing in `apps/backend`, no schema/resolver, no database, no infra/deploy config.
- **Gate 2 (run fresh, persona Freya) — No gap found.** Directly searched `design-artifacts/UX-festgrid-run-1/DESIGN.md` (grepped for `location|pin|map_link|confidence` across all 653 lines) and `EXPERIENCE.md`'s Component Patterns section (all subsection headings reviewed): no `location_link`/`map_link` component token or micro-interaction spec exists anywhere. The closest related pattern, "Account Location Field" (EXPERIENCE.md), is a moderator location-*editing* field with zero prop/behavior overlap with this display-only link. The governing sprint-change-proposal (CC-021) already assessed this directly: "No DESIGN.md/EXPERIENCE.md tokens exist yet for a 'location link' element... genuinely new but narrow visual surface... the user's own capture already specifies the exact visual composition in enough detail... without a dedicated bmad-ux pass." This mirrors the precedent set by `BlockingLoader` (Story 1.7a): a narrow, fully-specified primitive with zero DESIGN.md token that correctly stayed one small component with no further split. No hidden sub-component, no undocumented micro-interaction, no complex reusable hook/util buried in scope.
- **Gate 3 (run fresh, persona Winston) — No gap found.** The only non-trivial dependency (`isLocationTrustworthy`) is not new setup — it already ships and is already consumed elsewhere (`mapper.ts`). No i18n foundation is introduced (caller supplies already-resolved strings, matching `BlockingLoader`'s "caller resolves, component only renders" pattern) — this component adds zero `next-intl` locale keys. No analytics/observability, no GraphQL schema/resolver/codegen change, no global app shell/layout change. `lucide-react` (the icon library for `MapPin`/`ExternalLink`/`Search`) is already a `packages/ui` dependency and all three icons are already used elsewhere in this codebase. Structurally identical in dependency shape to sibling leaf primitives (`WeekPicker`, `BlockingLoader`, `RawJsonViewer`) that likewise didn't trigger Gate 3.
- **Lightweight guard — gaps the fresh dispatch didn't anticipate:** None found. This story introduces no new external service, no new data entity, and no cross-cutting tooling gap.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. `LocationLinkProps` is a new, purely local type defined in `packages/ui` — it has no database, GraphQL schema, or `@festgrid/shared-types` counterpart to drift from.
- **Impacted fields/contracts:** None directly. `LocationLinkProps`'s `coordinates`/`confidence`/`matchType` fields are structurally shaped to match `isLocationTrustworthy`'s own `LocationConfidenceSignal` type (`packages/domain/src/geolocation/is-location-trustworthy.ts`), which is deliberately defined to accept both `T | null` (the GraphQL-codegen shape, e.g. `GetEventBySlugQuery`'s nested `locationDetails`) and `T | undefined` (a plain object literal) — this story's props follow that same dual-acceptance shape rather than introducing a third, narrower variant.
- **Required DB migration changes:** No changes required — no database access of any kind in this story.
- **Required TypeScript type changes:** No changes required to `packages/shared-types` or any GraphQL-generated type. This story adds no new field to any existing contract.
- **Backward compatibility and rollout notes:** Not applicable — net-new component, zero existing consumers to break. Stories 1.6e and 0.i6e (both out of scope here) are the first real callers and are each responsible for mapping their own already-selected GraphQL data into `LocationLinkProps`'s shape.
- **Verification checks:** This story's own component tests (Task 7) cover every confidence/coordinate combination end-to-end at the component boundary. No live-page verification is possible until Story 1.6e or 0.i6e wires a real consumer — tracked separately by those stories.

### Package Boundaries

- **Reusable UI component → `packages/ui`:** `LocationLink` is a reusable UI component per this project's Core Primitives rule, correctly homed in `packages/ui/src/core/LocationLink.tsx` — not `packages/ui/src/features/events/`, since it has two known consumers from the start spanning two different feature areas (Story 1.6e's event-detail schedule, Story 0.i6e's `SubscribedAccountCard` in `features/subscriptions/`), matching the established `core/` (domain-agnostic, reused) vs. `features/<domain>/` (single-feature) convention (AD-9 Rule 3, `WeekPicker` precedent — epics.md's own Story 1.6d Note cites this exact precedent).
- **Reusable mechanism → `packages/domain`:** already satisfied — no *new* reusable business logic is being introduced by this story. The one piece of reusable logic this component depends on (`isLocationTrustworthy`) already lives in `packages/domain/src/geolocation/`, built by prior Stories 0.i7a/0.i7b/0.i7c. This story is a pure consumer of that existing export, not a candidate for a new `packages/domain` addition — the Google-Maps-URL-building logic itself is presentational glue tightly coupled to this component's own icon-choice rendering decision (the same reasoning `apps/web/src/features/events/mapper.ts` already applied by keeping it inline rather than in `packages/domain`), so it stays inside `LocationLink.tsx` rather than being extracted into `packages/domain`.
- **No cloud/external service setup:** Google Maps is reached via a plain deep-link URL (no Maps SDK, no API key, no new `SETUP_WALKTHROUGH.md` entry) — identical to the URL scheme `mapper.ts` already builds today.
- **No PostHog/analytics event:** No AC in this story or its governing proposal (CC-021) specifies tracking a click on this link; out of scope (see below).
- **No state management:** Purely a synchronous, stateless render off caller-supplied props — no React Query/nuqs/zustand involved (no Server/URL/Client-Global state categorization applies).
- **No async/loading state:** The component performs no data fetching of its own — no Blocking/Non-Blocking loader classification applies.
- **No schema-validation/package-isolation concerns:** No zod/ajv/firebase/testing-framework dependency is added or crossed by this story.

### Previous/Sibling Story Intelligence

- **Story 1.7a (`BlockingLoader`, `review`) — closest sibling precedent.** Same class of net-new, presentation-only `packages/ui/src/core/` primitive with zero DESIGN.md token, built directly from fully-specified ACs. Establishes: framework-agnostic constraints (no Radix, no `next-intl`, no Next.js-specific APIs — `lucide-react` + plain Tailwind + native HTML only), the "caller resolves, component only renders" i18n-decoupling pattern (reused here for `name`/`ariaLabel`), and the precedent that Gate 1/2/3 run fresh (rather than cited from a stale sweep) can legitimately land on "no gap, stays one small primitive" for a narrow, well-specified component.
- **`WeekPicker.tsx`/`RawJsonViewer.tsx` — file-naming/props-shape precedent.** Both are PascalCase-named `packages/ui/src/core/` files with an inline (not co-located `.types.ts`) props interface — this story follows that exact convention (per epics.md's explicit `LocationLink.tsx` filename and its citation of the `WeekPicker` precedent), distinct from the kebab-case `.tsx`/`.types.ts` split convention used by `blocking-loader.tsx`/`multi-select.tsx`/`page-header.tsx`. Both conventions coexist in this codebase today; this story's file is PascalCase per the epics.md-specified name.
- **`apps/web/src/features/events/mapper.ts` (current, unmodified by this story) — the logic being centralized.** Lines 60-66 today build the exact same two Google Maps URL variants this story implements, gated by the exact same `isLocationTrustworthy` call, but discard which branch was taken before handing the final `mapUrl` string to `EventDetailView` — which is why today's rendered schedule location link always shows the same (undifferentiated) treatment regardless of confidence. This story does not modify `mapper.ts` itself — that removal is explicitly Story 1.6e's scope (its AC3 removes `ScheduleDetail.mapUrl` and this pre-computation) — but understanding this existing code confirms the two URL formats and the gating predicate this story's ACs specify are not new inventions, just centralization.
- **Story 1-6c (`ready-for-dev`, backend/SSR-hydration scope) — no file overlap.** Entirely `apps/backend`/`apps/web` GraphQL-resolver and SSR-caching scope; shares no touched file with this `packages/ui`-only story.
- **Story 0.i6a/0.i6f (`SubscribedAccountCard`, `done`) — informational only, not this story's scope.** These stories shipped `SubscribedAccountCard`'s current contract (`packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx`), which Story 0.i6e (out of scope here) will later extend with a `location` prop consuming this story's `LocationLink`. No action needed in this story beyond confirming the dependency direction is correct (0.i6e depends on 1.6d, not the reverse).

### Git Intelligence Summary

Recent commit history (`203522c` `fix(cluster-b): stabilize infinite-scroll sentinel...`, `d95d05b` `feat(epic-1): resolve Story 1.6f - event-detail UI refinements`, `3322af2` `feat(epic-0): resolve Story 0.37 - extract and display event links`, `346709e` `feat(epic-0-i6): implement Story 0.i6a - finish SubscribedAccountCard/AccountAvatar contract`, `46c46b9` `feat(epic-0-i6): implement Story 0.i6f - platform-icon fallback...`) shows a consistent, current pattern: small, tightly-scoped `packages/ui` additions shipped independently, with `SubscribedAccountCard`'s own contract (0.i6a/0.i6f) actively evolving in parallel under Epic 0.i6 — confirming Story 0.i6e's later `location` prop addition (out of scope here) will land on an already-stable, already-multiply-revised component. This story's own scope (one small, self-contained, dependency-light primitive) fits the same established pattern — no additional extraction warranted beyond the single `.tsx` file this story's Task 1 creates.

### Project Structure Notes

- New files live under `packages/ui/src/core/`, per `project-context.md`'s "Core Primitives" convention, alongside existing PascalCase siblings `WeekPicker.tsx` and `RawJsonViewer.tsx`.
- Only existing file touched: `packages/ui/src/index.ts` (barrel re-export, add one line: `export * from './core/LocationLink';`). No conflicts with `apps/backend`, `apps/web`, or `packages/domain` — this story touches nothing outside `packages/ui/src/core/` and its own index re-export.
- `packages/ui`'s existing testing infra (`vitest.config.ts` using `@festgrid/testing-config/vitest-react`, confirmed by the existing `WeekPicker`/`RawJsonViewer`/`blocking-loader`/`account-avatar` test files) needs no new setup for this story.

### References

- [Source: _bmad-output/project-context.md] — Technology Stack, Code Organization (Core Primitives vs Domain Features), i18n rules.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6d] and neighboring Stories 1.6c, 1.6e, 0.i6e.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-15-reusable-location-link.md] — CC-021, this story's governing proposal (full ACs, rationale, epic-homing decision).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — confirmed `stories_covered` predates this story; Gate 1/3 run fresh instead.
- [Source: _bmad-output/implementation-artifacts/1-7a-build-the-reusable-blockingloader-component.md] — closest sibling reusable-component precedent (framework-agnostic constraints, caller-resolves-strings i18n pattern, Gate 1/2/3-run-fresh-and-clean precedent).
- [Source: packages/domain/src/geolocation/is-location-trustworthy.ts], [Source: packages/domain/src/geolocation/is-location-trustworthy.test.ts] — the exact predicate/constants/type this story imports and reuses verbatim.
- [Source: packages/domain/package.json] — confirms the real `./geolocation` exports subpath (`@festgrid/domain/geolocation`).
- [Source: packages/ui/package.json] — confirms `@festgrid/domain` and `lucide-react` are already declared `packages/ui` dependencies.
- [Source: apps/web/src/features/events/mapper.ts] (lines 1-83) — the existing inline URL-building/confidence-gating logic this component centralizes (not modified by this story).
- [Source: packages/ui/src/core/WeekPicker.tsx], [Source: packages/ui/src/core/RawJsonViewer.tsx] — PascalCase filename + inline-props-interface convention this story follows.
- [Source: packages/ui/src/index.ts] — current barrel export list this story appends one line to.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md] — confirmed (Gate 2) no location-link/map-affordance component token exists.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — confirmed (Gate 2) "Account Location Field" is the only related-but-distinct pattern (editing, not display-link).

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Core Primitives), i18n rules (caller-resolved strings), UI component placement conventions.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-9 Rule 3 (`core/` vs `features/<domain>/` placement, `WeekPicker` precedent).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/core/LocationLink.tsx` — component implementation (inline `LocationLinkProps`, pin icon + name + confidence-gated href/trailing-icon).
  - NEW `packages/ui/src/core/LocationLink.test.tsx` — component tests.
  - UPDATE `packages/ui/src/index.ts` — add `export * from './core/LocationLink';`.
  - No new `vitest.config.ts`/`package.json` changes needed — `packages/ui`'s testing infra (Story 0.10's `@festgrid/testing-config`) is already fully wired.
- **Rule Mapping:**
  - *Core Primitives (Code Organization)* → component placed in `packages/ui/src/core/`, PascalCase filename matching epics.md's Story 1.6d Note and the `WeekPicker`/`RawJsonViewer` precedent, not `features/events/` or a kebab-case split.
  - *Reuse over reinvention* → `isLocationTrustworthy` imported verbatim from `@festgrid/domain/geolocation`; no second confidence-gating implementation.
  - *i18n foundational principle (AD-6)* → zero new `next-intl` locale keys; `name`/`ariaLabel` are caller-resolved/pre-translated, mirroring `BlockingLoader`'s established pattern.
  - *Testing Philosophy (testing trophy)* → integration-style component tests via Vitest + Testing Library, not exhaustive unit fragmentation (this component itself is not `packages/domain`, so the 100%-coverage mandate doesn't apply here — only `isLocationTrustworthy` itself, already covered, carries that requirement).
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — covers: base render (pin icon + name + `target="_blank"`/`rel="noopener noreferrer"`), trustworthy-coordinate href + `ExternalLink` icon, boundary confidence `0.5`, every untrustworthy/absent-coordinate/null-signal case → text-query href + `Search` icon, `encodeURIComponent` escaping, `ariaLabel` present/absent.
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - No E2E test for this story (nothing renders `LocationLink` on a real page yet — that lands with Story 1.6e/0.i6e).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: build `LocationLink` as a standalone, presentation-only UI component in `packages/ui/src/core/`; no backend work, no live-data wiring, no consumer integration (Stories 1.6e/0.i6e wire the first real usage).
- [ ] Architecture confirmed: component built with plain Tailwind + native HTML elements + `lucide-react` only (no Radix, no `next-intl`, no maps SDK), placed under `packages/ui/src/core/` as `LocationLink.tsx` with inline props (matching `WeekPicker`/`RawJsonViewer`).
- [ ] Testing plan confirmed: Vitest + `@testing-library/react` component tests via the existing `packages/ui/vitest.config.ts` (`@festgrid/testing-config/vitest-react`), no new test-infra setup required.
- [ ] Gate 1/2/3 findings acknowledged: all three run fresh (epic-1-readiness.md predates this story) and all three returned "No gap found" — no prerequisite story required.
- [ ] Explicit human approval state (pending)

## Testing Requirements

- [ ] Component tests (Vitest + `@testing-library/react`) for: base render (pin icon + name always present, `<a target="_blank" rel="noopener noreferrer">` always present); trustworthy-coordinate case renders the coordinate-query `href` + `ExternalLink` icon; boundary confidence `0.5` is trustworthy; untrustworthy confidence, wrong `matchType`, absent `coordinates`, and explicit `null` confidence/matchType all render the `encodeURIComponent(name)` text-query `href` + `Search` icon; `ariaLabel` applied when provided, absent from the DOM when omitted.
- [ ] No E2E test required for this story (no live page consumes `LocationLink` yet; E2E coverage arrives with Story 1.6e/0.i6e).
- [ ] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per `project-context.md`; `packages/ui` follows the "testing trophy" integration-style approach.
- [ ] Note: use `@festgrid/testing-config/vitest-react` (Story 0.10, already available) for `packages/ui/vitest.config.ts` — do not create a parallel/ad hoc testing-config setup.

## Deliverables Checklist

- [ ] `LocationLink` component implemented in `packages/ui/src/core/LocationLink.tsx`, inline `LocationLinkProps`.
- [ ] Pin icon + name text, always wrapped in a single clickable `<a target="_blank" rel="noopener noreferrer">`.
- [ ] Confidence-gated href/trailing-icon: coordinate-query `href` + `ExternalLink` icon when trustworthy; text-query `href` + `Search` icon otherwise.
- [ ] `isLocationTrustworthy` imported and reused verbatim from `@festgrid/domain/geolocation` — no second predicate implementation.
- [ ] Optional `ariaLabel` prop threaded to `aria-label`, no synthesized fallback when omitted.
- [ ] No `next-intl` import, no FestGrid-specific business logic.
- [ ] Exported from `packages/ui`'s public entry point with TSDoc prop documentation.
- [ ] Component tests written and passing.

## Out of Scope

- Adopting `LocationLink` into `EventDetailView.tsx`'s schedule list, removing `ScheduleDetail.mapUrl`, or updating `mapper.ts` — all Story 1.6e's scope.
- Adopting `LocationLink` into `SubscribedAccountCard`'s account-identifier fallback line, adding its `location` prop, or the `getEventBySlug` query/codegen change for `sourceSocialMediaAccountProfile.defaultLocation` — all Story 0.i6e's scope.
- Any GraphQL query/schema/resolver/codegen change — none is needed by this story itself, per CC-021's own verified investigation.
- PostHog/analytics click tracking on this link — not specified by any AC in this story or CC-021.
- Storybook, visual-regression, or design-token tooling — not set up anywhere in this project yet.

## Definition of Done

- [ ] All Acceptance Criteria (AC1–AC5) are met.
- [ ] Required component tests (see Testing Requirements) are written and passing.
- [ ] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [ ] `LocationLink` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [ ] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`, invoked directly with epic/story number `1.6d`. `epics.md` already carried this story's full section (added by `bmad-correct-course`/CC-021 on 2026-09-15), but no `sprint-status.yaml` entry existed for `1-6d` at invocation time (verified: `grep -n "1-6d" sprint-status.yaml` returned nothing, while the immediately-adjacent `1-6c`/`1-6f` both had entries) — the same "epics.md section added, sprint-status.yaml registration deferred to a later bmad-create-story session" pattern CC-020/1-6c already documented. This session registers it.
- `epic-1-readiness.md` is `swept: true` but its `stories_covered` list predates this story's subject matter entirely (sweep date 2026-07-31; CC-021 dated 2026-09-15) — matching the precedent already set by Stories 1.6c/1.6f for the identical situation. All three gates (1/2/3) were run fresh via one-shot subagent dispatch (evidence inlined from already-loaded context, not re-read cold) and all three returned "No gap found" — see Dev Notes → Architecture & UX Gate Findings.
- No design tradeoff requiring `AskUserQuestion` was found. This story's ACs (drawn directly from the already-approved CC-021 proposal) are fully specified down to the exact URLs, predicate, icon choices, and prop shape — every implementation decision this session made (PascalCase filename matching the `WeekPicker` precedent epics.md itself cites, no `packages/domain` extraction of the URL-building glue, no synthesized `aria-label` fallback) followed directly from existing codebase precedent or explicit epics.md/CC-021 text, not an open judgment call.

### Completion Notes List

_To be filled by the dev agent during implementation._

### File List

_To be filled by the dev agent during implementation._
