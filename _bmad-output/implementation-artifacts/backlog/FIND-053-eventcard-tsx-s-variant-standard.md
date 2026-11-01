---
backlog_id: FIND-053
title: "EventCard.tsx's variant='standard' branch is dead code -- no production call site reaches it"
captured: 2026-09-26
---

# FIND-053: EventCard.tsx's variant='standard' branch is dead code -- no production call site reaches it

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Confirmed 2026-09-26: EventListView.tsx (the only production <EventCard> call site) always passes variant="masonry" explicitly; variant='standard' has no DESIGN.md/EVENT-CARD-DESIGN.md token and appears nowhere in apps/web outside EventCard.tsx's own default parameter and its test fixtures. Delete the branch and its dedicated tests rather than carry it forward or spend further AC-consolidation effort on it. CLOSED 2026-10-05: already shipped 2026-09-26 by commit f214f4e4 (the branch and its tests were removed); this row was never updated.
