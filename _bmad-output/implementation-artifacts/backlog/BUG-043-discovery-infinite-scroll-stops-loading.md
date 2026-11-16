---
backlog_id: BUG-043
title: "Discovery infinite scroll stops loading after exactly one extra page despite hasMore:true"
captured: 2026-09-26
---

# BUG-043: Discovery infinite scroll stops loading after exactly one extra page despite hasMore:true

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Found via live-deployment visual audit (https://fest-grid.vercel.app/id) at user's request. Original observation: scrolled to bottom 6 times, fetch fired exactly once (10->20->30), then stopped despite hasMore:true/totalCount:123. Note's own hypothesis (masonry's JS engine, Story 0.45, absolutely-positioning items and breaking the sentinel) was CHECKED 2026-09-29 by reading grid-container.tsx's actual masonry branch -- no `position: absolute` anywhere, plain flex columns, real DOM children; the sentinel is also a sibling outside GridContainer entirely (EventListView.tsx) so masonry layout can't affect it. Hypothesis was wrong, but the underlying bug is CONFIRMED FIXED regardless: user reported it works now, independently re-verified live against https://fest-grid.vercel.app/id via a scripted Playwright run (8 scrolls, cards grew 20->30->40->50->60->70->80->90->100, one getEvents request fired per scroll, no stall). Root cause of the original stall (and whichever commit fixed it) was never identified -- likely subsumed by one of the several other infinite-scroll fixes landed 2026-09-26 (BUG-045/046) or the masonry engine rewrite itself -- but the symptom no longer reproduces.
