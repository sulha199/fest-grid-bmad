# Handover — Phase E: deferred-work.md Evidence Gathering

**Read this file, then execute it. Everything you need is here or linked from here.**

## Your job in one sentence

For each of the **89 bullets** in `_bmad-output/implementation-artifacts/deferred-work.md`,
extract a fixed set of facts — including whether the condition it describes **still holds
today** — into `_bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml`.

## What you must NOT do

- **Do not decide any item's backlog status.** Not `done`, not `promoted`, not `skipped`.
  A later pass adjudicates from your output. If you find yourself weighing evidence,
  record both sides in `notes` and move on.
- **Do not fix anything.** Not even a one-line obvious fix. Several of these are trivially
  fixable and that is precisely the trap — recording them is this phase's whole job.
- **Do not modify `deferred-work.md`** or any file it mentions. Read-only except the
  single output file you create.
- **Do not edit `backlog.yaml`.** A later phase merges your records into it.

Guessing costs more than admitting uncertainty. A wrong `still_live: no` silently deletes
real work from the board.

## Background (read once)

`_bmad-output/implementation-artifacts/backlog-spec.md` defines this project's intake
board, `backlog.yaml`, which already tracks 35 items distilled from 19 Sprint Change
Proposals. `deferred-work.md` is a **third tracker** discovered afterwards — an
append-only log of work deferred from story verification, code review, and quick-dev
sessions, spanning 2026-07-22 to 2026-09-01. It is recorded on the board as **FIND-005**,
and this phase is the pass that folds it in.

Read **§3 (schema), §5 (status), §7 (touches)** of the spec so you know what your output
feeds. Skip the rest.

Unlike the Sprint Change Proposals, these items are **old and mostly small**: test gaps,
cosmetic debt, unreachable edge cases, and tooling notes. Many were written months ago
against code that has since changed. Establishing what is still true is the entire value
of this pass — a verbatim re-listing of 89 stale bullets would be worthless.

## Source document

`_bmad-output/implementation-artifacts/deferred-work.md` — 347 lines. Verified structure:

- **33** sections headed `## Deferred from: <source> (<YYYY-MM-DD>)`
- **89** top-level `- ` bullets (sections carry between 1 and 8 each)
- **69** bullets have an indented `evidence:` continuation line explaining why it was not
  fixed
- **2** bullets are prefixed `**Process note:**` — tooling/workflow findings, not code work
- **3** indented sub-bullets, which belong to their parent bullet and are **not** separate
  records

One record per top-level bullet. 89 records, in document order.

## Output format

Write `_bmad-output/implementation-artifacts/backlog-evidence-deferred.yaml`:

```yaml
records:
  - id: DW-001                    # sequential, document order
    section: "verification of ux-rework2-batch-9 (Post Selection AccountAvatar reuse)"
    section_date: 2026-09-01
    line: 24                      # line number of the bullet in deferred-work.md

    summary: "AccountAvatar commonClasses hardcodes border-slate-200/dark:border-slate-800 instead of the semantic border-border token"
    category: code-debt           # see taxonomy below
    evidence_given: "Found during batch-9's own Blind-Hunter review; not fixed since cosmetic and pre-existing to a frozen shared component"

    symbols_named: [AccountAvatar, commonClasses, border-border]
    files_named: ["packages/ui/src/core/account-avatar.tsx:54", "apps/web/src/app/globals.css:34"]

    still_live: yes               # yes | no | unverified
    still_live_evidence: "account-avatar.tsx:54 still reads border-slate-200 dark:border-slate-800; no border-border usage in the file"

    touches: [pkg:ui, cross:ux-tokens]
    duplicate_of: null            # DW id of an earlier record describing the same underlying issue
    notes: ""                     # <=3 lines; ambiguity only
```

### Field rules

- **`id`** — `DW-001` … `DW-089`, strictly document order. These are working ids for this
  file only; final backlog ids are assigned during adjudication.
- **`summary`** — one line, under 140 chars. Compress the bullet without losing the
  specific claim. Keep symbol names; drop the prose.
- **`category`** — exactly one of:
  - `test-gap` — missing or inadequate test coverage
  - `code-debt` — cosmetic, refactor, unused cruft, token/convention drift
  - `edge-case` — defensive gap, usually documented as unreachable through real data today
  - `bug` — a real defect with user-visible or correctness impact
  - `process` — tooling, workflow, delegation, CI (includes the `**Process note:**` bullets)
- **`evidence_given`** — compress the bullet's own `evidence:` line. Empty string if absent.
- **`files_named`** — keep `path:line` form where the bullet gives it. These are your
  cheapest `still_live` probes.
- **`still_live`** — **the highest-value field.** Does the described condition still hold?
  - `yes` — you confirmed the condition persists (the hardcoded value is still there, the
    test still lacks fake timers, the guard is still missing).
  - `no` — you confirmed it was since fixed. **Say what fixed it** in
    `still_live_evidence`; never assert `no` from absence of the old symbol alone, since a
    rename looks identical to a fix.
  - `unverified` — could not settle it within budget, or the item is not mechanically
    checkable (most `process` items). This is a respectable answer.
  - **Budget: 1–2 greps per item.** These are small items; do not chase any one of them
    into a deep investigation. Prefer the `path:line` the bullet already gives you.
- **`touches`** — from the registry below. Every tag must resolve; do not invent tags.
- **`duplicate_of`** — **read this carefully.** Many bullets describe the *same underlying
  issue* recurring across batches, and several say so outright ("pre-existing, not
  introduced by this batch", "same class of edge case already accepted for X in batch-7",
  "will keep resurfacing every session"). When a later bullet restates an earlier one, set
  `duplicate_of` to the earlier `DW-` id and still fill every other field. **Do not drop
  duplicates** — the adjudication pass needs to see the repetition to judge severity.
- **`notes`** — ≤3 lines, ambiguity only. Empty is fine and common.

### Tag registry (authoritative — do not extend)

```
web:   accounts auth events locations moderation onboarding post-selection posts
       reports settings subscriptions system votes widgets wizard
pkg:   analytics database domain graphql-select shared-types ui
app:   backend infrastructure
cross: ai-extraction prd architecture ux-tokens i18n notifications process
```

Form is `namespace:slice` or `namespace:slice/Symbol`. Tag as specifically as you honestly
know. Every `process` category item gets `cross:process`.

## Method

Work **section by section**, appending records as you go.

1. Read one `## Deferred from:` section.
2. For each top-level bullet in it, fill every field except `still_live`.
3. Then probe `still_live` using the `path:line` the bullet names, or one targeted grep for
   the distinctive symbol. Stop after two searches and record `unverified`.
4. Append the records. Move to the next section.

Do not read the whole file into context and then start writing — work through it in order
so the `duplicate_of` back-references are natural to spot.

Two known traps in this document:

- The **`pnpm test` date-flakiness** entry (two `packages/ui` tests failing on wall-clock
  rollover) explicitly says it "will keep resurfacing every session until fixed." Check it
  rather than assuming either way.
- The **`cline-cli` hang** entries span several sections and escalate — an early one
  reports the symptom, a later one root-causes it to a stale hub manifest and states a
  verified fix. These are `process` items, they are related, and the later one likely
  supersedes the earlier. Record the relationship in `duplicate_of` and `notes`; do not
  merge them.

## Done when

- `backlog-evidence-deferred.yaml` has exactly **89** records, ids `DW-001`–`DW-089`, in
  document order.
- Every record has a `category` from the taxonomy and at least one `touches` tag that
  resolves against the registry above.
- Every `duplicate_of` value is either `null` or an id earlier in the same file.
- The file is valid YAML (parse it to confirm).
- You have decided **zero** backlog statuses and changed **zero** other files.

Report back: record count; the breakdown by `category`; the breakdown by `still_live`
(yes/no/unverified); how many records carry a `duplicate_of`; and the ids of any items you
believe are **still live and user-visible** rather than cosmetic — those get read first
during adjudication.
