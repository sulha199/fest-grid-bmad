---
title: UI Quick Fixes Batch
type: 'bugfix'
created: '2026-08-27'
status: 'in-progress'
review_loop_iteration: 0
context: []
baseline_commit: 'e41913d32a147fb70501c5b4df97608bae0e34ae'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Multiple UI/UX refinements are needed across the application, including rendering favorite counts on the weekly calendar, fixing media display aspect ratios, standardizing nav bar avatar sizing, localizing user menus, adding missing navigation entries, removing redundant buttons, and introducing clear filters.

**Approach:** Implement all 8 quick-fix tasks incrementally, verifying that types are regenerated correctly and each component adheres strictly to project conventions. Ensure zero regression and clean linting and building at the end.

## Boundaries & Constraints

**Always:**
- Keep changes minimal and focused exactly on the bugs/tasks specified
- Run `pnpm run codegen`, `pnpm run lint`, and build validation scripts
- Maintain strict type safety in TypeScript

**Never:**
- Modify GraphQL schemas/resolvers
- Modify `packages/ui`'s `WeeklyCalendarView` or `EventCard` internals directly (except wiring parameters where needed, leaving core structures alone)

</frozen-after-approval>

## Code Map

- `apps/web/src/features/events/queries.graphql`
- `packages/ui/src/hooks/useWeeklyCalendarController.ts`
- `apps/web/src/app/[locale]/feed/FeedCalendarView.tsx`
- `apps/web/src/app/[locale]/my-calendar/my-calendar-content.tsx`
- `apps/web/src/app/[locale]/[platformSlug]/[accountId]/AccountCalendarView.tsx`
- `apps/web/src/features/events/CalendarView.tsx`
- `packages/ui/src/features/events/EventImage.tsx`
- `apps/web/src/components/layout/AppShell.tsx`
- `apps/web/src/components/layout/UserMenu.tsx`
- `apps/web/src/components/layout/AppShellWrapper.tsx`
- `apps/web/src/components/layout/profile-menu-entries.ts`
- `apps/web/locales/en.json`
- `apps/web/locales/id.json`
- `apps/web/src/app/[locale]/home-content.tsx`
- `packages/ui/src/features/events/FilterHub.tsx`

## Tasks & Acceptance

- [x] GraphQL queries updated (`favoriteCount`/`isFavorited` added to the 3 queries) and `pnpm run codegen` run successfully
- [ ] `favoriteCount` wired through `feed-content.tsx`, `useWeeklyCalendarController.ts`, and the downstream calendar view files listed in the Code Map
- [ ] `EventImage.tsx` aspect-ratio fix applied (object-cover -> object-contain on both video and img)
- [ ] Navbar avatar sizing fixed in `AppShell.tsx` and `UserMenu.tsx`
- [ ] `AppShellWrapper.tsx` userMenuLabels gets the 3 missing keys
- [ ] Widgets nav entry added (`profile-menu-entries.ts`, `en.json`, `id.json`)
- [ ] Discovery "Sign In" header button removed in `home-content.tsx`, Sign Out branch and login modal left untouched
- [ ] FilterHub inline `X` clear buttons added for type/category/nearby

## Verification

**Commands:**
- `pnpm run codegen`
- `pnpm run lint`
- `pnpm run build`
