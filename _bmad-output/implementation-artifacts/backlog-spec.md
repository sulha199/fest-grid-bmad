# Backlog Board — Specification

**Status:** active convention
**Created:** 2026-09-04
**Owns:** `_bmad-output/implementation-artifacts/backlog.yaml`

## 1. Purpose

`sprint-status.yaml` tracks work that **already has a story**. It has no room for the
things that come *before* a story: bug statements, raw ideas, review findings, and
Sprint Change Proposals — which today are 19 undated-vocabulary files in
`planning-artifacts/` with inconsistent or absent `status:` fields.

`backlog.yaml` is the **intake board** for exactly those items. It is an index, never
a content store.

### Why a separate file

`sprint-status.yaml` is ~1,869 lines / ~140KB (~35k tokens) and is read by 21 skill
files, including the hot path (`bmad-create-story`, `bmad-dev-story`,
`bmad-code-review`, `bmad-quick-dev`). Anything parked there is re-read on every story
cycle forever. `backlog.yaml` is read only by `bmad-sprint-status` and
`bmad-correct-course`.

### The one rule

> **Exactly one board owns an item's execution state at a time.**

Once an item has stories, `sprint-status.yaml` owns their state and the backlog row
degrades to a pointer with a *derived* status. Nothing is hand-maintained in two
places. Violating this is what produced the `1-3i` drift (marked `done` while its
`ViewModeToggle` component had been deleted).

## 2. File layout

| Path | Role |
|---|---|
| `implementation-artifacts/backlog.yaml` | The board. Rows + tag registry. |
| `implementation-artifacts/backlog/<ID>-<slug>.md` | Tier-1 note: raw capture for one item. |
| `planning-artifacts/sprint-change-proposal-*.md` | Tier-2: full `CC` impact analysis. |
| `implementation-artifacts/<story-key>.md` | Tier-3: the story. Owned by `sprint-status.yaml`. |

Detail scales with maturity. Most items die at tier 0 (row only) or tier 1. Do not
create a note file for an item whose title says everything.

## 3. `backlog.yaml` schema

```yaml
# ── tag registry ── every `touches` entry MUST resolve here
tags:
  web:   [accounts, auth, events, locations, moderation, onboarding, post-selection,
          posts, reports, settings, subscriptions, system, votes, widgets, wizard]
  pkg:   [analytics, database, domain, graphql-select, shared-types, ui]
  app:   [backend, infrastructure]
  cross: [ai-extraction, prd, architecture, ux-tokens, i18n, notifications, process]

items:
  CC-014:
    {type: proposal, status: promoted, created: 2026-09-04,
     title: "Discovery card redesign (TILL badge, status badge, nearby badge, grid spacing)",
     ref: [sprint-change-proposal-2026-09-04.md],
     stories: [1-3b-build-the-reusable-eventcard-component,
               1-3d-build-the-reusable-eventlistview-component],
     touches: [web:events/EventCard, web:events/EventListView, web:events/getEvents,
               cross:ux-tokens, cross:prd]}

  IDEA-001:
    {type: idea, status: backlog, created: 2026-09-04,
     impact: user-visible, effort: m,
     title: "Retry AI extraction on n+1 carousel slides when schedule count falls short",
     ref: [backlog/IDEA-001-multislide-extraction.md],
     touches: [cross:ai-extraction, app:backend]}

  BUG-001:
    {type: bug, status: triaged, created: 2026-09-04, parent: CC-014,
     impact: internal, effort: xs, blocks: [CC-019],
     title: "1-3i marked done but ViewModeToggle was deleted by a later change",
     ref: [],
     touches: [web:events/EventListView, cross:architecture]}
```

### Field reference

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | `bug` \| `idea` \| `finding` \| `proposal`. **Authoritative** — may change after capture. |
| `status` | yes | See §5. |
| `created` | yes | `YYYY-MM-DD`. For proposals, the date in the source filename. |
| `title` | yes | One line, ≤100 chars. Must be understandable without opening anything. |
| `ref` | yes | Ordered provenance chain, oldest→newest. Last = current home of truth. `[]` if tier 0. |
| `stories` | no | Full `sprint-status.yaml` keys. Presence means the item has fanned out. |
| `touches` | yes | Registry-resolved tags. See §7. |
| `impact` | open rows | User-facing consequence. See below. |
| `effort` | open rows | Size of the work. See below. |
| `parent` | no | Parent item ID, for carved-out children. See §6. |
| `blocks` | no | IDs this row gates. One-directional — declared on the blocker only. |
| `superseded_by` | no | Required when `status: superseded`. |
| `note` | no | One line. Only for a fact that changes how the row is read. Not a description. |

Rows are written as YAML flow mappings (one logical row per entry) to keep the board
cheap to read. ~30 tokens per row, ~38 for an open row carrying `impact`/`effort`;
50 items ≈ 1.7k tokens.

### Prioritization fields

Two facts, no score. **`priority` is deliberately absent.** A stored composite is a
derived value maintained by hand — the exact failure §5's derived `status` exists to
prevent, and worse, because no check in §9 can detect that it went stale. A single
scalar also cannot serve two different weightings; ranking happens at read time via §11.

The test for both fields: *can it be verified, or must it be judged?* Facts do not rot.

**`impact`** — the user-facing consequence of the row: the defect for a `bug`/`finding`,
the payoff for an `idea`/`proposal`.

| Value | Test |
|---|---|
| `user-visible` | A user — including a moderator — can reach it through today's data. |
| `compliance` | An unmet legal/DPA/consent obligation. No user symptom; not optional. |
| `latent` | A real defect, unreachable through today's data. |
| `cosmetic` | The user sees it, but only aesthetics. |
| `internal` | No user path at all — tests, tooling, docs, refactor, audits. |

Default ranking, absent a lens that says otherwise:
`compliance` ≈ `user-visible` > `latent` > `cosmetic` > `internal`.

`compliance` exists because the alternative collapses it into `internal`, which sorts a
regulatory obligation below a token rename. FIND-004 (vendor DPA never enforced) is the
case that forced it.

**`effort`** — size of the change, not its value. A property of the work itself, so it
does not move when goals do.

| Value | Scale |
|---|---|
| `xs` | One file, one edit. No story needed. |
| `s` | One story. |
| `m` | 2–4 stories, or one story plus a design/PRD pass. |
| `l` | Multi-epic, or blocked on infrastructure that does not exist yet. |

**Both are required only for open, un-promoted rows** (`status: backlog` or `triaged`) —
the set actually being ranked. A `promoted` item's effort is already legible in
`len(stories)`, and terminal items are never ranked. On the 2026-09-05 board that is
16 rows out of 35, which is what keeps this affordable.

## 4. IDs

Per-type counters, zero-padded to 3: `BUG-001`, `IDEA-001`, `CC-001`, `FIND-001`.

- **IDs are immutable.** If an item is reclassified, the `type:` field changes and the
  ID does not. A stale prefix is cosmetic; a moving ID breaks every cross-reference.
- Assign in chronological order during backfill.
- Never reuse an ID, including for deleted items.

`ref` paths are relative to `_bmad-output/`, except `backlog/…` which is relative to
`implementation-artifacts/`.

## 5. Status vocabulary and adjudication

| Status | Means | Test |
|---|---|---|
| `backlog` | Captured, not yet analysed. | No impact analysis exists. |
| `triaged` | Analysed/approved, no story yet. | Proposal exists; no `stories`. |
| `promoted` | Has ≥1 story; execution owned by `sprint-status.yaml`. | `stories` non-empty, not all `done`. |
| `done` | Fully landed. | Every entry in `stories` is `done`, **and** no proposed change remains unapplied. |
| `skipped` | Deliberately not doing. | Requires a `note` giving the reason. |
| `superseded` | Replaced by a later item. | Requires `superseded_by`. |

### Derived status

`status` for items with `stories` is **computed, not hand-edited**:

- any story `backlog`/`ready-for-dev`/`in-progress`/`review` → `promoted`
- all stories terminal (`done` or `wont-do`) **and** no unapplied sections → `done`

`wont-do` is a real terminal value in `sprint-status.yaml` (first used for
`4-3b-add-a-report-trigger-to-eventcard-list-view`, cancelled by CC-017). It counts
as terminal for derivation — a cancelled story does not hold its item open.

`stories` holds **execution units, not every story the source document mentions.** A
proposal often names stories as context. CC-017 names four but only cancels one;
listing all four would have held it open forever. Filter to what the item actually
changes.

**Known condition:** 115 stories currently sit in `review` against 43 `done`. An item
whose stories are all `review` is **`promoted`**, not `done` — report it as
`promoted (awaiting close-out)`. Do not paper over this by treating `review` as
terminal; the gap is real signal.

### Adjudicating the existing 19 proposals

A proposal's own `status:` frontmatter is the **document's** state and is *evidence,
not the answer*. It is freeform prose today and 11 of 19 files lack it entirely.
Decide the item's status from code and `sprint-status.yaml`, then reconcile.

Order of precedence when evidence conflicts:
1. Actual code state (does the change exist?)
2. `sprint-status.yaml` story status
3. The proposal's own `status:` frontmatter
4. Chronology (a later proposal touching the same surface may supersede)

When evidence is insufficient to choose, set `status: triaged` and add
`note: "status unverified — needs review"`. **Do not guess.** A wrong `done` is worse
than an honest unknown; it recreates the drift this board exists to remove.

## 6. Fan-out and partial promotion

**Fan-out:** one item routinely becomes several stories. `ref` (documents) and
`stories` (execution units) are separate axes — `ref` stays linear and ends at the
proposal; `stories` holds the list.

**Partial promotion** is the common failure this board must expose: a batch proposal
where some changes became stories and the rest quietly did not. Carve each un-promoted
chunk into its own child row:

```yaml
CC-009:   {type: proposal, status: promoted, created: 2026-08-24,
           title: "UX rework batch", ref: [sprint-change-proposal-2026-08-24-ux-rework-batch.md],
           stories: [...], touches: [...]}
BUG-004:  {type: bug,  parent: CC-009, status: backlog, created: 2026-08-24,
           title: "Carousel arrows overlap below 360px", ref: [], touches: [web:events]}
```

A parent **cannot** be `done` while any child is open. Children carry their own status
and are triaged independently.

## 7. `touches` tags

Form: `namespace:slice` or `namespace:slice/Symbol`.

- Every tag must resolve against the `tags:` registry at the top of the board. An
  unregistered tag is an error — typos silently disable collision detection, which is
  the entire point of the field.
- Adding a tag is a deliberate edit to the registry block.
- Matching is by **prefix**, so `web:events` matches `web:events/EventCard`. Tag as
  specifically as you honestly know; a vague item gets the slice.
- **Coarse, not file paths.** Paths rot on refactor; `web:events` is the seam the repo
  is already cut along.
- The `cross:` namespace is hand-curated and does the heavy lifting — it links items
  that share no directory, e.g. an AI-extraction idea and an architecture conflict.

## 8. Cross-reference contract

Links are **bidirectional**. Every file named in a `ref` carries the ID back:

```yaml
---
backlog_id: CC-014
title: "Sprint Change Proposal: Discovery Card Redesign"
status: approved      # the DOCUMENT's state — keep it, distinct from the item's
---
```

The existing `status:` field in proposal files is **preserved as-is**. It describes the
document; `backlog.yaml` describes the item. Do not rewrite or normalise it.

One-way links rot silently. With both directions, any file resolves to its row, and
§9's checks can assert the pair.

## 9. Checks (run by `bmad-sprint-status`)

**Run them with the committed runner, do not re-derive them:**

```
uv run --python 3.11 --with pyyaml scripts/backlog-check.py          # checks + counts + collisions + lenses
uv run --python 3.11 --with pyyaml scripts/backlog-check.py --lens cheap-wins
```

Exit code is the failure count, so it can gate a commit. The checks and the §11 lens
table are prose here and executable there; when they disagree, this document is
authoritative and the script is the bug. Re-deriving these checks from prose each
session is how a subtly wrong reimplementation comes to report "clean" on a broken
board — worse than running no check at all.


1. **Broken ref** — a `ref` path that does not exist on disk.
2. **Back-reference mismatch** — a referenced file whose `backlog_id` is missing or
   disagrees with its row.
3. **Unregistered tag** — a `touches` entry not in the registry.
4. **Unknown story** — a `stories` entry that is not a key in `sprint-status.yaml`.
5. **Stale target** — an open item whose story is `done` in `sprint-status.yaml`
   (the `1-3i` class).
6. **Orphan child** — a `parent` ID that does not exist.
7. **Target collision** — two or more open items (`backlog`/`triaged`/`promoted`)
   sharing a `touches` prefix or a story key. Report as a group for human review.

   **Report groups ascending by size and suppress any group larger than 4.** Measured
   on the 2026-09-04 backfill, `app:backend` grouped 17 open items and `cross:prd` 12 —
   a tag shared by a third of the board carries no information. The signal is in small
   groups: `cross:ai-extraction` (4) correctly linked IDEA-001 to CC-018 and FIND-004,
   and `web:wizard` (2) linked CC-014 to its own untracked spillover FIND-003.
   Deduplicate items within a group — an item with several `web:events/*` tags must
   count once.

8. **Unranked open row** — a `backlog`/`triaged` row missing `impact` or `effort`, or
   carrying a value outside the §3 enums. Blocks the row from appearing in any §11 lens,
   so it is silently unprioritizable rather than merely undecorated.
9. **Dangling or satisfied block** — a `blocks` entry naming an ID that does not exist,
   or one whose target is already terminal (`done`/`skipped`/`superseded`). The second
   case is the `blocks` equivalent of check 5: the gate outlived what it was gating.

Check 7 finds *candidates*, not conflicts. Semantic contradiction between items that
touch no common surface is **not mechanically detectable** and needs a reading pass —
e.g. one item re-hosting images unconditionally while another requires an opt-in gate.
The board's job is to make that pass tractable by keeping the open set small and
enumerable.

## 10. Lifecycle

**Capture.** Anything worth not forgetting gets a row immediately: `status: backlog`,
a title, `touches`, `ref: []`. If there is a raw dump (payloads, screenshots, stream of
thought), it becomes `backlog/<ID>-<slug>.md` and the row's only `ref`. Capture is
cheap by design — a row is one line.

**Triage.** Set `type`, sharpen `touches`, and either promote or `skip` with a reason.
Batch by `type` or by shared tag rather than item-by-item.

**Promotion.** Running `CC` appends the proposal to `ref` and sets `triaged`. Running
`bmad-create-story` appends story keys to `stories`; status becomes `promoted` and from
then on is derived. Any part of the item *not* promoted must become a child row in the
same pass — this is the step whose omission created the current mess.

**Close-out.** When all stories reach `done` and no children are open, the item is
`done`. It stays on the board as history; the board is not pruned.

## 11. Lenses

Prioritization is a **query, not a row property.** What changes between sessions is the
weighting across categories — not the facts about each item. So the variation lives here,
in named filters over fields the board already carries. Adding a lens re-ranks the entire
board without touching a single row; that is the property a stored `priority` can never
have.

| Lens | Filter | Use when |
|---|---|---|
| `cheap-wins` | `status: backlog` AND `effort` in (xs, s) AND `impact` in (user-visible, cosmetic) | Short session, want visible movement. |
| `stability` | `status: backlog` AND `impact: user-visible` AND `type` in (bug, finding) | Before a demo or a release. |
| `legal` | `impact: compliance` OR (`touches ~ cross:ai-extraction` AND status open) | Any consent/PDP/GDPR pass. Ignores `effort` — these are not optional. |
| `demo-polish` | `touches ~ (cross:ux-tokens \| web:events)` AND `impact` in (user-visible, cosmetic) | Portfolio and screenshot work. |
| `close-out` | `status: promoted` AND every entry in `stories` is `review` | Clearing the 115-vs-43 review gap named in §5. |
| `unblock` | any ID appearing in an open row's `blocks` | Ordering. These gate other work regardless of their own size. |
| `truth-debt` | `impact: internal` AND `type: finding` | Periodic sweep for docs/status that drifted from code. |

Rules:

- A lens is **defined here and nowhere else.** Never copy one into a row — that
  re-creates the stored-priority problem one item at a time.
- Lenses may overlap. An item in three lenses is signal, not an error.
- Adding or retiring a lens is a one-line edit to this table, and is expected. This is
  the mechanism that serves "different goal this week" without a migration.
- No lens may reference a field §3 does not define. If a lens needs a new fact, add the
  field and backfill it first — otherwise the lens silently returns a partial set.

## 12. Deferral intake

`deferred-work.md` is **tier-1 capture, not a tracker.** `bmad-code-review`,
`bmad-quick-dev` and `bmad-dev-auto` all append `defer` findings to it, and that stays —
it is prose-shaped, carries the `evidence:` reasoning, and sits naturally in those
workflows. What must not happen again is those entries existing *only* there.

Between 2026-07-22 and 2026-09-01 the file accumulated **89 entries across 33 sections**
that no board, sprint status, or query could see. Folding them in took two delegated
phases. The producers were never redirected, so without this section the file simply
refills and the two diverge again.

**Rule: a session that defers anything writes to both.** The prose entry goes to
`deferred-work.md` as it does today; the board gets row(s) whose `ref` points at it.

### Batching

Default to **one row per deferring session**, not one per finding. The 2026-09-05
fold-in resolved 89 entries into 24 rows, and that ratio is the target — check 7 works
by keeping the open set enumerable, so a row per finding destroys the property the board
exists for.

| Finding | Row |
|---|---|
| `impact: user-visible` — a user or moderator hits it through today's data | Its own row. |
| Everything else | Batched into one row per session, grouped by shared cause if the session's deferrals split cleanly into two or three themes. |

### Shape

```yaml
FIND-0NN:
  {type: finding, status: backlog, created: <today>,
   impact: internal, effort: s,
   title: "<the shared cause, one line>",
   ref: [implementation-artifacts/deferred-work.md],
   touches: [...],
   note: "Deferred from: <the exact deferred-work.md section heading>. <N> findings."}
```

`type` is `bug` when the batch is a genuine defect, `finding` otherwise. The `note`
**must** quote the section heading verbatim — it is the only link back to the detail,
the same role DW ids play for the Phase E evidence.

### Do not

- Do not re-verify or re-litigate the finding at defer time. The reviewing agent already
  judged it; the row records its existence, not a second opinion.
- Do not mark a deferral `skipped`. Deferred means not now, not never — `skipped` is
  reserved for a decision to never do it, and needs a stated reason.
- Do not migrate old `deferred-work.md` sections. Everything through 2026-09-01 is
  already folded in under FIND-005; re-importing them would double-count.

## 13. Promotion intake

§10 names promotion as *"the step whose omission created the current mess."* This is its
concrete mechanics, for `bmad-create-story`.

**Not every story comes from the board.** A story created from a Gate 1/2/3 prerequisite
finding, or from a plain epic entry, has no backlog row and needs none. Do not invent a
row to attach it to.

### Matching

A story implements a backlog row when any of these holds, checked in order:

1. The user named a row id (`CC-019`, `BUG-010`) when invoking the workflow.
2. The story derives from a Sprint Change Proposal, and some row's `ref` contains that
   proposal's filename. This is the deterministic case and covers most promotions.
3. The story's subject plainly matches an open row's `title` and `touches`. Confirm with
   the user before relying on this — a wrong attachment is worse than none, because it
   marks the wrong item as under way.

If none match, do nothing. Say so in the summary rather than silently skipping.

### On a match

1. Append the new story key(s) to that row's `stories`, using the full
   `sprint-status.yaml` key.
2. Set `status: promoted`. From here it is **derived** (§5) and never hand-edited again.
3. `impact`/`effort` may stay on the row; they become inert once `stories` is non-empty
   and check 8 no longer applies to it.
4. **Carve out every part of the item this story does not cover into a child row** (§6),
   with `parent` set to the row id. This is the whole point of the step. A proposal that
   fans into two stories and leaves three items unaddressed must leave three child rows
   behind, or those items vanish exactly as the 16 orphans found on 2026-09-04 did.
5. If the row carries `blocks`, check whether the gate is now satisfied — check 9 will
   flag a `blocks` entry pointing at a terminal target, but it cannot tell you that the
   *blocker itself* is resolved. That judgment is yours.

### Verify

Run `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` and confirm clean
before committing. Include `backlog.yaml` in the same commit as the story file and
`sprint-status.yaml` — the three move together, and splitting them is how a board row
ends up describing a story that was never written.
