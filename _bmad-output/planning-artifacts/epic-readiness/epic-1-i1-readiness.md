---
epic: 1-i1
swept: true
date: 2026-09-13
stories_covered:
  - 1.i1a
  - 1.i1b
  - 1.i1c
  - 1.i1d
  - 1.i1e
  - 1.i1z
---

# Epic 1.i1 Readiness Report — One card primitive for every event-card image slot and badge

## Gate 1 — Architecture / Infrastructure Completeness

**No gap found.** Every story (1.i1a–1.i1z) was walked against the trigger heuristics:

- No story calls a DB/ORM/domain package directly from `apps/web`/a UI package — the primitive and its adopters (`EventCard`, `WeeklyCalendarView`) only render props already passed into them, no data fetching.
- No story calls an external service directly from the frontend — image rendering via `<img>`/fallback is presentational, not a service call.
- No new API surface is introduced — no resolver, query, or mutation is touched anywhere in this epic.
- No auth/secrets/business rules are added to frontend code — this is pure visual/layout logic (sizing, fallback rendering, badge scale).
- No new infra requiring IaC is introduced — all changes are inside the existing `packages/ui`/`packages/ui/src/features/events` tree, including the 1.i1z ratchet (a CI-wired repo-scoped lint/test, not an infra dependency).

This epic is correctly scoped as pure presentational `packages/ui` work end to end.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

1. **Primitive's home: `packages/ui/src/features/events/`, not `packages/ui/src/core/`.** `event_card_*`'s content (a favorite-count badge, a date box) is event-domain-specific, not generic card chrome another domain would need verbatim — it fails `core/`'s domain-agnostic test (unlike `PageContainer`/`PageHeader`/`GridContainer`/`RouteLoader`). Precedent also points the same way: `EventCard.tsx` already lives in `features/events/`, and 1.i1a factors the primitive out of that same component. Story 5.1b's "matching EventCard's fallback pattern" reference (see item 3 below) is pattern-imitation for a different domain's own card, not literal reuse — it doesn't force a `core/` home now. Extracting to `core/` today would be speculative; revisit only if a future story needs the literal same primitive across domains.

2. **Story 1.i1d's open render-path question — resolved.** `WeeklyCalendarView.tsx` has exactly one per-schedule card component, `CalendarCard`, parameterized by `variant: 'grid' | 'list'`. `variant='list'` is used in exactly one place — the Mobile Vertical Day List (`mobile_day_list`, `data-testid="mobile-calendar-view"`), the grouped per-day compact row. `variant='grid'` drives the desktop grid cells and the "+N more" popover (a denser grid cell, not a row/card surface) — there is no second, ungrouped compact-row surface anywhere in the file. **Resolution applied directly to Story 1.i1d in `epics.md`: the primitive attaches to `CalendarCard`'s `variant='list'` render path only.** This removes the ambiguity the story's original note flagged as deliberately open.

3. **Cross-epic stale-reference finding (not a prerequisite — flagged in `epics.md`).** Epic 5's Story 5.1b (backlog, not started) cites "`EventCard`'s fallback pattern at `packages/ui/src/features/events/EventCard.tsx:155-164`" as its own design reference — precisely the text-based "No image available" branch Story 1.i1c replaces with the primitive's reserved-but-blank, no-text/no-icon fallback. Once 1.i1a/1.i1c ship, that citation will describe code that no longer exists. No new prerequisite story is warranted (Epic 5 hasn't started); a note was added directly to Story 5.1b in `epics.md` so whoever drafts it later re-derives the pattern from the shipped primitive instead of trusting the stale citation.

4. **No other missing shared foundation.** No global shell, i18n foundation, analytics foundation, or GraphQL/codegen dependency is implicated — no new text strings requiring i18n (removing "No image available" simplifies the i18n surface, if anything), no data fetching, no analytics events. No project-context.md-mandated utility or architecture-spine item is referenced with no owning story. Story 1.i1a is confirmed as the correct, first-of-its-kind story establishing the new architecture-spine invariant (a new AD-n) — not a deferral of something that should already exist (the spine's highest entry today is AD-14, none relate to event-card UI primitives).

5. **Minor aside (Gate 2 territory, not a completeness gap):** `EventImage.tsx` (`features/events`, used by `EventDetailView`/`InstagramEmbed`) is a separate, differently-scoped component (variable-height, icon-based fallback, video support) that shares naming adjacency with the new `event_card_*` primitive. Worth a one-line disambiguation note when 1.i1a is drafted so a future dev doesn't conflate the two — not blocking.

## Cross-epic reuse already correctly wired (confirmed, not a new finding)

Epic 3's Story 3.7c was independently amended 2026-09-12 (via `bmad-create-story`, user-confirmed) to narrow its own scope and depend on Stories 1.i1a, 1.i1c, 1.i1e — its AC1/AC2 were recognized as already covered by this epic. This confirms Epic 1.i1 is correctly positioned as an upstream dependency for Epic 3; no action needed here.

## New prerequisite stories created

**None.** This epic's scope is fully self-contained pure-UI work — no Epic 0 tooling gap, no shared-data-ownership gap, no missing single-story architecture layer.

## Corrections applied directly to `epics.md`

- **Story 1.i1d:** replaced the deliberately-open render-path question with the resolved answer (see Gate 3 item 2 above).
- **Story 5.1b (Epic 5):** added a stale-reference flag pointing at this epic's upcoming change to `EventCard.tsx:155-164` (see Gate 3 item 3 above).

## Next step

Create Epic 1.i1's stories one at a time via `bmad-create-story`, in `epics.md` order (1.i1a → 1.i1b → 1.i1c → 1.i1d → 1.i1e → 1.i1z). Each will skip Gate 1/Gate 3 (citing this report) and only run Gate 2.
