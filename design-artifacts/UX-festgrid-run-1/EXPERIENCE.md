---
title: "EXPERIENCE.md: festgrid"
status: "draft"
created: "2026-07-20T10:59:00Z"
updated: "2026-08-05T00:00:00Z"
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
  6. **Notifications** → `/settings/notifications`
  7. **Reports** → `/reports`
  8. **Moderator Items** → `/moderator/items`, *preceded and followed by a divider* — rendered only when the authenticated user's `role === MODERATOR` (PRD 3.9.3, AD-7.4's role model); the item **and both of its surrounding dividers** are absent entirely (not disabled/greyed) for regular users, so a non-moderator sees exactly one divider directly before Log Out, never two adjacent dividers.
  9. **Log Out** — action, not a navigation.

  This formalizes Story 2.8's existing (loose) AC plus PRD 3.9.3's intent ("a dedicated 'Reports' page under their user menu"; "a 'Moderator Items' page will be available under the user menu") into a concrete interaction spec. It **supersedes** Story 2.8's original item list (`epics.md`, pre-2026-08-05: "My Favorites", "My Calendar", "My Locations", "Settings", "Logout") — "My Favorites"/"My Calendar" are dropped as redundant now that both are first-class items in the primary 5-item nav (Story 0.7); "My Locations"/"Settings" are expanded into the full settings-registry set above. Reports and Moderator Items are registered by Stories 4.6 and 4.7 respectively (Epic 4, which already reference "the user menu" generically); Locations/Subscribed Accounts/API Keys/Notifications are registered by Stories 2.3/3.2/3.9/2.9 respectively — Story 2.8 owns the menu *mechanism* and its registry, not the content of every entry.

The main view is centered around a filterable, dynamic grid of events that can be viewed as either a card-grid or a weekly calendar. This provides flexibility for users to discover events in their preferred format.

- **Filter Hub**: Prominently displayed at the top of the discovery view, the Filter Hub contains controls for filtering events by `EventType` and `EventCategory`. These controls will support multi-selection, allowing users to combine filters (e.g., `FESTIVAL` + `MUSIC` + `FAMILY_AND_KIDS`).
- **Dynamic Event Grid**: The event grid (both card and calendar view) dynamically updates as filters are applied, showing only the events that match the user's criteria.
- **Calendar View**: The weekly calendar includes a header with previous/next week navigation and a "Today" button. Each schedule of an event is displayed as a separate compact card. The title of the card is formatted to distinguish between main and sub-schedules.

## Interaction Primitives

- **Filtering**: Users can tap on `EventType` or `EventCategory` buttons/tags in the Filter Hub. The event grid below will update in real-time with each selection. Selected filters are clearly indicated.
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

## State Patterns

### Soft Delete with Undo

This pattern is used for any destructive action on a user-created item (e.g., deleting a saved location, an API key, a subscription, or unfavoriting an event from a list).

*   **Initial State:** The item is visible in a list.
*   **Trigger:** User clicks a "Delete" or "Unfavorite" button.
*   **Intermediate State:**
    *   The item is not immediately removed from the list in the UI.
    *   The item's appearance changes to indicate it is "marked for deletion" (e.g., it becomes greyed out or has a strikethrough).
    *   An "Undo" button appears next to or within the item's row.
    *   A temporary confirmation message (e.g., a toast notification) appears, saying "Item deleted" with an "Undo" action.
*   **"Undo" Action:** If the user clicks "Undo", the item returns to its initial state. The deletion is cancelled.
*   **Final State (Commit):** The deletion is committed (i.e., the backend call is made and the item is permanently removed from the user's view) when the user navigates away from the current page. The next time the user visits the page, the item will be gone.

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

Global Navigation is the app's one 3-tier responsive component (Tailwind default breakpoints, matching the existing app-shell breakpoint usage):

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
