# Story 2.8: User Menu

## Story Details

- Epic: 2
- Story ID: 2.8
- Status: done

## Story

As a logged-in user,
I want to have a user menu,
So that I can easily navigate to my personalized/account sections of the application without leaving the page I'm on.

## Acceptance Criteria

1. **Given** I am not logged in, **when** I look at the Profile slot in the global nav (Story 0.7), **then** it renders as a "Log In" trigger (icon `LogIn`) that navigates to `/login` (Story 1.7) when activated — not a menu.
2. **Given** I am logged in, **when** I click/tap my avatar in the Profile slot, **then** a menu opens **anchored to the nav item** — a dropdown at desktop/tablet rail widths (≥768px), a bottom sheet at mobile widths (<768px) — not a full-page navigation and not a blocking modal.
3. **And** the menu is a *disclosure of navigation links*, not an application command menu: the trigger is `aria-haspopup="true"`/`aria-expanded`; contents are a plain list of links (no `role="menu"`/`"menuitem"`); it does **not** trap focus (Tab past the last item closes it and moves on); `Escape`/outside-click close it and return focus to the trigger; activating a link instead moves focus to the destination page per normal route-change behavior. The bottom sheet has an explicit always-reachable Close control (e.g. an "X" or "Close" button), not just outside-tap/Escape.
4. **And** the menu contains, top to bottom:
   - A non-interactive avatar + display-name header.
   - **Profile** (`/settings`).
   - **Locations** (`/settings/locations`).
   - **Subscribed Accounts** (`/settings/subscriptions`).
   - **API Keys** (`/settings/api-keys`).
   - **Notifications** (`/settings/notifications`).
   - **Reports** (`/reports`).
   - A divider (only visible when Moderator Items is shown, avoiding double dividers for regular users).
   - **Moderator Items** (`/moderator/items`), rendered with its own leading and trailing dividers only when the user's `role === 'MODERATOR'` — otherwise fully absent, not disabled.
   - A divider (always visible).
   - **Log Out** (button trigger).
5. **And** the menu is built as a typed, declarative **registry** (mirroring Story 0.7's primary nav-registry pattern in `nav-entries.ts`), not a hardcoded list — Locations, Subscribed Accounts, API Keys, Notifications, Reports, and Moderator Items are registered entries so future feature stories (e.g., Stories 2.3, 3.2, 3.9, 2.9, 4.6, 4.7) can enable them without this story needing those destination pages to exist yet. This story only needs to define the registry shape and seed it with Profile and Log Out (the two entries this story does own), plus the other entries as inactive or placeholders in the registry.
6. **And** clicking "Log Out" calls `useAuthSession().signOut()` (from `@/components/providers/auth-session-provider`) and returns the user to the unauthenticated state (Profile slot reverts to the "Log In" trigger); focus returns to the trigger element (deliberate exception to the "focus follows destination" rule, since the same DOM node persists, now relabeled).
7. **And** the Moderator Items link's visibility check (`role === 'MODERATOR'`) reads from the generated `useMeQuery` (Query.me already resolves role), not from `useAuthSession()`'s context value which lacks role information.
8. **And** the Profile trigger at the icon-only rail tier (768px-1279px) is explicitly excluded from the generic tap-to-flash behavior — a single tap (or click/Enter/Space) opens the menu directly, dismisses that same item's own hover tooltip immediately (independent of hover/focus-out state), and does not flash.
9. **And** each row's tappable region has a minimum height of 44px (`min-h-11`) and spans the full width of the menu/sheet (`w-full` or block-level) to ensure a high-quality touch target.

---

## Tasks / Subtasks

- [ ] **Task 1: Define the User Menu Registry** (AC: 4, 5)
  - [ ] Create `packages/ui/src/core/app-shell/profile-menu-entries.ts` exporting a `ProfileMenuEntry` interface:
    ```typescript
    import { LucideIcon } from 'lucide-react';

    export interface ProfileMenuEntry {
      id: string;
      labelKey: string; // e.g. 'profile', 'locations', 'subscriptions', 'apiKeys', 'notifications', 'reports', 'moderatorItems', 'logout'
      href?: string;     // Nullable for buttons like 'Log Out'
      icon: LucideIcon;
      requiresModerator?: boolean;
    }
    ```
  - [ ] Define and export `profileMenuEntries: ProfileMenuEntry[]` containing:
    - Profile (`id: 'profile'`, `href: '/settings'`, icon `User`)
    - Locations (`id: 'locations'`, `href: '/settings/locations'`, icon `MapPin`)
    - Subscribed Accounts (`id: 'subscriptions'`, `href: '/settings/subscriptions'`, icon `Radio`)
    - API Keys (`id: 'api-keys'`, `href: '/settings/api-keys'`, icon `Key`)
    - Notifications (`id: 'notifications'`, `href: '/settings/notifications'`, icon `Bell`)
    - Reports (`id: 'reports'`, `href: '/reports'`, icon `FileText`)
    - Moderator Items (`id: 'moderator-items'`, `href: '/moderator/items'`, icon `ShieldAlert`, `requiresModerator: true`)
  - [ ] Export everything from `packages/ui/src/core/app-shell/index.ts`.

- [ ] **Task 2: Build the Responsive User Menu Component** (AC: 2, 3, 4, 9)
  - [ ] Create a new component `packages/ui/src/core/app-shell/UserMenu.tsx` (using standard Tailwind CSS, Popover from Radix or custom, and a simple drawer overlay).
  - [ ] Ensure the desktop version (≥768px) is implemented as a non-modal Popover that does **not** trap focus:
    - Anchored below/aside the Profile trigger.
    - Standard HTML structure: a container containing a `<ul>` list of navigation links and buttons.
    - Tab key navigates naturally through the list, and tabbing past "Log Out" closes the popover and moves focus onwards.
  - [ ] Ensure the mobile version (<768px) is implemented as a Bottom Sheet / Drawer:
    - Displays from the bottom of the screen.
    - Includes a non-interactive header (avatar + display name) and a scrollable list of registry items.
    - Includes a visible, easily reachable Close button (`aria-label="Close menu"`) as the first or last focusable control.
    - Keyboard Escape or outside-click/tap dismisses the sheet and returns focus to the trigger.
  - [ ] Implement design tokens:
    - Use token classes for hit areas (`min-h-11 w-full flex items-center gap-3 px-4 py-2 hover:bg-muted text-sm rounded-md transition-colors`).
    - Handle regular vs moderator user divider rendering: avoid double dividers when Moderator Items is absent. Regular users see exactly one divider directly before "Log Out".

- [ ] **Task 3: Integrate Auth Session and GraphQL meQuery** (AC: 4, 6, 7)
  - [ ] In `apps/web/src/components/layout/AppShellWrapper.tsx`:
    - Retrieve the current user's role by calling `useMeQuery` with the `graphqlClient` and mapping `role === 'MODERATOR'`.
    - Pass a custom state handler `onProfileTriggerActivate` that opens the newly-created `UserMenu`.
    - Connect the Log Out item's action to `useAuthSession().signOut()`. On success, reset state and focus back to the Profile nav item.
  - [ ] Ensure that labels/translations for user menu options are added to the corresponding i18n locales (Indonesian and English) under `Nav` or a new `UserMenu` namespace.

- [ ] **Task 4: Tooltip & Touch Interaction Refinements** (AC: 8)
  - [ ] Exclude the Profile trigger button from the default tap-to-flash behavior of the 768px-1279px rail tier in `useNavRailItemInteraction`. A touch on the Profile trigger must open the menu immediately on first tap.
  - [ ] Ensure that opening the menu (via tap, click, Enter, or Space) immediately sets `tooltipVisible` to `false` and dismisses the hover tooltip for that item, preventing any tooltip from remaining visible behind or next to the opened menu.

- [ ] **Task 5: Testing and Quality Assurance** (AC: 1-9)
  - [ ] Create tests to verify that:
    - The menu remains hidden for unauthenticated users, and clicking the profile item navigates directly to `/login`.
    - Authenticated users clicking/tapping the profile trigger opens the menu (popover on desktop, bottom-sheet on mobile).
    - Opening the menu dismisses the nav item tooltip immediately.
    - Escape key or outside clicks dismiss the menu and return focus to the trigger.
    - Focus does not trap on desktop, and tabbing past "Log Out" closes the menu.
    - Regular users do not see the "Moderator Items" link and avoid duplicate dividers.
    - Moderator users see the "Moderator Items" link with single dividers framing it.
  - [ ] Run `pnpm build`, `pnpm lint`, and verify all tests pass.

---

## Dev Notes

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (Architecture/Infra + Foundational Dependency Completeness):** Sourced from `_bmad-output/planning-artifacts/epic-readiness/epic-2-readiness.md` (`swept: true`). Story 2.8 is covered, and no outstanding gaps were found for this story. Since it relies on the already established `useAuthSession` (Story 1.7) and `useMeQuery` (Story 0.17/0.8), it clears Gate 1 and 3 without requiring any new backend infrastructure changes.
- **Gate 2 (UI Complexity & Reusability):** Sourced from `design-artifacts/UX-festgrid-run-1/review-accessibility-profile-menu.md` and `EXPERIENCE.md` § Profile item — authentication states.
  - **Verdict:** Highly precise interaction design and accessibility constraints apply. A default Popover/Dropdown from Radix needs customization because a normal navigation menu consists of plain links, not application action buttons, which would incorrectly force `role="menu"` and `role="menuitem"`. We must avoid trapping focus on desktop, while ensuring proper focus-return behavior.
  - **Resolution:** Explicitly specified in AC 3 and Task 2 to build this as a Popover disclosing standard list navigation links rather than standard command `DropdownMenu`. Excluded from tap-to-flash, with specific divider layout adjustments, and full-width touch hit area heights of 44px (`min-h-11`).

### Design Decisions Confirmed With User (2026-08-06)

1. **A11y-First Dropdown Swapping:** Instead of Radix's standard `DropdownMenu` (which hardcodes `role="menu"`/`"menuitem"`), we use Radix `Popover` or native custom markup containing standard list navigation links `<ul><li><Link href="...">...</Link></li></ul>`. This meets APG guidelines because navigation elements are actual document links rather than application action items.
2. **Registry Seeding Approach:** The registry is seeded with Profile and Log Out. Other items like Locations, Subscribed Accounts, API Keys, Notifications, Reports, and Moderator Items are fully registered but links will route to placeholders until their respective stories are completed, avoiding dead routing in MVP.
3. **No Double Dividers:** Regular users see exactly one divider before "Log Out" (Moderator Items and its framing divider are completely omitted from the DOM when not authenticated as moderator).
