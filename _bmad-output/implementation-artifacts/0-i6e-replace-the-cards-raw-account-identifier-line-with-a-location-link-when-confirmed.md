---
baseline_commit: 7ac24fd5d6e6507536830efd9fdcd3dac1e9b3e3
---
# Story 0.i6e: Replace the card's raw account-identifier line with a location link when confirmed

## Story Details

- Epic: 0.i6 (SubscribedAccountCard improvement epic)
- Story ID: 0.i6e
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want `SubscribedAccountCard`'s account-identifier fallback line replaced by a location link when the account's own default location is confirmed/good-confidence,
so that a user sees where the account is actually based instead of an opaque identifier, on every surface that already renders this card with location data available (IDEA-032).

## Acceptance Criteria

1. **AC1 — Trustworthy location replaces the secondary line.** Given `SubscribedAccountCard` receives a new optional `location: { name: string; coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?: string | null } | null` prop, and it is present with `isLocationTrustworthy(location)` (Story 1.6d's same imported predicate, `@festgrid/domain/geolocation`) `true`, when the card renders, then its current secondary identity line — today rendered only when `account.displayName && account.username` are both present, as `@{account.username}` (`SubscribedAccountCard.tsx` lines 52-54; epics.md's original `:29` reference is stale, superseded by Story 0.i6a's fallback rework) — is replaced by `LocationLink` (Story 1.6d, `packages/ui/src/core/LocationLink.tsx`) rendering `location.name`, **unconditionally on `location`'s own trustworthiness** — independent of whether `account.displayName`/`account.username` are present or empty.
2. **AC2 — Untrustworthy/absent location: unchanged fallback.** Given `location` is absent (`null`/`undefined`), or present but `isLocationTrustworthy(location)` is `false`, when the card renders, then it falls back to today's rendering exactly unchanged — including the existing `account.displayName && account.username` gating on the `@{username}` line (IDEA-032's explicit fallback behavior; no new conditions introduced on this path).
3. **AC3 — `mapper.ts` derives `accountLocation`.** `apps/web/src/features/events/mapper.ts`'s existing account-prop derivation block (already producing `accountName`/`accountUsername`/`accountPlatform`/`accountId`/`accountHref`/`accountPlatformIconUrl` from `event.sourceSocialMediaAccountProfile`, lines 131-138) gains an `accountLocation` field derived from `event.sourceSocialMediaAccountProfile?.defaultLocation`, with `name` taken as `placeName || formattedAddress` (first non-empty) and `coordinates`/`confidence`/`matchType` passed through unchanged; `accountLocation` is `null` when `defaultLocation` is absent or when both `placeName` and `formattedAddress` are empty. This is threaded through `EventDetailViewProps.accountLocation` (new optional field, `EventDetailView.types.ts`) to `EventDetailView.tsx`'s existing `SubscribedAccountCard` render call (lines 272-283), mapped to its new `location` prop.
4. **AC4 — Query-selection-set gap closed.** `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` document's `sourceSocialMediaAccountProfile` selection (lines 75-82) gains `defaultLocation { coordinates { lat lng } placeName formattedAddress confidence matchType }` — the field already exists on the deployed `SocialMediaAccountProfile` GraphQL type (`apps/backend/src/schema/social-media-accounts.graphql:12`) and already resolves via the existing generic `buildOptimizedDrizzleSelect`-driven `Event.sourceSocialMediaAccountProfile` resolver (`resolvers.ts:3631`) with no backend code change — this is a query-selection-set gap only, the same class of gap Story 0.i7c's own amendment note documents for this field family. Codegen (`pnpm --filter web codegen`) is regenerated so `GetEventBySlugQuery`'s generated type carries the new nested field.
5. **AC5 — Other adoption sites unaffected.** This does not change `SubscribedAccountCard`'s other adoption sites (Post Selection, Story 0.i6b; Subscribed Accounts settings, Story 0.i6c — neither is built yet in code as of this story) — they simply omit the new `location` prop, and today's fallback rendering is exactly what they get, unaffected. `SubscribedAccountCard`'s current sole real caller, `EventDetailView.tsx`, is the only one wired to the new prop by this story.

## Tasks / Subtasks

- [ ] 1. Widen `packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts`: add `location?: { name: string; coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?: string | null } | null` to `SubscribedAccountCardProps`. (AC1, AC2)
- [ ] 2. Update `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx`: import `LocationLink` from `../../core/LocationLink` (relative import, matching how `AccountAvatar`/`getAccountIdentityLabel` are already imported from `../../core/*` in this same file — no barrel/`@festgrid/ui` self-import) and `isLocationTrustworthy` from `@festgrid/domain/geolocation`. Replace the current secondary-line block (`{account.displayName && account.username && (<span ...>@{account.username}</span>)}`, lines 52-54) with: when `location && isLocationTrustworthy(location)`, render `<LocationLink name={location.name} coordinates={location.coordinates} confidence={location.confidence} matchType={location.matchType} />` in that slot instead; otherwise render today's unchanged conditional `@{username}` span. (AC1, AC2)
- [ ] 3. Widen `packages/ui/src/features/events/EventDetailView.types.ts` (`EventDetailViewProps`): add `accountLocation?: { name: string; coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?: string | null } | null` alongside the existing `accountName`/`accountUsername`/etc. block (lines 120-125). (AC3)
- [ ] 4. Update `packages/ui/src/features/events/EventDetailView.tsx`: destructure `accountLocation` from props (alongside `accountName`/`accountUsername`/etc., lines 43-48) and pass `location={accountLocation}` on the existing `SubscribedAccountCard` render call (lines 272-283). No change to `canActOnSubscription` (line 228) or any other existing prop wiring. (AC3)
- [ ] 5. Update `apps/web/src/features/events/mapper.ts`: add an `accountLocation` field to `mapGraphQLEventToDetailViewProps`'s return object (alongside `accountName`/`accountUsername`/etc., lines 131-138), computed from `event.sourceSocialMediaAccountProfile?.defaultLocation` — `null` when absent; otherwise `{ name: defaultLocation.placeName || defaultLocation.formattedAddress || '', coordinates: defaultLocation.coordinates ?? null, confidence: defaultLocation.confidence ?? null, matchType: defaultLocation.matchType ?? null }`, and treat an empty-string `name` (both `placeName`/`formattedAddress` empty) as `accountLocation: null` rather than an empty-name object, so `isLocationTrustworthy`'s confidence/matchType gate is never reached with unusable display text. (AC3)
- [ ] 6. Update `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` operation: add `defaultLocation { coordinates { lat lng } placeName formattedAddress confidence matchType }` inside the existing `sourceSocialMediaAccountProfile { ... }` selection (lines 75-82). Run `pnpm --filter web codegen` to regenerate `apps/web/src/generated/graphql.ts`. Confirm `apps/web/src/features/events/queries.graphql.test.ts` (Story 3.7c AC1's list-view guard) still passes unmodified — it deliberately excludes `getEventBySlug` from its forbidden-field check, so this change does not trip it. (AC4)
- [ ] 7. Tests:
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx`: add cases for (a) trustworthy `location` renders `LocationLink` with `location.name` instead of the `@username` line, even when `displayName`/`username` are both present; (b) untrustworthy `location` (e.g. `confidence: 0.2`) falls back to today's `@username` rendering unchanged; (c) absent `location` (omitted prop) falls back to today's rendering unchanged (regression check — existing test suite already covers this implicitly, confirm it still passes); (d) trustworthy `location` with `displayName`/`username` both empty still renders `LocationLink` (the "unconditional on location's own trustworthiness" part of AC1). Mock/stub `LocationLink` minimally if needed to assert on its `name` prop rather than re-testing its own internal rendering (already covered by Story 1.6d's own test suite).
  - `packages/ui/src/features/events/EventDetailView.test.tsx`: add a case confirming `accountLocation` is threaded to `SubscribedAccountCard`'s `location` prop; confirm existing tests (guard, toggle, etc.) remain green with the new optional prop omitted.
  - `apps/web/src/features/events/mapper.test.ts`: add cases for `accountLocation` derivation — `placeName` present (used verbatim), `placeName` empty/`formattedAddress` present (fallback used), both empty (`accountLocation: null`), `defaultLocation` entirely absent (`accountLocation: null`). The existing `buildEvent` fixture helper only parameterizes schedule overrides and defaults `sourceSocialMediaAccountProfile: null` — override it via object spread on the built event (`{ ...buildEvent({}), sourceSocialMediaAccountProfile: { ... } }`), matching the pattern already needed for any other account-profile-dependent test in this file today.
  - Type-check/lint clean for `packages/ui` and `apps/web`. (AC1-AC5)

## Dev Notes

- **Blocking prerequisite — Story 1.6d is not yet implemented.** `packages/ui/src/core/LocationLink.tsx` does not exist in the codebase as of this story's creation (confirmed via glob: no match). Story 1.6d ("Build the reusable LocationLink component") is `ready-for-dev` in `sprint-status.yaml`, fully specified (exact `LocationLinkProps` shape, export path), but not started. This story's Task 2 cannot compile or pass tests until 1.6d ships `LocationLink` and its `packages/ui/src/index.ts` export. This mirrors the exact situation already documented for Story 1-6c ("Blocked on Story 1-3j (ready-for-dev, not yet implemented)") — the established pattern in this project is to create the dependent story now (fully specified, ready-for-dev) rather than block story creation on prerequisite implementation order, and to flag the block explicitly in the Pre-Coding Approval Gate below so `bmad-dev-story` sequences correctly (implement 1.6d first, or confirm it has landed, before starting this story's Task 2 onward).
- **`SubscribedAccountCardProps.location`'s shape intentionally mirrors `LocationLinkProps` (Story 1.6d) exactly** (`name`, `coordinates?`, `confidence?`, `matchType?`, minus `ariaLabel` which this story's call site does not need) so Task 2's render call is a near-direct prop pass-through — no shape translation needed between the two.
- **`isLocationTrustworthy` is imported directly into `packages/ui`** (`@festgrid/domain/geolocation`) — already an established pattern in this codebase: `apps/web/src/features/events/mapper.ts` already imports it the same way for the schedule map-link gate, and `packages/ui/package.json` already declares `@festgrid/domain` as a dependency (confirmed by Story 1.6d's own Dev Notes, which imports the same predicate into `packages/ui/src/core/LocationLink.tsx`). No new cross-package dependency is introduced.
- **Data flow, end to end:** `socialMediaAccountProfiles.defaultLocation` (DB, `jsonb` typed `LocationDetails`, already exists — set by the account-location feature, Epic 0.i7/moderator-review flow) → GraphQL `SocialMediaAccountProfile.defaultLocation: LocationDetails` (schema field already exists, no resolver change — generic `buildOptimizedDrizzleSelect` pass-through) → `getEventBySlug` query selection (Task 6, new) → `GetEventBySlugQuery.eventBySlug.sourceSocialMediaAccountProfile.defaultLocation` (codegen, new) → `mapper.ts`'s `accountLocation` derivation (Task 5, new) → `EventDetailViewProps.accountLocation` (Task 3, new) → `EventDetailView.tsx` prop threading (Task 4, new) → `SubscribedAccountCard`'s `location` prop (Task 1, new) → conditional `LocationLink` render (Task 2, new).
- **Current code state (read in full before drafting this story):**
  - `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx` (95 lines, post-Story-0.i6a) — the secondary identity line (lines 52-54) only renders when **both** `account.displayName` and `account.username` are truthy (`{account.displayName && account.username && (<span ...>@{account.username}</span>)}`). This is Story 0.i6a's graceful-fallback rework, landed after epics.md's Story 0.i6e AC text was originally written (which cites the pre-0.i6a line number `:29`) — the AC's *intent* (replace the identifier line with a location link) is unambiguous; only the exact line/condition reference needed correcting against current code, captured in AC1 above.
  - `apps/web/src/features/events/mapper.ts` (142 lines) — `mapGraphQLEventToDetailViewProps`'s account-prop block is lines 131-138; `accountLocation` is added here, following the exact same `?? null` / optional-chaining style already used for the sibling fields on the preceding lines.
  - `apps/web/src/features/events/queries.graphql` — `getEventBySlug`'s `sourceSocialMediaAccountProfile` selection (lines 75-82) does not currently select `defaultLocation`; `getEvents` (the list/grid query, lines 2-34) also does not and must not (Story 3.7c AC1's guard, `queries.graphql.test.ts`, explicitly excludes `getEventBySlug` from that check, so this story's addition there is safe).
  - `packages/ui/src/features/events/EventDetailView.tsx`/`.types.ts` — `accountId`/`accountName`/`accountUsername`/`accountPlatform`/`accountPlatformIconUrl`/`accountHref` are all already threaded the same way `accountLocation` will be; no structural change to this threading pattern, purely additive.
- **Data source is already correctly typed and requires no migration.** `packages/database/schema.ts:173`: `defaultLocation: jsonb('default_location').$type<LocationDetails>()` on `socialMediaAccountProfiles` — this column and its `LocationDetails` shape (`coordinates: Coordinates!`, `placeName`/`placeId`/`formattedAddress`/`timezone`/`confidence`/`matchType`/etc., all optional except `coordinates`) already exactly match the GraphQL `LocationDetails` type and the shape schedules' `locationDetails` field already uses — the same type family, not a new/parallel one.

### Architecture & UX Gate Findings

- **No epic readiness report exists for Epic 0.i6** (confirmed: `_bmad-output/planning-artifacts/epic-readiness/` has no `epic-0-i6-readiness.md` — same situation already documented by sibling Stories 0.i6a and 0.i6f for this same epic). Gate 1, 2, and 3 were run **fresh** via one-shot subagent dispatch (evidence inlined from context already gathered in this session, not re-read cold by the subagents), not cited from a swept report.
- **Gate 1 (Architecture/Infrastructure Completeness), run fresh — No gap.** No DB/ORM/domain/backend-only dependency is called directly from `apps/web`/`packages/ui`; data access stays inside the existing `buildOptimizedDrizzleSelect`-driven `Event.sourceSocialMediaAccountProfile` resolver. `defaultLocation` already exists on the deployed schema and resolves via the existing generic resolver with zero backend code change — AC4 is a selection-set addition, not a new API surface/resolver/query/mutation. No auth/authorization/secrets/business-rule addition in frontend code. No new infra — the DB column already exists, no migration needed. All touched files are frontend/UI only; zero `apps/backend` changes.
- **Gate 2 (UI Complexity & Reusability), run fresh — No gap.** The draft scope is a single optional prop on an already-shipped, already-reusable `SubscribedAccountCard` that conditionally swaps one existing text line for a render of `LocationLink` — a separate component that is itself already fully specified and built under its own dedicated story (1.6d), not created here (satisfying, not violating, the "reusable component gets its own story" heuristic). No new hook, formatter, or util is introduced or buried. UX-spec search (both authoritative docs, grepped case-insensitive for "subscribedaccountcard"/"account identifier"/"account_card"/"location"): `design-artifacts/UX-festgrid-run-1/DESIGN.md` has zero tokens for this card or a location-link element (consistent with Stories 0.i6a's and 1.6d's identical findings); `EXPERIENCE.md`'s only location-related pattern ("Account Location Field") is a moderator-facing location-*editing* form field, already ruled out by Story 1.6d's own Gate 2 pass as a different surface/audience/interaction with zero prop overlap with this read-only display card. No undocumented visual/interaction detail is omitted from scope. Fallback behavior is explicitly unchanged (AC2); other adoption sites are explicitly unaffected (AC5).
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness), run fresh — No gap.** No global app shell/layout, i18n foundation, or analytics/observability foundation is touched — `location.name` is pre-resolved data (not translatable enum/copy), matching the existing coordinates/address handling pattern elsewhere in this codebase; no new `next-intl` locale key. The GraphQL Code Generator pipeline is already established project-wide — this story re-runs it after a selection-set change, doesn't stand it up. `LocationLink` is the one candidate for a "reusable primitive with no home" finding, but it does not qualify: it already has its own dedicated story (1.6d) with a fully specified contract and reserved export slot — this story is sequenced *behind* that story's implementation (a Pre-Coding-Approval-Gate ordering concern, documented above, not a missing-foundation Gate 3 finding). `isLocationTrustworthy` and `defaultLocation` are both pre-existing, not new shared dependencies other stories would need to stand up.
- **Lightweight guard:** reasoned over the full scope above for anything a hypothetical epic-wide sweep couldn't have anticipated — no new external service, no new data entity, no new cross-cutting tooling gap introduced. Nothing here warrants a second Gate 1/3 pass.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: No mismatch found.** `SocialMediaAccountProfile.defaultLocation`'s GraphQL type (`LocationDetails`), its underlying DB column (`packages/database/schema.ts:173`, `jsonb('default_location').$type<LocationDetails>()`), and the new `SubscribedAccountCardProps.location`/`EventDetailViewProps.accountLocation` TypeScript shapes this story introduces are all structurally aligned — `location`/`accountLocation`'s `coordinates`/`confidence`/`matchType` fields are deliberately typed to match `isLocationTrustworthy`'s existing `LocationConfidenceSignal` interface (`packages/domain/src/geolocation/is-location-trustworthy.ts`), the same dual `T | null`-acceptance shape already used by `LocationLinkProps` (Story 1.6d) and by `mapper.ts`'s existing schedule `locationDetails` handling.
- **Impacted fields/contracts:** `SubscribedAccountCardProps` gains `location?: {...} | null` (new, additive, optional — non-breaking for the two not-yet-built adoption sites 0.i6b/0.i6c). `EventDetailViewProps` gains `accountLocation?: {...} | null` (new, additive, optional). `GetEventBySlugQuery`'s generated type gains a nested `sourceSocialMediaAccountProfile.defaultLocation` field (codegen regeneration, Task 6) — purely additive to the generated type, no existing field's shape changes.
- **Required DB migration changes:** None. `defaultLocation` and its `LocationDetails` shape already exist on `socialMediaAccountProfiles` (built by prior Epic 0.i7 / account-location work) — this story only asks for a field that already exists.
- **Required TypeScript type changes:** The two additive interface widenings above (hand-written, `packages/ui`) plus the codegen regeneration (Task 6, generated, not hand-written) — no `@festgrid/shared-types` change.
- **Backward compatibility and rollout notes:** Every new prop is optional and additive; no existing caller of `SubscribedAccountCard` or `EventDetailView` breaks by omitting it. `mapper.test.ts`'s existing fixture (`sourceSocialMediaAccountProfile: null` default) continues to compile unmodified — new tests override it via object spread rather than changing the shared default (Task 7).
- **Verification checks:** `pnpm --filter ui test`, `pnpm --filter web test` (including the unmodified `queries.graphql.test.ts` guard), `tsc`/lint clean for both packages, and manual confirmation on a seeded event whose `sourceSocialMediaAccountProfile.defaultLocation` has `confidence >= 0.5`/`matchType === 'full_match'` that the account card renders a location link instead of `@username`.

### Project Structure Notes

- **No new files.** Every file this story touches already exists: `SubscribedAccountCard.tsx`/`.types.ts`, `EventDetailView.tsx`/`.types.ts` (both `packages/ui`), `mapper.ts`, `queries.graphql` (both `apps/web`), plus their respective test files and the codegen-generated `graphql.ts`.
- **No `packages/domain` change** — this story only *consumes* the existing `isLocationTrustworthy` export; no new portable business logic is introduced.
- **No `apps/backend` change, no new GraphQL SDL field, no new resolver, no new npm dependency, no new state management, no new URL param, no new Zustand store, no new i18n locale key, no new PostHog/analytics event, no cloud/external service setup.**
- **Reusable UI component check:** `LocationLink` (the reusable component this story renders) is not built by this story — see Story 1.6d, already homed in `packages/ui/src/core/`. This story adds no new reusable component of its own.
- **Reusable function/mechanism check:** no new reusable function/mechanism is introduced by this story; `isLocationTrustworthy` (already in `packages/domain`) is reused verbatim.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-0.i6e] — this story's home; original AC text and Note (CC-021 homing rationale).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6d] — `LocationLink`'s full spec (`LocationLinkProps` shape, export path), this story's blocking prerequisite.
- [Source: _bmad-output/implementation-artifacts/1-6d-build-the-reusable-locationlink-component.md] — `LocationLinkProps` exact shape, Gate 1/2/3 findings for the component this story consumes, confirmed not-yet-implemented status.
- [Source: _bmad-output/implementation-artifacts/0-i6a-finish-the-subscribedaccountcard-accountavatar-contract.md] — `SubscribedAccountCard`'s current fallback-rendering contract (post-rework), the stale-line-number precedent this story's AC1 corrects the same way.
- [Source: _bmad-output/implementation-artifacts/backlog.yaml#IDEA-032, #CC-021] — this story's originating backlog rows; CC-021's note explicitly names this story as its own not-yet-promoted "Phase 3."
- [Source: packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx, .types.ts, .test.tsx] — current implementation and tests, read in full.
- [Source: packages/ui/src/features/events/EventDetailView.tsx, .types.ts] — current account-prop threading pattern, read in full (relevant sections).
- [Source: apps/web/src/features/events/mapper.ts, mapper.test.ts] — current account-prop derivation and test fixture, read in full.
- [Source: apps/web/src/features/events/queries.graphql, queries.graphql.test.ts] — current `getEventBySlug` selection set and the Story 3.7c AC1 guard confirmed unaffected.
- [Source: apps/backend/src/schema/social-media-accounts.graphql] — confirms `defaultLocation: LocationDetails` already exists on `SocialMediaAccountProfile`.
- [Source: apps/backend/src/schema/resolvers.ts:3631, :176-188] — confirms `Event.sourceSocialMediaAccountProfile`'s existing generic resolver and the absence of a custom `defaultLocation` field resolver (plain pass-through).
- [Source: packages/database/schema.ts:173] — confirms `defaultLocation` DB column already exists, correctly typed, no migration needed.
- [Source: packages/domain/src/geolocation/is-location-trustworthy.ts] — the exact predicate/type this story imports and reuses verbatim.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md, EXPERIENCE.md] — confirmed (Gate 2) no relevant token/pattern beyond the already-ruled-out "Account Location Field".
- [Source: _bmad-output/planning-artifacts/festgrid-architecture-spine.md#AD-9] — `core/` vs `features/<domain>/` placement precedent (informational; this story adds no new component).
- [Source: _bmad-output/implementation-artifacts/1-6c-*.md] — the "create the dependent story now, flag the block in Pre-Coding Approval Gate" precedent this story follows for its own dependency on 1.6d.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (`packages/ui` core/features placement, confirmed no violation), Locale-Sensitive Data Rendering rule (confirmed `location.name` is free-form resolved data, not an enum/translatable string, so no i18n key is required).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this story's section order/status vocabulary.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-9 (`core/` vs `features/<domain>/` convention, informational).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable, no backend/infra change in this story (confirmed by Gate 1 above).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - UPDATE `packages/ui/src/features/subscriptions/SubscribedAccountCard.types.ts` — add `location` prop type (Task 1).
  - UPDATE `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx`, `.test.tsx` — conditional `LocationLink` render, new tests (Task 2, Task 7).
  - UPDATE `packages/ui/src/features/events/EventDetailView.types.ts` — add `accountLocation` prop type (Task 3).
  - UPDATE `packages/ui/src/features/events/EventDetailView.tsx`, `.test.tsx` — thread `accountLocation`, new test (Task 4, Task 7).
  - UPDATE `apps/web/src/features/events/mapper.ts`, `mapper.test.ts` — `accountLocation` derivation, new tests (Task 5, Task 7).
  - UPDATE `apps/web/src/features/events/queries.graphql` — add `defaultLocation {...}` selection (Task 6).
  - REGENERATE `apps/web/src/generated/graphql.ts` — via `pnpm --filter web codegen` (Task 6).
  - No new files; no `apps/backend` changes; no database migration.
- **Rule Mapping:**
  - `story-split-gate.md` Gate 1/2/3 → run fresh (no epic readiness report for Epic 0.i6), all three no-gap (Architecture & UX Gate Findings above).
  - Data Type Compatibility rule (this workflow) → dedicated section above; no mismatch found, full rationale given (not a bare formality).
  - Reusable-component rule (this workflow) → explicitly confirmed `LocationLink` is not built by this story (already has its own story, 1.6d); no new reusable component introduced here.
  - Reusable-function rule (this workflow) → explicitly confirmed no new `packages/domain` logic; `isLocationTrustworthy` reused verbatim.
  - Locale-Sensitive Data Rendering rule (`project-context.md`) → `location.name` is caller-resolved data (place name/address), not an enum or numeric value, so no `Intl`/`next-intl` formatting step applies — matches the existing precedent for `Schedule.location`/`ticketPrice` free-form text fields.
- **Verification Plan:**
  - `pnpm --filter ui test` — `SubscribedAccountCard.test.tsx` (existing + new location-prop cases), `EventDetailView.test.tsx` (existing + new threading case) all green.
  - `pnpm --filter web test` — `mapper.test.ts` (existing + new `accountLocation` derivation cases), `queries.graphql.test.ts` (existing, confirmed unaffected) all green.
  - `pnpm --filter web codegen` run and generated output committed; `tsc`/lint clean for `packages/ui` and `apps/web`.
  - Manual/integration sanity: on a seeded event whose `sourceSocialMediaAccountProfile.defaultLocation` has `confidence >= 0.5` and `matchType === 'full_match'`, confirm the event-detail account card shows a clickable location link (pin icon + place name) instead of `@username`; on one with no `defaultLocation` or low confidence, confirm the card is visually unchanged from today.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — Tasks 1-7 match epics.md's Story 0.i6e ACs exactly, with the stale `:29` line reference corrected against current post-0.i6a code (AC1) and the "unconditional on location's own trustworthiness" reading of AC1 made explicit (see Dev Notes).
- [ ] Architecture and boundary confirmation — no `apps/backend`/database change; Gate 1/2/3 all no-gap (Architecture & UX Gate Findings above).
- [ ] Testing plan confirmation — Task 7 covers every new prop/derivation path across all three touched packages, plus regression checks on `queries.graphql.test.ts` and `mapper.test.ts`'s existing fixture.
- [ ] **Blocking prerequisite: Story 1.6d (`LocationLink`) must be implemented and merged before this story's Task 2 onward can compile.** As of this story's creation, `packages/ui/src/core/LocationLink.tsx` does not exist (`sprint-status.yaml`: `1-6d-build-the-reusable-locationlink-component: ready-for-dev`). Confirm 1.6d is done, or explicitly accept implementing it as a corequisite of this story, before starting `bmad-dev-story` on this story.
- [ ] **Explicit human approval state (Default: pending approval)** — final go-ahead to begin implementation is pending, to be confirmed at `bmad-dev-story` time, per this workflow's default.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — all three run fresh this session, all three no-gap; the one open item is the 1.6d sequencing dependency above (not a Gate 1/2/3 finding).

## Testing Requirements

- [ ] Component tests — `packages/ui/src/features/subscriptions/SubscribedAccountCard.test.tsx`: trustworthy `location` → `LocationLink`/`location.name` rendered instead of `@username` (including when `displayName`/`username` are both empty); untrustworthy `location` → unchanged `@username` fallback; absent `location` → unchanged existing behavior (regression).
- [ ] Component tests — `packages/ui/src/features/events/EventDetailView.test.tsx`: `accountLocation` prop threaded to `SubscribedAccountCard`'s `location` prop; existing tests remain green with the new optional prop omitted.
- [ ] Unit tests — `apps/web/src/features/events/mapper.test.ts`: `accountLocation` derivation for `placeName` present, `placeName` empty + `formattedAddress` present, both empty (→ `null`), `defaultLocation` entirely absent (→ `null`).
- [ ] Integration/regression check — `apps/web/src/features/events/queries.graphql.test.ts` (Story 3.7c AC1's list-view guard) confirmed unaffected by the `getEventBySlug`-only selection-set addition.
- [ ] E2E tests — not required; this is a presentational conditional-rendering change to an already-shipped, already-tested card + a query-selection-set addition, matching this component family's existing E2E-not-required precedent (Stories 0.i6a/0.i6f/1.6d).
- [ ] Migration verification — not applicable; no migration in this story (see Data Type Compatibility & Migration Requirements).
- [ ] Codegen verification — `pnpm --filter web codegen` run successfully; generated `graphql.ts` diff contains only the additive `defaultLocation` field, nothing else changed.

## Deliverables Checklist

- [ ] `SubscribedAccountCard` renders `LocationLink` (Story 1.6d) in place of the `@username` secondary line whenever `location` is present and `isLocationTrustworthy(location)` is true, regardless of `displayName`/`username` presence.
- [ ] `SubscribedAccountCard`'s untrustworthy/absent-`location` rendering is byte-for-byte unchanged from today.
- [ ] `SubscribedAccountCardProps`/`EventDetailViewProps` widened with the new optional `location`/`accountLocation` fields; `packages/ui`/`apps/web` type-check clean.
- [ ] `mapper.ts`'s `accountLocation` derivation implemented per AC3 (placeName-then-formattedAddress name resolution, empty-both → `null`).
- [ ] `getEventBySlug`'s `sourceSocialMediaAccountProfile` selection gains `defaultLocation {...}`; codegen regenerated.
- [ ] All Task 7 test additions passing; `queries.graphql.test.ts` and `mapper.test.ts`'s existing fixture default unmodified and still passing.
- [ ] Confirmed (manually or via test) that Post Selection/Subscribed Accounts settings adoption sites are unaffected (they don't exist in code yet — this is a forward-looking non-regression note, not a live check).

## Out of Scope

- **Story 0.i6b/0.i6c's own adoption work** (Post Selection, Subscribed Accounts settings) — neither exists in code yet; this story only wires the `location` prop at `EventDetailView.tsx`'s existing call site.
- **Story 1.6d's own implementation** (`LocationLink` itself) — this story consumes it but does not build it; see the Pre-Coding Approval Gate's blocking-prerequisite item.
- **Story 1.6e's event-detail schedule adoption of `LocationLink`** — separate story, separate call site (`ScheduleDetail.mapUrl` removal), untouched here.
- **Moderator Tools accounts-tab location editing/clearing** (IDEA-034) — a distinct Epic 4 surface, explicitly carved out of IDEA-032's scope already; not part of this story.
- **PostHog/analytics click tracking on the rendered `LocationLink`** — not specified by any AC in this story or its governing proposal (CC-021); matches Story 1.6d's own out-of-scope decision for the component itself.
- **`hasPendingDefaultLocationReview`/moderator-review-state UI** — this story only reads `defaultLocation`'s resolved value; any pending-review indicator is a separate, unrelated concern.
- **Storybook, visual-regression, or design-token tooling** — not set up anywhere in this project yet.

## Definition of Done

- [ ] All Acceptance Criteria (AC1-AC5) are met.
- [ ] Required tests passing (Task 7 + Testing Requirements) across `packages/ui` and `apps/web`.
- [ ] Lint and TypeScript strict-mode checks pass for `packages/ui` and `apps/web`.
- [ ] Codegen regenerated and committed with only the additive `defaultLocation` diff.
- [ ] Pre-Coding Approval Gate's explicit human approval state confirmed, and the Story-1.6d blocking prerequisite resolved, before this story is marked done.

## Completion Status

- [ ] Not started — story created and ready for `bmad-dev-story` (blocked on Story 1.6d's implementation, see Pre-Coding Approval Gate).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`, invoked directly with epic/story identifier `0.i6e`. `epics.md` already carried this story's full section (added by `bmad-correct-course`/CC-021 on 2026-09-15), but no `sprint-status.yaml` entry existed for `0-i6e` at invocation time (verified: `grep -n "0-i6e" sprint-status.yaml` returned nothing, while every other `0-i6*` sibling except this one already had an entry) — the same "epics.md section added, sprint-status.yaml registration deferred to a later bmad-create-story session" pattern already documented by Stories 1-6c/1-6d/CC-021's own note ("Not yet promoted to a story file — bmad-create-story is Phase 3"). This session registers it.
- No epic readiness report exists for Epic 0.i6 (same situation Stories 0.i6a/0.i6f already documented) — all three gates run fresh via one-shot subagent dispatch (evidence inlined from context already gathered in this session), all three returned "No gap found."
- **Hard blocking dependency found and NOT worked around:** Story 1.6d (`LocationLink`), a prerequisite this story's own epics.md text names explicitly, is `ready-for-dev` but not implemented — `packages/ui/src/core/LocationLink.tsx` does not exist. Rather than silently absorbing `LocationLink`'s implementation into this story's scope (which would violate this story's own boundary and duplicate 1.6d's already-fully-specified work) or blocking story creation entirely, this session followed the established `1-6c` precedent: create this story fully specified and `ready-for-dev`, with the block recorded as an explicit Pre-Coding Approval Gate checklist item for `bmad-dev-story` to resolve.
- No `AskUserQuestion` was raised. Every implementation decision in this story (the AC1 stale-line-number correction against current post-0.i6a code, the "unconditional on location's own trustworthiness" reading of AC1's literal text, the `placeName || formattedAddress` name-resolution priority, the `packages/ui` cross-package import pattern) followed directly from either explicit epics.md AC text, direct inspection of current code, or established precedent from sibling stories (0.i6a, 1.6d) already accepted by the user in this same epic — not an open judgment call requiring elicitation.

### Completion Notes List

_To be filled by the dev agent during implementation._

### File List

_To be filled by the dev agent during implementation._

## Change Log

- 2026-09-19: Story created via `bmad-create-story`, invoked directly with identifier `0.i6e`. Registered in `sprint-status.yaml` (was previously only referenced, not entried). Gate 1/2/3 all run fresh (no epic-0-i6 readiness report), all no-gap. Blocking prerequisite on Story 1.6d's implementation recorded explicitly.
