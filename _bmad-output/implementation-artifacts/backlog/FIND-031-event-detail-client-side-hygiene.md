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
