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

**Problem:** Backlog IDs are hand-minted per-type counters (`FIND-128` = highest + 1), so parallel branches mint the same ID. Git merges the two appended rows cleanly into one file and `yaml.safe_load` silently keeps the last duplicate key, so a row vanishes with no failure. This has already happened: `IDEA-103` is a key twice on `master` (319 keys, 318 rows loaded), and the first row is lost.

**Approach:** New IDs are `<TYPE>-<YYMMDD>-<3 chars [a-z0-9]>` (e.g. `FIND-261108-k3x`), minted by a helper with no shared state. The 318 distinct legacy `TYPE-NNN` IDs stay valid and frozen. A new check 17 enforces format, legacy freeze, ID-date equals `created`, duplicate keys in any mapping, and branch-vs-`origin/master` collisions. A standalone CI job gates on it. One legacy row is repaired first (the `IDEA-103` duplicate).

## Boundaries & Constraints

**Always:** `backlog-spec.md` is authoritative over the script and cites the module's constants by name, not as duplicated numbers. IDs are immutable and never reused. For a new-format ID, `created` is derived from the ID's `YYMMDD`, never from the clock; the helper uses UTC and `--date` mints retroactive rows. Check 17 does not compare an ID's prefix to `type:` (reclassification keeps the ID, §4). Duplicate detection covers every mapping, not only top-level keys. Exit code of `backlog-check.py` stays the failure count. Python 3.11 + `pyyaml` only. The `IDEA-103` repair lands before the CI job.

**Ask First:** Changing the ID format, suffix length or legacy rule. Making the CI job a required check, or requiring up-to-date branches (a GitHub ruleset change, not a file).

**Never:** Rename or renumber any existing row, file, ref or commit reference, with ONE exception: the `IDEA-103` duplicate repair (the row with fewer citations gets a new-format ID dated 2026-10-31; update only citations that unambiguously name that row; never allowlist the duplicate). Add a shared ledger or extra branch. Touch `apps/` or `packages/`. Open a PR.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| New ID ok | `FIND-261108-k3x`, `created: 2026-11-08` | passes | N/A |
| Legacy frozen | `FIND-127`, present at merge-base | passes | N/A |
| Legacy reopened | `FIND-128`, or a gap such as `IDEA-074` | check 17 fails | names the helper; with no git, the per-type ceiling is the fallback |
| Malformed | `FIND-26118-k3x`, lowercase type, month `13` | check 17 fails | names row and rule |
| Date drift | ID date `261108`, `created: 2026-11-07` | check 17 fails; `str()` compare covers quoted and unquoted dates | N/A |
| Duplicate key | same key twice in any mapping | check 17 fails, names key and lines | one-line rename recipe in the message |
| ID removed | present at merge-base, absent at HEAD | check 17 fails (immutable, never reused) | N/A |
| Branch collision | in `HEAD−base` and in `master−base` | check 17 fails; names the branch that must rename | N/A |
| No remote | `origin/master` or merge-base missing | local: stderr warning; `CI=true` or `--require-remote`: failure | N/A |
| Scoped run | `--only 17` | only check 17 counted and gating | N/A |
| Mint | `backlog-new-id.py FIND [--date]` | prints one ID absent from tree and `origin/master` | re-rolls the suffix |

</frozen-after-approval>

## Code Map

- `_bmad-output/implementation-artifacts/backlog.yaml` -- `IDEA-103` at lines 2851 and 2899 (re-extract Apply; profile lookup fallback)
- `_bmad-output/implementation-artifacts/backlog-spec.md` -- §4 IDs, §9 checks, §10 capture, §12 `FIND-0NN` example
- `scripts/backlog-check.py` -- `yaml.safe_load`, string `sorted()`, `{key:9}` lens width, stale "checks 1-15"
- `scripts/backlog-history-check.py` -- audited: no ID regex, no change
- `_bmad/custom/bmad-correct-course.toml` -- "highest and add one" (l.13), `CC-NNN` (l.4,15,40,47)
- `_bmad/custom/bmad-quick-dev.toml`, `bmad-dev-auto.toml`, `bmad-code-review.toml` -- "report the row id(s) you added", no minting rule
- `_bmad/custom/bmad-sprint-status.toml` -- stale "checks 1-9" and row count
- `.github/workflows/ci.yml`, `apps/infrastructure/lib/ci-wiring.test.ts` -- job names pinned; `needs` untouched

## Tasks & Acceptance

**Execution:**
- [ ] `backlog.yaml` + the proposal doc for the renamed row -- repair `IDEA-103`: count citations (`git grep`), give the row with fewer a new-format ID dated 2026-10-31, update its `**Backlog:**` line and unambiguous citations -- precondition for check 17 and CI
- [ ] `scripts/backlog_ids.py` -- new module: ceilings, `parse_id`, `is_valid_date`, `id_sort_key`, `mint_id`, all-mapping duplicate-detecting loader, `check_ids`, `collisions` as `(HEAD−base) ∩ (master−base)`, removed-ID and legacy-reuse detection
- [ ] `scripts/backlog-check.py` -- use the module; duplicate-aware load; check 17; `--only N[,N]`; `--require-remote` / `CI=true`; `id_sort_key` ordering; widen lens column; fix "checks 1-15" and the docstring
- [ ] `scripts/backlog-new-id.py` -- thin CLI over `mint_id`; UTC date; prints only the ID
- [ ] `scripts/tests/__init__.py`, `scripts/tests/test_backlog_ids.py` -- `unittest` per matrix row; temp git repo (with `-c user.name/user.email`) for collision, removed-ID and legacy-reuse; assert ceilings equal the board's real maxima; `--only 17` via subprocess on the hyphenated script
- [ ] `backlog-spec.md` -- rewrite §4 (format, freeze, minting, ordering by date then suffix, module constants by name), add check 17 to §9, fix §10 and the §12 `FIND-0NN` example; drop "highest number" and "chronological backfill" wording
- [ ] `_bmad/custom/*.toml` -- correct-course, quick-dev, dev-auto, code-review: mint with `scripts/backlog-new-id.py <TYPE>`, set `created` from the ID; fix sprint-status stale text
- [ ] `.github/workflows/ci.yml` + `ci-wiring.test.ts` -- job `name: Backlog IDs`, no `paths:`, not in `needs`, `setup-python` 3.11, pinned `pyyaml`, runs unit tests and `--only 17`; assert the job exists and runs `--only 17`
- [ ] `README.md` -- check for ID-minting wording; fix if present

**Acceptance Criteria:**
- Given the repaired board, when `backlog-check.py` runs, then failures do not exceed the 78 baseline, none are check 17, and 319 rows load.
- Given each matrix row, when the unit tests run, then every row behaves as listed.
- Given the CI edit, when `ci-wiring.test.ts` runs, then it passes and the new job is asserted.

## Spec Change Log

- 2026-11-08, architecture review (APPROVE WITH CHANGES): added the `IDEA-103` repair and its one exception to "Never"; collision rule now `(HEAD−base) ∩ (master−base)`; CI fails on a missing remote; legacy gap-reuse and removed-ID rules; `created` derived from the ID in UTC; all-mapping duplicate detection; wider Code Map; fixed test layout. KEEP: merge-base over title comparison, 3-char suffix, `--only 17` gating, no ledger.

## Design Notes

Duplicate-key detection is the real CI gate: on GitHub's merge-ref and master-push checkouts, `HEAD` already contains `master`, so the merge-base set is empty. The merge-base rules matter for a local pre-push run or a PR-head checkout, where they name the branch that must rename.

CI is advisory today (no required status checks), and a stale-green PR is not re-run when `master` moves. The push-to-`master` run is the catch-all, so a duplicate surfaces red there. Requiring the check plus up-to-date branches is the Ask-First ruleset change.

Collision odds: same type and day, 36^3 = 46,656 suffixes; about 1% per year at the board's creation rate.

## Verification

**Commands:**
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py --quiet; echo $?` -- expected: at most 78, no `check 17` lines
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py --only 17; echo $?` -- expected: 0
- `uv run --python 3.11 --with pyyaml python -m unittest discover -s scripts/tests -t scripts -v` -- expected: all pass
- `uv run --python 3.11 --with pyyaml scripts/backlog-new-id.py FIND` -- expected: matches `^FIND-\d{6}-[a-z0-9]{3}$`
- `cd apps/infrastructure && npx tsx --test lib/ci-wiring.test.ts` -- expected: pass
