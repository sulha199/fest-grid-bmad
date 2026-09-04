# Handover — Phase F: fold the deferred-work evidence into the board

**Read this file, then execute it. Everything you need is here or linked from here.**

## Your job in one sentence

Turn the 89 evidence records in `backlog-evidence-deferred.yaml` into a **small number of
new rows** on `backlog.yaml`, then close FIND-005.

## The number that matters

89 records must **not** become 89 rows. The board is 35 rows today; 124 would destroy the
property it exists for — §9 check 7 works by "keeping the open set small and enumerable,"
and a tag shared by a third of the board carries no information.

**Target: 15–25 new rows.** If you are heading past 30, you are not batching enough.
Detail is not lost when you batch: the evidence file is the `ref`, and `backlog-spec.md`
§2 is explicit that detail scales with maturity — most items are meant to die at tier 0.

## Read first

1. `_bmad-output/implementation-artifacts/backlog-spec.md` — §3 (schema, **including the
   new "Prioritization fields" subsection**), §4 (IDs), §5 (status), §7 (touches), §11
   (lenses). Skip the rest.
2. `_bmad-output/implementation-artifacts/backlog.yaml` — the board you are appending to.
   Read it fully; it is ~350 lines and you need the existing rows to spot merges.
3. `_bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml` — your input,
   89 records `DW-001`–`DW-089`. Work through it in id order.

You do **not** need to read `deferred-work.md`. Phase E already extracted it and verified
each item against current code. Trust the evidence file; do not re-verify.

## Decision rules — apply in this order

For each `DW-` record, the **first** rule that matches wins:

1. **`still_live: no` → no row.** Phase E confirmed it was fixed and said what fixed it.
   Do not memorialize dead work. (~27 records.)
2. **`duplicate_of` is set → no new row.** Add its id to the note of the row you created
   for the earlier record. (~5 records.)
3. **Already on the board → no new row.** Check `touches` and title against existing rows
   first. BUG-003 (`AWAITING_APPROVAL` email) is known to be one of these — its note
   already says "Also logged in deferred-work.md." There may be others.
4. **On the Phase E user-visible list → its own row.** These nine get individual rows, not
   batched: **DW-031, DW-032, DW-033, DW-034, DW-045, DW-069, DW-070, DW-087, DW-089.**
5. **Everything else → batch by shared cause into a thematic row.** See below.

## Batching

Group remaining records by *shared underlying cause*, not by category. One row per group:

```yaml
FIND-0NN:
  {type: finding, status: backlog, created: 2026-09-05,
   impact: internal, effort: s,
   title: "<the shared cause, one line, <=100 chars>",
   ref: [implementation-artifacts/backlog-evidence-deferred.yaml],
   touches: [...],
   note: "DW-012, DW-019, DW-044, DW-061. <one fact that changes how the row is read>"}
```

The `note` **must** list the DW ids it absorbs — that is the only link back to the detail.

Known groups (not exhaustive — find the rest yourself):

- The **cline-cli hang saga** (DW-002 / DW-004 / DW-007). Phase E found the later record
  root-causes it to a stale hub manifest and states a *verified fix*. One row at most, and
  check whether it should exist at all under rule 1. `touches: [cross:process]`.
- The **`pnpm test` date-flakiness** pair in `packages/ui` (DW-008 and its relatives).
- **Degenerate-input handling** across shared components (DW-006 / DW-015 class).
- **Error-message extraction reading only the first error** (DW-030 / DW-036 class).
- **Token/convention drift** — the `code-debt` records that are hardcoded colors instead
  of semantic tokens. `touches: [cross:ux-tokens]`.

## Field assignment

- **IDs** — continue the per-type counters in `backlog.yaml`: next free are `BUG-005`,
  `IDEA-008`, `FIND-006`. Never reuse. Assign in DW order so ids stay chronological.
- **`type`** — map from the evidence `category`:

  | evidence `category` | board `type` | typical `impact` |
  |---|---|---|
  | `bug` | `bug` | `user-visible` |
  | `edge-case` | `bug` | `latent` |
  | `test-gap` | `finding` | `internal` |
  | `code-debt` | `finding` | `cosmetic` or `internal` |
  | `process` | `finding` | `internal` (+ `touches: cross:process`) |

  The `impact` column is the *typical* case, not a rule — assign it from the §3 table by
  reading the record. A `code-debt` item a user can actually see is `cosmetic`; one they
  cannot is `internal`.
- **`impact` / `effort`** — **required on every new row** (all of yours are `backlog`).
  Definitions are in `backlog-spec.md` §3 "Prioritization fields". Most of these are
  `xs` or `s`; a batched row takes the effort of the whole group.
- **`created`** — `2026-09-05` for every new row. These are new *rows*, not new findings;
  the original dates live in the evidence file.
- **`touches`** — copy from the evidence record. Every tag must resolve against the
  registry at the top of `backlog.yaml`. **Do not extend the registry.**
- **`ref`** — `[implementation-artifacts/backlog-evidence-deferred.yaml]` on every new row.
- **`parent`** — only if the record clearly belongs to an existing `CC`. Do not force it.
- **`blocks`** — only if a record genuinely gates another row. Rare here. Do not invent.

## Placement

Append the new rows under a new dated section at the end of `items:`, before the
`# ── undated intake ──` block:

```
  # ── 2026-09-05 (deferred-work fold-in, FIND-005) ──────────────────────────────
```

Keep the existing flow-mapping style exactly — one logical row per entry.

## Close the loop

1. Set **FIND-005** to `status: done` and rewrite its note to state the outcome: how many
   records folded into how many rows, and how many were dropped as already-fixed.
2. Add `backlog_id: FIND-005` to the top of `deferred-work.md` as YAML frontmatter — §8's
   cross-reference contract requires the referenced file to carry the id back. This is the
   **only** edit you may make to `deferred-work.md`; do not touch its content.
3. Bump `last_updated:` at the top of `backlog.yaml`.

## What you must NOT do

- **Do not fix any of the underlying code.** Not one line. This is a bookkeeping pass.
- **Do not edit** `backlog-evidence-deferred.yaml`, `backlog-spec.md`, `sprint-status.yaml`,
  or any story file.
- **Do not extend the tag registry** or invent `impact`/`effort` values outside the enums.
- **Do not add a `priority` field.** Ranking is done at read time by §11 lenses. A stored
  priority is the failure mode §5 exists to prevent.
- **Do not guess `still_live`.** If a record says `unverified`, the row inherits that
  uncertainty: create it as `status: backlog` with `note: "... unverified — needs a check
  pass"`. An honest unknown beats a wrong `done`.

## Done when

- `backlog.yaml` is valid YAML and every new row has `type`, `status`, `created`,
  `impact`, `effort`, `title`, `ref`, `touches`.
- Every `impact` is one of `user-visible|compliance|latent|cosmetic|internal`; every
  `effort` is one of `xs|s|m|l`; every `touches` tag resolves against the registry.
- Every DW id from 1–89 is accounted for: it produced a row, was absorbed into a batched
  row's note, or was dropped under rule 1/2/3.
- Each of the nine rule-4 ids has its own row.
- FIND-005 is `done` and `deferred-work.md` carries `backlog_id: FIND-005`.

Verify by parsing `backlog.yaml` with a YAML parser before you report.

## Report back

Total new rows and their id ranges; how many DW records were dropped under each of rules
1/2/3; the batched groups you formed with the DW ids in each; the breakdown of new rows by
`impact` and by `effort`; and anything you could not place under any rule.
