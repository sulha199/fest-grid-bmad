# Handover — Phase B: Backlog Evidence Gathering

**Read this file, then execute it. Everything you need is here or linked from here.**

## Your job in one sentence

For each of the 20 source documents listed below, extract a fixed set of **facts** into
`_bmad-output/implementation-artifacts/backlog-evidence.yaml`.

## What you must NOT do

- **Do not decide any item's status.** Not `done`, not `promoted`, not `superseded`.
  A later pass adjudicates from your output. If you find yourself weighing evidence,
  stop and record both sides in `evidence_notes`.
- **Do not modify any existing file.** This phase is read-only except for the single
  output file you create.
- **Do not create `backlog.yaml`.** That is a later phase.
- **Do not fix anything you find.** Record it and move on.

Guessing costs more than admitting uncertainty here — a wrong fact silently becomes a
wrong board entry, which is the exact failure this project exists to eliminate.

## Background (read once)

`_bmad-output/implementation-artifacts/backlog-spec.md` defines a new intake board
(`backlog.yaml`) that will track bugs, ideas, findings, and Sprint Change Proposals —
the pre-story work that `sprint-status.yaml` has no room for. Today these are 19
proposal files with inconsistent or missing `status:` frontmatter, plus loose idea
dumps, with no way to see what is pending, half-done, or abandoned.

Read **§3 (schema), §5 (status), §6 (fan-out), §7 (touches)** of the spec so you know
what your output feeds. Skip the rest.

## Source documents

All 19 in `_bmad-output/planning-artifacts/`:

```
sprint-change-proposal-2026-08-01.md
sprint-change-proposal-2026-08-01-festdaily-rebrand.md
sprint-change-proposal-2026-08-02.md
sprint-change-proposal-2026-08-03.md
sprint-change-proposal-2026-08-06.md
sprint-change-proposal-2026-08-06-map-picker-continuity.md
sprint-change-proposal-2026-08-07.md
sprint-change-proposal-2026-08-12.md
sprint-change-proposal-2026-08-13.md
sprint-change-proposal-2026-08-13-discovery-detail-calendar-ux.md
sprint-change-proposal-2026-08-15-not-found-detection-bug.md
sprint-change-proposal-2026-08-16-detail-carousel-ux-fixes.md
sprint-change-proposal-2026-08-24-moderator-location-override.md
sprint-change-proposal-2026-08-24-ux-rework-batch.md
sprint-change-proposal-2026-08-25-video-priority-display.md
sprint-change-proposal-2026-08-28.md
sprint-change-proposal-2026-08-29.md
sprint-change-proposal-2026-09-02.md
sprint-change-proposal-2026-09-04.md
```

Plus one loose idea dump: `_bmad-output/implementation-artifacts/ai-extraction-improvement.md`

### Already-extracted frontmatter (do not re-derive)

11 of the 19 have **no** `status:` field. The 8 that do, verbatim:

| File | `status:` |
|---|---|
| `…-08-01-festdaily-rebrand.md` | `approved (planning artifacts applied; app code handed off, not yet implemented)` |
| `…-08-01.md` | `approved` |
| `…-08-02.md` | `approved` |
| `…-08-03.md` | `"approved"` |
| `…-08-06-map-picker-continuity.md` | `"approved"` |
| `…-08-06.md` | `"approved"` |
| `…-08-24-moderator-location-override.md` | `approved` |
| `…-09-04.md` | `"approved"` |

Treat this as the document's own claim — **evidence, not truth**. Your job is to gather
what would confirm or contradict it.

## Output format

Write `_bmad-output/implementation-artifacts/backlog-evidence.yaml`. One record per
source document, in the order listed above:

```yaml
records:
  - file: sprint-change-proposal-2026-09-04.md
    created: 2026-09-04
    title_from_doc: "Discovery Card Redesign (TILL badge, status badge, nearby badge, masonry grid spacing)"
    frontmatter_status: "approved"        # verbatim, or null

    stories_named:                        # story keys/numbers the document names as targets
      - 1-3b-build-the-reusable-eventcard-component
      - 1-3d-build-the-reusable-eventlistview-component
    story_status:                         # looked up in sprint-status.yaml; "NOT-FOUND" if absent
      1-3b-build-the-reusable-eventcard-component: review
      1-3d-build-the-reusable-eventlistview-component: review

    proposed_artifact_edits:              # PRD / architecture / UX changes it proposes
      - target: "prds/festgrid-prd-2026-07-10-2047/prd.md §3.1"
        marker: "Event Status Badge (added 2026-09-04)"
        present_in_target: false          # true | false | unverified
      - target: "prds/festgrid-prd-2026-07-10-2047/prd.md §3.16"
        marker: "durableImageUrl"
        present_in_target: true

    symbols_named: [EventCard, EventListView, getEvents, GridContainer]

    deferred_or_rejected_sections:        # chunks the doc explicitly defers/rejects/leaves open
      - "Rejected: reusing 2.5a backend distance resolver for the per-card nearby badge"

    supersedes_hint: null                 # quote if the doc says it replaces earlier work
    evidence_notes: |
      Doc flags 1-3i as dead (ViewModeToggle deleted by spec-ux-rework2-p1-masonry-only.md)
      while sprint-status.yaml still reads `done`.
```

### Field rules

- **`created`** — from the filename date.
- **`stories_named`** — resolve every story reference (`1.3b`, `Story 1.3b`, `3-6i`, …)
  to the **full key** in `sprint-status.yaml`. Keys look like
  `1-3b-build-the-reusable-eventcard-component`. If no key matches, record the raw
  string and mark its status `NOT-FOUND`.
- **`story_status`** — exact value from `sprint-status.yaml`'s `development_status:`.
  Do not interpret it.
- **`proposed_artifact_edits.present_in_target`** — this is the one genuinely useful
  check: grep the target file for `marker` (a distinctive phrase from the proposed NEW
  text) and report whether it is there. Use `unverified` when the target file or the
  section cannot be located — never guess `false`.
- **`deferred_or_rejected_sections`** — **the highest-value field.** These become
  child rows representing work that was proposed and quietly never done. Capture
  anything phrased as deferred, rejected, out of scope, follow-up, "not in this
  change", or left as an open question.
- **`symbols_named`** — component/function/file names, for later `touches` tagging.
  Bare names, no paths.
- **`evidence_notes`** — ≤3 lines. Contradictions, ambiguity, anything that made you
  hesitate. Empty is fine.

For `ai-extraction-improvement.md`: same record shape. It is an unstructured idea dump
with no frontmatter and probably no story references — most fields will be null/empty.
That is the correct output, not a failure.

## Method

Work **one document at a time**, appending each record as you go. Do not read all 19
into context first — they total ~299KB.

Per document:
1. Read it.
2. Extract the fields above.
3. Resolve story references against `sprint-status.yaml` (grep by story-number prefix,
   e.g. `grep -nE "^\s+1-3b" sprint-status.yaml` — do not read that file whole, it is
   ~1,869 lines).
4. For each proposed artifact edit, grep the target file for the marker.
5. Append the record. Move on.

Do not chase implementation details into the app code. If a proposal claims a code
change landed and grepping the named symbol does not settle it in one or two searches,
record `unverified` and move on — a later pass has the judgment budget for that.

## Done when

- `backlog-evidence.yaml` has exactly **20** records, in the listed order.
- Every `stories_named` entry has a matching `story_status` entry.
- The file is valid YAML (parse it to confirm).
- You have decided **zero** statuses.

Report back: the record count, how many documents named zero stories, how many had
`present_in_target: false` edits, and the total count of
`deferred_or_rejected_sections` across all records.
