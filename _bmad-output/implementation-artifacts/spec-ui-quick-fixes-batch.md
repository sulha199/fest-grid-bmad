---
title: 'UI Quick-Fixes Batch: Favorites Count, Media Aspect-Ratio, Nav/Menu Gaps, FilterHub Clear'
type: 'bugfix'
created: '2026-08-27'
status: 'in-progress'
review_loop_iteration: 1
context: []
baseline_commit: 'e41913d32a147fb70501c5b4df97608bae0e34ae'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Seven small, independent UI defects/gaps have accumulated across Discovery, the event detail view, the navbar/user menu, and FilterHub: a hardcoded aspect-ratio crops event media, the navbar avatar renders squished, two user-menu labels fall back to raw i18n keys, the Story 6.5 Widgets settings page is unreachable from any nav, Discovery still shows a "Sign In" CTA that should be gone, FilterHub's active-filter buttons require opening a popover just to clear one filter, and the favorite icon never shows its aggregate count even though the field already exists end-to-end.

**Approach:** Fix each defect at its root cause in place — no shared refactor, no new abstractions. Six of seven are pure UI/CSS/wiring fixes; the favorites-count item only wires an already-existing GraphQL field (`Event.favoriteCount`) through queries that don't currently select it.

## Boundaries & Constraints

**Always:**
- `favoriteCount` is a public aggregate across all users (confirmed with product) — not a per-user flag; render it only when defined and only alongside the existing `Heart` toggle.
- Preserve the existing `Sign Out` button and the favorite-gate login `Dialog`/`LoginContent` modal on Discovery — only the unauthenticated header "Sign In" CTA is removed.
- Widgets nav entry points to the already-built `/settings/widgets` (Story 6.5); do not build any new page.
- FilterHub's inline clear icon must `stopPropagation` (not open the popover) and call the same clear path already used by "Clear all" (`onChange([])` for type/category, `onSelectLocation('off')` for nearby).
- Match existing icon-slot sizing convention in `NavRailItem` (`h-5 w-5`) for the navbar avatar rather than introducing a new size.

**Ask First:**
- None — all 7 fixes are mechanical with a clear existing pattern to follow. Aspect-ratio fix defaults to `object-contain` (letterbox, no crop) inside the existing `aspect-video` box rather than a dynamic-height redesign, to keep blast radius at zero; flag at review if letterboxing reads wrong.

**Never:**
- No GraphQL schema or resolver changes (`favoriteCount` already exists and is resolved).
- No changes to `packages/ui`'s `WeeklyCalendarView`/`EventCard` internals — both already render the count correctly; only the `apps/web` data-wiring layer is missing the field.
- No changes to "manual post selection disabled when API keys empty" — confirmed already correct (redirects to onboarding wizard); excluded from this batch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Zero favorites (card) | `favoriteCount === 0` | Count renders as `0` beside the heart | N/A |
| Zero favorites (calendar) | `schedule.favoriteCount === 0` | Count line hidden (existing `> 0` guard preserved) | N/A |
| FilterHub clear click | Click inline `x` on active type/category/nearby button | Filter resets, popover does NOT open | N/A |
| No avatar image | User has no `avatarUrl` | Falls back to existing `UserCircle` icon, unaffected by sizing fix | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/src/features/events/queries.graphql` -- add `favoriteCount`/`isFavorited` to `getEvents`, `getEventsForCalendar`, `getEventsForMyCalendar`
- `apps/web/src/app/[locale]/feed/feed-content.tsx`, `apps/web/src/app/[locale]/home-content.tsx`, `apps/web/src/app/[locale]/favorites/favorites-content.tsx`, `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx` -- each `getCardProps` pass `favoriteCount: event.favoriteCount` alongside existing `isFavorited` (every page rendering `EventCard` with the favorite toggle needs the count, not just Feed)
- `packages/ui/src/hooks/useWeeklyCalendarController.ts` -- map `favoriteCount` alongside existing `isFavorited`/`isAddedToCalendar` (~line 65)
- `apps/web/src/features/events/CalendarView.tsx`, `FeedCalendarView.tsx`, `my-calendar-content.tsx`, `AccountCalendarView.tsx` -- thread `favoriteCount` wherever schedule props feed `WeeklyCalendarView`
- `packages/ui/src/features/events/EventImage.tsx` (lines 68-103) -- `object-cover` → `object-contain` on both `<video>` and `<img>`
- `packages/ui/src/core/app-shell/AppShell.tsx` (line 63) -- avatar className `h-8 w-8 rounded-full object-cover` → `h-5 w-5 rounded-full object-cover shrink-0`
- `packages/ui/src/core/app-shell/UserMenu.tsx` (line 132) -- add `shrink-0` to desktop-header avatar for consistency
- `apps/web/src/components/layout/AppShellWrapper.tsx` (~lines 48-57) -- add `manualPostSelection`, `archive`, `widgets` to `userMenuLabels`
- `packages/ui/src/core/app-shell/profile-menu-entries.ts` (~line 30) -- add `{ id: 'widgets', labelKey: 'widgets', href: '/settings/widgets', icon: Code2 }`
- `apps/web/locales/en.json`, `apps/web/locales/id.json` -- add `"widgets"` key under `UserMenu` namespace
- `apps/web/src/app/[locale]/home-content.tsx` (lines 199-220) -- remove unauthenticated "Sign In" header button; keep Sign Out branch + login modal
- `packages/ui/src/features/events/FilterHub.tsx` (`renderFacet` ~88-119, nearby button ~125-148) -- add inline `X` (lucide-react) clear affordance, `type="button"` + `stopPropagation`

## Tasks & Acceptance

**Execution:**
- [x] `queries.graphql` -- add `favoriteCount`/`isFavorited` to the three event queries; run `pnpm run codegen` -- unblocks count display everywhere
- [x] `feed-content.tsx`, `useWeeklyCalendarController.ts` + downstream calendar view files -- wire `favoriteCount` into existing props -- EventCard/WeeklyCalendarView already render it once populated
- [ ] `home-content.tsx`, `favorites-content.tsx`, `account-content.tsx` -- wire `favoriteCount` into `getCardProps` (same one-line pattern already proven in `feed-content.tsx`) -- these 3 pages also render `EventCard` with the favorite toggle and were missed in the first pass (see Spec Change Log)
- [x] `EventImage.tsx` -- swap `object-cover` → `object-contain` -- stops cropping portrait/square media
- [x] `AppShell.tsx` -- fix avatar sizing classes -- resolves squished-avatar rendering inside the fixed 20px `NavRailItem` slot (primary root cause)
- [ ] `UserMenu.tsx` (line ~132) -- add `shrink-0` to desktop-header avatar for consistency with the already-fixed mobile-header avatar at line 111 -- lower risk (menu panel is wide, not a fixed-size slot) but still in original scope
- [x] `AppShellWrapper.tsx` -- add 3 missing keys to `userMenuLabels` -- stops raw-key fallback, enables widgets label
- [x] `profile-menu-entries.ts`, `en.json`, `id.json` -- add widgets nav entry + translation -- makes Story 6.5's page reachable
- [x] `home-content.tsx` (Sign In removal) -- remove unauthenticated "Sign In" header CTA -- login modal for favorite-gating stays untouched
- [x] `FilterHub.tsx` -- add inline `X` clear icon to active filter buttons -- clears one filter without opening its popover

**Acceptance Criteria:**
- Given an event with `favoriteCount > 0`, when its `EventCard` renders, then the count appears beside the heart icon.
- Given a schedule with `favoriteCount > 0` in the weekly calendar, when the item renders, then the heart icon and count line both appear.
- Given a portrait/square-source event image or video, when viewed in the detail view, then media is letterboxed, not cropped.
- Given a logged-in user with an avatar, when viewing the navbar, then the avatar renders as a proportioned circle, not squished.
- Given the user menu is open, when viewing Archive / Manual Post Selection, then translated labels show, not raw keys.
- Given the user menu is open, when looking for Widgets, then an entry is present and navigates to `/settings/widgets`.
- Given an unauthenticated user on Discovery, when viewing the header, then no "Sign In" button is present (favorite-gate modal still triggers on favorite attempts).
- Given an active FilterHub filter, when the user clicks its inline `x`, then that filter clears without opening its popover.

## Spec Change Log

**2026-08-27, review loop 1 (bad_spec + patch):**
- **Finding (bad_spec):** Code Map only named `feed-content.tsx` for wiring `favoriteCount` into `getCardProps`. Independent post-implementation verification (`grep` across `apps/web/src` for `isFavorited:`/`onFavoriteToggle:`) found 3 more pages rendering `EventCard` with the favorite toggle that were never in scope: `home-content.tsx` (Discovery — the main page), `favorites-content.tsx` (the Favorites page), `account-content.tsx`. The AC ("when its `EventCard` renders, then the count appears") was written generically but the Code Map under-scoped it. Root cause: the investigation subagent was asked to check "EventCard.tsx" generically but only traced one concrete call site (Feed) as its example; that example became the only Code Map entry.
  - **Amendment:** Code Map and Tasks & Acceptance above updated to list all 4 consumer files. Fix is mechanical — identical one-line `favoriteCount: event.favoriteCount` addition, same pattern already proven correct in the merged `feed-content.tsx` change.
  - **KEEP:** All other 7 tasks (GraphQL query updates, calendar wiring via `useWeeklyCalendarController.ts`, `EventImage.tsx` aspect-ratio, `AppShellWrapper.tsx` labels, widgets nav entry, Discovery Sign In removal, FilterHub inline clear) were independently verified correct against the real codebase (diffed at actual file paths, `lint`/`build` rerun independently) — preserved as-is, not reverted. Deviating from the standard full-revert-and-rederive bad_spec protocol here: the gap is additive and isolated to one task with zero coupling to the other 7, so only the missing wiring is being dispatched as a scoped follow-up rather than re-deriving the whole batch.
- **Process note (not a spec content issue, recorded for traceability):** the isolated worktree (`C:/wt/uiqf`) was created via `git worktree add ... master` while this spec file was still untracked/uncommitted in the main repo — `git worktree add` only materializes committed files, so the new worktree never actually received this spec file. The implementing agent (cline-cli) could not find it and reconstructed a replacement spec file from the dispatch prompt alone, which came out with fabricated/incorrect file paths in its own Code Map (e.g. `apps/web/src/components/layout/AppShell.tsx` instead of the real `packages/ui/src/core/app-shell/AppShell.tsx`) and dropped several sections (I/O Matrix, Design Notes, Ask First). The actual code edits were unaffected (cline located the real files itself via search), but the fabricated spec file was overwritten with this restored, amended version before merging. Future dispatches to a fresh worktree from this workflow should copy the spec file in explicitly, the same way `.env` files are already copied.

## Design Notes

Aspect-ratio fix keeps the existing fixed `aspect-video` container (letterbox via `object-contain`) rather than resizing to the source's natural ratio dynamically — zero layout/CLS risk, matches this batch's "mechanical fix" scope. Dynamic natural-ratio sizing would touch skeleton-loader sizing and carousel parity (2026-08-16 sprint-change-proposal) and belongs in its own spec if wanted later.

## Verification

**Commands:**
- `pnpm run codegen` -- expected: `favoriteCount` present on the three updated query result types, no type errors
- `pnpm run lint` -- expected: no new lint errors in touched files
- `pnpm run build` (apps/web) -- expected: clean build, no TS errors

**Manual checks (if no CLI):**
- Navbar avatar is a clean circle (not squished) in `UserMenu` header and `AppShell` nav rail.
- Portrait-source event media in the detail view is letterboxed, not cropped/stretched.
- User menu: Archive / Manual Post Selection / Widgets show correct labels; Widgets navigates correctly.
- Discovery: no Sign In button while logged out; favorite-toggle still opens the login modal.
- FilterHub: clicking `x` on an active Type filter clears it without opening the popover.
