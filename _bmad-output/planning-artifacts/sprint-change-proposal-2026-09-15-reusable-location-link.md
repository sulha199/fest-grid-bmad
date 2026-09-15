---
backlog_id: CC-021
title: "Sprint Change Proposal: Reusable Location-Link Component (IDEA-029/033/032)"
status: "approved"
created: "2026-09-15T00:00:00Z"
approved: "2026-09-15T00:00:00Z"
---

# Sprint Change Proposal: Reusable Location-Link Component

## 1. Issue Summary

A user request (`bmad-help`, 2026-09-15) asked for a reusable location-link element: a pin icon
plus the location's name, always clickable and always opening a map in a new tab, with a
confidence-based icon — an open-in-new-tab icon straight to the resolved coordinate when the
location match is confirmed/good-confidence, or a search icon (querying the map by name) when it
isn't. Two follow-on requests asked for this component to be adopted in two places: the
event-detail page's schedule list (IDEA-033, alongside two small unrelated schedule-item
refinements) and the "reusable account element" that already links to an account's own page,
replacing its current raw account-identifier fallback line with the location link when the
account's own location is confirmed (IDEA-032).

All three items were already fully captured with no open design question
(`event-pages-followthrough-plan.md` Phase 1). Investigation while drafting this proposal found
the project already ships the exact confidence predicate this component needs —
`isLocationTrustworthy` (`packages/domain/src/geolocation/is-location-trustworthy.ts`,
built by Story 0.i7a/0.i7b/0.i7c for gating the event-detail map link on location confidence) —
and that `apps/web/src/features/events/mapper.ts` already uses it to decide between a
coordinate-based and a text-query Google Maps URL for the schedule location link, but discards
*which* branch it took before handing the final URL to `EventDetailView` — so today's schedule
location link always renders the same icon regardless of confidence. This proposal's mechanism
story reuses that same predicate rather than inventing a second one.

**Issue type:** New requirement (user-requested reusable component + two adoption sites), not a
technical limitation or a misunderstanding of existing scope.

## 2. Impact Analysis

### Epic Impact

- **Epic 1 (Core App and Event Discovery):** Owns the mechanism and its first adoption site.
  Two new lettered stories: **1.6d** (build `LocationLink`) and **1.6e** (adopt it into
  `EventDetailView`'s schedule list, plus IDEA-033's two other small schedule-item refinements).
  Homed under Epic 1 — not Epic 0 — per this project's own established convention for a
  single-story-origin, cross-epic-reusable UI primitive: *"built once, reused across epics, homed
  off the first story that needs it rather than Epic 0"* (Story 1.3c's note, and IDEA-029's own
  capture lists "event-detail page + its schedule" as the first consumer).
- **Epic 0 (Foundation), improvement epic 0.i6 — a deviation from the follow-through plan's own
  framing, found during drafting:** `event-pages-followthrough-plan.md` Phase 1 asked this
  proposal to confirm whether the "reusable account element" (IDEA-032's target) is homed under
  Epic 1 or Epic 3, by checking where it lives in the codebase. It lives in neither: direct code
  inspection found the component is `SubscribedAccountCard`
  (`packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx`), which is already governed
  by its own dedicated improvement epic, **Epic 0.i6** ("One `SubscribedAccountCard` for every
  subscribed-account display") — its stated invariant is exactly *"every place that displays a
  subscribed social-media account renders it through one `SubscribedAccountCard` whose props are
  fully specified and gracefully degrade on missing input,"* and Story 0.i6d already sets the
  precedent of an internal-contract change to this exact card joining Epic 0.i6 as a new lettered
  story rather than the epic that happens to consume the card (0.i6d's own note: *"FIND-008
  violates this epic's existing invariant directly, so it joins rather than forming anything
  new"*). IDEA-032's change — replacing the card's account-identifier fallback line with a
  location link — is the same class of internal-contract change, not a new consuming surface. One
  new lettered story: **0.i6e**, depending on Story 1.6d (the mechanism) and Story 0.i6a (the
  card's base contract). **Assumption, recorded explicitly per this session's operating
  instructions:** since no user was available to confirm this deviation from the plan's Epic-1-
  or-Epic-3 framing live, this proposal proceeds on the reasoning above rather than halting; it is
  a Direct Adjustment either way (amending an existing epic, not forming a new one), so the
  scope-classification risk of being wrong is low — reassignment to Epic 1/3 later would be a
  one-line `epics.md` move, not a rework.
- `EventDetailView.tsx` (Story 1.6a) is reopened for amendment by Story 1.6e (its schedule-item
  markup) but keeps its own story identity — matching the precedent of Stories 1.i1c/1.i1e
  amending already-`review` component internals without becoming new stories of their own scope.
- No other epic affected. No new epic required; no epic removed, resequenced, or invalidated —
  this is exactly the case `event-pages-followthrough-plan.md` identified for the getEvents/
  eventBySlug side (Proposal 2a): the surface is already owned by existing epics, so
  `bmad-correct-course` amending them directly is the right tool, not `bmad-form-epics`.

### Artifact Conflicts

**PRD:** No conflict, no changes needed. This is a UI/component-reuse change with no new
requirement, data model, or business rule — the confidence-gating logic itself was already a PRD-
adjacent decision made by Epic 0.i7's own stories, not something this proposal introduces.

**Architecture:** No new Architectural Decision needed. This proposal is a straightforward reuse
of an existing, already-decided mechanism (`isLocationTrustworthy`, `packages/domain/src/
geolocation`) — the same "reuse the one predicate everywhere" principle AD-9 (`WeekPicker`
boundary math) and AD-17 (this session's other proposal) both already establish for this
codebase. `packages/ui` already depends on `@festgrid/domain` (verified in `packages/ui/
package.json`), so `LocationLink` can import `isLocationTrustworthy` directly with no new
cross-package dependency.

**UX:** No `DESIGN.md`/`EXPERIENCE.md` tokens exist yet for a "location link" element (pin icon +
name + confidence icon). This is genuinely new but narrow visual surface — a single small
element, not a new page or interaction pattern — and the user's own capture (IDEA-029) already
specifies the exact visual composition (pin icon, name text, one of two trailing icons) in enough
detail for `bmad-create-story` to translate directly into Tailwind classes without a dedicated
`bmad-ux` pass, unlike CC-019's card redesign (which needed one because it composed several
competing new elements in a narrow space). No UX pass is recommended as a prerequisite.

**Other artifacts:** `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` document
already selects everything Story 1.6e's schedule-side adoption needs (`schedules.locationDetails
{ coordinates { lat lng } placeName placeId formattedAddress timezone confidence matchType }` —
verified, no query change needed there). It does **not** yet select `sourceSocialMediaAccountProfile.
defaultLocation` — Story 0.i6e's own AC adds that selection and regenerates codegen, the same
"query-selection-set gap, not a resolver gap" pattern Story 0.i7c's own amendment note already
documents for this exact field family.

### Technical Impact

- `packages/ui/src/core/LocationLink.tsx` (new): the mechanism component (Story 1.6d).
- `apps/web/src/features/events/mapper.ts`: stops pre-computing `mapUrl` for schedules (its
  `isLocationTrustworthy`-gated URL-building moves into `LocationLink` itself, removing the
  duplicate implementation rather than adding a second one); adds `accountLocation` derived from
  `event.sourceSocialMediaAccountProfile?.defaultLocation` for Story 0.i6e (Story 1.6e, 0.i6e).
- `packages/ui/src/features/events/EventDetailView.tsx`/`.types.ts`: `ScheduleDetail.mapUrl`
  replaced by a `locationDetails` shape; schedule item's `text-lg` title class removed; the
  decorative `CalendarDays` icon next to each schedule's title replaced by a functional per-
  schedule add-to-calendar action reusing the existing `onAddToCalendar` prop; the schedule's
  location line (`~460-473`) replaced by `LocationLink` (Story 1.6e).
- `packages/ui/src/features/subscriptions/SubscribedAccountCard.tsx`/`.types.ts`: new optional
  `location` prop; the `@{account.username}` fallback line conditionally replaced by
  `LocationLink` when trustworthy (Story 0.i6e).
- `apps/web/src/features/events/queries.graphql`: `getEventBySlug`'s
  `sourceSocialMediaAccountProfile` selection gains `defaultLocation { coordinates { lat lng }
  placeName formattedAddress confidence matchType }`; codegen regenerated (Story 0.i6e).

## 3. Recommended Approach

**Direct Adjustment (Option 1).** No rollback, no PRD/MVP scope change, no epic restructuring —
amends two existing epics (1 and 0.i6) directly, per the reasoning in Section 2.

- **Effort:** Small-Medium. One net-new component with a fully-specified visual contract, two
  narrow adoption sites, one of which (0.i6e) needs a small query-selection addition.
- **Risk:** Low. The confidence mechanism already exists and is proven (Story 0.i7b/0.i7c); this
  proposal's own real judgment call (Epic 0 vs. Epic 1/3 homing for IDEA-032) is resolved above
  with a low-cost reversal path if wrong.
- **Rejected:** Rollback, MVP reduction — not applicable, nothing here contradicts shipped work.
- **Rejected:** Forcing IDEA-032's adoption story into Epic 1 or Epic 3 per the follow-through
  plan's original framing — rejected because it would misrepresent which epic actually owns
  `SubscribedAccountCard`'s contract, contradicting this project's own established precedent
  (Story 0.i6d) for where an internal-contract change to this exact card belongs.

## 4. Detailed Change Proposals

### 4.1 Epic 1 — New Story 1.6d

```
### Story 1.6d: Build the reusable LocationLink component

**As a** developer,
**I want** a reusable `LocationLink` component in `packages/ui/src/core/` that renders a pin
icon plus a location's name, always opening a map in a new tab, with a confidence-based icon
choice reusing the existing location-trustworthiness predicate,
**So that** every place that displays a resolved location (the event-detail schedule, Story
1.6e, and the reusable account element, Story 0.i6e) stops duplicating Google-Maps-URL-building
and confidence-gating logic, and a low-confidence match is never presented identically to a
confirmed one.

**Acceptance Criteria:**

*   **Given** a `locationDetail` prop shaped `{ name: string; coordinates?: { lat: number; lng:
    number } | null; confidence?: number | null; matchType?: string | null }`, **when**
    `LocationLink` renders, **then** it displays a pin-location icon followed by `name` as text,
    the whole element wrapped in an `<a>` with `target="_blank" rel="noopener noreferrer"` — the
    entire component is always clickable and always opens a map in a new tab.
*   **And** given `coordinates` is present and `isLocationTrustworthy({ confidence, matchType })`
    (imported directly from `@festgrid/domain/geolocation` — the exact predicate and
    `MIN_TRUSTWORTHY_CONFIDENCE`/`TRUSTWORTHY_MATCH_TYPE` threshold `apps/web`'s `mapper.ts`
    already uses to gate the event-detail map link, per Story 0.i7c) is `true`, **when**
    `LocationLink` computes its `href`, **then** it links directly to the coordinate
    (`https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`) and renders a trailing
    open-in-new-tab icon.
*   **And** given `coordinates` is absent, or present but `isLocationTrustworthy` is `false`,
    **when** `LocationLink` computes its `href`, **then** it links to a text-query search built
    from `name` (`https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(name)>`)
    and renders a trailing search icon instead — never the open-in-new-tab icon.
*   **And** the component is domain-agnostic beyond reusing `isLocationTrustworthy`: no
    `next-intl` import, no FestGrid-specific business logic; an optional `ariaLabel` prop lets a
    caller supply localized accessible text.
*   **And** it is documented and exported from `packages/ui`'s public entry point for reuse
    across features.

**Note:** Homed as `packages/ui/src/core/LocationLink.tsx` — a domain-agnostic `core/` primitive,
not `features/events/` — because it has two known consumers from the start spanning two
different feature areas (Story 1.6e's event-detail schedule, and Story 0.i6e's
`SubscribedAccountCard`), matching this project's established `core/` (domain-agnostic, reused)
vs. `features/<domain>/` (single-feature) placement convention (AD-9 Rule 3, `WeekPicker`
precedent). Positioned under Epic 1 rather than Epic 0, per the single-story-origin convention
already established by Story 1.3c/1.6b: built once, reused across epics, homed off the first
story that needs it (IDEA-029's own capture lists the event-detail page/schedule first). Reuses
`isLocationTrustworthy` (`packages/domain/src/geolocation/is-location-trustworthy.ts`, built by
Epic 0.i7's Stories 0.i7a-0.i7c) rather than introducing a second confidence-gating
implementation. Registered via `bmad-correct-course` as **CC-021**
(`sprint-change-proposal-2026-09-15-reusable-location-link.md`).

**Depends on:** None directly (pure presentational component consuming `@festgrid/domain/
geolocation`'s already-shipped `isLocationTrustworthy`, Story 0.i7a/0.i7c).
```

### 4.2 Epic 1 — New Story 1.6e

```
### Story 1.6e: Event-detail schedule refinements — smaller name, bigger add-to-calendar action,
location link

**As a** user,
**I want** each event-detail schedule item to show a smaller schedule name, a bigger and more
visible per-item add-to-calendar action, and its location as a proper map link,
**So that** the schedule list is easier to scan and act on without opening the full add-to-
calendar dialog just to add one schedule.

**Acceptance Criteria:**

*   **Given** the schedule item's title element (`EventDetailView.tsx`'s `h3`, ~line 412,
    `font-semibold text-lg`), **when** it renders, **then** the `text-lg` class is removed so the
    schedule name scales down alongside the now-smaller event title (IDEA-030 item 6's
    `text-2xl` change) rather than visually competing with it.
*   **And** given each schedule item, **when** it renders, **then** the decorative `CalendarDays`
    icon next to its title (`EventDetailView.tsx` ~line 413, purely illustrative today) is
    replaced by a clickable, larger, more visually prominent `CalendarPlus` action icon (sized
    and styled to match the top-of-page add-to-calendar button's own prominence before IDEA-030
    item 7 removes it) that, when activated, calls the existing `onAddToCalendar([schedule.id])`
    directly for that one schedule — reusing the exact prop/mutation path the top-of-page
    dialog already uses, not a new one — and reflects `schedule.isAddedToCalendar` with the same
    filled/active visual state the top-level button already uses (`fill-primary text-primary`
    when added).
*   **And** given a schedule's `locationDetails` (already selected by `getEventBySlug`'s query —
    verified, no query change needed here), **when** the schedule item renders its location line
    (`EventDetailView.tsx` ~460-473, today a manually-built `<a href={schedule.mapUrl}>`),
    **then** it renders `LocationLink` (Story 1.6d) instead, passing `{ name: scheduleLocation,
    coordinates: schedule.locationDetails?.coordinates, confidence:
    schedule.locationDetails?.confidence, matchType: schedule.locationDetails?.matchType }` —
    `ScheduleDetail`'s `mapUrl: string | null` field is removed in favor of a `locationDetails`
    shape, and `apps/web/src/features/events/mapper.ts` stops pre-computing `mapUrl` itself
    (that computation now lives inside `LocationLink`, removing the duplicate implementation
    rather than adding a second one alongside it).
*   **And** existing behavior is unchanged for a location that was already trustworthy or already
    untrustworthy under today's logic — regression tests confirm the rendered `href` for both
    cases matches what `mapper.ts`'s removed code produced.

**Note:** Covers all three items of IDEA-033 in one story, since they are small, same-file,
same-list-item changes to the schedule section rather than independently substantial concerns —
matching this project's precedent for batching a small multi-item UI request into one story (e.g.
Story 1.3b's TILL-badge amendment). Depends on Story 1.6d for the location-link mechanism.
Registered via `bmad-correct-course` as **CC-021**
(`sprint-change-proposal-2026-09-15-reusable-location-link.md`).

**Depends on:** Story 1.6d (`LocationLink`), Story 1.6a (`EventDetailView`, amended in place).
```

### 4.3 Epic 0, improvement epic 0.i6 — New Story 0.i6e

```
### Story 0.i6e: Replace the card's raw account-identifier line with a location link when
confirmed

**As a** developer,
**I want** `SubscribedAccountCard`'s account-identifier fallback line replaced by a location link
when the account's own default location is confirmed/good-confidence,
**So that** a user sees where the account is actually based instead of an opaque identifier, on
every surface that already renders this card with location data available (IDEA-032).

**Acceptance Criteria:**

*   **Given** `SubscribedAccountCard` receives a new optional `location: { name: string;
    coordinates?: { lat: number; lng: number } | null; confidence?: number | null; matchType?:
    string | null } | null` prop, and it is present with `isLocationTrustworthy(location)`
    (Story 1.6d's same imported predicate) `true`, **when** the card renders, **then** its
    account-identifier fallback line (`SubscribedAccountCard.tsx:29`, today `@{account.username}`
    — the identifier this card falls back to displaying beneath the account-page link) is
    replaced by `LocationLink` (Story 1.6d) rendering `location.name`.
*   **And** given `location` is absent, or present but not trustworthy, **when** the card
    renders, **then** it falls back to today's `@{account.username}` line unchanged — matching
    IDEA-032's explicit fallback behavior.
*   **And** `apps/web/src/features/events/mapper.ts`'s account-prop derivation (the block
    already producing `accountName`/`accountUsername`/`accountPlatform`/`accountId`/
    `accountHref`, ~lines 113-119) gains an `accountLocation` field derived from
    `event.sourceSocialMediaAccountProfile?.defaultLocation`, with `name` taken as `placeName ||
    formattedAddress` (first non-empty) — threaded through `EventDetailViewProps` to
    `SubscribedAccountCard`'s new `location` prop.
*   **And** `apps/web/src/features/events/queries.graphql`'s `getEventBySlug` document's
    `sourceSocialMediaAccountProfile` selection gains `defaultLocation { coordinates { lat lng }
    placeName formattedAddress confidence matchType }` (the field already exists on the
    `SocialMediaAccountProfile` GraphQL type, `social-media-accounts.graphql:12` — this is a
    query-selection-set gap, not a resolver gap, the same class of gap Story 0.i7c's own
    amendment note documents for this field family) — codegen is regenerated accordingly.
*   **And** this does not change `SubscribedAccountCard`'s other adoption sites (Post Selection,
    Story 0.i6b; Subscribed Accounts settings, Story 0.i6c) — they simply omit the new
    `location` prop, and today's fallback line renders exactly as it does now, unaffected.

**Note:** Homed under Epic 0's `SubscribedAccountCard` improvement epic rather than Epic 1 or
Epic 3 — see this proposal's Section 2 (Epic Impact) for the full reasoning: this is an internal-
contract change to the card itself, the same class of change Story 0.i6d already set the
precedent for joining this epic directly. Registered via `bmad-correct-course` as **CC-021**
(`sprint-change-proposal-2026-09-15-reusable-location-link.md`).

**Depends on:** Story 1.6d (`LocationLink`), Story 0.i6a (the card's base contract).
```

`Story 0.i6z`'s (the ratchet) `Depends on` list is extended to add `0.i6e`, matching the existing
precedent that an internal-contract fix to the card (0.i6d) is included there — see epics.md edit.

### 4.4 Backlog rows carved

None. IDEA-029, IDEA-033, and IDEA-032 (its post-carve Epic 1/3 half — the Epic 4 half is
IDEA-034, already carved and out of this proposal's scope) are fully covered by Stories 1.6d,
1.6e, and 0.i6e above.

## 5. Implementation Handoff

**Scope classification: Minor.** No epic restructuring, no PRD/architecture change, small and
fully-specified visual/behavioral surface. The one open judgment call (Epic 0 vs. Epic 1/3 homing
for IDEA-032, Section 2) is resolved with a documented, low-cost-to-reverse assumption.

**Handoff sequence:**
1. **`bmad-create-story`** (Phase 3, a later session per `event-pages-followthrough-plan.md`) —
   turn Stories 1.6d, 1.6e, and 0.i6e's draft ACs above into final implementation-artifact story
   files, running `story-split-gate.md`'s gates (Gate 2 is already effectively pre-cleared by this
   proposal's own reuse analysis; Gate 1 should confirm no other `SocialMediaAccountProfile`-
   consuming query needs the same `defaultLocation` selection added at the same time).
2. **`bmad-quick-dev`/`bmad-dev-story`** — implement, per this project's delegate-to-cline-cli
   convention, with independent verification before merge.

**Sprint-status.yaml impact (checklist 6.4):** N/A at this stage — no story files exist yet
(Phase 3, a separate later session). `epics.md` gains two lettered stories under Epic 1 and one
under Epic 0's improvement epic 0.i6.

**Success criteria:** `LocationLink` renders identically wherever adopted; the event-detail
schedule list shows a smaller name, a working per-item add-to-calendar action, and a
confidence-correct location link; `SubscribedAccountCard` shows a location link in place of the
raw identifier line exactly when the account's own location is confirmed, with zero behavior
change on its other two adoption sites.
