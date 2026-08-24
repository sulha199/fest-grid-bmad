---
title: "EXPERIENCE.md: festgrid"
status: "draft"
created: "2026-07-20T10:59:00Z"
updated: "2026-08-06T00:00:00Z"
sources:
  - "design-artifacts/UX-festgrid-run-1/DESIGN.md"
  - "_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md"
---

# EXPERIENCE.md: FestDaily

This document defines the information architecture, behavior, states, and interactions for the FestDaily application. It is the authority on *how the app works*.

## Foundation

*   **Form-factor:** The primary experience is mobile-first, but the application will be a responsive web app accessible on desktop.
*   **Visual Identity:** All visual styling is defined in `{design-artifacts/UX-festgrid-run-1/DESIGN.md}`.

## Information Architecture

The application's structure is as follows:

*   **/ (Event Discovery):** The main landing page for authenticated users.
*   **/favorites:** A dedicated page showing the user's favorited events.
*   **/my-calendar:** A dedicated page showing events the user has added to their calendar.
*   **/feed:** The page where a user views events from their subscribed accounts.
*   **/settings:** A parent page for all user settings.
*   **/settings/locations:** The "Manage Locations" screen.
*   **/settings/subscriptions:** The "Manage Subscribed Accounts" screen.
*   **/settings/api-keys:** The "Manage API Keys" screen.
*   **/settings/notifications:** The screen for configuring push notifications.
*   **/reports:** The "User Reports" page — status and history of the user's own submitted reports (PRD 3.9.3). Reachable only via the Profile menu, not part of the primary 5-item nav.
*   **/moderator/items:** The "Moderator Items" page — visible only to users with `role === MODERATOR` (PRD 3.9.3, AD-7.4). Surfaces user reports and pending "Default Location" changes (see State Patterns § Default Location Pending Review) for a moderator to accept or revert. Reachable only via the Profile menu.

### Global Navigation

The five top-level destinations, always reachable from the app shell (see Component Patterns and Responsive & Platform below):

| Label | Route | Icon (Lucide) |
|---|---|---|
| Discover | `/` | `Compass` |
| Feed | `/feed` | `Rss` |
| Favorites | `/favorites` | `Heart` |
| Calendar | `/my-calendar` | `CalendarDays` |
| Profile | see below (auth-dependent) | `UserCircle` / `LogIn` |

"Feed" (not "Following") to stay consistent with the `/feed` route name above.

#### Profile item — authentication states

**Ownership note:** Epic 0/Story 0.7 owns only the *trigger* — rendering this nav slot's icon/state and invoking whichever behavior is described below. The menu itself (its contents, ARIA pattern, and interaction spec below) is owned by **Story 2.8 "User Menu"** (Epic 2, `epics.md`, status `backlog`), which already exists as the story for this feature — Story 0.7 must not build or duplicate it. This correction was made 2026-08-05 after checking `epics.md` (not done before the first draft of this subsection — see `.memlog.md`).

The Profile item is the only nav entry with two distinct states:

- **Unauthenticated — "Log In":** icon `LogIn`, label "Log In". Tap/click **navigates to `/login`** (Story 1.7 "User Signup and Login with Google", Epic 1 — already builds this route, including its own `generateMetadata`). Not a modal — Story 1.7 establishes `/login` as a real page, and this nav item must route to it rather than reinventing an in-place login affordance.
- **Authenticated — avatar, opens a menu:** icon is the user's avatar (falls back to `UserCircle` if no avatar image). Tap/click opens the **User Menu** (Story 2.8) **anchored to the nav item** — a dropdown at the rail tiers (≥768px), a bottom sheet at the mobile tab-bar tier (<768px) — not a full-page navigation and not a blocking modal, so quick actions (especially Log Out) are reachable from anywhere without losing context. `/settings` remains a valid deep-link destination (e.g. from a notification), it just isn't the required first stop.

  **ARIA pattern:** this is a *disclosure of navigation links*, not an application command menu — do **not** use `role="menu"`/`"menuitem"` (WAI-ARIA APG reserves that pattern for desktop-style command menus; 10 of the 11 rows below are plain page links). The trigger is a `<button aria-haspopup="true" aria-expanded={open}>`; the popup content is a plain `<ul><li><a>…</a></li></ul>` list of links, with **Log Out** as a real `<button>` in that same list. If a component library's dropdown-menu primitive is used for convenience (e.g. Radix `DropdownMenu`), it must be swapped for a `Popover` + native list instead — `DropdownMenu` hard-codes menu/menuitem roles and command-menu keyboard behavior (Home/End/typeahead) that don't fit link navigation.

  **Focus behavior:** no focus trap (a focus trap is a dialog-only requirement — trapping here would fight normal Tab-order expectations for a set of nav links). Tabbing past the last item (Log Out) closes the menu and moves focus to the next focusable element after the nav in DOM order, same as any other disclosure. `Escape` explicitly closes it and returns focus to the Profile trigger. Focus-return on close has three distinct cases:
  - **Escape / outside dismiss:** focus returns to the Profile trigger.
  - **Activating a navigation item** (Profile, Locations, Subscribed Accounts, API Keys, Notifications, Reports, Moderator Items): the menu closes and focus follows the app's standard route-change focus management (moves to the destination page's main heading/landmark) — not back to the nav item, which is no longer relevant on the new page.
  - **Log Out:** focus returns to the trigger (deliberate exception — the same DOM node persists, now relabeled "Log In"). If Log Out ever redirects to a different route instead, apply the destination-page rule like other items.

  **Bottom sheet (mobile tab-bar tier, <768px):** in addition to outside-tap and `Escape`, the sheet has an explicit, always-reachable **Close** control (first or last focusable item in the sheet) — outside-tap/Escape alone aren't reliably discoverable/producible on pure-touch, no-keyboard devices. The sheet also honors the Android back gesture/button to close. Drag-down-to-dismiss is an optional touch enhancement, never the only non-Escape path.

  **Icon-only rail tier (768–1279px) interaction:** Profile is **excluded** from the generic "tap navigates and flashes label" rule that applies to the other 4 items at this tier (see Responsive & Platform) — since Profile's target is a disclosure trigger, not a navigation link, a tap/click here opens the menu directly, with no separate flash-then-second-tap step. Opening the menu (by click, tap, `Enter`, or `Space`) always dismisses Profile's *own* hover tooltip immediately, independent of hover/focus-out state (mouse `:hover` can persist after a click while the cursor stays over the icon).

  Menu contents, top to bottom:
  1. Header (non-interactive): avatar + display name.
  2. **Profile** → `/settings`
  3. **Locations** → `/settings/locations`
  4. **Subscribed Accounts** → `/settings/subscriptions`
  5. **API Keys** → `/settings/api-keys`
  6. **Queue Status** → `/settings/queue-status` — per-subscription pending-extraction counts and API key health (Active/Invalid), with a warning link to API Keys if any key is Invalid.
  7. **Notifications** → `/settings/notifications`
  8. **Reports** → `/reports`
  9. **Moderator Items** → `/moderator/items`, *preceded and followed by a divider* — rendered only when the authenticated user's `role === MODERATOR` (PRD 3.9.3, AD-7.4's role model); the item **and both of its surrounding dividers** are absent entirely (not disabled/greyed) for regular users, so a non-moderator sees exactly one divider directly before Log Out, never two adjacent dividers.
  10. **Log Out** — action, not a navigation.

  This formalizes Story 2.8's existing (loose) AC plus PRD 3.9.3's intent ("a dedicated 'Reports' page under their user menu"; "a 'Moderator Items' page will be available under the user menu") into a concrete interaction spec. It **supersedes** Story 2.8's original item list (`epics.md`, pre-2026-08-05: "My Favorites", "My Calendar", "My Locations", "Settings", "Logout") — "My Favorites"/"My Calendar" are dropped as redundant now that both are first-class items in the primary 5-item nav (Story 0.7); "My Locations"/"Settings" are expanded into the full settings-registry set above. Reports and Moderator Items are registered by Stories 4.6 and 4.7 respectively (Epic 4, which already reference "the user menu" generically); Locations/Subscribed Accounts/API Keys/Notifications are registered by Stories 2.3/3.2/3.9/2.9 respectively — Story 2.8 owns the menu *mechanism* and its registry, not the content of every entry. **Queue Status is registered by Story 3.9a** (added 2026-08-11, resolving FR23's previously-orphaned in-app queue-status requirement — see `_bmad-output/implementation-artifacts/3-9a-display-in-app-queue-status-and-api-key-health.md`).

The main view is centered around a filterable, dynamic grid of events that can be viewed as either a card-grid or a weekly calendar. This provides flexibility for users to discover events in their preferred format.

- **Filter Hub**: Prominently displayed at the top of the discovery view, the Filter Hub contains compact dropdown triggers for filtering events by `EventType` and `EventCategory`. Each trigger opens a popover containing tap-to-toggle multi-selection controls, allowing users to combine filters (e.g., `FESTIVAL` + `MUSIC` + `FAMILY_AND_KIDS`).
- **Dynamic Event Grid**: The event grid (both card and calendar view) dynamically updates as filters are applied, showing only the events that match the user's criteria.
- **Calendar View**: The weekly calendar includes a header with previous/next week navigation and a "Today" button. Each schedule of an event is displayed as a separate compact card. The title of the card is formatted to distinguish between main and sub-schedules. Below `{components.calendar.mobile_day_list.breakpoint}` (768px), the 7-column grid becomes a vertical list of days, skipping days with no schedules — see Component Patterns § Mobile Multi-Day Calendar Spanning for how a multi-day schedule renders in that layout.

## Interaction Primitives

- **Filtering**: Users can open an `EventType` or `EventCategory` trigger in the Filter Hub, then tap buttons/tags in its popover. The event grid below will update in real-time with each selection. Selected filters are clearly indicated on the trigger.
- **Event Discovery**: Clicking on an event card in the main grid view opens a modal with the full event details, including a clear display of its types and categories as tags. Clicking on a specific schedule in the calendar view also opens the modal with the full event details. The URL is updated for deep-linking in both cases.
- **Swipe-to-delete:** On mobile touch interfaces, a swipe gesture on a list item can reveal a "Delete" button. This will trigger the "Soft Delete with Undo" state.

## User Flows

- **Default Location for a Subscribed Account:**
  1. User navigates to the "Manage Subscribed Accounts" page (`/settings/subscriptions`).
  2. Each subscribed account's row shows its current default location, if any, and a "Set/Edit Default Location" action, following the In-Table Add Form pattern.
  3. **First time set (no default location on the account yet):** clicking the action reveals a text input field; the user types a location (e.g., "Grand Indonesia Mall, Jakarta") and saves. The location is persisted immediately and associated with the *account* — not the individual subscription — so every other subscriber to that account inherits it too.
  4. **Editing an already-set default location:** the field shows the existing value, editable. Saving is never blocked — the change applies immediately — but it triggers the "Default Location Pending Review" state (see State Patterns), since an edit here silently changes what every other subscriber of the account sees.

## Voice and Tone

The feeling of using FestDaily should be one of exciting discovery. Microcopy should be clear, concise, and helpful. Avoid technical jargon where possible. Provide immediate and clear feedback for user actions (e.g., "Event favorited", "API Key saved").

## Component Patterns

- **Notifications:** The system will use notifications to keep users informed about events and other relevant updates.
- **Accessibility:** All components will be designed and built to meet WCAG 2.1 AA standards, ensuring they are usable by people with a wide range of disabilities.
- **Platform Adaptability:** Components will be responsive and adapt their layout and density for optimal viewing on both mobile and desktop platforms.
- **Motion & Animation:** Subtle animations will be used on interactive elements (like button presses or card selection) to provide feedback and enhance the sense of discovery.
- **Content Density:** Components will adjust their information density based on the screen size, showing more detailed information on larger screens and a more concise version on smaller screens.
- **In-Table Add Form:** For managing lists of items (e.g., API Keys, Subscriptions), the mechanism for adding a new item is an always-present, editable row at the bottom of the table. This row contains the necessary input fields and an "Add" (`+`) action button.
- **Global Navigation:** A single, persistent nav element (never remounted across route changes, never duplicated in the DOM) renders the five items from Information Architecture § Global Navigation, laid out per the breakpoint rules in Responsive & Platform below.
  - **Active item:** indicated by `{colors.nav_active_indicator}` as a leading bar (vertical on the rail, top edge on the mobile tab bar) *and* a filled-vs-outline icon-style swap, so the cue survives even where the bar's contrast is hard to perceive. `aria-current="page"` is set on the active item independent of any visual styling.
  - **Icon-only rail (768–1279px):** every item carries an explicit `aria-label` matching its ≥1280px visible label — this is the accessible name, not the tooltip. The label tooltip appears on `:hover` **and** `:focus-visible` alike, stays visible while focus remains on the item, and dismisses on `Escape` or focus-out.
  - **Touch on the icon-only rail:** a single tap both navigates *and* flashes the item's label for ≥2000ms before it fades (never shortened, only extended, under `prefers-reduced-motion`) — not a two-step reveal-then-navigate.
  - **Hit areas:** every nav item's clickable/tappable region is at least `{components.nav.item_hit_area}`, not just the icon's visual bounds.
  - **Focus ring:** every item gets a visible focus indicator (`{components.nav.focus_ring}`) rendered in a color distinct from the active-bar accent, so "focused" and "active/current page" never collapse into one signal.
  - **Profile item (auth-dependent):** Story 0.7's shell renders this slot's trigger only (icon/state, `/login` navigation when unauthenticated, invoking Story 2.8's User Menu when authenticated) — the User Menu itself (ARIA pattern, focus behavior, dismiss/close affordances, icon-only-rail tap handling, item registry) is Story 2.8's scope; see Information Architecture § Profile item — authentication states.

### Mobile Multi-Day Calendar Spanning

*Added via a targeted `bmad-ux` pass, 2026-08-24 — resolves the deferred half of `ux-rework-2026-08-24.md` item #11 (`sprint-change-proposal-2026-08-24-ux-rework-batch.md` Section 4.8: vertical/skip-empty-days was already scoped for the mobile breakpoint; multi-day-span rendering inside that layout had no design until this pass). Applies to `WeeklyCalendarView` (Story 1.3g) at both its consumers (Discovery's Calendar View, Story 1.3f; "My Calendar", Story 2.6).*

**Breakpoint.** Below `{components.calendar.mobile_day_list.breakpoint}` (768px, matching Global Navigation's existing tier split above — the app's other precedent for a breakpoint-driven layout change), the 7-column week grid (`{components.calendar.grid_weekly}`) is replaced by a vertical list of days (`{components.calendar.mobile_day_list.container}`), one `{components.calendar.mobile_day_list.day_row}` per calendar day that has at least one schedule — days with none are omitted entirely, not rendered empty. Both layouts exist in the DOM simultaneously, toggled by Tailwind's `hidden`/`md:hidden` pairing; per the same rule as Global Navigation's own two-markup case (Accessibility Floor above), only the visually active variant is ever present in the accessibility tree, since `display:none` removes an element from it.

**Multi-day schedules repeat, once per spanned day.** A schedule whose `eventEndDate` differs from `eventStartDate` does **not** render once (on its start day) with a "spans N days" summary. It renders as a normal, fully-interactive compact card in **every** day-row it touches — the exact same per-day segment already computed for the desktop grid (`WeeklyCalendarView`'s `dayBuckets`/`isFirstSegment`/`isLastSegment`, AC4). This keeps one mental model across breakpoints: a schedule's presence on a given day is always its own independently focusable, independently clickable card, never a cross-day summary object with different interaction rules than a single-day card.

**Why no day ever gets "pulled back in" or jumped over.** The skip-empty-days rule is defined per day: a day is empty only if its schedule bucket has zero entries. A day inside a multi-day schedule's span always has at least one entry — its own segment of that schedule — so the rule never has occasion to skip it. There is no separate re-inclusion or "jump the gap" logic to design or build; it is a direct consequence of repeating the segment per day (previous point). This guarantee depends on the next rule holding:

**No cap, no "+N more" popover on the mobile list.** The desktop grid's `{components.calendar.event_rendering.more_link}` overflow-popover mechanism exists because `{components.calendar.day_cell}` is a fixed `h-32` box (see Story 1.3g Dev Notes § "Design Decisions Confirmed With User" for the original tradeoff). A vertical list row has no such fixed-height constraint — it grows to fit its content — so that constraint, and the mechanism it justified, do not carry over. The mobile list ignores `maxEventsPerDay` and always renders a day's full `{components.calendar.mobile_day_list.event_stack}` inline. This is required, not optional: capping on mobile could hide a multi-day segment on one of its spanned days behind "+N more," silently breaking the previous point's continuity guarantee — a user paging or scrolling through would see the event vanish and reappear.

**Visual treatment: a repeated "Day X of N" badge, not a connecting line.** The desktop grid signals continuity between adjacent segments by suppressing the shared border/corner rounding where two day *columns* touch (`multiDayRoundingClass` in `WeeklyCalendarView.tsx`) — it reads as one bar because the columns are physically adjacent. In the vertical list, each day's segment sits inside its own `{components.calendar.mobile_day_list.day_row}`, separated from the next by that row's own `{components.calendar.mobile_day_list.day_row_header}` — there is no shared edge to merge, and building a literal connecting line across non-adjacent, variable-height rows would need new absolute-positioning/measurement machinery this project has no primitive for (checked `packages/ui/src/core/`: `PageContainer`, `GridContainer`, `WeekPicker`, `BlockingLoader`, `MultiSelect` and the rest provide layout/composition, none provide timeline or connector rendering). Instead, every segment of a multi-day schedule keeps the existing `{components.calendar.event_rendering.multi_day_event}` violet background/border as its "this is multi-day" signal, plus a small `{components.calendar.mobile_day_list.multi_day_badge}` reading "Day *X* of *N*" (a small calendar-range icon + text, e.g. lucide-react's `CalendarRange` — confirm the exact icon name against the installed `lucide-react` version at implementation time). `X` and `N` are computed from the schedule's actual `eventStartDate`/`eventEndDate`, not clamped to the currently visible week — the same convention `isFirstSegment`/`isLastSegment` already use — so a schedule spanning a week boundary shows consistent numbering ("Day 3 of 10" on Saturday, "Day 4 of 10" on the following Sunday) as a user pages between weeks. The label is supplied by the caller as a resolver function, mirroring the existing `moreLabel` contract: `labels.multiDaySegmentLabel?: (dayNumber: number, totalDays: number) => string`, falling back to a plain `` `Day ${dayNumber} of ${totalDays}` `` if omitted — the count is only known per-segment inside the component, exactly like `moreLabel`'s existing rationale, so a static pre-resolved string can't work here either.

**Card content and line order.** A mobile list card stacks, top to bottom: (1) title, bold for a main schedule / normal for a sub-schedule (unchanged from desktop), plus the existing favorited/added-to-calendar icons; (2) the time range for that day's segment, rendered as always-visible inline text (`{components.calendar.mobile_day_list.time_range_inline}`) rather than the desktop's hover/focus tooltip — a necessary corollary, since the tooltip's existing show/hide handlers already skip touch pointers entirely (`pointerType !== 'touch'`), so a touch-only mobile user currently has no way to see a schedule's time at all; (3) the favorite count, when present, as its own line (`{components.calendar.mobile_day_list.favorite_count_line}`) — the "calendar items may be two lines tall" decision (`sprint-change-proposal-2026-08-24-ux-rework-batch.md` Section 4.5); (4) the "Day X of N" badge, multi-day segments only. None of these lines compete for space or force truncation, since list rows (unlike the desktop grid's `h-32` cell) size to their content.

**Keyboard/focus model.** The desktop grid's roving-tabindex arrow-key navigation (AC8) is a 2D-grid concern — rows and columns of day cells. The vertical list has no columns, so it does not adopt that model: cards are plain, linear Tab-order stops top to bottom, same as any other list in the app. Enter/Space activation (`onScheduleClick`) and the hover/focus-driven tooltip's `Escape`-to-dismiss behavior are unaffected on the desktop grid; on the mobile list, since time is always visible (no tooltip), there is nothing to dismiss.

**Interaction with the same-week-relative/`>`7-days-absolute date display rule.** No change needed. That rule (Section 4.9) is explicitly scoped to card/list *event* views, not the calendar — "calendar already positions items by absolute day column." The mobile list's day-row headers are themselves each day's absolute-date anchor (same `formatDayHeader` output the grid already uses, left-aligned per `{components.calendar.mobile_day_list.day_row_header}` instead of centered), so the relative-label rule simply does not apply inside the calendar at any breakpoint — confirmed non-conflicting, not extended here.

## State Patterns

### Soft Delete with Undo

This pattern is used for any destructive action on a user-created item (e.g., deleting a saved location, an API key, or a subscription).

**Event-list exception:** unfavoriting an event from the Discover/Favorites list already follows an immediate-commit variant of this pattern today (the toggle call fires at Trigger, and "Undo" re-invokes the same toggle rather than a dedicated restore call) — that existing behavior is the precedent this pattern generalizes to every other surface, not a divergent case to reconcile.

*   **Initial State:** The item is visible in a list, in its normal (not-pending) appearance.
*   **Trigger:** User clicks a "Delete" button (or confirms one revealed via the Swipe-to-delete primitive). Focus is not force-moved anywhere by Trigger itself (see Accessibility Floor § Soft Delete with Undo below) — the triggering control either stays focusable in an updated (e.g., disabled/relabeled) state, or, if this pattern's consuming component removes it from the DOM as part of the pending-state change, focus deliberately moves to the item's own container rather than being left to fall through to the browser default.
*   **Intermediate State (Pending):**
    *   The delete commits to the backend immediately, at the moment of Trigger — a real backend delete, not a deferred/pending call. (Revised 2026-08-06 — see below.)
    *   In that same moment, without waiting for the call's response, the item optimistically switches to its "marked for deletion" appearance — greyed out and/or struck through; at least one non-color cue is required (WCAG 1.4.1) — and stays visible in the list, not removed from view yet.
    *   A toast notification appears with an "Undo" action (e.g., "Item deleted" / "Undo"), rendered per Accessibility Floor § Soft Delete with Undo (live-region announcement, timing, focus, and tab-order rules). The toast auto-dismisses after `{components.notification.undo_duration_ms}`.
*   **"Undo" Action:** If the user clicks "Undo" before the toast dismisses, a restore call reverses the already-committed delete (the same record is restored, not recreated). On success the item returns to its Initial State appearance and the toast dismisses.
*   **Final State (Commit confirmed — timeout path):** If the toast times out without "Undo" being clicked, the item is removed from the visible list by filtering it out of the client's already-loaded list data — no further network call is made, since the delete already committed at Trigger. It does not reappear on the next visit. No separate announcement is required for this removal beyond the toast's own dismissal (a deliberate decision, not an oversight).
*   **Failure path (Trigger-time delete call fails):** If the delete call itself fails (network/server error), the item reverts from its greyed-out-and/or-struck-through appearance back to Initial State, the Undo toast/timer is cancelled, and a distinct error toast is shown instead (e.g., "Couldn't delete — try again"), auto-dismissing after `{components.notification.error_duration_ms}` with a visible close control, and given its own accessibility treatment per Accessibility Floor § Soft Delete with Undo — it is not a lesser-specified variant of the undo toast. Nothing was committed, so there is nothing to undo.
*   **Concurrent deletes:** Each pending item gets its own independent toast (per `useSoftDeleteWithUndo`'s multi-id support). Stacked toasts' live-region announcements queue in trigger order rather than interrupting each other, and their Undo buttons are reachable via Tab in the same order the toasts appeared, so a user who fires several quick deletes can still identify and reach each Undo unambiguously.

**Why revised (2026-08-06):** the prior version of this pattern deferred the backend commit until the user navigated away from the page (component unmount). That silently broke if the user closed the browser tab/window instead of navigating within the app — unmount never fired, so the delete was never committed even though the toast and greyed-out item had already told the user it was. Immediate-commit-at-Trigger removes that failure mode entirely; the trade-off is that "Undo" now must reverse a completed delete rather than simply cancel a pending one, which is why every surface using this pattern needs a real restore/undo delete path on its backend mutation (tracked separately as an architecture item, not specified here).

### Default Location Pending Review

This pattern applies only when a user edits an *already-set* default location on a shared subscribed account — not the first-time-set case, which has no prior value to protect and needs no review.

*   **Initial State:** The account row shows its current default location value.
*   **Trigger:** User edits the value and saves.
*   **Immediate State:**
    *   The new value saves and displays right away — the save is never blocked waiting on a moderator.
    *   A confirmation message acknowledges the save and briefly notes that the change affects every subscriber to this account and has been sent for moderator review — informative, not alarming (Voice and Tone).
    *   The row shows a "Pending Review" badge until a moderator resolves it.
*   **Resolution (external):** A moderator accepts or reverts the change from Moderator Tools (Epic 4). On revert, the row's value reverts to the prior location and the badge clears; on accept, the badge simply clears.

## Responsive & Platform

Global Navigation is the app's original 3-tier responsive component (Tailwind default breakpoints, matching the existing app-shell breakpoint usage); the Calendar View's grid-to-vertical-list swap (Component Patterns § Mobile Multi-Day Calendar Spanning) is a second, simpler 2-tier component using the same `md:` breakpoint:

| Breakpoint | Layout | Label visibility |
|---|---|---|
| `< 768px` | Fixed bottom tab bar, all 5 items | Icon + label always visible |
| `768–1279px` | Left sidenav rail, icon-only | Label on hover/focus tooltip; tap-to-flash on touch |
| `≥ 1280px` | Same rail, permanently expanded | Icon + label always visible |

At the rail tiers (≥768px), the app logo is pinned to the top of the rail; Profile is pinned to the bottom (`mt-auto`); Discover/Feed/Favorites/Calendar sit between them in that order. There is no manual collapse/expand control — the tier is purely a function of viewport width. Only one layout variant is ever present in the accessibility tree at a time (see Accessibility Floor).

## Accessibility Floor

*Scoped to Global Navigation for this pass — the rest of the app's accessibility floor is documented per-component in Component Patterns and should be consolidated here in a future UX pass.*

- **Landmarks:** one persistent `<nav aria-label="Main">` across all breakpoints — CSS drives the layout change, not swapped markup. If mobile/desktop ever require structurally different markup, only one variant may be in the DOM/accessibility tree at a time (`hidden`/`inert` on the other), both sharing the identical `aria-label`, so a screen reader user resizing the viewport never sees two "navigation" regions.
- **Accessible names:** every nav item has an `aria-label` matching its visible label text, present at every breakpoint regardless of whether the label is visually shown.
- **Current page:** `aria-current="page"` on the active item, independent of the visual active-bar/icon-style cue.
- **Focus:** every item has a visible focus ring (`{components.nav.focus_ring}`) distinct in color from the active-bar indicator (`{colors.nav_active_indicator}`), so focus and active-page never read as the same signal.
- **Hover/focus parity:** the icon-only rail's label tooltip triggers on `:focus-visible` as well as `:hover`, persists while focused, and dismisses on `Escape` or focus-out (WCAG 1.4.13).
- **Hit area:** minimum `{components.nav.item_hit_area}` per item, independent of the icon's visual size.
- **Motion:** the touch tap-to-flash label and any rail/tab-bar transition respect `prefers-reduced-motion` (instant show/hide fallback, never a shorter animated fade).

### Soft Delete with Undo (Notification Toast)

*Scoped to the Soft Delete with Undo pattern (State Patterns above) — added 2026-08-06 alongside its immediate-commit revision, following an ad-hoc accessibility review (`review-accessibility-soft-delete-undo.md`).*

- **Live region:** the undo toast renders inside a `role="status" aria-live="polite" aria-atomic="true"` region, so screen reader users hear its content (e.g., "Item deleted. Undo.") as it appears without needing focus to be on the deleted item. The failure-path toast instead uses `role="alert"` / `aria-live="assertive"`, since an error interrupting an in-progress action warrants immediate announcement rather than a polite queue.
- **Timing (WCAG 2.2.1):** the toast's countdown pauses on mouse hover or keyboard focus (already stated in State Patterns), and additionally on assistive-technology virtual-cursor entry into the live region — an AT user "visiting" the toast via swipe navigation (mobile VoiceOver/TalkBack) counts as pausing it, the same as a sighted keyboard user tabbing to it. Regardless of input modality, the Undo button itself (see Hit area/tab order below) is always reachable and clickable/activatable for the toast's full open duration, giving touch-only and AT users a functional equivalent to "extend the timer" — they can always still act, even without a hover-pause gesture available to them.
- **Focus:** the toast does not steal focus when it appears (non-modal — matches APG guidance for status messages); see Trigger's focus-management rule in State Patterns above for what happens to the item's own triggering control.
- **Hit area / tab order:** the Undo action (and the failure toast's close control) is a real, tab-reachable `<button>` inside the live region, meeting `{components.notification.action_hit_area}`. It is reached by continuing to Tab forward from wherever focus currently is — not assumed to be the very next stop after the triggering item, since the toast is portal-rendered outside normal document flow.
- **Non-color cue:** the pending item's "marked for deletion" appearance always includes a non-color signal (greyed out and/or struck through — WCAG 1.4.1), never opacity/color alone.
