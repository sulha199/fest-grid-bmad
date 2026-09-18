---
backlog_id: BUG-031
title: "Infinite scroll jumps to the very bottom after loading a page (mobile always, desktop sometimes)"
captured: 2026-09-15
fixed: 2026-09-17
---

# FestDaily backlog note: BUG-031

## Finding

User report via `bmad-help` (2026-09-15). On the paginated list surfaces, once the
user scrolls to the bottom and the next page of results loads in-place, the
viewport sometimes jumps straight to the very bottom of the list instead of
staying where it was.

- **Desktop:** behavior is **intermittent** — sometimes the scroll position is
  preserved (correct behavior), sometimes the viewport immediately jumps to the
  very bottom. When it jumps, the user has to scroll back up to reach the newly
  loaded content and to be able to trigger the next pagination load again.
- **Mobile:** the jump to the very bottom happens **every time** after the next
  pagination triggers.

## Affected surface

Shared infinite-scroll mechanism, not a single page:

- `packages/ui/src/hooks/useInfiniteScroll.ts` (+ `.types.ts`) — the
  `IntersectionObserver`-based sentinel hook used by every paginated list.
  Defaults: `rootMargin: '200px'`, `threshold: 0`; calls `fetchNextPage()` when
  the sentinel intersects, guarded by `hasNextPage` / `isFetchingNextPage`.
- Consumers (all combine `useInfiniteScroll` with React Query's `useInfiniteQuery`):
  - `apps/web/src/app/[locale]/home-content.tsx` (Discovery)
  - `apps/web/src/app/[locale]/feed/feed-content.tsx` (Feed)
  - `apps/web/src/app/[locale]/favorites/favorites-content.tsx` (Favorites)
  - `apps/web/src/app/[locale]/archive/archive-content.tsx` (Archive)
  - `apps/web/src/app/[locale]/[platformSlug]/[accountId]/account-content.tsx`
    (Account)

## Hypothesis (unconfirmed)

When the next page's rows are appended, the content height below the user's
current position grows. The jump-to-the-bottom symptom suggests the scroll
container's position is not being preserved after the append — either the
browser's native scroll anchoring interacts badly with the newly inserted rows
above the sentinel, or something actively scrolls to the end once the sentinel
re-renders (e.g. a `scrollTop` reset, a re-render that re-anchors to the sentinel
node, or focus/keyboard navigation into appended content). The `rootMargin:
'200px'` pre-fetch means the sentinel is already below the viewport when the
fetch fires, so the jump is unlikely to be a simple "sentinel still intersecting"
loop. Needs diagnosis (device/OS/scroll-container reproduction, DOM
inspection after append) before a fix is scoped.

## Diagnosed & Fixed, 2026-09-17 (bmad-quick-dev)

**Root cause confirmed:** the sentinel element's height collapses after page load because the
spinner-containing content disappears, causing browser scroll-anchoring to jump. The sentinel
displays tall (~48-60px) when `isFetchingNextPage=true` (spinner visible), then shrinks to
~28px when `isFetchingNextPage=false` (just `py-4` padding), triggering scroll anchoring on
appended items.

**Fix applied:**
1. Added `min-h-16` to `EventListView.tsx`'s sentinel to maintain consistent height.
2. Added a "You've reached the end" indicator when `!hasNextPage` (visible UX feedback, as the
   user suggested).
3. Updated `EventListViewProps` interface to accept an optional `hasNextPage` prop.
4. Updated all 5 consumers (Discovery/Feed/Favorites/Archive/Account) to pass `hasNextPage`
   from `useInfiniteQuery`.

**Changes:** `packages/ui/src/features/events/EventListView.tsx`/`.types.ts` (min-height +
end-of-list indicator), `apps/web/src/app/[locale]/{home,feed,favorites,archive,[platformSlug]/[accountId]}/xxx-content.tsx`
(pass `hasNextPage` prop).

Verified no breaking changes — `hasNextPage` is optional for backward compatibility; existing
consumers without it render end-of-list text only when explicitly `false`.

**Note:** this fix's mechanism (sentinel height collapse) is what also plausibly closes
BUG-018's real-world symptom — see BUG-018's own history in Story 0.i5b's Dev Notes.

## Status

~~Open backlog bug~~ **Fixed 2026-09-17** (see above). Tracked as `BUG-031` on `backlog.yaml`.
