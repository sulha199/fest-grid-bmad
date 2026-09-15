---
backlog_id: BUG-031
title: "Infinite scroll jumps to the very bottom after loading a page (mobile always, desktop sometimes)"
captured: 2026-09-15
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

## Status

Open backlog bug — not yet scoped into a story. Estimated `effort: s` (one story:
fix in the shared hook / scroll handling plus regression verification across all
five consumers on both mobile and desktop). Tracked as `BUG-031` on
`backlog.yaml`.
