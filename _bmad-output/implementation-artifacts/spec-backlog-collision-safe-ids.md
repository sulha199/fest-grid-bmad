---
title: 'Collision-safe backlog IDs (date + random suffix)'
type: 'chore'
created: '2026-11-08'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/backlog-spec.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Backlog IDs are hand-minted per-type counters (`FIND-128` = highest + 1), so two parallel branches mint the same ID. Git merges the two appended rows cleanly into one file, and `yaml.safe_load` then silently keeps the last duplicate key, so a row disappears with no failure.

**Approach:** New IDs are `<TYPE>-<YYMMDD>-<3 chars [a-z0-9]>` (e.g. `FIND-261108-k3x`), minted by a helper with no shared state. The 319 legacy `TYPE-NNN` IDs stay valid and frozen. A new check 17 enforces format, legacy freeze, date, duplicate keys and branch-vs-`origin/master` collisions, and CI runs it.

## Boundaries & Constraints

**Always:** `backlog-spec.md` is authoritative over the script. IDs stay immutable and never reused. `created` must equal the ID's date for new-format IDs. Exit code of `backlog-check.py` stays the failure count. Missing `origin/master` or merge-base is a stderr warning, never a failure. Python 3.11 + `pyyaml` only.

**Ask First:** Changing the ID format, the suffix length, or the legacy ceilings. Making the new CI job a required check (a GitHub ruleset change, not a file).

**Never:** Rename or renumber any existing row, file, ref or commit reference. Add a shared ledger or extra branch. Touch `apps/` or `packages/`. Open a PR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New ID ok | `FIND-261108-k3x`, `created: 2026-11-08` | passes | N/A |
| Legacy frozen | `FIND-127` (at or below ceiling) | passes | N/A |
| Legacy reopened | `FIND-128` (above ceiling) | check 17 fails | message points to `scripts/backlog-new-id.py` |
| Malformed | `FIND-26118-k3x`, `find-261108-k3x`, month `13` | check 17 fails | names the row and the rule |
| Date drift | ID date `261108`, `created: 2026-11-07` | check 17 fails | N/A |
| Duplicate key | same ID twice in `backlog.yaml` | check 17 fails, names the key | loader reports, never silently overwrites |
| Branch collision | ID absent at merge-base, present on `origin/master` | check 17 fails | N/A |
| No remote | `origin/master` unreachable | warning only, exit unaffected | N/A |
| Scoped run | `--only 17` | only check 17 counted and gating | N/A |
| Mint | `backlog-new-id.py FIND [--date]` | prints one ID, absent from tree and `origin/master` | re-rolls the suffix on a hit |

</frozen-after-approval>

## Code Map

- `_bmad-output/implementation-artifacts/backlog-spec.md` -- §4 IDs, §9 check list, §10 capture; authoritative
- `scripts/backlog-check.py` -- runner; loads the board with `yaml.safe_load`, sorts IDs as strings, `{key:9}` lens width
- `scripts/backlog-history-check.py` -- audited: no ID regex, no change expected
- `_bmad/custom/bmad-correct-course.toml` -- step 1 says "scan for the highest and add one"
- `_bmad/custom/bmad-quick-dev.toml`, `bmad-dev-story.toml`, `bmad-dev-auto.toml`, `bmad-code-review.toml`, `bmad-sprint-status.toml`, `bmad-create-story.toml` -- deferral/row-registration prose; audit for minting wording
- `.github/workflows/ci.yml` -- no backlog check today; `apps/infrastructure/lib/ci-wiring.test.ts` pins the `ci`/`e2e` jobs

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/backlog_ids.py` -- new importable module: `LEGACY_CEILING`, `parse_id`, `is_valid_date`, `id_sort_key`, `mint_id`, duplicate-key-detecting loader, `check_ids`, `branch_collisions` (merge-base set difference) -- one place for every ID rule
- [ ] `scripts/backlog-check.py` -- use the module: duplicate-aware load, check 17, `--only N[,N]`, sort via `id_sort_key`, widen lens column, fix stale "checks 1-15" and docstring -- backstop
- [ ] `scripts/backlog-new-id.py` -- thin CLI over `mint_id`; prints only the ID
- [ ] `scripts/tests/test_backlog_ids.py` -- `unittest` cases for every matrix row, incl. a temp-git-repo collision case -- no existing script tests
- [ ] `_bmad-output/implementation-artifacts/backlog-spec.md` -- rewrite §4 (format, freeze, minting, ordering), add check 17 to §9, drop "highest number" and "chronological backfill" wording
- [ ] `_bmad/custom/*.toml` -- replace "highest + 1" and `NNN` minting wording with `scripts/backlog-new-id.py <TYPE>`
- [ ] `.github/workflows/ci.yml` -- new standalone `backlog-ids` job: `fetch-depth: 0`, install `pyyaml`, run the tests and `backlog-check.py --only 17`

**Acceptance Criteria:**
- Given the current board, when `backlog-check.py` runs, then failures do not exceed the 78 baseline and none are check 17.
- Given each matrix row, when the unit tests run, then every row behaves as listed.
- Given the CI edit, when `ci-wiring.test.ts` runs, then it still passes.

## Spec Change Log

## Design Notes

Merge-base, not `origin/master`, decides "new on this branch": an ID is a collision only if absent at the merge-base and present on `origin/master`. Comparing titles instead would false-positive on a legitimate title edit. Duplicate-key detection covers the post-merge case, where both rows are in one file.

Collision odds: same type, same day, same suffix (36^3 = 46,656) across two live branches. The CI check catches the remainder; the loser is unmerged, so renaming it touches only its branch.

## Verification

**Commands:**
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py --quiet; echo $?` -- expected: no more than 78, no `check 17` lines
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py --only 17; echo $?` -- expected: 0
- `uv run --python 3.11 --with pyyaml python -m unittest discover -s scripts/tests -v` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-new-id.py FIND` -- expected: matches `^FIND-\d{6}-[a-z0-9]{3}$`
- `cd apps/infrastructure && npx tsx --test lib/ci-wiring.test.ts` -- expected: pass
