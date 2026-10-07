---
backlog_id: FIND-031
title: "Event-detail page client-side hygiene: unmemoized prop mapper, raw <img> instead of next/image on hero and carousel-peek images"
captured: 2026-09-15
---

# FIND-031 — Event-detail client-side hygiene

## Capture

Found via `bmad-agent-architect` audit (2026-09-15), secondary to the backend findings
(BUG-033/034/035).

- `mapGraphQLEventToDetailViewProps(...)` runs unmemoized in `EventDetailWrapper.tsx`'s render
  body (~461-463), rebuilding the schedules array on every re-render (dialog open/close,
  liveMessage updates) — likely cheap for a single event, but not memoized.
- Both the hero image (`packages/ui/src/features/events/EventImage.tsx:88-91`) and the
  carousel-peek images (`event-preview-card.tsx:41-47`) use raw `<img>`, not `next/image` — no
  responsive srcset/format optimization; the peek images additionally have no `loading="lazy"`.

Low priority relative to BUG-032/033/034; bundled as one item since all three are
event-detail-page client-side polish, not separate root causes.

Not yet scoped into a story.

## Resolution (2026-10-07, `bmad-quick-dev`, implemented directly — no story)

User-decided scope: memoize the mapper, and adopt `next/image` on the hero and
carousel-peek images. Before touching code, checked `_bmad-output/project-context.md`
and the PRD per this workflow's mandatory references; the project-context check
surfaced a blocker not visible from the finding alone, so scope was narrowed via
`AskUserQuestion` (twice) rather than guessed:

1. **Mapper memoized.** `EventDetailWrapper.tsx`'s `mapGraphQLEventToDetailViewProps(...)`
   call is now wrapped in `useMemo`, keyed on its actual inputs
   (`data?.eventBySlug`, `labels`, `locale`, `tType`, `tCategory`, `resolvedInstagramEmbed`,
   `subscriptionsData?.mySubscriptions`, `pendingCoauthorAccountId`). Declared above the
   component's early returns (hidden-for-current-user / not-found views) — a hook placed
   after those conditional `return`s would violate the Rules of Hooks (confirmed by a
   "Rendered fewer hooks than expected" failure on first attempt, fixed by moving it up
   next to the component's other top-level hooks).

2. **Carousel-peek → `next/image`.** `event-preview-card.tsx` lives in `apps/web` (not
   `packages/ui`), so no framework-agnosticism concern. Converted to `next/image` with
   `fill` (container is already `relative` + sized) and `unoptimized`: `imageUrl` is a
   hotlinked URL from whatever arbitrary scraped-platform CDN the source post lived on,
   and `next.config.js` deliberately has no `images.remotePatterns` configured (its own
   `img-src` CSP comment explains why that host set can't be statically enumerated) — a
   plain optimized `next/image` would throw at runtime for real data. `unoptimized` still
   gets native lazy-loading (addressing the finding's `loading="lazy"` sub-note) without
   requiring a remote-host allowlist.

3. **Hero → NOT converted, carved out as [FIND-075].** `EventImage.tsx` lives in
   `packages/ui`, which `project-context.md` requires to stay decoupled from
   Next.js-specific APIs (the same principle documented for `useScopedLocale`/
   `useScopedTimezone` vs. `next-intl`) — zero `next/image` precedent anywhere in
   `packages/ui`, and the component's video/unknown-until-load-aspect-ratio design
   doesn't fit `next/image`'s `width`/`height` contract anyway. Confirmed via
   `AskUserQuestion`: keep the raw `<img>` rather than coupling the shared package to
   Next.js or building a new wrapper abstraction outside this row's `xs` effort scope.

Verified: `pnpm --filter web test -- event-preview-card EventDetailWrapper mapper.test`
(84 passed) and `pnpm --filter web lint` (0 errors; pre-existing warnings only, none in
the touched files) — both scoped to the touched package, no whole-repo run.
