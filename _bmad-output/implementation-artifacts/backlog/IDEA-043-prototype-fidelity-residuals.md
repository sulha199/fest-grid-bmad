---
backlog_id: IDEA-043
title: "Seven rules the 2026-09-14 prototype pass validated have no story and no board row"
captured: 2026-09-20
parent: CC-019
---

# IDEA-043 — Unowned prototype-fidelity residuals (2026-09-14 UX pass)

## Capture

Found 2026-09-20 while auditing how `design-artifacts/UX-festgrid-run-1/prototypes/` is covered by
the planning artifacts. The seven prototypes are not named anywhere in `epics.md`, `backlog.yaml`,
`event-pages-dev-story-tracking.md`, or either source plan (`prototype` = 0 hits in all five) — the
only link is indirect: `DESIGN.md`'s token comments record which prototype validated each token, and
the `1.i1*` stories cite those tokens. Story 1.i1k is the single story file that cites the HTML files
by path.

Auditing the two amendment notes that recorded the pass's outstanding work — `IDEA-016`'s row
("3 prototyping corrections not yet folded into a story amendment") and `IDEA-017`'s
("7 prototyping refinements … not yet folded into a story amendment") — shows most points landed
later, but **seven did not, and no board row was ever created for them.**

Landed since (no gap): masonry title 2-line/venue 1-line clamps (`EventCard.tsx:369,375`), the
category/type badge replaced by the `<8km` nearby badge on masonry (`EventCard.tsx:356-378`; Story
1.i1f gated it), `happeningNow`'s solid-emerald variant (owned by Story 1.i1i, `ready-for-dev`), and
the grid-item's own multi-line title (`1-i1f-…md:207-208`).

## Prototype → story matrix (verified 2026-09-20)

| Prototype (`prototypes/event-card-…`) | Stories consuming its tokens |
|---|---|
| `masonry/default-with-thumbnail.html` | 1.i1a, 1.i1b, 1.i1c, 1.i1e, 1.i1i, 1.i1k *(cites the file)*, 1.i1z |
| `masonry/default-thumbnail-fallback.html` | 1.i1a, 1.i1c, 1.i1e, 1.i1z |
| `masonry/prominent-poster.html` | 1.3b (AC14-18), 1.i1e, 1.i1i |
| `calendar-row/with-thumbnail.html` | 1.i1d, 1.i1j, 1.i1k *(cites the file)* |
| `calendar-row/thumbnail-fallback.html` | 1.i1c, 1.i1d |
| `calendar-grid-item/with-thumbnail-multiple-days.html` | 1.i1f, 1.i1g, 1.i1h |
| `calendar-grid-item/thumbnail-fallback.html` | 1.i1f, 1.i1h |

The pass's own engineering finding (a thumbnail-bearing card cannot fit the real 174×128 `day_cell`)
is fully traced: `FIND-026` + `BUG-036` → Story 1.i1h.

## The seven residuals

All seven are already fully specified in `DESIGN.md`/`EXPERIENCE.md` — this is code-following-
existing-spec work, not new design. Line references are the spec source; code references are the
2026-09-20 state of `packages/ui/src/features/events/`.

| # | Rule | Spec | Code today |
|---|---|---|---|
| 1 | Masonry card max width (round 7) | `max-w-[230px]` on all three masonry states — DESIGN.md:306, EXPERIENCE.md:200 | `w-full max-w-sm` (`EventCard.tsx:227`); no `230` in `packages/ui`/`apps/web` |
| 2 | Prominent-poster crop (round 3) | `aspect-square` — DESIGN.md:308, EXPERIENCE.md:188 | `aspect-[2/3]` (`EventCard.tsx:330`) |
| 3 | `happeningNow` label (round 3) | "Now", one translatable word — DESIGN.md:486, validation-log round 3 | `'Happening Now'` (`EventCard.tsx:95`, `EventCard.types.ts:18`) |
| 4 | Date-pill/TILL position mechanism (rounds 5-7) | pill `top-2`, both pills shift to `top-5` when a TILL tag is present; TILL offset `-top-1.5` default / `-top-3` on `prominentPoster=true` — DESIGN.md:332, 458-465, 477, EXPERIENCE.md:178 | static `top-3` overlays (`EventCard.tsx:241`, `:337`); one shared `TILL_BADGE_CLASS` at `-top-1.5` (`:34-35`); no `top-5`/`-top-3` in code |
| 5 | Badge size floors + harmonization (rounds 4/6/8) | all four badge families ≥11px; TILL + favorite `text-xs`/`text-sm` in all three masonry states; favorite ≥ TILL; corner-pill padding `px-1.5 py-1` — DESIGN.md:391, 467-477, EXPERIENCE.md:444-446 | TILL `text-[10px]` (`EventCard.tsx:35`, under the floor); favorite corner pill `px-2.5 py-1.5` (`EventCardMediaPrimitives.tsx:163` — the exact looser value round 8 removed) |
| 6 | Calendar-row title wrap (round 3, IDEA-016 pt 2) | wraps up to 2 lines — `1-i1d-…md:165-166` | `truncate` (`WeeklyCalendarView.tsx:907`, `:965`) |
| 7 | Calendar-row reserved-slot reversal (round 3, IDEA-016 pt 3) | image omitted from the DOM; content expands; favorite at the row's end with no reserved wrapper — `1-i1d-…md:166-170`, EXPERIENCE.md:450 | `EventCardMediaSlot layout="fixed-square"` renders unconditionally → `w-16 h-16 shrink-0` always (`EventCardMediaPrimitives.tsx:67-74`, used at `WeeklyCalendarView.tsx:923`) |

## Notes for story creation

- **Rule 3 additionally needs an `epics.md` change, not just new tasks.** Story 1.i1i's AC
  (`epics.md:1646`) requires the shared badge component's label defaults to match `EventCard.tsx`'s
  current `defaultLabels` "verbatim", explicitly listing "Happening Now" — so implementing the "Now"
  rule means amending that AC, otherwise 1.i1i and this row contradict each other.
- **Rules 4/5 overlap Story 1.i1k's files.** 1.i1k rewrites `EventCardDateBox`'s chrome and reuses
  `event_card_till_badge`'s classes for the compact row's `till_label`; rules 4/5 change those exact
  class strings. Prefer folding 4/5 into 1.i1k's ACs, or dispatch this row after 1.i1k lands.
- **No prerequisite otherwise.** 1.i1e and 1.i1f are already `review`, so rules 1/2/3/6/7 can proceed
  independently.

## Promoted

Not yet promoted — no story exists. Verify each row's code reference before drafting (this audit is a
point-in-time check, and 1.i1i/1.i1j/1.i1k all touch these same components). Once a story is drafted,
fold this history into its Dev Notes and update the tracking doc's "Prototype coverage" section.
