---
baseline_commit: 0211b0e0a3b973cca70f4c593c8fddfec8e673b6
---
# Story 1.6e: Event-detail schedule refinements — smaller name, bigger add-to-calendar action, location link

## Story Details

- Epic: 1
- Story ID: 1.6e
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a user,
I want each event-detail schedule item to show a smaller schedule name, a bigger and more visible per-item add-to-calendar action, and its location as a proper map link,
so that the schedule list is easier to scan and act on without opening the full add-to-calendar dialog just to add one schedule.

## Acceptance Criteria

1. **AC1 — Schedule title scales down:** Given the schedule item's title `<h3>` (`EventDetailView.tsx` line 471, currently `className="font-semibold text-lg flex items-center gap-2"`), when it renders, then the `text-lg` class is removed (`className="font-semibold flex items-center gap-2"`) so the schedule name scales down alongside the event's own now-smaller `text-2xl` title (Story 1.6f) rather than visually competing with it. No other class on this element changes.
2. **AC2 — Decorative calendar icon becomes a functional per-schedule add-to-calendar action:** Given each schedule item, when it renders, then the purely decorative `CalendarDays` icon next to the title (line 472, `<CalendarDays className="w-5 h-5 text-gray-500" />`) is replaced by a clickable `CalendarPlus` icon button, styled and sized to match the prominence of the now-removed top-of-page add-to-calendar button (Story 1.6f relocated that button into the overflow menu; its exact pre-removal markup, recovered via `git show d95d05b^`, is the reference for this button's chrome):
   ```jsx
   <button
     type="button"
     onClick={() => onAddToCalendar?.([schedule.id])}
     className="p-1 -m-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
     aria-label={labels.addToCalendarButtonLabel}
     aria-pressed={!!schedule.isAddedToCalendar}
   >
     <CalendarPlus className={`w-5 h-5 ${schedule.isAddedToCalendar ? 'fill-primary text-primary' : 'text-gray-500'}`} />
   </button>
   ```
   Only rendered when `onAddToCalendar` is provided (matching every other conditional control in this component); when absent, the icon reverts to the current non-interactive `CalendarDays` rendering (no functional regression for callers that never pass the prop — none exist today, but the contract stays consistent with `onFavoriteToggle`/`onCorrectData`'s existing "omit the prop, hide the control" pattern elsewhere in this same component).
3. **AC3 — Calling `onAddToCalendar([schedule.id])` directly is safe unauthenticated, no separate auth branch needed:** Given a logged-out user clicks this button, when `onAddToCalendar([schedule.id])` fires, then the mutation orchestrator the caller actually wires up (`EventDetailWrapper.tsx`'s `handleAddToCalendar`, `apps/web/src/features/events/EventDetailWrapper.tsx:445-449`) already checks `if (!session) { router.push("/login"); return }` **before** it ever inspects `selectedIds` — so it redirects to `/login` identically whether it's called with `[schedule.id]` or `[]`. This button therefore does **not** need `EventDetailView.tsx`'s existing `handleTriggerClick`'s `if (!isAuthenticated && onAddToCalendar) { onAddToCalendar([]); return; }` short-circuit — that shortcut exists only to avoid opening the *bulk dialog* before redirecting, and this button never opens a dialog in the first place (unlike the bulk `AddToCalendarDialog`, which stays open-via-overflow-menu, untouched by this story). Do not add an `isAuthenticated` check to this button; calling `onAddToCalendar([schedule.id])` unconditionally is the correct, simplest implementation.
4. **AC4 — Schedule location renders via the reusable `LocationLink` component:** Given a schedule's resolved location, when the schedule item renders its location line (currently `EventDetailView.tsx` lines 519-532: a standalone `<MapPin>` icon followed by a `<div>` containing an sr-only `locationLabel` span and either `<a href={schedule.mapUrl}>{scheduleLocation}<ExternalLink/></a>` or a plain `<span>{scheduleLocation}</span>`), then that whole block is replaced by:
   ```jsx
   <address className="not-italic flex items-start gap-2">
     <span className="sr-only">{labels.locationLabel}:</span>
     <LocationLink
       name={scheduleLocation}
       coordinates={schedule.locationDetails?.coordinates}
       confidence={schedule.locationDetails?.confidence}
       matchType={schedule.locationDetails?.matchType}
     />
   </address>
   ```
   importing `LocationLink` from `../../core/LocationLink` (Story 1.6d; a relative import within `packages/ui`, matching how `PlatformIcon` is already imported at line 8 of this same file — **not** from the `@festgrid/ui` package barrel, since this file lives inside `packages/ui` itself). The standalone `<MapPin>` icon at line 520 is **removed entirely, not kept as a sibling** — `LocationLink` already renders its own pin icon inside its own `<a>`, so keeping the outer one would render two pin icons. This differs from the Performers/Ticket-Price rows immediately below (which keep their own leading `<User>`/`<DollarSign>` icons unchanged) — that asymmetry is intentional and specific to this one row, not a pattern to carry over to the other rows.
5. **AC5 — `ScheduleDetail.mapUrl` removed in favor of `locationDetails`; `mapper.ts` stops pre-computing it:** `ScheduleDetail.mapUrl?: string | null` (`EventDetailView.types.ts` line 19) is removed from the type. A new field is added in its place: `locationDetails?: { coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?: string | null } | null;` — structurally matching `LocationLinkProps`' own `coordinates`/`confidence`/`matchType` fields (Story 1.6d). `apps/web/src/features/events/mapper.ts` stops computing `mapUrl` (currently lines 60-66, gated by `isLocationTrustworthy` — that gating logic moves inside `LocationLink` itself, per Story 1.6d) and instead passes the GraphQL schedule's own `locationDetails` straight through: `locationDetails: s.locationDetails ?? null`. The now-unused `isLocationTrustworthy` import is removed from `mapper.ts` (nothing else in that file calls it after this change).
6. **AC6 — Existing behavior is unchanged and regression-verified, including the tests this story must update (not just add to):**
   - `packages/ui/src/features/events/EventDetailView.test.tsx`'s `fullProps` fixture (`schedules[0].mapUrl`, line 59) is replaced with a `locationDetails` shape (e.g. a trustworthy coordinate pair), and the assertion at line 106 (`getByRole('link', { name: /Stage 1/i })` asserting a hardcoded `mapUrl` href) is rewritten to assert against `LocationLink`'s own rendered output (its computed `href`, per Story 1.6d's own gating rules) rather than a value `mapper.ts` no longer produces.
   - `apps/web/src/features/events/mapper.test.ts`'s entire `describe('mapGraphQLEventToDetailViewProps mapUrl gating (Story 0.i7c / 0.i7z)', ...)` block (lines 100-168) — which exists specifically to prove `mapper.ts` performs the `isLocationTrustworthy` gating and branches `mapUrl` on it — is **removed**, since that gating logic no longer lives in `mapper.ts` after AC5. It is replaced with a small passthrough test proving `mapGraphQLEventToDetailViewProps` forwards `schedules[].locationDetails` onto `ScheduleDetail.locationDetails` unchanged (object identity or deep-equal, not a URL computation) — the confidence-gating behavior itself is Story 1.6d's own test responsibility (`LocationLink.test.tsx`), not re-tested here.
   - A location that was already trustworthy/untrustworthy under today's logic renders the identical final `href`/icon as before (`LocationLink`'s AC2/AC3 from Story 1.6d) — this story's own tests confirm the *wiring* (correct props reach `LocationLink`), not the gating math itself.

## Tasks / Subtasks

- [ ] 1. Remove `text-lg` from the schedule title `<h3>` (`EventDetailView.tsx` line 471). (AC1)
- [ ] 2. Replace the decorative `CalendarDays` icon (line 472) with the clickable `CalendarPlus` button per AC2's exact markup, gated on `onAddToCalendar` being provided; retain the current `CalendarDays` rendering as the fallback when `onAddToCalendar` is absent. (AC2, AC3)
- [ ] 3. Do **not** add an `isAuthenticated` branch to the new button's click handler — confirmed unnecessary per AC3's analysis of `EventDetailWrapper.tsx`'s `handleAddToCalendar`. (AC3)
- [ ] 4. Add `locationDetails` to `ScheduleDetail` (`EventDetailView.types.ts`) and remove `mapUrl`. (AC5)
- [ ] 5. Replace the schedule item's location block (lines 519-532) with `LocationLink`, importing it from `../../core/LocationLink`; remove the now-redundant standalone `<MapPin>` icon. (AC4)
- [ ] 6. Update `apps/web/src/features/events/mapper.ts`: remove the `mapUrl`-computing block (lines 60-66) and its now-unused `isLocationTrustworthy` import; pass `locationDetails: s.locationDetails ?? null` through instead. (AC5)
- [ ] 7. Update `packages/ui/src/features/events/EventDetailView.test.tsx`: replace the `mapUrl` fixture field and href assertion per AC6. (AC6)
- [ ] 8. Replace `apps/web/src/features/events/mapper.test.ts`'s `mapUrl gating (Story 0.i7c / 0.i7z)` describe block with a `locationDetails` passthrough test per AC6. (AC6)
- [ ] 9. Run `pnpm --filter @festgrid/ui test`, `pnpm --filter @festgrid/ui lint`, `pnpm --filter web test`, `pnpm --filter web lint`, and TypeScript strict-mode checks for both packages; confirm no regressions in the untouched parts of `EventDetailView.test.tsx`/`mapper.test.ts`. (AC6)

## Dev Notes

### Architecture & UX Gate Findings

- **Epic-1-readiness sweep not cited.** `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` is marked `swept: true`, but its `stories_covered` frontmatter list (`1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6, 1.7, 1.8`) predates Stories 1.6b–1.6f entirely (sweep date 2026-07-31; this story's governing proposal CC-021 is dated 2026-09-15) — the same "sweep predates this story" situation already resolved for sibling Stories 1.6c/1.6d/1.6f by running all three gates fresh via subagent dispatch rather than citing the stale report.
- **Gate 1 (run fresh, persona Winston) — No gap found.** This story's scope is confined entirely to `packages/ui` (`EventDetailView.tsx`/`.types.ts`/`.test.tsx`) and `apps/web/src/features/events/mapper.ts` (a frontend prop-mapping function, no direct DB/ORM/API access). No Drizzle/domain/backend-only dependency is called from the frontend beyond what already exists (`mapper.ts` merely stops pre-computing a field, it doesn't add a backend call); no external service is called directly; no new API surface is introduced — `getEventBySlug`'s query (`apps/web/src/features/events/queries.graphql` lines 96-107) already selects the full `locationDetails { coordinates { lat lng } placeName placeId formattedAddress timezone confidence matchType }` shape this story needs, verified directly — no GraphQL schema/resolver/codegen change required; no auth/secrets/business-rule logic is added — `onAddToCalendar` and `isLocationTrustworthy` are both pre-existing and unmodified, just re-wired to a different UI trigger. The one real dependency not yet built — `LocationLink` — is not an architecture-layer gap; it's an ordinary sequencing dependency on Story 1.6d, an already-separately-drafted, appropriately-scoped, `ready-for-dev` sibling story that exists specifically to cover it.
- **Gate 2 (run fresh, persona Freya) — No gap found.** All three changes are either a trivial class removal or thin reuse of already-established patterns/components: (1) removing `text-lg` is a pure Tailwind edit; (2) the `CalendarPlus` button reuses an existing prop (`onAddToCalendar`), existing field (`schedule.isAddedToCalendar`), and the exact visual treatment of a previously-shipped button (recovered from git history) — no new state, no new variant matrix, no second consumer being introduced; (3) `LocationLink` itself was already correctly identified as reuse-worthy (≥2 consumers: this story's schedule row, and Story 0.i6e's `SubscribedAccountCard`) and split into its own sibling story (1.6d) by a prior Gate 2 pass — this story only wires already-selected GraphQL fields into that component's props, textbook consumer-side adoption, not a second instance of undifferentiated reuse. `design-artifacts/UX-festgrid-run-1/DESIGN.md` (grepped case-insensitively for `event_detail`, `schedule_item`, `EventDetailView` — zero matches) and `EXPERIENCE.md`'s Component Patterns section (all subsection headings reviewed: Mobile Multi-Day Calendar Spanning, Account Location Field, Account Settings & Moderator Tools Shells, the three EventCard-family token sets, Day-of-Week Recurring Schedules, Temporal Filter, Calendar Overflow, Ambient Capability Ask, PWA Install Prompt, Ambient Viewer-Location Consent) confirm neither document covers the event-detail page's schedule-item layout, title sizing, or add-to-calendar affordance — matching the identical zero-coverage finding sibling Story 1.6f already logged for this same page.
- **Gate 3 (run fresh, persona Winston) — No gap found.** No global app shell/layout change (a leaf-level edit inside one already-existing component's already-existing schedule list); no new `next-intl` locale keys (all labels involved — `locationLabel`, `addToCalendarButtonLabel` — already exist in `EventDetailViewLabels`/`apps/web/locales/en.json`, and `LocationLink` itself takes zero i18n strings directly per its own 1.6d ACs); no PostHog/analytics event specified by this story's ACs or CC-021; no GraphQL schema/resolver/codegen change (query already selects everything needed, verified); the only cross-story dependency (`LocationLink`, Story 1.6d) already has its own home as a separately-produced, well-scoped, Gate-3-cleared prerequisite story one step earlier in the same lettered sequence — not an undocumented dependency this story is inventing.
- **Lightweight guard — gaps the fresh dispatch didn't anticipate:** None found. This story introduces no new external service, no new data entity, and no cross-cutting tooling gap. One sequencing dependency is worth flagging explicitly (not a Gate finding, but load-bearing): **`LocationLink` (`packages/ui/src/core/LocationLink.tsx`) does not exist in the codebase yet** — Story 1.6d is drafted (`ready-for-dev`) but not yet implemented (verified via `git log --all -- "**/LocationLink*"`, no hits). This story's own Pre-Coding Approval Gate below requires confirming 1.6d has shipped (or the gap is explicitly accepted) before implementation starts.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found, but a deliberate, scoped type change: `ScheduleDetail.mapUrl?: string | null` (`packages/ui/src/features/events/EventDetailView.types.ts` line 19) is removed and replaced by `locationDetails?: { coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?: string | null } | null`.
- **Impacted fields/contracts:** `ScheduleDetail` (packages/ui, local type, no `@festgrid/shared-types`/GraphQL-generated counterpart to drift from) and `apps/web/src/features/events/mapper.ts`'s `mapGraphQLEventToDetailViewProps` return shape (the one caller of `ScheduleDetail`). The new `locationDetails` field's shape is deliberately a structural subset of `LocationLinkProps`' own `coordinates`/`confidence`/`matchType` fields (Story 1.6d), so no new type needs to be independently maintained. No GraphQL schema, resolver, or codegen change — `Schedule.locationDetails` (the GraphQL field this story's `mapper.ts` change reads from) already exists and is already fully selected by `getEventBySlug`.
- **Required DB migration changes:** No changes required — no database access of any kind in this story.
- **Required TypeScript type changes:** Only the local `ScheduleDetail` interface change described above (`packages/ui`). No `packages/shared-types` or GraphQL-generated type changes.
- **Backward compatibility and rollout notes:** `ScheduleDetail.mapUrl` has exactly one producer (`mapper.ts`, modified by this story) and one consumer (`EventDetailView.tsx`, also modified by this story) — both change together in this same story, so there is no intermediate state where one side still expects the old field. No other file references `ScheduleDetail.mapUrl` (confirmed via project-wide search before drafting this story).
- **Verification checks:** `EventDetailView.test.tsx`'s updated fixture/assertions (AC6) and `mapper.test.ts`'s new passthrough test (AC6) together prove the new field's shape end-to-end from GraphQL response through `mapper.ts` to `EventDetailView`'s rendered `LocationLink` props. TypeScript strict-mode compilation catches any remaining `mapUrl` reference this story misses.

### Package Boundaries

- **No new `packages/ui` component or `packages/domain` mechanism introduced by this story.** This story is a pure *consumer* of two things that already have (or will have, via a separately-scoped sibling story) their own correct home: `LocationLink` (Story 1.6d, `packages/ui/src/core/`) and `isLocationTrustworthy` (already shipped, `packages/domain/src/geolocation/`, imported only inside `LocationLink` after this story ships — `mapper.ts` stops importing it directly).
- **No cloud/external service setup, no `SETUP_WALKTHROUGH.md` entry** — Google Maps continues to be reached via the same plain deep-link URL scheme, now built inside `LocationLink` instead of `mapper.ts`.
- **No PostHog/analytics event** — no AC in this story or its governing proposal (CC-021) specifies tracking a click on either the new per-schedule calendar button or the location link.
- **No new state management** — the `CalendarPlus` button reuses the existing `onAddToCalendar` prop/mutation path (already React-Query-backed at the `EventDetailWrapper.tsx` level, unmodified by this story); no new Server/URL/Client-Global state categorization applies to anything added here.
- **No new async/loading state** — no new data fetching is introduced; the existing Blocking/Non-Blocking loader classification for `onAddToCalendar`'s mutation is unchanged.
- **No schema-validation/package-isolation concerns** — no zod/ajv/firebase/testing-framework dependency is added or crossed by this story.

### Previous/Sibling Story Intelligence

- **Story 1.6d (`LocationLink`, `ready-for-dev`, NOT yet implemented in code) — the direct prerequisite.** Its story file (`_bmad-output/implementation-artifacts/1-6d-build-the-reusable-locationlink-component.md`) fully specifies `LocationLinkProps`: `{ name: string; coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?: string | null; ariaLabel?: string }`, always renders a `MapPin` + `name` inside a single `<a target="_blank" rel="noopener noreferrer">`, and computes its own `href`/trailing-icon via `isLocationTrustworthy` (coordinate-query URL + `ExternalLink` icon when trustworthy at `confidence >= 0.5` AND `matchType === 'full_match'`; text-query URL + `Search` icon otherwise). This story's AC4 props mapping is written directly against that exact contract. **Confirm 1.6d has actually shipped (component file exists, tests pass) before starting this story's implementation** — see Pre-Coding Approval Gate below.
- **Story 1.6f (`review`, already implemented in code) — informational, no file-touch overlap beyond the shared file.** Already shipped the `text-2xl font-bold` event-title downsize (AC1's sibling change) and relocated the top-of-page add-to-calendar button into the overflow menu (confirmed by reading the current `EventDetailView.tsx`: no standalone top-level calendar button exists anymore, only `menuActions`' "Add to Calendar" entry). This story's AC2 recovers that now-removed button's exact classes/aria-attributes from `git show d95d05b^` (the pre-1.6f commit) specifically because 1.6f already deleted them from the live file — they no longer exist anywhere in current `HEAD` to copy from directly.
- **Story 1.6a (`EventDetailView`, `done`) — the component being amended in place**, per epics.md's own "Depends on" line. No new component created; this story amends the existing one.
- **Story 1.6c (`ready-for-dev`, backend/SSR-hydration scope) — no file overlap.** Entirely `apps/backend`/GraphQL-resolver and SSR-caching scope; shares no touched file with this `packages/ui`/`mapper.ts`-only story.
- **`apps/web/src/features/events/mapper.ts` (current, being modified) — the logic being centralized away.** Lines 60-66 today build the exact two Google Maps URL variants `LocationLink` (1.6d) implements, gated by the same `isLocationTrustworthy` call — confirming this story's removal of that logic from `mapper.ts` is a pure centralization, not a behavior change, so long as `LocationLink` reproduces it (which 1.6d's own ACs/tests already require).

### Git Intelligence Summary

Recent commit history (`0211b0e` `feat: add Story 1.6d for CC-021 reusable LocationLink component`, `81c07e4` `feat: add Story 1.6c for CC-020 eventBySlug/event-detail perf hardening`, `a7d7510` `feat: add Story 1.3j for CC-020 getEvents computed-field batching`) shows this exact epic-1/event-detail cluster is being worked through sequentially, story-file-first, with implementation (`bmad-dev-story`) trailing behind story creation — 1.6c and 1.6d are both `ready-for-dev` (drafted, not yet coded) at the time this story (1.6e) is created. This story's own dependency on 1.6d's not-yet-built component is therefore the expected, normal state of an in-progress lettered-story sequence, not a sign of drift. `git show d95d05b^:packages/ui/src/features/events/EventDetailView.tsx` (the commit immediately before Story 1.6f's changes) was used to recover the exact pre-removal top-of-page add-to-calendar button markup this story's AC2 reproduces for the new per-schedule button.

### Project Structure Notes

- Files touched: `packages/ui/src/features/events/EventDetailView.tsx`, `packages/ui/src/features/events/EventDetailView.types.ts`, `packages/ui/src/features/events/EventDetailView.test.tsx` (all `UPDATE`, not `NEW`), and `apps/web/src/features/events/mapper.ts`, `apps/web/src/features/events/mapper.test.ts` (both `UPDATE`). No new files. No `apps/backend`, `packages/domain`, or database changes.
- `LocationLink` is imported via the relative path `../../core/LocationLink` from inside `EventDetailView.tsx` (which lives at `packages/ui/src/features/events/`), matching the existing `PlatformIcon` import (`'../../core/platform-icon'`, line 8 of the current file) — not via the `@festgrid/ui` package barrel, since both files live inside the same `packages/ui` package.
- No conflicts with `apps/backend` or `packages/domain` — this story touches nothing outside `packages/ui/src/features/events/` and `apps/web/src/features/events/`.

### References

- [Source: _bmad-output/project-context.md] — Technology Stack, Code Organization (Core Primitives vs Domain Features), i18n rules, UI Patterns & UX Invariants.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.6e] and neighboring Stories 1.6a, 1.6c, 1.6d, 1.6f.
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-09-15-reusable-location-link.md] — CC-021, this story's governing proposal (full ACs, rationale, epic-homing decision).
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — confirmed `stories_covered` predates this story; Gate 1/3 run fresh instead.
- [Source: _bmad-output/implementation-artifacts/1-6d-build-the-reusable-locationlink-component.md] — the direct prerequisite this story's AC4/AC5 props mapping is written against.
- [Source: packages/ui/src/features/events/EventDetailView.tsx] (lines 1-612, read in full) — current implementation this story amends.
- [Source: packages/ui/src/features/events/EventDetailView.types.ts] (read in full) — current `ScheduleDetail`/`EventDetailViewProps` contracts.
- [Source: apps/web/src/features/events/mapper.ts] (read in full) — current `mapUrl` computation this story removes.
- [Source: apps/web/src/features/events/queries.graphql] (lines 60-113) — confirms `getEventBySlug`'s `schedules.locationDetails` already selects `coordinates`/`confidence`/`matchType`, no query change needed.
- [Source: packages/domain/src/geolocation/is-location-trustworthy.ts] — the predicate this story's `mapper.ts` change stops importing directly (moves to `LocationLink`, Story 1.6d).
- [Source: apps/web/src/generated/graphql.ts] (lines 426-440) — confirms `LocationDetails`'s `confidence`/`matchType` are `Maybe<...>` (nullable), `coordinates` non-nullable within the object — consistent with `ScheduleDetail.locationDetails`'s new shape.
- [Source: apps/web/src/features/events/EventDetailWrapper.tsx] (lines 445-449) — confirms `handleAddToCalendar`'s `!session` check precedes any use of `selectedIds`, the basis for AC3.
- [Source: git show d95d05b^:packages/ui/src/features/events/EventDetailView.tsx] — recovered the exact pre-Story-1.6f top-of-page add-to-calendar button markup/classes this story's AC2 reproduces.
- [Source: packages/ui/src/features/events/EventDetailView.test.tsx] (lines 1-140, read in full) — current test fixtures/assertions this story's AC6 updates.
- [Source: apps/web/src/features/events/mapper.test.ts] (read in full) — current `mapUrl` gating test suite this story's AC6 replaces.
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md] — confirmed (Gate 2) no event-detail/schedule-item component token exists.
- [Source: design-artifacts/UX-festgrid-run-1/EXPERIENCE.md] — confirmed (Gate 2) Component Patterns section has no coverage of this page's layout/title-size/icon-affordance details.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Core Primitives/`packages/ui` import conventions), Locale-Sensitive Data Rendering (no new locale keys needed, verified), UI Patterns & UX Invariants.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-9 Rule 3 (`core/` vs `features/<domain>/` placement, cited via Story 1.6d's own `LocationLink` homing decision, which this story consumes).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - UPDATE `packages/ui/src/features/events/EventDetailView.tsx` — AC1 (title class), AC2/AC3 (`CalendarPlus` button), AC4 (`LocationLink` adoption, remove standalone `MapPin`).
  - UPDATE `packages/ui/src/features/events/EventDetailView.types.ts` — AC5 (`ScheduleDetail.mapUrl` → `locationDetails`).
  - UPDATE `packages/ui/src/features/events/EventDetailView.test.tsx` — AC6 (fixture + assertion update).
  - UPDATE `apps/web/src/features/events/mapper.ts` — AC5 (remove `mapUrl` computation + `isLocationTrustworthy` import, pass `locationDetails` through).
  - UPDATE `apps/web/src/features/events/mapper.test.ts` — AC6 (replace `mapUrl` gating suite with a passthrough test).
  - No new files. No `apps/backend`, `packages/domain`, database, or GraphQL schema/query changes.
- **Rule Mapping:**
  - *Reuse over reinvention* → `LocationLink` (Story 1.6d) is imported and consumed as-is, not re-implemented; the Google-Maps-URL/confidence-gating logic is removed from `mapper.ts` rather than duplicated.
  - *i18n foundational principle (AD-6)* → zero new `next-intl` locale keys; `labels.locationLabel`/`labels.addToCalendarButtonLabel` are reused verbatim from the existing `EventDetailViewLabels` contract.
  - *Data Type Compatibility* → `ScheduleDetail.mapUrl` → `locationDetails` change is scoped to one producer (`mapper.ts`) and one consumer (`EventDetailView.tsx`), both updated together in this story — see Dev Notes' Data Type Compatibility section.
  - *Testing Philosophy (testing trophy)* → integration-style component/unit tests updated in place (Vitest + Testing Library for `EventDetailView.test.tsx`, plain Vitest for `mapper.test.ts`), no new E2E test (this is a UI refinement to an already-E2E-covered page, not a new critical flow).
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — `EventDetailView.test.tsx` passes with its updated `locationDetails` fixture/assertion; no other existing test in this file regresses (title-size, badge-click-through, favorite/subscribe, attribution, contact-info, and menu tests are all untouched by this story's scope).
  - `pnpm --filter web test` — `mapper.test.ts` passes with its replaced passthrough test; `EventDetailWrapper.test.tsx`'s `locationDetails: null` fixtures (lines 345, 362) continue to pass unmodified (no assertion in that file depends on `mapUrl`).
  - `pnpm --filter @festgrid/ui lint` / `pnpm --filter web lint` and TypeScript strict-mode checks for both packages — catch any stray `mapUrl` reference this story's own task list misses.
  - Manual/visual check once `LocationLink` (1.6d) is implemented: the schedule item's location line renders one pin icon (not two), the smaller title doesn't visually collide with the new `CalendarPlus` icon, and clicking the per-schedule icon adds/removes exactly that one schedule (verified against `EventDetailWrapper.tsx`'s existing `handleAddToCalendar` toggle semantics, unmodified by this story).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: three small edits to `EventDetailView.tsx`'s existing schedule-item markup (title class, calendar-action icon, location link) plus the corresponding `ScheduleDetail`/`mapper.ts` type change and test updates — no new component, no backend/infra work.
- [ ] Architecture and boundary confirmation: no new `packages/ui`/`packages/domain` addition; `LocationLink` is imported, not re-implemented; no GraphQL/schema/query change.
- [ ] **Dependency confirmed: Story 1.6d (`LocationLink`) has been implemented and its tests pass** (verify `packages/ui/src/core/LocationLink.tsx` exists on disk) **before this story's implementation begins** — as of this story's creation, `git log --all -- "**/LocationLink*"` returns no commits, meaning 1.6d is drafted but not yet coded. If 1.6d has not shipped by the time this story is picked up for `dev-story`, either implement 1.6d first or explicitly accept working against 1.6d's story-file-documented `LocationLinkProps` contract as a temporary type-only stub, subject to revision once 1.6d actually lands.
- [ ] Testing plan confirmed: `EventDetailView.test.tsx` and `mapper.test.ts` updates (Task 7/8) are understood as **replacing** existing assertions, not purely additive — see AC6.
- [ ] Explicit human approval state (Default: pending approval)
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted: all three gates ran fresh (epic-1-readiness.md predates this story) and all three returned "No gap found" — no prerequisite story required beyond the already-existing Story 1.6d dependency above.

## Testing Requirements

- [ ] `packages/ui/src/features/events/EventDetailView.test.tsx` updated: `fullProps.schedules[0]` replaces `mapUrl` with a `locationDetails` fixture; the `getByRole('link', ...)` href assertion is rewritten against `LocationLink`'s rendered output.
- [ ] `apps/web/src/features/events/mapper.test.ts` updated: the `mapUrl gating (Story 0.i7c / 0.i7z)` describe block is removed and replaced with a `locationDetails` passthrough test.
- [ ] No new E2E test required — this is a UI refinement to an already-E2E-covered page (event-detail), not a new critical user flow.
- [ ] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only; this story touches only `packages/ui` and `apps/web`, both "testing trophy" scope.

## Deliverables Checklist

- [ ] Schedule title `<h3>` no longer has `text-lg`.
- [ ] Each schedule item renders a clickable `CalendarPlus` button (styled per AC2) instead of the decorative `CalendarDays` icon, calling `onAddToCalendar([schedule.id])` directly with no separate auth branch.
- [ ] Each schedule item's location renders via `LocationLink` (Story 1.6d), with the redundant standalone `MapPin` icon removed.
- [ ] `ScheduleDetail.mapUrl` removed; `ScheduleDetail.locationDetails` added.
- [ ] `mapper.ts` passes `locationDetails` through instead of pre-computing `mapUrl`; unused `isLocationTrustworthy` import removed.
- [ ] `EventDetailView.test.tsx` and `mapper.test.ts` updated per AC6, not left referencing the removed `mapUrl` field.
- [ ] Lint and TypeScript strict-mode checks pass for `packages/ui` and `apps/web`.

## Out of Scope

- Building `LocationLink` itself — Story 1.6d's scope; this story only consumes it once shipped.
- Adopting `LocationLink` into `SubscribedAccountCard` — Story 0.i6e's scope.
- Any change to the bulk `AddToCalendarDialog`, its overflow-menu entry, or the top-of-page layout — all Story 1.6f's already-shipped scope, untouched here.
- Any GraphQL query/schema/resolver/codegen change — none needed, per this story's own verified investigation (query already selects everything required).
- PostHog/analytics click tracking on the per-schedule calendar button or the location link — not specified by any AC in this story or CC-021.

## Definition of Done

- [ ] All Acceptance Criteria (AC1–AC6) are met.
- [ ] Required tests (see Testing Requirements) are updated/added and passing.
- [ ] Lint and type checks pass for `packages/ui` and `apps/web`.
- [ ] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began, including confirmation that Story 1.6d has shipped.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (`claude-sonnet-5`)

### Debug Log References

- Story created via `bmad-create-story`, invoked directly with epic/story number `1.6e`. `epics.md` already carried this story's full section (added by `bmad-correct-course`/CC-021 on 2026-09-15), but no `sprint-status.yaml` entry existed for `1-6e` at invocation time (verified: `grep` returned nothing, while the immediately-adjacent `1-6c`/`1-6d`/`1-6f` all had entries) — the same "epics.md section added, sprint-status.yaml registration deferred to a later bmad-create-story session" pattern Stories 1-6d/1-3j/1-6c already documented. This session registers it.
- `epic-1-readiness.md` is `swept: true` but its `stories_covered` list predates this story's subject matter entirely (sweep date 2026-07-31; CC-021 dated 2026-09-15) — matching the precedent already set by Stories 1.6c/1.6d/1.6f for the identical situation. All three gates (1/2/3) were run fresh via one-shot subagent dispatch (evidence inlined from already-loaded context, not re-read cold) and all three returned "No gap found."
- Confirmed via direct code inspection that **`LocationLink` (Story 1.6d) does not exist in the codebase yet** (`git log --all -- "**/LocationLink*"` returns nothing) — 1.6d is drafted (`ready-for-dev`) but not implemented. This story documents `LocationLink`'s contract from 1.6d's own story file (not from reading the component itself, which doesn't exist) and flags the sequencing dependency explicitly in the Pre-Coding Approval Gate rather than treating it as a Gate 1/3 architecture gap (it is not one — see Architecture & UX Gate Findings).
- Recovered the exact pre-Story-1.6f top-of-page add-to-calendar button markup (needed for this story's AC2, since 1.6f already deleted it from the live file) via `git show d95d05b^:packages/ui/src/features/events/EventDetailView.tsx`.
- Discovered, via direct reading of `EventDetailWrapper.tsx:445-449`, that `handleAddToCalendar`'s `!session` check precedes any use of `selectedIds` — resolving what could have looked like an open question (does the new per-schedule button need its own unauthenticated short-circuit, matching `handleTriggerClick`'s `onAddToCalendar([])` pattern?) into a confirmed non-issue (AC3): no such branch is needed, since the redirect fires identically regardless of which array is passed. This was verified from evidence already in hand, not escalated to the user, since it was a mechanical resolution rather than a genuine open design tradeoff.
- Discovered, via direct reading of `apps/web/src/features/events/mapper.test.ts`, that an entire existing describe block (`mapUrl gating (Story 0.i7c / 0.i7z)`, lines 100-168) tests logic this story removes from `mapper.ts` — folded into AC6/Task 8 as a required test *replacement*, not an additive test, so a dev agent doesn't leave dead/broken assertions referencing the removed `mapUrl` field.
- No design tradeoff requiring `AskUserQuestion` was found. This story's ACs (drawn directly from the already-approved CC-021 proposal, cross-checked against the current live component/mapper/test files) are fully specified down to exact classes, props, and file lines; the one candidate ambiguity found (the auth-branch question above) was resolved by direct evidence rather than being a genuine open judgment call.

### Completion Notes List

_To be filled by the dev agent during implementation._

### File List

_To be filled by the dev agent during implementation._
