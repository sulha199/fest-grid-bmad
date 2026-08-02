# Story 2.1: Favorite an event

## Story Details

- Epic: 2 - User Personalization
- Story ID: 2.1
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want to be able to favorite an event from its detail page,
so that I can easily find it later.

## Acceptance Criteria

1. **Given** I am viewing the details of an event as an authenticated user, **when** I click the Favorite (heart) icon, **then** the event is marked as a favorite: the icon fills in, `aria-pressed` becomes `true`, and its accessible label switches from "Add to Favorites" to "Remove from Favorites" — this is an icon state change, not a text-label button swap (per `01.2-event-detail.md`'s UX spec).
2. **And** the change is reflected immediately (optimistic UI) while the `toggleFavorite` mutation (Story 2.1a) is in flight, without a full-screen blocking loader — see Dev Notes → Loader Classification.
3. **And** when I click the icon again while it is favorited, the event is unfavorited: the icon reverts to its outline state, `aria-pressed` becomes `false`, and the accessible label reverts to "Add to Favorites".
4. **And** only authenticated users can favorite or unfavorite an event. An unauthenticated user who clicks the icon is redirected to `/login`; no mutation is attempted and no optimistic state change occurs. See Dev Notes → Unauthenticated Click Behavior for the rationale and the Pre-Coding Approval Gate item confirming this UX decision.
5. **And** if the `toggleFavorite` mutation fails, the icon reverts to its pre-click state (rollback) and an error is announced via the same accessible live-region mechanism used for success (see AC6) — the user is never left looking at an optimistic state that silently failed to persist.
6. **And** all user-facing labels (`favoriteButtonLabel`, `removeFavoriteButtonLabel` — both already defined in the `EventDetailsPage` next-intl namespace, `en`/`id`, from Story 1.6a) and the new success/error live-region announcement strings (see Dev Notes → i18n Keys Required) are localized using next-intl. No hardcoded user-facing strings.
7. **And** integration tests (Vitest + msw, `apps/web`) verify: optimistic favorite/unfavorite toggling, mutation-failure rollback, and the unauthenticated-click redirect. One E2E test (Playwright) covers the authenticated happy path: open event details → favorite → icon reflects favorited state → unfavorite → icon reverts.

## Tasks / Subtasks

- [ ] Task 1: Extend the event-detail GraphQL query and add the mutation document (AC1, AC3)
  - [ ] Add `isFavorited` to `getEventBySlug`'s selection set in `apps/web/src/features/events/queries.graphql`.
  - [ ] Add a new `apps/web/src/features/events/mutations.graphql` with `mutation toggleFavorite($eventId: ID!) { toggleFavorite(eventId: $eventId) { eventId isFavorited } }`, matching Story 2.1a's `ToggleFavoriteResult` contract exactly (`eventId`, `isFavorited` — no other fields).
  - [ ] Run `pnpm run codegen` at the repo root to generate `useToggleFavoriteMutation` in `apps/web/src/generated/graphql.ts`, following the same `graphql-request` + `@tanstack/react-query` v5 pattern already used by `useGetEventBySlugQuery`/`useMeQuery`. **Blocked until Story 2.1a's `Mutation.toggleFavorite` and `Event.isFavorited` are merged** — see Dev Notes → Data Type Compatibility.
- [ ] Task 2: Wire the favorite toggle into `EventDetailWrapper` (AC1, AC2, AC3, AC4, AC5)
  - [ ] In `apps/web/src/features/events/mapper.ts`, extend `mapGraphQLEventToDetailViewProps` to accept and pass through `isFavorited` (from the query) — do not compute it there; it is server-authoritative data, passed straight through.
  - [ ] In `apps/web/src/features/events/EventDetailWrapper.tsx`, add `useToggleFavoriteMutation` (react-query mutation) and an `onFavoriteToggle` handler passed to `<EventDetailView>`.
  - [ ] Auth gate: read `session` from `useAuthSession()` (`apps/web/src/components/providers/auth-session-provider.tsx`); if `!session`, `router.push('/login')` and return early — no mutation call, no optimistic update (AC4).
  - [ ] Optimistic update: on click (authenticated), immediately flip the cached `isFavorited` value via `queryClient.setQueryData(['getEventBySlug', { slug }], ...)` (this is the exact query key the codegen'd `useGetEventBySlugQuery` hook uses — confirmed in `apps/web/src/generated/graphql.ts`), then fire the mutation.
  - [ ] Rollback: on mutation error, revert the cached value to its pre-click state and surface the error via the live-region (Task 3) (AC5).
  - [ ] On mutation success, reconcile the cache with the server-returned `isFavorited` (do not blindly trust the optimistic value — trust the mutation response).
- [ ] Task 3: Accessible success/error feedback (AC5, AC6)
  - [ ] Add a visually-hidden `aria-live="polite"` status region (co-located in `EventDetailWrapper` or a small shared spot) that announces the new i18n strings on toggle success/failure — see Dev Notes → Feedback Mechanism Decision for why this replaces a toast (no toast library exists in this codebase; not introducing one here).
  - [ ] Add the new i18n keys (Dev Notes → i18n Keys Required) to both `apps/web/locales/en.json` and `apps/web/locales/id.json` under the existing `EventDetailsPage` namespace.
- [ ] Task 4: Analytics (AC — supports observability, not a numbered AC but required by `project-context.md` AD-5)
  - [ ] Fire `posthog.capture('event_favorited', { eventId, eventName })` / `posthog.capture('event_unfavorited', { eventId, eventName })` **on mutation success only** (not optimistically), mirroring the existing `event_details_viewed`/`filter_applied` capture pattern in this codebase.
- [ ] Task 5: Testing (AC7)
  - [ ] Integration tests: new `apps/web/src/features/events/EventDetailWrapper.test.tsx` using msw to mock `getEventBySlug` and `toggleFavorite`, covering optimistic toggle, error rollback, and the unauthenticated-redirect path.
  - [ ] One Playwright E2E happy-path test covering authenticated favorite → unfavorite from the event detail page.
  - [ ] Manual verification: `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root for touched packages.

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`, `2.1` listed in `stories_covered`). No new gaps — the backend/API layer this story needs is Story 2.1a, already correctly positioned immediately before this story in `epics.md`/`sprint-status.yaml`.
- **Gate 2 (UI Complexity & Reusability):** Run fresh via subagent against `design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.2-event-detail/01.2-event-detail.md` and `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md`. **No gap found.** The reusable presentation component this story needs — `packages/ui/src/features/events/EventDetailView.tsx` (built in Story 1.6a) — **already fully implements** the favorite heart-icon toggle: `isFavorited`/`onFavoriteToggle` props, `Heart` icon (lucide-react) with fill/outline classes, `aria-label`/`aria-pressed` swap via `labels.favoriteButtonLabel`/`labels.removeFavoriteButtonLabel`. It is presentation-only and currently **unwired** — `apps/web/src/features/events/mapper.ts` never passes `isFavorited`/`onFavoriteToggle` through. This story's entire scope is that wiring (integration work), not new reusable-UI construction, so it does not trip Gate 2's triggers. Confirmed separately: `packages/ui/src/features/events/EventCard.tsx` (Story 1.3b) has its own, distinct "Quick Favorite" slot (`isFavorited`/`onFavoriteToggle`) intended for the Discovery feed / Favorites list (Story 2.2), also unwired — **out of scope here**, see Out of Scope.
- **UX correction vs. `epics.md`'s AC shorthand:** `epics.md`'s Story 2.1 AC describes a "Favorite button" that changes to an "Unfavorite button" (implying a text-label swap). The authoritative UX artifact (`01.2-event-detail.md`, "Favoriting the Event") specifies a heart **icon** that fills in / reverts to outline — this is what `EventDetailView` already implements, and what the ACs above describe. No text-label button exists or should be built; the *accessible* label (`aria-label`) is what swaps, not visible button text.
- **"Soft Delete with Undo" pattern does NOT apply here.** `EXPERIENCE.md`'s "Soft Delete with Undo" pattern (grey-out + Undo toast, commit-on-navigate-away) is explicitly scoped to "unfavoriting an event **from a list**" — it solves the problem of an item visually disappearing out from under the user mid-scroll. The detail page is a single-item view with no list-removal problem; unfavoriting here is an instant, reversible icon toggle. This pattern belongs to Story 2.2 (Favorites list page), not this story. Confirmed via Gate 2 subagent review.
- **Escape hatch note:** none invoked — no gate raised a blocking gap for this story.

### Feedback Mechanism Decision

`EXPERIENCE.md`'s Voice and Tone section cites `"Event favorited"` as the model example of the required "immediate and clear feedback for user actions" microcopy, parallel to the Add-to-Calendar flow's `"Event has been added to your calendar"` confirmation. The UX scenario for favoriting itself only describes the icon fill as feedback (no toast is shown in the scenario). This codebase has **no toast/notification library** (`sonner`, `react-hot-toast`, etc. — none installed); the only existing precedent for "confirm an action to the user" is a plain `alert()` in `home-content.tsx`'s sign-out flow, which is not appropriate for a lightweight, frequent toggle action.

**Decision:** Use a visually-hidden `aria-live="polite"` status region that announces the localized success/error string (Task 3), in addition to the icon's visual fill/outline change. This satisfies Voice-and-Tone's feedback requirement, gives screen-reader users parity with the sighted icon-fill feedback, and avoids introducing a new UI dependency for a single story. This is a documented decision, not an implicit choice — confirm acceptable in the Pre-Coding Approval Gate, or direct that a toast be introduced instead.

### Unauthenticated Click Behavior

Neither the PRD nor the UX artifacts specify what happens when a signed-out user clicks the favorite icon (the Discovery page itself is browsable without login — see `home-content.tsx`'s conditional Sign In button — so a signed-out user can reach the event detail page). AC4 only requires that the action itself be gated to authenticated users.

**Decision:** Always render the favorite icon (do not hide it for signed-out users — hiding it would prevent feature discovery), but on click, if `!session`, redirect to `/login` (reusing the exact `router.push('/login')` pattern already used in `home-content.tsx`) instead of attempting the mutation or showing an inline error. This is a documented decision — confirm acceptable in the Pre-Coding Approval Gate, or direct an alternative (e.g. disabling the icon, or an inline "Sign in to favorite" prompt).

### i18n Keys Required (AD-6)

Existing (already present in `EventDetailsPage` namespace, `en.json`/`id.json`, from Story 1.6a — reused as-is, not modified):
- `favoriteButtonLabel` ("Add to Favorites" / "Tambah ke Favorit")
- `removeFavoriteButtonLabel` ("Remove from Favorites" / "Hapus dari Favorit")

New keys required (add to both `en` and `id` under `EventDetailsPage`):
- `favoriteSuccessAnnouncement` — e.g. en: "Event favorited", id: an equivalent Indonesian phrasing.
- `unfavoriteSuccessAnnouncement` — e.g. en: "Event removed from favorites".
- `favoriteErrorAnnouncement` — e.g. en: "Something went wrong. Please try again." (reuse existing tone from `EventDetailsPage.errorText` if a suitable generic string already fits; otherwise add a dedicated key).

### Analytics Events Required (AD-5)

- `event_favorited` — payload `{ eventId: string, eventName: string }`
- `event_unfavorited` — payload `{ eventId: string, eventName: string }`

Fired via the existing `usePostHog()` hook (`@festgrid/analytics`), on mutation **success** only (not optimistically), matching the existing `event_details_viewed` capture precedent in `EventDetailWrapper.tsx`. Firing on success (not on click) avoids recording phantom favorite/unfavorite events for actions that get rolled back due to a mutation error.

### State Management Categorization

`isFavorited` is **Server State** (`@tanstack/react-query` + `graphql-request`, per `project-context.md`'s State Management Architecture rule) — it is fetched via `getEventBySlug`, mutated via `toggleFavorite`, and the toggle is implemented as a react-query optimistic update against the `['getEventBySlug', { slug }]` query key (confirmed exact key shape by reading the generated `useGetEventBySlugQuery` hook in `apps/web/src/generated/graphql.ts`) followed by reconciliation on mutation settle. No URL state (`nuqs`) or Client Global State (`zustand`) is involved — this is purely per-event server-cached data.

### Loader Classification

**Non-blocking.** Per `project-context.md`'s UI Patterns & UX Invariants rule, this is not a "critical mutation" in the sense of the Blocking-loader examples (submitting a report, saving a location) — it is a lightweight, frequent, reversible toggle, and `01.2-event-detail.md`'s UX spec explicitly describes instant icon feedback, not a page-blocking wait state. Implement as a **localized** state on the icon button itself (e.g. reduced opacity / disabled pointer-events while the mutation is in flight, reverting via the optimistic-update + rollback flow in Task 2) — never a full-screen `BlockingLoader` overlay.

### Data Type Compatibility & Migration Requirements

- **No DB/schema changes in this story's own scope** — this story adds no tables, columns, or migrations.
- **Hard dependency, not yet satisfiable:** This story's `toggleFavorite` mutation call and `Event.isFavorited` field read require Story 2.1a's GraphQL schema additions (`type Mutation { toggleFavorite(eventId: ID!): ToggleFavoriteResult! }`, `Event.isFavorited: Boolean!`) to exist in `apps/backend/src/schema/*.graphql` **and** `pnpm run codegen` to have been re-run, before `apps/web/src/generated/graphql.ts` will contain a typed `useToggleFavoriteMutation` hook or an `isFavorited` field on `GetEventBySlugQuery`. As of this story's creation, Story 2.1a is `ready-for-dev` (not `done`) in `sprint-status.yaml` — Task 1's codegen step is blocked until then. This is a sequencing dependency, not a data-type mismatch requiring a fix.
- **Contract to implement against:** `toggleFavorite(eventId: ID!): ToggleFavoriteResult!` where `ToggleFavoriteResult { eventId: ID!, isFavorited: Boolean! }` — taken directly from Story 2.1a's story file (`2-1a-build-the-favorites-and-calendar-additions-backend-graphql-api-layer.md`), which is the authoritative contract (more authoritative than `epics.md`'s shorthand `toggleFavorite(eventId)` description).
- **Verification:** a type-check (`pnpm build`) after codegen proving `EventDetailWrapper.tsx`'s mutation call and `mapper.ts`'s `isFavorited` passthrough type-check against the generated types with no `any`/type assertions needed.

### Package boundaries

All work in this story is `apps/web` only: GraphQL operation documents (`.graphql` files), the wrapper component, the mapper, and locale JSON files. No `packages/domain` changes (there is no pure, framework-agnostic business logic to extract here — this is UI-to-API wiring with optimistic cache state, which is inherently react-query/React-coupled and does not belong in `packages/domain` per `project-context.md`'s Code Organization rule). No `packages/ui` changes (the component is already built and unwired — this story doesn't need to touch it).

### Architecture / technical constraints

- **AD-1/AD-2 (Unified Event Querying):** This story only *consumes* `Event.isFavorited` as a field on the existing `events`/`eventBySlug` queries — it does not add new query conditions or a new endpoint.
- **AD-7 (Authenticated Context):** The mutation itself enforces auth server-side (`requireAuth`, Story 2.1a). This story's client-side auth gate (AC4, redirecting unauthenticated clicks to `/login`) is a UX nicety on top of that server-side enforcement, not a substitute for it — never treat the frontend check as the security boundary.
- **GraphQL-only data path:** `apps/web` reaches favorite state exclusively through the GraphQL query/mutation, never a direct DB/domain import (AC4's "only authenticated users" is enforced server-side; this story adds no new bypass).

### Previous/Sibling Story Intelligence (Story 2.1a)

- Story 2.1a's own Dev Notes flagged that this story (`2-1-favorite-an-event.md`) was originally drafted before 2.1a existed and referenced an unspecified "GraphQL mutation contract" — this rewrite closes that gap by adopting 2.1a's actual, authoritative `toggleFavorite(eventId: ID!): ToggleFavoriteResult!` contract and its `Event.isFavorited: Boolean!` field.
- 2.1a's Gate 2 review (run fresh for that story) found that `EXPERIENCE.md`'s Soft-Delete-with-Undo pattern is a **frontend-only** timing concern for *unfavoriting from a list* (Story 2.2) and requires no special backend "pending" state — a plain idempotent `toggleFavorite` is sufficient. This story's own Gate 2 review (above) independently reached the same conclusion for the detail-page context and additionally confirmed the pattern doesn't apply here at all (not a list).
- 2.1a's mutation is transactional and **upserts** (never deletes/re-inserts) the underlying row — this story's optimistic-then-reconcile UI approach is compatible with that: repeated rapid toggling is safe server-side and this story's cache reconciliation on mutation success will always converge to the server's authoritative value.

### Git Intelligence Summary

Recent commits (`6148b78` auth/Supabase+OAuth config, `f612609`/`59f5c15` BlockingLoader artifact docs, `2a45f2c` parallel-route modal layout for event details, `bcdbb86` event metadata localization) are all frontend/auth/docs work; none touch `EventDetailWrapper.tsx`, `mapper.ts`, or the backend resolver layer since Story 1.3a. `2a45f2c`'s parallel-route modal layout confirms `EventDetailWrapper` is rendered from two entry points (`apps/web/src/app/[locale]/events/[slug]/page.tsx` full page, and `apps/web/src/app/[locale]/@modal/(.)events/[slug]/page.tsx` intercepted modal) — this story's wiring must work correctly from both, since both render the same `EventDetailWrapper` component with no favorite-specific branching needed (confirmed by reading `EventDetailWrapper.tsx`: the `isModal` prop only affects navigation-header/layout chrome, not the favorite control).

### Latest Tech Information

- `@tanstack/react-query` v5's optimistic-update pattern (`onMutate` + `queryClient.setQueryData` + rollback in `onError` + reconciliation in `onSuccess`/`onSettled`) is the standard, current approach for this exact use case — no deprecated v4 API surface (`useMutation`'s old callback shape) should be used.
- `graphql-codegen`'s `typescript-react-query` plugin (already configured, `reactQueryVersion: 5`) generates a `useToggleFavoriteMutation` hook with the same `(client, options?, headers?)` signature already seen on `useGetEventBySlugQuery`/`useMeQuery` — no new codegen configuration is needed once Story 2.1a's schema lands.

## Global Rules References

- `_bmad-output/project-context.md` (State Management Architecture, UI Patterns & UX Invariants, i18n rules, Analytics)
- `_bmad-output/planning-artifacts/story-content-structure.md`
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` (AD-1, AD-2, AD-7)
- `_bmad-output/planning-artifacts/epics.md` (Story 2.1, Story 2.1a, Story 1.6a, Story 1.3b)
- `_bmad-output/planning-artifacts/story-split-gate.md`
- `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md`
- `_bmad-output/implementation-artifacts/2-1a-build-the-favorites-and-calendar-additions-backend-graphql-api-layer.md` (authoritative mutation/field contract)
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` (§4.10 Favorite, §3.2.1)
- `design-artifacts/C-UX-Scenarios/01-sarahs-weekend-rescue/01.2-event-detail/01.2-event-detail.md`
- `design-artifacts/UX-festgrid-run-1/EXPERIENCE.md` (Voice and Tone, Soft Delete with Undo)
- `docs/infrastructure/index.md` (frontend-only story — no infra-shard read required beyond the index summary)

## Implementation Plan (Rule-Compliant)

### File Change Plan

- Modified: `apps/web/src/features/events/queries.graphql` (add `isFavorited` to `getEventBySlug`).
- New: `apps/web/src/features/events/mutations.graphql` (`toggleFavorite` mutation document).
- Regenerated (not hand-edited): `apps/web/src/generated/graphql.ts` (via `pnpm run codegen`, after Story 2.1a's schema lands).
- Modified: `apps/web/src/features/events/mapper.ts` (pass `isFavorited` through `mapGraphQLEventToDetailViewProps`).
- Modified: `apps/web/src/features/events/EventDetailWrapper.tsx` (mutation hook, optimistic update, auth gate, rollback, `aria-live` status region, analytics capture).
- Modified: `apps/web/locales/en.json`, `apps/web/locales/id.json` (new `EventDetailsPage` announcement keys).
- New: `apps/web/src/features/events/EventDetailWrapper.test.tsx` (integration tests, Vitest + msw).
- New/Modified: a Playwright E2E spec covering the favorite/unfavorite happy path (exact file location to follow whatever convention Story 0.10's Playwright setup establishes for `apps/web`).
- **Not modified:** `packages/ui/src/features/events/EventDetailView.tsx` (already built, reused as-is), `packages/ui/src/features/events/EventCard.tsx` (out of scope), any `apps/backend`/`packages/database` file (owned by Story 2.1a).

### Rule Mapping

- *State Management Architecture* → `isFavorited` handled as Server State via react-query optimistic update on the `['getEventBySlug', { slug }]` key (Dev Notes → State Management Categorization).
- *UI Patterns & UX Invariants (Loaders)* → Non-blocking, localized icon-button state, not a `BlockingLoader` (Dev Notes → Loader Classification).
- *i18n rule* → all labels and new announcement strings localized via next-intl `EventDetailsPage` namespace (Dev Notes → i18n Keys Required).
- *AD-5 Analytics* → `event_favorited`/`event_unfavorited` with explicit payload shapes (Dev Notes → Analytics Events Required).
- *AD-7 Authenticated Context* → client-side redirect-to-login UX gate layered on top of, not instead of, server-side `requireAuth` enforcement (Story 2.1a).
- *Code Organization (Domain vs UI)* → no `packages/domain` changes; this is inherently React/react-query-coupled wiring (Dev Notes → Package boundaries).
- *Data Schemas single source of truth* → mutation/field contract taken verbatim from Story 2.1a's story file, not re-derived or guessed (Dev Notes → Data Type Compatibility).

### Verification Plan

- Integration tests (`apps/web`, Vitest + msw): optimistic toggle on click, cache reconciliation on mutation success, rollback + error announcement on mutation failure, unauthenticated click redirects to `/login` with no mutation attempted.
- One Playwright E2E happy-path test: authenticated session → event detail page → click favorite icon → icon fills, `aria-pressed="true"` → click again → icon reverts, `aria-pressed="false"`.
- Manual: `pnpm build` / `pnpm lint` / `pnpm run codegen` clean at the repo root; confirm `apps/web/src/generated/graphql.ts` contains `useToggleFavoriteMutation` and `GetEventBySlugQuery.eventBySlug.isFavorited` after Story 2.1a lands and codegen is re-run.

## Pre-Coding Approval Gate

- [ ] Scope confirmed: frontend wiring only (`apps/web`) against Story 2.1a's mutation/field contract; no new reusable UI component built (Gate 2: no gap — `EventDetailView` from Story 1.6a is reused as-is).
- [ ] **Dependency confirmed:** Story 2.1a must be merged (schema/resolvers in place, `pnpm run codegen` re-run) before Task 1's codegen step and this story's implementation can complete. Confirm proceeding with this story's non-blocked prep work now (GraphQL documents, mapper/wrapper wiring against the known contract, tests written against mocked responses) while 2.1a is in flight, or direct that this story wait until 2.1a is `done`.
- [ ] **Unauthenticated-click decision accepted:** redirect to `/login` on click when signed out (icon always visible), per Dev Notes → Unauthenticated Click Behavior. Confirm acceptable, or direct an alternative.
- [ ] **Feedback-mechanism decision accepted:** `aria-live="polite"` status announcement (new i18n keys) in place of introducing a toast library, per Dev Notes → Feedback Mechanism Decision. Confirm acceptable, or direct that a toast library be introduced instead.
- [ ] Architecture and data/API boundaries confirmed: GraphQL-only data path, no `packages/domain` changes, optimistic react-query cache update against the `['getEventBySlug', { slug }]` key.
- [ ] Gate 1/2/3 prerequisites confirmed: Gate 1/3 sourced from swept `epic-2-readiness.md` (no gap — Story 2.1a is the identified backend prerequisite, already positioned before this story); Gate 2 run fresh via subagent (no gap — `EventDetailView`/`EventCard` favorite UI already built in Stories 1.6a/1.3b, this story only wires it up).
- [ ] Testing plan confirmed: Vitest + msw integration tests for `EventDetailWrapper`, one Playwright E2E happy-path test.
- [ ] Explicit human approval state (Default: pending approval)

## Testing Requirements

- Integration tests (`apps/web`, Vitest + msw) for `EventDetailWrapper`: optimistic favorite/unfavorite toggle, mutation-failure rollback with error announcement, unauthenticated-click redirect behavior.
- One E2E happy-path test (Playwright): favorite then unfavorite an event from its detail page as an authenticated user.
- No new `packages/domain` unit-test surface expected (see Dev Notes → Package boundaries).

## Deliverables Checklist

- [ ] `getEventBySlug` query extended with `isFavorited`; new `toggleFavorite` mutation document added; codegen re-run once Story 2.1a lands.
- [ ] `EventDetailWrapper` wired: optimistic toggle, auth gate/redirect, rollback on error, analytics capture on success.
- [ ] New `EventDetailsPage` i18n announcement keys added to `en.json`/`id.json`.
- [ ] Integration and E2E tests written and passing.
- [ ] `pnpm build`/`pnpm lint`/`pnpm run codegen` clean at the repo root.

## Out of Scope

- Story 2.1a's backend work itself (tables, migrations, resolvers, `Mutation` root) — hard prerequisite, tracked separately.
- Favorites listing page and its own unfavorite-from-list interaction, including the "Soft Delete with Undo" pattern (Story 2.2).
- `EventCard`'s "Quick Favorite" slot wiring on the Discovery feed or any list view (Story 2.2 or a future discovery-feed enhancement) — confirmed out of scope for this story by Gate 2.
- Add to Calendar button wiring (`EventDetailView.onAddToCalendar`) — Story 2.6.
- Introducing a toast/notification library — this story uses an `aria-live` region instead (see Dev Notes → Feedback Mechanism Decision); revisit if a future story needs richer toast UX.

## Definition of Done

- Acceptance criteria satisfied.
- Required tests pass (integration + E2E).
- Lint and type checks pass for `apps/web`.
- Story 2.1a is `done` and this story's codegen/type-check has been re-verified against its real generated types (not just the contract documented in Dev Notes).

## Completion Status

- [ ] Not started — story rewritten to align with Story 2.1a's actual contract and the already-built `EventDetailView`/`EventCard` components; awaiting Pre-Coding Approval Gate sign-off and Story 2.1a completion.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story regenerated per Story 2.1a's own Dev Notes recommendation ("Sibling story note — Story 2.1 was drafted out of order"), replacing the prior draft (originally generated by a different tool/model, referencing an unspecified "GraphQL mutation contract") with one aligned to 2.1a's actual `toggleFavorite`/`Event.isFavorited` contract.
- Codebase investigation found `EventDetailView` (Story 1.6a) and `EventCard` (Story 1.3b) already implement the favorite-toggle UI end-to-end but unwired — confirmed via direct file reads of `packages/ui/src/features/events/EventDetailView.tsx`, `EventDetailView.types.ts`, `EventDetailView.test.tsx`, `EventCard.tsx`, and `apps/web/src/features/events/{EventDetailWrapper.tsx,mapper.ts,queries.graphql}`.
- Gate 2 (UI Complexity & Reusability) run fresh via subagent against the authoritative UX artifacts; verdict: no gap. See Dev Notes → Architecture & UX Gate Findings.

### Completion Notes List

- Story rewritten from a generic, contract-agnostic draft into one scoped against Story 2.1a's real mutation/field contract and the pre-existing, unwired `EventDetailView`/`EventCard` favorite UI.

### File List

- `_bmad-output/implementation-artifacts/2-1-favorite-an-event.md`
