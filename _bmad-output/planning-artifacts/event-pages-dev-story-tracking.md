# Event Detail & Event List — Dev-Story Dependency Graph & Tracking

**Created:** 2026-09-19
**Status:** working doc, companion to `event-pages-followthrough-plan.md` and
`event-pages-remaining-backlog-plan.md` (both of which are now fully through `bmad-create-story`
for everything actionable). This doc picks up from there: it tracks the actual `bmad-dev-story`
dispatch order for the resulting `ready-for-dev` queue, the real dependency graph pulled from
`epics.md`'s own `Depends on:` lines (not doc prose, which has drifted stale more than once
today), and current status. Update checkboxes/status live as `bmad-dev-story` runs land — don't
let this drift the way the other two docs did.

## Why this doc exists

Both source plans are now past `bmad-create-story`. What's left is execution order: 19 stories
sit at `ready-for-dev` with a real (if partly undocumented) dependency graph between them, plus
one item (IDEA-038) still genuinely blocked pending two of those stories reaching `done`. The
orchestrator dispatches `bmad-dev-story` strictly sequentially (one story in flight at a time —
`sprint-status.yaml`/`epics.md` are shared-write hazards), so this doc's "waves" are really just
a safe *ordering*, not real parallelism — but front-loading high-fan-out prerequisites means
later stories never wait mid-batch for something that should already be done.

## Known epics.md documentation gaps (found 2026-09-19, not fixed)

- **Story 0.39's own `**Depends on:**` line omits Story 0.42.** It only lists "Story 1.1, Story
  1.2" even though 0.39's own story file correctly documents the real dependency ("Story 0.42
  must be `done` before Task 5 begins"). Automated tooling that trusts only epics.md's
  `Depends on:` line (e.g. `resolve-targets.ts`) will NOT catch this — the order below corrects
  it by hand.
- **Stories 0.38 and 0.38a have no `### Story 0.38:`/`### Story 0.38a:` section in epics.md at
  all** (pre-existing gap since their 2026-09-17 creation) — `resolve-targets.ts` cannot resolve
  either automatically; both are placed below using their own story files' Dev Notes instead.

Neither gap blocks dev-story dispatch (the real dependencies are correctly recorded in each
story's own file, which is what `bmad-dev-story` actually reads) — only automated cross-story
ordering tools are affected. Flagged here rather than fixed, since fixing `epics.md` wasn't asked
for.

## Dependency graph

All chains are exactly 2 levels deep — no story here depends on a story that itself depends on
another story in this set.

| Prerequisite | Effort | Unlocks |
|---|---|---|
| **1.i1f** | m | 1.i1g, 1.i1h, 1.i1j *(jointly with 1.i1i)* — 3 dependents, highest fan-out |
| **1.6d** | s | 1.6e, 0.i6e — 2 dependents |
| **0.42** | m | 0.39, 0.38 *(jointly with 0.38a)* — 2 dependents |
| **1.3l** (BUG-025) | s | 0.i5e — 1 dependent, also half of IDEA-038's own unblock |
| 1.3j | m | 1.6c — 1 dependent |
| 1.i1i | — | 1.i1j *(jointly with 1.i1f)* — 1 dependent |
| 0.38a | l | 0.38 *(jointly with 0.42)* — 1 dependent |
| 1.3k, 0.i5d, 1.i1k | m / — / — | none — fully standalone |

**Critical path** — two readings:
- **By fan-out**: **1.i1f** gates the most downstream work (3 stories). Dispatch first among
  true prerequisites.
- **By effort (heaviest chain)**: **0.38a (l) → 0.38 (l)**, additionally gated by 0.42 (m) — the
  two largest stories in the queue, chained. This is the longer pole if optimizing for calendar
  time even though it isn't the highest-fan-out node.
- **IDEA-038's own unblock chain** (1.3l → 0.i5e → IDEA-038 itself needs a *third*
  `bmad-create-story` pass once both are `done`) is the one genuinely 3-stage chain in the whole
  picture — see its own section below.

## Recommended dispatch order

**Wave 1 — prerequisites (dispatch first, unlocks the most/heaviest downstream work):**

- [x] 1.i1f (m)
- [ ] 1.6d (s)
- [x] 0.42 (m)
- [x] 1.3l (s) — BUG-025
- [x] 1.3j (m)
- [x] 1.i1i (—) — verified 2026-09-22 via `sprint-status.yaml`, now `review`
- [x] 0.38a (l)

**Wave 2 — standalone (no dependents waiting; slot anywhere, including interleaved with Wave 1 on business priority):**

- [ ] 1.3k (m)
- [ ] 0.i5d (—)
- [x] 1.i1k (—) — verified 2026-09-22 via `sprint-status.yaml`, now `review` (commit `c80cd9bd`)

**Wave 3 — dependents (only after their own prerequisite lands):**

- [ ] 1.6c — needs 1.3j (1.3j now `review`, implementation landed — prerequisite satisfied)
- [ ] 1.6e — needs 1.6d
- [ ] 0.i6e — needs 1.6d
- [x] 1.i1g — needs 1.i1f; verified 2026-09-22 via `sprint-status.yaml`, now `review`
- [x] 1.i1h — needs 1.i1f; verified 2026-09-22 via `sprint-status.yaml`, now `review`
- [x] 1.i1j — needs 1.i1f + 1.i1i; verified 2026-09-22 via `sprint-status.yaml`, now `review`
      (commit `d1b135b8`)
- [x] 0.39 — needs 0.42 (epics.md gap, see above — verified via the story's own file)
- [ ] 0.38 — needs 0.38a + 0.42 (its own Tasks 1-3 have no prerequisite and could start early,
      but treat as gated since dispatch is whole-story)
- [ ] 0.i5e — needs 0.i5a (already `review`, shipped) + 1.3l

## IDEA-038's own unblock chain (tracked separately — not yet story-created)

IDEA-038 (extend the Today/Upcoming/All temporal filter to Feed/Favorites) stays at
`backlog.yaml` status `backlog` by design — its own `bmad-create-story` dispatch (2026-09-19)
declined to draft it yet (per `AskUserQuestion`, "create the missing prerequisite story first")
and instead carved **Story 0.i5e** as a new prerequisite. Full chain:

1. [ ] Story 1.3l (BUG-025) reaches `done` — wires Feed/Favorites to real
       auth/location/AI-filter state
2. [ ] Story 0.i5e reaches `done` — adopts `useListPaginationController` in Feed/Favorites
       (depends on 1.3l per its own epics.md `Depends on:` line, plus already-shipped 0.i5a)
3. [ ] Re-invoke `bmad-create-story` for IDEA-038 once both are `done` — only then does the
       temporal filter extension itself become actionable

## Full story status (verification — re-check via `verify-story.ts` before trusting stale rows)

| Story | Backlog row(s) | Status | Notes |
|---|---|---|---|
| 1.3j | BUG-030, FIND-027, BUG-034, FIND-028 | `review` | implementation landed (`8879447`); batch resumed 2026-09-20 with bookkeeping fix-up — run `code-review` before `done` |
| 1.6c | BUG-033, BUG-035, FIND-030 | `ready-for-dev` | needs 1.3j (now `review` — prerequisite satisfied) |
| 1.6d | IDEA-029 | `ready-for-dev` | |
| 1.6e | IDEA-033 | `ready-for-dev` | needs 1.6d |
| 0.i6e | IDEA-032 | `ready-for-dev` | needs 1.6d |
| 1.3k | IDEA-003 (day-of-week extension) | `ready-for-dev` | standalone |
| 0.i5d | IDEA-019 | `ready-for-dev` | standalone |
| 1.i1f | IDEA-026 | `review` | standalone, highest fan-out — implementation landed |
| 1.i1i | IDEA-041 | `review` | standalone — implementation landed (verified 2026-09-22) |
| 1.i1j | IDEA-025 | `review` | needs 1.i1f + 1.i1i — implementation landed, commit `d1b135b8` (verified 2026-09-22) |
| 1.i1k | IDEA-042 | `review` | standalone — implementation landed, commit `c80cd9bd` (verified 2026-09-22) |
| 1.i1g | IDEA-039 | `review` | needs 1.i1f — implementation landed (verified 2026-09-22) |
| 1.i1h | BUG-036, FIND-026 | `review` | needs 1.i1f — implementation landed (verified 2026-09-22) |
| 0.39 | IDEA-040 | `review` | needs 0.42 (epics.md gap) — prerequisite satisfied, implementation landed |
| 0.42 | (carved from IDEA-040's create-story) | `review` | standalone — implementation landed |
| 0.38a | (carved from IDEA-020) | `review` | standalone — implementation landed |
| 0.38 | IDEA-020 | `ready-for-dev` | needs 0.38a + 0.42 |
| 1.3l | BUG-025 | `review` | standalone — implementation landed |
| 0.i5e | (carved from IDEA-038's create-story) | `ready-for-dev` | needs 1.3l |
| — | IDEA-038 | `backlog` (not yet storied) | blocked on 1.3l + 0.i5e reaching `done` |

## Prototype coverage — 2026-09-14 UX pass (audited 2026-09-20)

`design-artifacts/UX-festgrid-run-1/prototypes/` holds the seven screenshot-validated HTML prototypes
that the `1.i1*` stories implement. Neither this doc, `epics.md`, `backlog.yaml`, nor either source
plan has ever named them (`prototype` appears **0** times in all five) — the link is only indirect:
`DESIGN.md`'s token comments record which prototype validated each token, and the `1.i1*` stories cite
those tokens. Only Story 1.i1k cites the HTML files by path (`1-i1k-…md:95,145`). Two consequences
worth knowing at dispatch time:

1. **A prototype not appearing in the tables above does not mean uncovered.** 13 stories cover the
   seven prototypes, but most of them (`1.3b`, `1.i1a`–`1.i1e`, `1.i1f`, `1.i1z`) are `review`, so
   they never enter this doc's `ready-for-dev` queue.
2. **Coverage is still incomplete** — 7 prototype rules have no story and no board row (below).

| Prototype | Validates (DESIGN.md tokens) | Stories that consume them | Status |
|---|---|---|---|
| `masonry/default-with-thumbnail.html` | `event_card_masonry.top_row_default`, `event_card_date_box.base_default` | 1.i1a, 1.i1b, 1.i1c, 1.i1e, 1.i1i, **1.i1k**, 1.i1z | all `review` (updated 2026-09-22 — 1.i1i/1.i1k moved to `review`) |
| `masonry/default-thumbnail-fallback.html` | `event_card_masonry.thumbnail_default_fallback`, `event_card_favorite_count_badge_large` | 1.i1a, 1.i1c, 1.i1e, 1.i1z | all `review` |
| `masonry/prominent-poster.html` (Panels A-D) | `event_card_masonry.image_prominent`, `event_card_date_box.favorite_pill`, `event_card_till_badge`, `event_card_status_badge.happening_now` | 1.3b (AC14-18), 1.i1e, 1.i1i | all `review` (updated 2026-09-22 — 1.i1i moved to `review`) |
| `calendar-row/with-thumbnail.html` | `event_card_compact.date_box`/`content`, `event_card_till_badge` (as `till_label`) | 1.i1d, 1.i1j, **1.i1k** | all `review` (updated 2026-09-22 — 1.i1j/1.i1k moved to `review`) |
| `calendar-row/thumbnail-fallback.html` | `event_card_compact_thumbnail_fallback`, large-badge scaling | 1.i1c, 1.i1d | all `review` |
| `calendar-grid-item/with-thumbnail-multiple-days.html` | `event_card_calendar_grid_item` (with-image), attachment decision | 1.i1f, 1.i1g, 1.i1h | all `review` (updated 2026-09-22 — 1.i1g/1.i1h moved to `review`) |
| `calendar-grid-item/thumbnail-fallback.html` | `event_card_calendar_grid_item` (no-image two-row) | 1.i1f, 1.i1h | all `review` (updated 2026-09-22 — 1.i1h moved to `review`) |

*(All seven under `design-artifacts/UX-festgrid-run-1/prototypes/event-card-…`.)* The pass's one real
engineering finding — a thumbnail-bearing card physically cannot fit the real 174×128 `day_cell` — is
the best-traced item of all: `FIND-026` + `BUG-036` → Story 1.i1h.

### Unowned prototype rules → `IDEA-046` (row created 2026-09-20, renumbered from `IDEA-043`)

Seven rules that pass validated have no story AC and no board row. All are already fully specified in
`DESIGN.md`/`EXPERIENCE.md`, so this is code-following-existing-spec work, not new design. Code state
verified 2026-09-20:

| # | Rule (source) | Spec says | Code today |
|---|---|---|---|
| 1 | Masonry card max width — DESIGN.md:306 (round 7), EXPERIENCE.md:200 | `max-w-[230px]`, all three masonry states | `w-full max-w-sm` (`EventCard.tsx:227`); no `230` anywhere in `packages/ui`/`apps/web` |
| 2 | Prominent-poster crop — DESIGN.md:308 (round 3) | `aspect-square` | `aspect-[2/3]` (`EventCard.tsx:330`) |
| 3 | `happeningNow` label — DESIGN.md:486 (round 3) | "Now" (one translatable word) | `'Happening Now'` (`EventCard.tsx:95`, `EventCard.types.ts:18`) — and 1.i1i's own AC (`epics.md:1646`) freezes the old default verbatim, so this needs an `epics.md` AC change too |
| 4 | Date-pill/TILL position mechanism — DESIGN.md:332, 458-465 (rounds 5-7), EXPERIENCE.md:178 | pill `top-2`, both pills `top-5` when a TILL tag is present; TILL offset `-top-1.5` default / `-top-3` on `prominentPoster=true` | one static `top-3` overlay (`EventCard.tsx:241`, `:337`) and one shared `TILL_BADGE_CLASS` at `-top-1.5` (`:34-35`) — no `top-5`, no `-top-3` in code |
| 5 | Badge size floors + harmonization — DESIGN.md:391, 467-477 (rounds 4/6/8), EXPERIENCE.md:444-446 | all four badge families ≥11px; TILL and favorite `text-xs`/`text-sm` in all three masonry states; favorite ≥ TILL; corner-pill padding `px-1.5 py-1` | TILL is `text-[10px]` (`EventCard.tsx:35`, under the floor); favorite corner pill still `px-2.5 py-1.5` (`EventCardMediaPrimitives.tsx:163` — the exact looser value round 8 removed) |
| 6 | Calendar-row title wrap — `1-i1d` amendment pt 2 (round 3) | wraps up to 2 lines | `truncate` (`WeeklyCalendarView.tsx:907`, `:965`) |
| 7 | Calendar-row reserved-slot reversal — `1-i1d` amendment pt 3 (round 3), EXPERIENCE.md:450 | image omitted from the DOM; content expands; favorite at the row's end with no reserved wrapper | `EventCardMediaSlot layout="fixed-square"` renders unconditionally → `w-16 h-16 shrink-0` always (`EventCardMediaPrimitives.tsx:67-74`, used at `WeeklyCalendarView.tsx:923`) |

**RESOLVED, 2026-09-22** — IDEA-046 shipped as two stories after a fresh `git pull` surfaced commits
from elsewhere (`6412792c`, `13861432`), both `review`:

- **Story 1.i1l** (`1-i1l-apply-the-six-unowned-prototype-fidelity-rules`) — rules 1/2/3/4/5/6 above.
  Its own Gate 1/2 re-verified all seven rules still reproduced against `c80cd9b` (post-1.i1i/j/k)
  before drafting, and corrected two of this table's code references that had moved since
  (rule 3 gained a third default site at `WeeklyCalendarView.tsx:298`; rule 5's `px-2.5 py-1.5`
  literal also survives inline at `EventCard.tsx:255`).
- **Story 1.i1m** (`1-i1m-drop-the-calendar-rows-reserved-image-slot`) — rule 7, carved out of
  1.i1l via its own Gate 2: rule 7 forks `EventCardMediaSlot`'s shared reserved-blank-fallback
  contract between masonry and the compact row, and contradicts a shipped AC (Story 1.i1z AC3 +
  two live CI ratchet tests asserting the compact row *does* reserve blank space) — governance
  work needing its own review, not a same-story class swap.

**Also carved:** **`IDEA-048`** (child of IDEA-046) — two further `event_card_compact` gaps found
during 1.i1l's Gate 2 sweep, deliberately left for 1.i1m's row-restructure rather than folded in:
the compact row never renders `DESIGN.md`'s `event_card_compact.venue` line at all (data already
plumbed via Story 1.i1g), and its favorite badge still corner-overlays the thumbnail instead of
DESIGN.md's spec'd reversal (a vertical stack below it, glassmorphism dropped).

**RESOLVED, 2026-09-25:** the `EventCardDateBox` word/time-content overflow bug found by this
session's own visual-fidelity audit (2026-09-22) — `dayClasses` at
`EventCardMediaPrimitives.tsx:273` was still bare `text-5xl`/`text-3xl font-extrabold leading-none`
with no `max-width`/`whitespace-nowrap`/word-variant handling, confirmed unchanged by both 1.i1l and
1.i1m (neither touched this) — now has its own story, `1-i1n-fix-eventcarddatebox-overflow-on-word-time-content`
(`backlog.yaml` `BUG-040`), sequenced ahead of Story 1.3k per its own `epics.md` `Depends on:` line
(see "Known conflicts" below).

**Also flagged:** `prototypes/validation-log.md` records rounds 1-4 only, while `DESIGN.md` cites
rounds 5-8 as user-directed revisions of that same pass. A dated addendum in that file now records
the gap (the added rules are quoted there) rather than leaving it silent.

## Known conflicts for any new event-card story

**RESOLVED, 2026-09-25 (`bmad-create-story`, Story 1.i1n):** the date-box overflow fix flagged
below now has its own story, `1-i1n-fix-eventcarddatebox-overflow-on-word-time-content`
(`backlog.yaml` `BUG-040`), and `epics.md`'s Story 1.3k section's `Depends on:` line has been
amended to add `Story 1.i1n` directly — no longer just a flagged risk in this doc. Story 1.i1n
should land and reach at least `review` before 1.3k's `bmad-dev-story` is dispatched.

**Story 1.3k** (`1-3k-render-day-of-week-recurring-schedules-and-repeat-badge`) is `ready-for-dev`,
not yet started, and its own `Depends on:` line names "Story 1.i1a-e (the shared
`EventCardMediaPrimitives.tsx` primitives this story adds to)" and now also Story 1.i1n, while its
AC touches `WeeklyCalendarView.tsx`'s `dayBuckets` and regression tests across `EventCard.test.tsx`.
Any *other* new story touching `EventCardDateBox`/`EventCardMediaPrimitives.tsx`/`EventCard.tsx`/
`WeeklyCalendarView.tsx` should land and reach at least `review` — ideally amend 1.3k's own
epics.md `Depends on:` line to name it — before 1.3k's `bmad-dev-story` is dispatched, so 1.3k
isn't built blind to a shared-primitive change landing underneath it.

## Story 0.44 -> Story 0.43 dependency (packages/visual-audit)

**Story 0.43** (`0-43-visual-fidelity-audit-tool`, `ready-for-dev`) — the new `packages/visual-audit`
tool (Architecture Spine AD-26) this session's own audit findings above (the `EventCardDateBox`
overflow bug) motivated — is now **blocked on Story 0.44**
(`0-44-define-testing-standard-for-meta-testing-tooling-packages`, `ready-for-dev`) reaching `done`.

0.43's own Gate 3 pass found `project-context.md`'s Testing Rules section has no tier for a
meta-testing/tooling package (neither `packages/domain`'s 100%-unit tier nor `apps/*`'s
testing-trophy tier fits); it split out Story 0.44 to define that tier and, per its AC13, offered
an Escape Hatch letting 0.43 proceed under its own self-declared scoped DoD in the meantime. **The
user explicitly rejected the Escape Hatch and chose "0.44 first, then 0.43."** Story 0.43's file was
amended accordingly: it now carries a `Depends on: Story 0.44` line, AC13 inherits Story 0.44's
tier instead of self-declaring one, and its Pre-Coding Approval Gate blocks `bmad-dev-story` until
Story 0.44 is `done`. Both stories sit at `ready-for-dev` in `sprint-status.yaml` — per this doc's
own established convention (e.g. Story 1.3k above, Story 0.38/0.38a), the gate is enforced via each
story's explicit Pre-Coding Approval Gate note, checked at dispatch time, not via a separate status
value. **Do not dispatch 0.43's `bmad-dev-story` before 0.44 reaches `done`.**

## How to use this doc during dev-story dispatch

1. Dispatch in the wave order above via `ritual-orchestrator` (`bmad-dev-story`, `run-act-with-checks.ts`).
2. After each story reaches `done`/`review`, tick its checkbox and re-run
   `npx tsx src/verify-story.ts --story <id>` to confirm before moving to a dependent.
3. Run `npx tsx src/detect-new-stories.ts` after each dispatch — `bmad-dev-story` can also
   surface gaps that carve new stories, same as `bmad-create-story` did today (0.42, 0.i5e, 1.3l
   were all created this way).
4. Once 1.3l and 0.i5e are both `done`, re-invoke `bmad-create-story IDEA-038` and fold the
   result into this doc.
