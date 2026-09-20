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
- [ ] 1.i1i (—)
- [x] 0.38a (l)

**Wave 2 — standalone (no dependents waiting; slot anywhere, including interleaved with Wave 1 on business priority):**

- [ ] 1.3k (m)
- [ ] 0.i5d (—)
- [ ] 1.i1k (—)

**Wave 3 — dependents (only after their own prerequisite lands):**

- [ ] 1.6c — needs 1.3j (1.3j now `review`, implementation landed — prerequisite satisfied)
- [ ] 1.6e — needs 1.6d
- [ ] 0.i6e — needs 1.6d
- [ ] 1.i1g — needs 1.i1f
- [ ] 1.i1h — needs 1.i1f
- [ ] 1.i1j — needs 1.i1f + 1.i1i
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
| 1.i1i | IDEA-041 | `ready-for-dev` | standalone |
| 1.i1j | IDEA-025 | `ready-for-dev` | needs 1.i1f + 1.i1i |
| 1.i1k | IDEA-042 | `ready-for-dev` | standalone |
| 1.i1g | IDEA-039 | `ready-for-dev` | needs 1.i1f |
| 1.i1h | BUG-036, FIND-026 | `ready-for-dev` | needs 1.i1f |
| 0.39 | IDEA-040 | `review` | needs 0.42 (epics.md gap) — prerequisite satisfied, implementation landed |
| 0.42 | (carved from IDEA-040's create-story) | `review` | standalone — implementation landed |
| 0.38a | (carved from IDEA-020) | `review` | standalone — implementation landed |
| 0.38 | IDEA-020 | `ready-for-dev` | needs 0.38a + 0.42 |
| 1.3l | BUG-025 | `review` | standalone — implementation landed |
| 0.i5e | (carved from IDEA-038's create-story) | `ready-for-dev` | needs 1.3l |
| — | IDEA-038 | `backlog` (not yet storied) | blocked on 1.3l + 0.i5e reaching `done` |

## How to use this doc during dev-story dispatch

1. Dispatch in the wave order above via `ritual-orchestrator` (`bmad-dev-story`, `run-act-with-checks.ts`).
2. After each story reaches `done`/`review`, tick its checkbox and re-run
   `npx tsx src/verify-story.ts --story <id>` to confirm before moving to a dependent.
3. Run `npx tsx src/detect-new-stories.ts` after each dispatch — `bmad-dev-story` can also
   surface gaps that carve new stories, same as `bmad-create-story` did today (0.42, 0.i5e, 1.3l
   were all created this way).
4. Once 1.3l and 0.i5e are both `done`, re-invoke `bmad-create-story IDEA-038` and fold the
   result into this doc.
