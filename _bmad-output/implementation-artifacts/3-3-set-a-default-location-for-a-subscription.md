# Story 3.3: Set a default location for a subscription

## Story Details

- Epic: 3
- Story ID: 3.3
- Story Key: 3-3-set-a-default-location-for-a-subscription
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to be able to set a default location on an account I'm subscribed to, if it doesn't have one yet,
so that the system can use this location if it cannot find an explicit location in a post.

## Acceptance Criteria

1. **Given** I am on `/settings/subscriptions` (Story 3.2) and one of my active subscriptions' account has no `SocialMediaAccountProfile.defaultLocation` set yet, **when** the row renders, **then** I see a "Set Default Location" action in place of a location value. [epics.md AC, Amendment 2]
2. **And** clicking it opens Story 3.3d's `LocationPickerField`/map-sheet (address-autocomplete search, "use my current location", "pick on map" — matching the Saved Locations experience for consistency), prefilled with nothing. [epics.md AC, Amendment 2]
3. **And** confirming a location persists it onto that account's `SocialMediaAccountProfile.defaultLocation` (never onto the `Subscription` row) via a new `setAccountDefaultLocation(accountId: ID!, input: SetAccountDefaultLocationInput!): SocialMediaAccountProfile!` mutation — **built and owned by this story**, backend-GraphQL-only (never a direct DB write from `apps/web`), reusing `packages/domain`'s `resolveLocationInputMode`/Story 0.16's Geolocation adapter exactly as `createUserLocation`/`updateUserLocation` already do (`SetAccountDefaultLocationInput` omits the blind-geocode `address` mode those mutations support, since Story 3.3d's UI always resolves through a selected `placeId` or explicit coordinates, never a raw typed address string). [epics.md AC, Amendment 2]
4. **And** once set, the AI extraction pipeline (Story 3.6, already implemented as an AC there) uses it as a fallback when a post has no explicit location — no change needed in this story. [epics.md AC]
5. **And** if the account's `defaultLocation` is already set (by any previous subscriber, including this story's own prior write), the row shows the existing formatted value read-only instead of the "Set Default Location" action — surfaced via a small extension to Story 3.2's `getMySubscriptions` query, adding `defaultLocation` to its `account { ... }` selection; editing an already-set value is Story 3.3b, not this story. [epics.md AC]
6. **And** calling `setAccountDefaultLocation` for an account whose `defaultLocation` is already set is rejected server-side with a `GraphQLError` (`extensions.code = 'INVALID_STATE_TRANSITION'`) — defense in depth, since the UI already hides the action once set; a real edit must go through Story 3.3b's moderation-gated path, not this mutation reused uncontrolled. [epics.md AC, Derived]
7. **And** `setAccountDefaultLocation` requires the caller to be an active subscriber of the target account (`requireAuth`, Story 0.17, plus an `activeOnly(subscriptions)` check, Story 0.22) — an authenticated user cannot set another account's default location without being subscribed to it. [epics.md AC]
8. **And** all user-facing strings (action label, picker labels, success/error toasts) are sourced through next-intl from Story 3.2's existing `SubscriptionsPage` namespace, with new entries added to both `apps/web/locales/en.json` and `apps/web/locales/id.json`. [project-context.md i18n rule, persistent fact]
9. **And** the save action is wrapped in `BlockingLoader` (a critical, persisted mutation), per `project-context.md`'s Loaders rule. [persistent fact]
10. **And** a `subscription_default_location_set` (`{ accountId }`) PostHog analytics event fires on successful save. [persistent fact — AD-5]

## Tasks / Subtasks

- [ ] **Task 1: Backend — `SetAccountDefaultLocationInput` and `setAccountDefaultLocation` schema** (AC: 3, 6, 7)
  - [ ] **Sequencing check (Pre-Coding Approval Gate item):** confirm Story 3.1a (`social-media-accounts.graphql`, `subscribe-to-account.ts`) and Story 3.2 (`subscriptions.graphql`'s `Subscription.account` field resolver, `getMySubscriptions`, `SubscriptionsContent`) have landed before starting — this story extends both files.
  - [ ] Extend `apps/backend/src/schema/social-media-accounts.graphql` (Story 3.1a's file):
    ```graphql
    input SetAccountDefaultLocationInput {
      placeId: String
      latitude: Float
      longitude: Float
    }

    extend type Mutation {
      setAccountDefaultLocation(accountId: ID!, input: SetAccountDefaultLocationInput!): SocialMediaAccountProfile!
    }
    ```
    Reuses the existing `SocialMediaAccountProfile`/`LocationDetails` types — does not redeclare either.
  - [ ] Run `pnpm --filter backend run codegen` to regenerate `apps/backend/src/generated/resolvers-types.ts`.
- [ ] **Task 2: Backend — `setAccountDefaultLocation` resolver** (AC: 3, 6, 7)
  - [ ] In `apps/backend/src/schema/resolvers.ts`, add `setAccountDefaultLocation` to the `Mutation` map: `requireAuth(context)`; look up the caller's active subscription to `accountId` via `activeOnly(subscriptions)` scoped to `eq(subscriptions.userId, authUser.userId)` and `eq(subscriptions.accountId, accountId)` — throw `NOT_FOUND` (matching `removeSubscription`'s ownership-scoping precedent) if none exists; look up the `social_media_account_profiles` row by `id = accountId` — throw `NOT_FOUND` if absent; if `defaultLocation` is already non-null, throw `GraphQLError('Default location already set', { extensions: { code: 'INVALID_STATE_TRANSITION' } })`; otherwise call `resolveLocationInputMode(input)` (imported from `@festgrid/domain/user-locations`, already used by `createUserLocation`/`updateUserLocation`) to branch on `PLACE_ID`/`COORDINATES` mode, call `resolveLocation(...)` (from `../lib/geolocation/adapter.js`) to produce a full `LocationDetails`, `UPDATE social_media_account_profiles SET default_location = ...` for the row, and return the updated profile with `defaultLocation` run through the existing `formatLocationDetails()` helper (matching `socialMediaAccountProfileByAccountId`'s handling, Story 3.1a Task 9) via `buildOptimizedDrizzleSelect(socialMediaAccountProfiles, info)`.
  - [ ] Create `apps/backend/src/schema/social-media-accounts.test.ts` (or extend if Story 3.1a's own equivalent test file already exists at implementation time) covering: happy path via `placeId`; happy path via `latitude`/`longitude`; rejects with `INVALID_STATE_TRANSITION` when `defaultLocation` is already set; rejects with `NOT_FOUND` when the caller has no active subscription to the account; rejects with `NOT_FOUND` for a non-existent `accountId`; requires authentication.
- [ ] **Task 3: Backend — cross-amend Story 3.2's `Subscription.account` field resolver and `getMySubscriptions` query to expose `defaultLocation`** (AC: 5)
  - [ ] In `apps/backend/src/schema/resolvers.ts`'s `Subscription.account` field resolver (Story 3.2's Task 3 deliverable): confirm/ensure `defaultLocation`, when selected and non-null, is run through `formatLocationDetails()` before being returned — mirroring `socialMediaAccountProfileByAccountId`'s existing handling (Story 3.1a Task 9). If Story 3.2 has already landed without this transform on this specific field, add it here rather than duplicating the field resolver.
  - [ ] Extend `apps/web/src/features/subscriptions/queries.graphql`'s `getMySubscriptions` operation (Story 3.2's file) to add `defaultLocation { coordinates { lat lng } formattedAddress placeName } ` inside its existing `account { ... }` selection.
  - [ ] Re-run `pnpm --filter web run codegen` to regenerate `apps/web/src/generated/graphql.ts` with the updated `GetMySubscriptionsQuery` shape.
- [ ] **Task 4: Frontend — GraphQL mutation and codegen** (AC: 3)
  - [ ] Add to `apps/web/src/features/subscriptions/mutations.graphql` (Story 3.2's file):
    ```graphql
    mutation setAccountDefaultLocation($accountId: ID!, $input: SetAccountDefaultLocationInput!) {
      setAccountDefaultLocation(accountId: $accountId, input: $input) {
        id
        defaultLocation {
          coordinates {
            lat
            lng
          }
          formattedAddress
          placeName
        }
      }
    }
    ```
  - [ ] Run `pnpm --filter web run codegen` to regenerate the new `useSetAccountDefaultLocationMutation` hook.
- [ ] **Task 5: Frontend — "Set Default Location" row action** (AC: 1, 2, 3, 5, 8, 9, 10)
  - [ ] Extend `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx` (Story 3.2's file): per row, if `account.defaultLocation` is absent, render a "Set Default Location" button (inline, matching this app's established inline-row convention — `locations-content.tsx` — no extracted row component, confirmed no Gate 2 gap for this specific trigger/display piece); if present, render the formatted `defaultLocation.formattedAddress`/`placeName` read-only instead.
  - [ ] Create `apps/web/src/app/[locale]/settings/subscriptions/set-default-location-dialog.tsx` (`"use client"`): a `Dialog`/`Sheet` (matching `LocationFormDialog`'s modal convention) hosting Story 3.3d's `LocationPickerField` and map-picker-sheet components; owns the `useAddressAutocompleteQuery`/`usePreviewLocationQuery`/`useCurrentLocationCapture` orchestration itself (per Story 3.3d's controlled-component contract — `packages/ui`'s components take data/callbacks as props, `apps/web` owns the actual query hooks), passing suggestions/loading/preview state and callbacks down as props.
  - [ ] On confirm: call `useSetAccountDefaultLocationMutation` with the resolved `placeId` or `latitude`/`longitude`, wrapped in `BlockingLoader`; on success, invalidate/refetch `getMySubscriptions` (or optimistically update the row's `account.defaultLocation`), fire `subscription_default_location_set` (`{ accountId }`) via `usePostHog()`, show a success toast, and close the dialog; on error, show an error toast and keep the dialog open.
  - [ ] Create `set-default-location-dialog.test.tsx` and extend `subscriptions-content.test.tsx` (Vitest + Testing Library + `msw`): row shows "Set Default Location" when `account.defaultLocation` is absent; row shows the formatted read-only value when present (no action rendered); happy path (via a mocked suggestion selection) closes the dialog and updates the row without a full reload; failure path shows an error toast and keeps the dialog open.
- [ ] **Task 6: i18n — `SubscriptionsPage` namespace additions** (AC: 8)
  - [ ] Add to the existing `SubscriptionsPage` object in `apps/web/locales/en.json` (Story 3.2's namespace): `setDefaultLocationLabel`, `defaultLocationSetToast`, `defaultLocationErrorToast`, plus any labels the picker dialog itself needs (e.g. `defaultLocationDialogTitle`).
  - [ ] Mirror every new key into `apps/web/locales/id.json` with real Indonesian translations.
- [ ] **Task 7: Verification** (AC: all)
  - [ ] `pnpm --filter backend run test`, `pnpm --filter web run test` pass, including all new/extended test files, with no regression in existing suites (including Story 3.2's own `subscriptions-content.test.tsx`).
  - [ ] `pnpm build` and `pnpm lint` clean at the repo root, including new generated GraphQL types.
  - [ ] Manual smoke check (Completion Notes): as a user subscribed to an account with no default location, see the "Set Default Location" action on its row; open the picker, search an address, select a suggestion, confirm — see the row update to show the formatted address without a reload; as a user subscribed to an account that already has a default location (e.g. set by another test user), confirm the row shows the read-only value and no "Set Default Location" action; attempt a direct `setAccountDefaultLocation` call against an already-set account via a GraphQL client and confirm `INVALID_STATE_TRANSITION`.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3:** Sourced from the swept `epic-3-readiness.md` (`swept: true`, re-run 2026-08-07, explicitly lists `3.3` in `stories_covered`) — no Gate 1 gap (this story writes exclusively through a backend GraphQL mutation, never a direct DB/domain call from `apps/web`; reuses Story 0.16's Geolocation adapter rather than calling Geoapify directly); no Gate 3 gap specific to this story (it introduces no new cross-cutting/foundational dependency — `resolveLocationInputMode`/Geolocation adapter/`activeOnly` all already exist and are reused as-is).
  - **Lightweight guard (fresh, story-specific) — found one real gap the sweep could not have anticipated, since it only surfaced while re-reading this story's own AC against the two forms it originally implied it lived on:** the original AC's "an optional field... filling out the subscription form" is technically unsatisfiable as written — its own "read-only if already set" clause requires knowing the account's pre-existing state *before* the field renders, but Story 3.1's wizard step and Story 3.2's subscribe dialog are both blind add-forms (platform + handle, submit) with no pre-submit account lookup, and the account row may not exist yet at that point. Cross-checked against `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s "Default Location for a Subscribed Account" flow, which independently describes this exact feature as a separate "Set/Edit Default Location" row action on the already-subscribed accounts list (`/settings/subscriptions`) — a design that *can* satisfy the read-only-if-set condition, since the row already has the account's current data loaded. Presented to the user via `AskUserQuestion`; user confirmed relocating the field to the subscriptions-list row action (see epics.md's Amendment 2, this story's rewrite) over extending Story 3.1/3.2's blind forms with a new pre-submission lookup step. See epics.md Story 3.3's Amendment 2 for full detail.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent persona Freya, against `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`'s row-action description and the two location-picker consumers now in play. **Verdict: gap found and split off.** A second `AskUserQuestion` confirmed the user wants this story's location picker to reuse the full Saved-Locations-style experience (address-autocomplete search, "use my current location", "pick on map") rather than a simpler plain-text/blind-geocode field, for UX consistency. That experience exists today only as ~250 lines of non-extracted, non-trivial async/stateful logic inline inside `location-form-dialog.tsx`/`map-picker-sheet.tsx` (Stories 2.3/2.4, neither in `packages/ui`) — reuse-across-≥2-places plus non-trivial state (loading/error/empty suggestions, geolocation capture, map interaction) is the textbook Gate 2 trigger per `story-split-gate.md`, confirmed by Freya's pass rather than a borderline call. Split into new **Story 3.3d** (`3-3d-build-the-reusable-locationpickerfield-component`), positioned immediately before this story in `epics.md`; a new `sprint-status.yaml` `backlog` entry was added. Freya's pass also confirmed the row-level trigger/read-only-value display itself does **not** need extraction — single consumer (this story only), trivial state, matches `locations-content.tsx`'s established inline-row convention — kept inline in `subscriptions-content.tsx` (Task 5).
  - **A related finding surfaced by the same pass, folded into Story 3.3d's scope rather than split further:** `MapView` (the raw MapLibre primitive) is not actually in `packages/ui` today, despite Story 2.4a's own original AC requiring it — a pre-existing, unrelated gap, not new scope this story invents. Since `packages/ui` cannot import from `apps/web`, relocating `MapView` is a forced, non-optional consequence of Story 3.3d's extraction (confirmed via the same Freya pass as not warranting its own separate story, since the two must land together regardless).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding: no new DB schema/migration required by this story.** `social_media_account_profiles.default_location` (jsonb, nullable, typed as `LocationDetails`) already exists — added by Story 3.1a's migration. This story only adds a new GraphQL mutation/input that writes into that existing column via the existing Drizzle table; no `packages/database/schema.ts` change.
- **Impacted contracts:** new GraphQL `SetAccountDefaultLocationInput` type and `setAccountDefaultLocation` mutation, added to Story 3.1a's `social-media-accounts.graphql` file (not redeclared elsewhere); Story 3.2's `getMySubscriptions` query (`apps/web/src/features/subscriptions/queries.graphql`) extended to select `defaultLocation` on `account`; new `apps/web/src/features/subscriptions/mutations.graphql` operation. Generated counterparts: `apps/backend/src/generated/resolvers-types.ts`, `apps/web/src/generated/graphql.ts` (new `useSetAccountDefaultLocationMutation` hook, updated `GetMySubscriptionsQuery` shape). No `packages/shared-types` change — `SocialMediaAccountProfile.defaultLocation?: LocationDetails` (Story 3.1a) already has the correct shape.
- **Required DB migration changes:** none.
- **Required TypeScript type changes:** none beyond the new codegen output above.
- **Backward compatibility and rollout notes:** purely additive — a new mutation and a widened query selection on Story 3.2's already-additive schema extensions; no existing contract changes. `Subscription.account`'s field resolver (Story 3.2) is extended to format an already-nullable field it already returns the parent object for — not a breaking change to any existing consumer.
- **Verification checks:** Task 2's `social-media-accounts.test.ts` asserts `setAccountDefaultLocation`'s two input modes, the `INVALID_STATE_TRANSITION` idempotency guard, the active-subscriber authorization check, and the auth requirement; Task 5's frontend tests assert the row's conditional action/read-only rendering and the end-to-end save flow.

### Project Structure Notes

- **This story has real code dependencies on Story 3.2 and Story 3.3d, neither of which is `done` as of this story's creation** (`3-2-...` is `ready-for-dev`; the new `3-3d-...` is `backlog`) — it extends files Story 3.2 creates (`subscriptions.graphql`'s `Subscription.account` resolver, `subscriptions-content.tsx`, `queries.graphql`/`mutations.graphql`) and consumes components Story 3.3d creates (`LocationPickerField`, the map-picker-sheet equivalent). Do not start Tasks 3-5 until both have landed.
- New backend: `apps/backend/src/schema/social-media-accounts.test.ts` (or extended, if Story 3.1a already created an equivalent file).
- Modified backend: `apps/backend/src/schema/social-media-accounts.graphql` (Story 3.1a's file — new input + `extend type Mutation`); `apps/backend/src/schema/resolvers.ts` (new `setAccountDefaultLocation` resolver; confirm/extend `Subscription.account`'s `formatLocationDetails` handling).
- New frontend: `apps/web/src/app/[locale]/settings/subscriptions/set-default-location-dialog.tsx` + `set-default-location-dialog.test.tsx`.
- Modified frontend: `apps/web/src/features/subscriptions/{queries.graphql, mutations.graphql}` (Story 3.2's files); `apps/web/src/app/[locale]/settings/subscriptions/subscriptions-content.tsx` + its test file (Story 3.2's files); `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- **No conflicts detected** with Story 3.3b's future edit-path work — this story only ever writes `defaultLocation` from `null`, never overwrites an existing value (enforced server-side by AC6), so there is no shared-write race with Story 3.3b's separate moderation-gated edit mutation once that story exists.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3] — this story's authoritative AC and both Amendment notes (2026-08-01 scope narrowing; 2026-08-08 field-placement/mutation-ownership rewrite, added during this story's own creation).
- [Source: _bmad-output/planning-artifacts/epics.md#Story-3.3d] — the new prerequisite this story consumes for its location picker.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-3-readiness.md] — the swept Gate 1/3 sweep this story cites (`stories_covered` includes `3.3`).
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — "Default Location for a Subscribed Account" user flow (the row-action design this story follows) and "Default Location Pending Review" (Story 3.3b's future edit-path pattern, referenced for boundary clarity only).
- [Source: _bmad-output/implementation-artifacts/3-1a-create-social-media-account-profiles-table.md] — `social_media_account_profiles.default_location` column, `formatLocationDetails`/`buildOptimizedDrizzleSelect` conventions this story's resolver follows.
- [Source: _bmad-output/implementation-artifacts/3-2-subscribe-to-a-social-media-account.md] — `subscriptions-content.tsx`, `Subscription.account` field resolver, `getMySubscriptions`/`mutations.graphql` this story extends.
- [Source: apps/backend/src/schema/resolvers.ts] — `createUserLocation`/`updateUserLocation`'s `resolveLocationInputMode`/`resolveLocation`/`formatLocationDetails` pattern this story's `setAccountDefaultLocation` resolver mirrors.
- [Source: packages/domain/src/user-locations/validateLocationInput.ts] — `resolveLocationInputMode`, reused as-is (structurally typed, no changes needed for the narrower `SetAccountDefaultLocationInput` shape).
- [Source: apps/web/src/app/[locale]/settings/locations/location-form-dialog.tsx] — the location-acquisition UX (address search/current-location/map-pick) this story's picker dialog reuses via Story 3.3d's extracted components.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Loaders (`BlockingLoader` on save), State Management (Server State via React Query/codegen, `packages/ui` components stay presentational per Story 3.3d), i18n rules, Optimized DB Queries (`buildOptimizedDrizzleSelect`/`formatLocationDetails`).
- [x] `story-content-structure.md` — canonical section order followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-5 (analytics event naming), AD-6 (i18n), AD-7 (`requireAuth` as the single enforcement surface).
- [x] `docs/infrastructure/index.md` — no infra/deployment change in this story (pure application-layer GraphQL + frontend, reusing Story 0.16's already-provisioned Geolocation adapter).

## Implementation Plan (Rule-Compliant)

### File Change Plan

- **New:** `apps/backend/src/schema/social-media-accounts.test.ts` (or extended); `apps/web/src/app/[locale]/settings/subscriptions/{set-default-location-dialog.tsx, set-default-location-dialog.test.tsx}`.
- **Modified:** `apps/backend/src/schema/social-media-accounts.graphql` (Story 3.1a's file); `apps/backend/src/schema/resolvers.ts` (new `setAccountDefaultLocation` resolver, `Subscription.account` `formatLocationDetails` check); `apps/web/src/features/subscriptions/{queries.graphql, mutations.graphql}` (Story 3.2's files); `apps/web/src/app/[locale]/settings/subscriptions/{subscriptions-content.tsx, subscriptions-content.test.tsx}` (Story 3.2's files); `apps/web/locales/{en,id}.json`; `apps/web/src/generated/graphql.ts` and `apps/backend/src/generated/resolvers-types.ts` (codegen output).
- **Not modified:** `packages/database/schema.ts` (no schema change — `default_location` already exists); `packages/shared-types` (reuses Story 3.1a's `SocialMediaAccountProfile.defaultLocation` shape); `packages/domain` (reuses `resolveLocationInputMode` as-is, no changes).

### Rule Mapping

- Backend-only mutation layer, never a direct DB/domain write from `apps/web` → `story-split-gate.md` Gate 1 → `setAccountDefaultLocation` resolver (Task 2), consumed only via the generated hook (Task 4).
- Reuse over reinvention (`resolveLocationInputMode`, Story 0.16's `resolveLocation`, `formatLocationDetails`, `activeOnly`, Story 3.3d's `LocationPickerField`) → this story's Gate Findings + epics.md Amendment 2 → Tasks 2, 5.
- Field-placement/mutation-ownership correction (blind subscribe form → subscriptions-list row action) → lightweight guard finding, user-confirmed via `AskUserQuestion` → epics.md Amendment 2, AC1-3/5.
- UI reuse split (full location-picker experience) → Gate 2 finding, user-confirmed via `AskUserQuestion` → Story 3.3d dependency, Task 5.
- Non-blocking-vs-blocking loaders → `project-context.md` Loaders rule → `BlockingLoader` on save (Task 5).
- i18n, no hardcoded strings → `project-context.md` i18n rules → Task 6.
- PostHog analytics events named/payload-shaped explicitly → persistent fact (AD-5) → AC10/Task 5.
- Idempotency/state-transition guard (`INVALID_STATE_TRANSITION`) → AD-8-adjacent app convention (`deleteApiKey`/`removeSubscription` precedent) → AC6/Task 2.

### Verification Plan

- `apps/backend/src/schema/social-media-accounts.test.ts`: both input modes, `INVALID_STATE_TRANSITION` guard, active-subscriber authorization, auth requirement (Task 2).
- `apps/web/.../subscriptions-content.test.tsx` (extended), `set-default-location-dialog.test.tsx`: conditional row rendering, happy/unhappy save paths (Task 5).
- `pnpm build`, `pnpm lint`, full test suite at repo root — no regressions, including Story 3.2's and Story 3.3d's own test suites (this story extends files they own/create).

## Pre-Coding Approval Gate

- [ ] Scope confirmation: this story builds the `setAccountDefaultLocation` mutation and the "Set Default Location" row action + picker dialog on Story 3.2's `/settings/subscriptions` page. It does not build the onboarding wizard/subscribe forms (Stories 3.1/3.2), editing an already-set default location (Story 3.3b), or the reusable location-picker components themselves (Story 3.3d, a separate prerequisite).
- [ ] Architecture and boundary confirmation: `setAccountDefaultLocation` confined to `apps/backend`'s GraphQL layer, reusing Story 0.16's Geolocation adapter; no direct DB/external-API access from `apps/web`; no new `packages/domain` logic added (reuses `resolveLocationInputMode` as-is).
- [ ] **Sequencing confirmation (specific to this story):** confirm Story 3.2 (`subscriptions-content.tsx`, `Subscription.account` resolver, `getMySubscriptions`/`mutations.graphql`) and Story 3.3d (`LocationPickerField`, the map-picker-sheet equivalent, relocated `MapView`) are implemented before starting Tasks 3-5 — neither is `done` as of this story's creation (3.2 is `ready-for-dev`; 3.3d is `backlog`).
- [ ] Testing plan confirmation: backend integration tests (Task 2), frontend integration tests (Task 5) as scoped above.
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: Gate 1/3 sourced from swept `epic-3-readiness.md` (no gap); lightweight guard found the original AC's field-placement was technically unsatisfiable and relocated it to the subscriptions-list row action (user-confirmed via `AskUserQuestion`, see epics.md Amendment 2); Gate 2 run fresh via Freya, confirmed the full location-picker experience (user-confirmed via a second `AskUserQuestion`) requires splitting off Story 3.3d, and confirmed the row trigger/read-only display itself does not need extraction.
- [ ] Explicit human approval state (Default: **pending approval**).

## Testing Requirements

- [ ] Backend integration tests (`social-media-accounts.test.ts`): `setAccountDefaultLocation`'s `placeId`/coordinate input modes, `INVALID_STATE_TRANSITION` on an already-set account, `NOT_FOUND` for a non-subscriber/non-existent account, auth requirement.
- [ ] Frontend integration tests: `subscriptions-content.test.tsx` (extended — conditional "Set Default Location" action vs. read-only value rendering), `set-default-location-dialog.test.tsx` (happy/unhappy save paths).
- [ ] E2E: not required as a dedicated flow per `project-context.md`'s testing-trophy philosophy — integration coverage above satisfies the Definition of Done; the manual smoke check in Task 7 substitutes for a scripted E2E given the cross-story (3.2/3.3d) dependencies.

## Deliverables Checklist

- [ ] `setAccountDefaultLocation` mutation, fully tested, extending Story 3.1a's `social-media-accounts.graphql`.
- [ ] `Subscription.account`'s `defaultLocation` field correctly formatted and selectable via `getMySubscriptions` (Story 3.2 extension).
- [ ] "Set Default Location" row action + `SetDefaultLocationDialog`, both integration tested, consuming Story 3.3d's `LocationPickerField`.
- [ ] `SubscriptionsPage` i18n additions in both `en.json` and `id.json`.
- [ ] `subscription_default_location_set` PostHog event wired via `usePostHog()`.

## Out of Scope

- The onboarding wizard and subscribe forms themselves — Stories 3.1/3.2, unmodified beyond the specific extensions listed in this story's File Change Plan.
- Editing/overwriting an already-set default location, and the moderator-review flow that comes with it — Story 3.3b.
- The reusable `LocationPickerField`/map-picker-sheet components and the `MapView` relocation into `packages/ui` — Story 3.3d, a separate prerequisite this story depends on and consumes, not builds.
- Any change to Story 3.6's AI-extraction fallback logic — already implemented there; this story only ever populates the data that logic reads.
- Live scrape-based account validation, richer autocomplete-for-existing-accounts subscribe UX — inherited, already-documented gaps from Stories 3.1/3.2's own Out of Scope; unrelated to this story's default-location scope.

## Definition of Done

- [ ] AC1-10 satisfied and demonstrated via the tests in Testing Requirements.
- [ ] Backend and frontend test suites pass; no regression in existing suites (including Story 3.2's and Story 3.3d's own test suites once implemented).
- [ ] `pnpm build` and `pnpm lint` clean for all touched packages.
- [ ] `en.json`/`id.json` both updated — no hardcoded user-facing strings.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
