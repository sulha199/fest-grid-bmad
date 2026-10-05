---
backlog_id: IDEA-060
title: "Consolidate z-index into named layering tiers: one documented scale, theme tokens, and a ratchet against raw z-values"
captured: 2026-10-05
---

# IDEA-060 — z-index layering tiers

## Capture

Raised 2026-10-05 while closing IDEA-048 (the compact-row favorite pill). The pill needed `z-30`
to win a stacking tie against a sibling overlay, and the same "defensive bump" comment appears in
`EventCard.tsx` and `EventCardMediaPrimitives.tsx`. That is a symptom: there is no rule for which
level a thing belongs at, so each change picks a number that works locally.

## Inventory (2026-10-05, `packages/ui/src` + `apps/web/src`, tests and generated code excluded)

| Level | Uses | Where |
|---|---|---|
| `z-0` / `-z-10` | 3 | swipe-to-reveal; calendar column guides (inside an `isolate` context) |
| `z-10` | 23 | card overlays, panels, calendar spanning-bar click target |
| `z-20` | 8 | spanning-bar visual layer, calendar and media internals |
| `z-30` | 10 | favorite and till badges, calendar hover tooltip |
| `z-40` | 4 | AppShell, user menu, calendar overflow-dialog backdrop |
| `z-50` | 17 | dialogs, popovers, sheets, select, nav-rail item, AI overlay, summary bar, `EventDetailView` (two sites, not yet checked) |
| `z-[60]` | 1 | blocking loader (the only value outside Tailwind's scale) |

## Findings

- 17 unrelated things share `z-50`. A sticky summary bar and a modal tie; DOM and portal order
  decide, and nothing documents that.
- The calendar already has a local rule (`isolate`, a `z-10` click target under a `z-20` visual
  layer), recorded only in code comments in `WeeklyCalendarView.tsx`.
- No layering section exists in `DESIGN.md`, `EVENT-CARD-DESIGN.md` or `project-context.md`.

## Proposed shape (to be decided by `bmad-architecture`, not settled here)

1. **Local tier**, `z-0` to `z-30`: only meaningful inside a component that creates its own
   stacking context (`isolate`). Card badges, calendar bars, tooltips.
2. **App-chrome tier**, `z-40`: shell, nav, user menu.
3. **Overlay tiers**, named levels above chrome: sticky bars, modals/sheets/popovers/select,
   then the blocking loader above all.

Define each tier once as a Tailwind theme token, document it as a "Layering" section in
`project-context.md` (and cross-reference from `DESIGN.md`), migrate the ~25 files, and add a
ratchet that rejects raw `z-[n]` values. The ratchet should be a Vitest test, not an ESLint rule:
`packages/ui` has no ESLint config yet (Story 0.41 / FIND-036), and the repo already ratchets card
sizing with CI tests (Story 1.i1z).

## Open questions

- What are `EventDetailView.tsx:354` and `:1062` at `z-50`: sticky bars or overlays?
- Should portaled overlays (Radix) get their tier from a shared wrapper instead of per-component
  classes?
- Is a Tailwind theme extension enough, or should tiers also be CSS variables for non-Tailwind code?

## Routing

`bmad-architecture` (decide the tier model, record as an AD), then `bmad-create-story`. Roughly
25 files to migrate, so check `epic-formation-gate.md` before creating more than one story.
