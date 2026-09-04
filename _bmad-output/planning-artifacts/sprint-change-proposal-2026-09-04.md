---
backlog_id: CC-019
title: "Sprint Change Proposal: Discovery Card Redesign (TILL badge, status badge, nearby badge, masonry grid spacing)"
status: "approved"
created: "2026-09-04T00:00:00Z"
approved: "2026-09-04T00:00:00Z"
---

# Sprint Change Proposal: Discovery Card Redesign

## 1. Issue Summary

The user requested deepening a story to add new event-card UI (a `TILL` badge, a replacement status/upcoming badge, a proximity/"nearby" badge, and a denser masonry grid), citing Story 3-6i as the target. Investigation found 3-6i is **"Classify-and-discard private contact info during AI extraction"** — an unrelated backend privacy-filtering story. The correct targets, confirmed with the user, are **Story 1.3b** (`EventCard`) and **Story 1.3d** (`EventListView`'s masonry grid). Story 1.3i ("wire the list/masonry view-mode toggle") was also considered but is **dead**: a later change (`spec-ux-rework2-p1-masonry-only.md`) deleted the `ViewModeToggle` component and all per-page `layout` URL-param wiring it introduced, hardcoding `EventListView` to always render masonry. Its `sprint-status.yaml` entry still reads `done`, which is now misleading (see Section 5, Handoff).

Two reference screenshots were provided showing a card layout not fully matched by any existing `EventCard` variant: a date box (month/day) with a conditional `TILL` sub-badge, a poster image with an existing heart+count overlay, a two-badge row below the image (status + nearby), and event name + location below that. A second screenshot shows the same structure with a visually larger/more prominent poster image, described by the user as "the one for the opt-in account."

Cross-referencing the PRD during this session found that the "bigger poster for opted-in accounts" idea is **not new** — PRD §3.16 ("Scraping & Display Data Minimization") already states: *"Opted-in accounts get a visually distinct, more prominent card... This card is the only surface that uses `Post.durableImageUrl`."* That requirement was never implemented in `EventCard`/`EventListView` (confirmed: the Discovery/Favorites/Feed list query, `getEvents` in `apps/web/src/features/events/queries.graphql`, does not fetch `durableImageUrl` today — only the single-event detail query, `getEventBySlug`, does). This proposal both closes that pre-existing gap and adds the genuinely new requirements (TILL badge, status badge, nearby badge, grid spacing).

**Issue type:** New requirement emerged from stakeholder (user-provided screenshots), combined with a previously-specified-but-unimplemented PRD requirement surfaced during impact analysis.

## 2. Impact Analysis

### Epic Impact

- **Epic 1 (Core App and Event Discovery):** Stories 1.3b and 1.3d (both `review` status) are reopened for amendment — matching the existing precedent of AC11-13 being added to 1.3b in `review` status without a status-field change. No epic-level scope change; this is a **Direct Adjustment** (Section 4, Option 1).
- **Epic 2 (Story 2.5/2.5a, "Find nearby events"):** No changes needed. That feature is a list-level radius *filter* using a backend `withinRadius` DSL condition (server-side haversine/`ST_DWithin` against a saved or ad-hoc location) — a different mechanism from this proposal's per-card nearby *badge*, which the user explicitly chose to compute **client-side** (event coordinates from the list query + the viewer's live coordinates via the existing `useCurrentLocationCapture` hook, already built for 2.5). Reusing 2.5a's backend distance resolver for a per-card badge was considered and rejected by the user in favor of not adding new backend distance-computation surface.
- **Epic 3 (Stories 3.6g/3.6h, image-storage opt-in):** No changes needed. This proposal only *consumes* the already-shipped `isImageStorageOptedIn` → `durableImageUrl` pipeline (AD-12 Rule 3, already resolver-complete on `Event.durableImageUrl` per `events.graphql:94`) — it does not modify 3.6g/3.6h's own scope.
- **No new epic required; no epic removed, resequenced, or invalidated.**

### Artifact Conflicts

**PRD (`prds/festgrid-prd-2026-07-10-2047/prd.md`):**
- §3.16 already covers the prominent-card requirement (no conflict, just unimplemented) — needs a small amendment cross-referencing the new badges so a future reader isn't left to infer the connection.
- §3.1 (Event Discovery) has no mention of a relative-time status badge or a proximity badge on cards today — **addition needed**, not a conflict.
- §4.4 (Schedule Interface) **already declares** `eventEndDate?`/`eventEndTime?` — no interface change needed, only wiring these already-modeled fields through to the frontend query/types that currently omit them.
- §4.2/§4.3 (Coordinates/LocationDetails) **already declare** `coordinates: Coordinates` on `LocationDetails` — no interface change needed for the nearby badge's data needs.
- No MVP-scope conflict; §3.1/§3.16 are additive clarifications.

**Architecture (`festgrid-architecture-spine.md`):**
- **AD-12 (Durable Media Re-hosting) requires no change.** Rule 3 already specifies `durableImageUrl` is exposed as a secondary field for opted-in accounts — this proposal is simply the first frontend consumer to actually use it as a *card-selection* signal (not just an `onError` fallback target, its only current use in `EventDetailWrapper`).
- **AD-1/AD-2 (Unified Query DSL) requires no change** — the nearby badge deliberately does not add a new DSL operator (client-side distance calc, per user decision); 2.5a's `withinRadius` operator is untouched.
- No new Architectural Decision is warranted for this change; it is data-plumbing through already-declared schema, not a new pattern.

**UX (`DESIGN.md`/`EXPERIENCE.md`):**
- `DESIGN.md`'s `event_card_masonry`/`event_card_relative_day_pill`/`event_card_favorite_count_badge` tokens (added 2026-08-25) describe the **current** masonry card, which this proposal's new layout partially supersedes (the date-box + TILL badge replaces the existing top-left relative-day pill; a new below-image badge row is added; the existing top-right favorite+count button is unchanged).
- **Gap found:** neither `DESIGN.md` nor `EXPERIENCE.md` specifies the exact visual composition of a "date box beside/above a poster image" layout, or the prominent-vs-default poster sizing split. This is new visual design, not just new logic — see Recommended Approach below for how this is sequenced.

**Technical Impact:**
- `getEvents` query (`apps/web/src/features/events/queries.graphql`) needs 3 additions: `durableImageUrl` on `Event`; `eventEndDate`/`eventEndTime` and (for the nearby badge) coordinates on `Schedule`. Confirm at implementation time whether `Schedule.locationDetails.coordinates` is already selectable through the `events` resolver's field-mapping (it's already a full schema type, used by `eventBySlug`/manual correction) — likely a query-selection addition only, not new resolver code, but not yet verified against `buildOptimizedDrizzleSelect`'s field map for this specific path.
- `EventListViewScheduleShape`/`EventListViewItem` (`EventListView.types.ts`) need the same 3 fields threaded through, plus `EventListView.tsx`'s `derivedProps` (lines 57-72) passing them to `EventCard`.
- `EventCardProps` needs new fields for end date/time, a prominent-poster flag, and a caller-computed distance value (see Section 4 for exact shape).
- `EventListView.tsx`'s two `GridContainer` call sites (lines 21, 55) need their `gap="gap-2"` changed to an asymmetric horizontal/vertical value.

## 3. Recommended Approach

**Hybrid: Direct Adjustment for behavior/data (ready now) + a short `bmad-ux` pass for exact visual tokens (before story finalization).**

- **Effort:** Medium. No new backend resolver logic, no new DSL operator, no new database columns — every field this proposal needs is already modeled in the schema (`eventEndDate`/`eventEndTime`/`coordinates`/`durableImageUrl` all pre-exist). The work is query/type plumbing plus new frontend state-machine logic (the 8-state status badge) and a genuinely new card visual composition.
- **Risk:** Low-medium. The main risk is under-specifying the new date-box/poster visual layout and having `bmad-create-story` guess at Tailwind classes the way `event_card_masonry` was specified by "reference: user-provided screenshot" in 2026-08-25 — that precedent worked because the screenshot was simple (image + two overlay pills). This proposal's screenshot has more competing elements (date box, poster, 2 new badges, existing heart+count, existing favorite slot) in a narrow 2-column mobile card, so a dedicated `bmad-ux` token pass (matching the project's own precedent — e.g. "Mobile Multi-Day Calendar Spanning" was resolved by "a targeted `bmad-ux` pass" before its ACs were written) reduces the risk of `bmad-create-story` inventing conflicting layout decisions mid-draft.
- Rejected: pure Direct Adjustment straight to `bmad-create-story` with no UX pass — viable but higher risk of a mid-draft Gate 2 finding (per this project's own `story-split-gate.md` pattern) forcing a restart once the badge-row/date-box layout collision becomes concrete during implementation.
- Rejected: rollback or MVP-scope reduction — not applicable; nothing here contradicts already-shipped work in a way rollback would simplify.

## 4. Detailed Change Proposals

### 4.1 PRD Amendments

**Section 3.1 (Event Discovery) — add, after the existing "Default View" bullet:**

```
OLD:
*   **Default View:** By default, the event discovery page will only display ongoing and upcoming events.

NEW:
*   **Default View:** By default, the event discovery page will only display ongoing and upcoming events.
*   **Event Status Badge (added 2026-09-04):** Every event card displays a relative-time status badge summarizing where the event stands relative to now: `Ended` (a schedule that has fully passed — relevant to card-reusing surfaces like Archive, not the default ongoing/upcoming Discovery view above), `Happening Now`/similar (started, not ending today), `Ends Today` (started, ends today), `In (n) hour(s)` (starts later today), `Tomorrow`, the weekday name (starts within the same week), `In (n) days` (starts next week), or `Upcoming` (beyond that). Exact wording and the same-week/next-week/next-month boundaries are defined in the implementing story (Story 1.3b).
*   **Nearby Badge (added 2026-09-04):** When the viewer has granted browser location permission, a card for an event within 5km of the viewer's current position shows a "Nearby" badge. No badge is shown when permission is not granted — this badge never itself prompts for location access (distinct from Section 3.3's explicit, user-initiated "nearby events" search, which does prompt).
```

**Section 3.16 (Scraping & Display Data Minimization) — amend the opted-in-card bullet:**

```
OLD:
*   **Opted-in accounts get a visually distinct, more prominent card** — the image becomes the visual center of interest rather than a small thumbnail — as a felt incentive to opt in (Section 4.5 `isImageStorageOptedIn`). This card is the only surface that uses `Post.durableImageUrl`.

NEW:
*   **Opted-in accounts get a visually distinct, more prominent card** — the image becomes the visual center of interest rather than a small thumbnail — as a felt incentive to opt in (Section 4.5 `isImageStorageOptedIn`). This card is the only surface that uses `Post.durableImageUrl`. **(Added 2026-09-04)** The presence of a non-null `durableImageUrl` on an event is the frontend's trigger for this prominent treatment — no separate opt-in flag is exposed to or read by the client, since `durableImageUrl` is never populated for a non-opted-in account's post (AD-12 Rule 1). See Story 1.3b for the exact layout.
```

### 4.2 Architecture

No Architectural Decision changes. AD-12 Rule 3 already covers `durableImageUrl`'s exposure; this proposal is a documented new *consumer* of it, not a new rule. Recorded here per the checklist's Section 3.2 requirement, not because a change is needed.

### 4.3 UX — Recommended Follow-up Pass (before story finalization)

Recommend a targeted `bmad-ux` pass, scoped to:
1. Exact composition of the date-box + poster row (relative sizing at default vs. prominent/opted-in state) for the masonry card, superseding `DESIGN.md`'s current `event_card_relative_day_pill` (top-left overlay pill) with the new date-box + TILL sub-badge treatment.
2. Placement/styling tokens for the new below-image badge row (status badge + nearby badge) — two badges, category badge dropped from masonry per user decision.
3. Confirm whether the existing top-right heart+count button (`event_card_favorite_count_badge`) stays visually unchanged (current assumption: yes, per both reference screenshots).
4. New `gap-x`/`gap-y` values for the masonry `GridContainer` (directionally: tighter horizontal, larger vertical — see Story 1.3d draft AC below for a concrete starting point subject to visual QA).

This pass produces new/amended `DESIGN.md` tokens (e.g. `event_card_date_box`, `event_card_till_badge`, `event_card_status_badge`, `event_card_nearby_badge`) that `bmad-create-story` then cites verbatim when amending Story 1.3b's Tasks, matching how `event_card_masonry` itself was token-specified before being turned into ACs.

### 4.4 Story 1.3b (`EventCard`) — Draft Amendment (behavior/data ACs; visual Tailwind classes deferred to the UX pass above)

**New props on `EventCardProps` (`EventCard.types.ts`):**

```
OLD:
  /** The primary schedule's start date/time (required) */
  startDate: Date | string;

  /** Optional starting time of day */
  startTime?: string | null;

NEW:
  /** The primary schedule's start date/time (required) */
  startDate: Date | string;

  /** Optional starting time of day */
  startTime?: string | null;

  /** Optional end date of the primary schedule, for the TILL badge and status-badge computation */
  endDate?: Date | string | null;

  /** Optional end time of the primary schedule */
  endTime?: string | null;

  /** When true (masonry variant only), renders the enlarged/prominent poster treatment per PRD §3.16. Caller derives this from `durableImageUrl != null` — EventCard does not know about the opt-in concept itself. */
  prominentPoster?: boolean;

  /** Caller-computed distance in kilometers from the viewer to this event (client-side geolocation math — EventCard performs no location/distance logic itself). A "Nearby" badge renders only when this is non-null and <= 5. Omit/null when the viewer has not granted location permission. */
  distanceKm?: number | null;
```

**New/amended Acceptance Criteria (numbering continues from the existing AC13):**

- **AC14 — TILL badge (masonry variant):** Given `endDate` (and optionally `endTime`), the masonry variant's date element renders a `TILL` sub-badge per this rule: if `startDate` is in the future, no `TILL` badge. If the event has started (`now >= startDate`+`startTime`) and `endDate` is today, render `till hh:mm` using `endTime` in the viewer's active locale/timezone (reusing `EventCard`'s existing `useScopedTimezone`/graceful-degradation pattern). If started and `endDate` is tomorrow or later, render `till` with no time. Absent `endDate` is treated as "ends same day as start" for this rule only (i.e. can still show `till hh:mm` if `endTime` present and today, else no badge once started with no known end) — exact absent-data fallback to be confirmed during implementation against real data frequency (how often `endDate` is null in practice).
- **AC15 — Status badge (masonry variant):** A new `formatEventStatus(now, startDate, startTime, endDate, endTime, labels)` helper (co-located with `formatRelativeDayOrDate` in `format-event-date.ts`) computes one of: `ended` (end has passed), `happeningNow` (started, not ending today), `endsToday` (started, ends today), `inHours(n)` (starts later today), `tomorrow`, a weekday name (starts within the same week, i.e. day+2 through day+6 — reusing the exact same "same week" boundary `formatRelativeDayOrDate`/AC12 already established), `inDays(n)` (starts next week), or `upcoming` (beyond next month). All strings sourced from `labels` with English defaults, matching the existing i18n-readiness pattern (AC9). This badge renders in the new below-image badge row, replacing the masonry variant's current lack of any status indicator (today's relative-day pill shows the date, not a status).
- **AC16 — Nearby badge:** When `distanceKm` is a number `<= 5`, render a "Nearby" badge alongside the status badge in the same row. When `distanceKm` is `null`/`undefined`, or `> 5`, render nothing — no placeholder, no disabled state.
- **AC17 — Prominent poster (masonry variant):** When `prominentPoster` is `true`, the poster image renders using the enlarged/prominent treatment (exact aspect ratio/sizing token from the UX pass, Section 4.3 above); when `false`/omitted, the existing `event_card_masonry.image` (`aspect-[3/4] object-cover`) treatment is unchanged. Both states keep the existing heart+favorite-count overlay (AC7/AC13) unchanged.
- **AC18 — Badge row supersedes AC11's caption exclusivity:** AC11's rule that masonry renders no categories/types badges is **reconfirmed, not changed** — the new status+nearby badge row is additive to the existing "no category badges" masonry rule, not a reversal of it.
- **AC12 amendment note:** AC12's existing top-left relative-day pill (masonry only) is **superseded** by AC14/AC15's date-box + TILL badge and status badge — the pill's `Today`/`Tomorrow`/weekday logic is reused (not duplicated) inside the new `formatEventStatus` helper rather than kept as a separate rendered element.

**Dev Notes for the implementing story:**
- `EventCard` remains framework-agnostic and presentational: it accepts `endDate`/`endTime`/`prominentPoster`/`distanceKm` as plain props and performs no data fetching, no geolocation calls, and no knowledge of "opt-in" as a concept — matching its existing design (`project-context.md`'s Adapter/decoupling principle already cited for `useScopedLocale`).
- `now` for status-badge computation should be injectable (matching `formatRelativeDayOrDate`'s existing testability pattern), not a bare `new Date()` call inside the helper, so the 8-state boundaries are unit-testable without mocking global time.

### 4.5 Story 1.3d (`EventListView`) — Draft Amendment

**Type changes (`EventListView.types.ts`):**

```
OLD:
export interface EventListViewScheduleShape {
  isMainSchedule: boolean;
  eventStartDate: string;
  eventStartTime?: string | null;
  ticketPrice?: string | number | null;
}

export interface EventListViewItem {
  id: string;
  slug: string;
  eventName: string;
  imageUrl?: string | null;
  location?: string | null;
  categories?: string[] | null;
  types?: string[] | null;
  schedules: EventListViewScheduleShape[];
}

NEW:
export interface EventListViewScheduleShape {
  isMainSchedule: boolean;
  eventStartDate: string;
  eventStartTime?: string | null;
  eventEndDate?: string | null;
  eventEndTime?: string | null;
  ticketPrice?: string | number | null;
  locationDetails?: { coordinates?: { latitude: number; longitude: number } | null } | null;
}

export interface EventListViewItem {
  id: string;
  slug: string;
  eventName: string;
  imageUrl?: string | null;
  durableImageUrl?: string | null;
  location?: string | null;
  categories?: string[] | null;
  types?: string[] | null;
  schedules: EventListViewScheduleShape[];
}
```

**New/amended Acceptance Criteria:**

- **AC16 — Thread end date/time and coordinates:** `EventListView`'s `derivedProps` (deriving `startDate`/`priceFrom` from the main schedule today) is extended to also derive `endDate`/`endTime` from the same schedule, and pass the schedule's `locationDetails.coordinates` through for the caller's nearby-distance computation (see AC18).
- **AC17 — Prominent poster derivation:** `EventListView` derives `prominentPoster: event.durableImageUrl != null` and passes it to `EventCard`, per PRD §3.16's amended trigger rule (Section 4.1 above) — no new boolean is required from the backend.
- **AC18 — Nearby distance computation stays out of `EventListView`:** `EventListView` does not compute `distanceKm` itself — it passes each event's coordinates through in its minimal event-shape type (AC5's existing "does not import any apps/web-generated GraphQL type" rule is preserved), and the `apps/web` call site (e.g. `home-content.tsx`) is responsible for combining them with `useCurrentLocationCapture`'s live position and passing the resulting `distanceKm` via `getCardProps`. This matches `EventListView`'s existing controlled-component pattern (`getCardProps` already carries per-event caller-computed props like `isFavorited`/`onFavoriteToggle`).
- **AC19 — Masonry grid spacing:** `EventListView.tsx`'s two `GridContainer` call sites (loading-skeleton and success branches) change `gap="gap-2"` to `gap="gap-x-2 gap-y-6"` (tight horizontal spacing, larger vertical spacing, per user's "dense horizontal gap, relatively bigger vertical gap" requirement) — starting values, adjustable during visual QA against the UX pass's final tokens. `baseCols={2}` (2 columns at the mobile/base breakpoint) is unchanged — already satisfies "2 cols on mobile."

**Dev Notes:**
- Story 1.3i is dead (its `ViewModeToggle`/`viewMode` prop were deleted); this amendment does not reintroduce a `viewMode` prop or touch 1.3i.
- `getEvents` (`apps/web/src/features/events/queries.graphql`) needs the corresponding field additions (`durableImageUrl`, `eventEndDate`, `eventEndTime`, `locationDetails { coordinates { latitude longitude } }`) — this is an `apps/web` query-file change, not a schema/resolver change, assuming the field-mapping confirmation in Section 2's Technical Impact note comes back clean.

## 5. Implementation Handoff

**Scope classification: Minor-to-Moderate.** No epic restructuring, no new backend schema/resolver surface, no PRD MVP change — but touches two already-`review` stories plus a query file and warrants a short UX pass before the story amendments are finalized into exact Tailwind classes.

**Handoff sequence:**
1. **`bmad-ux`** — targeted pass per Section 4.3, producing new `DESIGN.md` tokens for the date-box/TILL badge, the status+nearby badge row, and prominent-vs-default poster sizing.
2. **`bmad-create-story`** — reopen Story 1.3b and Story 1.3d, turning this proposal's draft ACs (Section 4.4/4.5) plus the UX pass's tokens into final AC/Task text in the implementation-artifact story files, run against `story-split-gate.md`'s gates (a UI-only, no-new-backend-surface change is unlikely to trigger Gate 1, but Gate 2's reuse check should confirm the new `formatEventStatus` helper's "stays local to `EventCard.tsx`" placement, mirroring `formatRelativeDayOrDate`'s existing documented rationale).
3. **`bmad-quick-dev`/`bmad-dev-story`** — implement, per this project's existing delegate-to-cline-cli convention for coding tasks, with independent verification before merge.

**Documentation correction needed (not part of this feature, surfaced during impact analysis):** `sprint-status.yaml`'s `1-3i-wire-the-list-masonry-view-mode-toggle-into-apps-web` entry still reads `done`, but the feature it shipped (`ViewModeToggle`, per-page `layout` URL param) was deleted by a later change (`spec-ux-rework2-p1-masonry-only.md`). Recommend a documentation-only note added to that entry (matching this file's existing convention of appending a `# ...` correction comment rather than rewriting history) — no code change, no epics.md restructuring, since masonry is simply now the sole/permanent mode rather than a toggled one.

**Sprint-status.yaml impact (checklist 6.4):** N/A — no epics added/removed/renumbered. Stories 1.3b/1.3d stay `review`; add an amendment reference comment (matching the existing convention, e.g. Story 1.3g's AC13-15 amendment comments) once `bmad-create-story` finalizes the new ACs.

**Success criteria:** `EventCard`'s masonry variant renders the TILL badge, status badge, and nearby badge per the state rules in Section 4.4; opted-in accounts' cards render the prominent poster treatment keyed off `durableImageUrl`; the masonry grid shows the new asymmetric gap; all new logic (status-badge state machine, TILL rule, prominent-poster derivation) has unit/component test coverage per this project's existing testing-trophy rule.
