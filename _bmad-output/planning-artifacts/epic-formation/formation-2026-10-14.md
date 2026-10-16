# Epic Formation Pass — 2026-10-14 (scoped)

**Method:** `epic-formation-gate.md` §5/§7. **Skill:** `bmad-form-epics`.
**Scope:** scoped pass over the rows named by the user (IDEA-069, FIND-018, BUG-011) plus a title-keyword re-scoring check. **Not a full-board sweep** — no feature-axis sweep over all `idea`/`proposal` rows and no disposition for every other open row were run, so the §5 balance line covers only the rows read.
**Frozen input:** `backlog-check.py` already exited 69 before this pass (checks 1, 3, 5, 14, 15; none concern these rows); user chose to proceed. After the pass it exits 68 (FIND-018's over-long note was fixed by the carve).

## Accepted epic

**Epic 9** (feature axis, next integer; Epic 8 is a placeholder).
Capability: a user describes events in one prompt using any combination of the supported criteria, including or, not, groups, rolling date spans and several weekdays, and sees exactly the events they meant, with a summary that says how the prompt was understood.
Members: **IDEA-069** (driving), **FIND-083** (carved from FIND-018), **BUG-060** (carved from BUG-011).
Stories: 9.1a, 9.1b, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 9.9z (ratchet optional for a feature epic; kept).
Spec route: spec already updated (`bmad-spec`, CAP-6/CAP-7); PRD §3.15/§4.18 amendment carried in 9.9z.

## Criteria check (§5)

1. ≥3 open rows — IDEA-069, FIND-083, BUG-060 (after carve-first).
2. Sentence written before membership (above).
3. Journey form — FIND-083 members are gaps in "exactly the events they meant" (wrong date windows, unvalidated filters). BUG-060 is an abuse guard and fails the journey test, so it joins as a **sweep story** (9.8), not a capability member.
4. Ratchet — optional (feature epic); 9.9z included.
5. Effort ≥3 stories — 10 stories.

## Carve-first decisions

| Row | Result |
|---|---|
| FIND-018 | Split. DW-074..078 and DW-086 → FIND-083 (member). Remainder DW-083/084/085 stays on FIND-018 → `promote` (effort s). |
| BUG-011 | Split. DW-082 → BUG-060 (sweep, Story 9.8). Remainder DW-066/067/068 stays on BUG-011 (`epic-0-i2`). |

## Rejected / not members

- Folding FIND-018 and BUG-011 whole (earlier suggestion) — failed criterion 3's feature form: their saved-filter quota/pagination/error-mapping and non-resolver Gemini guardrails can ship alone without leaving the capability incomplete.

## Unclustered rows read (disposition)

| Row | Disposition |
|---|---|
| FIND-018 (remainder) | promote |
| BUG-011 (remainder) | already `epic: epic-0-i2` |

Balance (scoped): 3 accepted members + 2 unclustered remainders = 5 rows read. Related done/promoted rows (IDEA-065, IDEA-019, IDEA-038, FIND-060, BUG-025) are not inputs; they constrain Stories 9.1b, 9.3, 9.4.

## Re-scoring sweep (§9.1) — partial

A title-keyword scan of open rows (weekday, date range, temporal, EventFilterInput, widget filter, boolean, nested, AI filter, summary renderer, prompt) found no open row whose effort drops with this mechanism. FIND-055 (BUG-046 hardening) is unrelated. The full-board read was not run; run it before `bmad-epic-readiness-check` if desired.

## Absorbed stories

No unstarted story joined the cluster. Story 1-3l (review) is constrained by 9.3 (Feed/Favorites compilers) but is not absorbed. Sprint action item `retro-7-1` closes with Story 9.7.

## Coverage

Not computed (scoped pass).

## Next

`bmad-epic-readiness-check` on Epic 9 (validates 9.1a as the buildable mechanism), then `bmad-create-story` per story in order.
