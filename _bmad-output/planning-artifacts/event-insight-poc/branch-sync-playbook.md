# Keeping `claude/ecstatic-shannon-e8eh9h` in sync with master

Written 2026-11-16, after the first big sync (480 master commits, 958 files). **The branch is long-lived and will not merge into master soon** (it carries a complex app upgrade), so the goal is to stay close to master: every sync should be small, and the branch should differ from master only where it has to.

## Rules that decide everything

1. **Master's numbers win; the branch moves.** PRD sections and FR numbers, spine AD and rule numbers, backlog IDs, migration numbers: if both sides used a number, the branch side is renumbered.
2. **Do not edit master-owned files for tidiness.** Any edit to a file master also changes is a future conflict. If a branch rename would touch a master-owned file (a doc or a code comment), leave the old reference there instead.
3. **Sync often.** The first sync took hours because the two sides had drifted for weeks and had already used each other's numbers. A weekly sync is mostly clean merges.
4. **Never fix a number in place in master's text.** Fix the branch's own text and, if useful, add a mapping note (see the renumbering table).

## Procedure

1. **Fetch over https** (SSH fails on the owner's machine) into a temp ref, then point `origin/master` at it so the repo's scripts see the real master:
   `git fetch https://github.com/sulha199/fest-grid-bmad.git master:refs/remotes/tmp/master` then `git update-ref refs/remotes/origin/master refs/remotes/tmp/master` and `git update-ref -d refs/remotes/tmp/master`.
2. **Size it:** `git merge-base HEAD origin/master`, `git rev-list --left-right --count HEAD...origin/master`, and the files changed on both sides:
   `comm -12 <(git diff --name-only HEAD...origin/master | sort) <(git diff --name-only origin/master...HEAD | sort)`.
3. **Look for number collisions before merging.** Compare these between the merge base, the branch and master:
   - PRD: `grep -nE '^#{2,3} (3\.|4\.)'` and the highest `FRnnn` in `prd.md`.
   - Spine: `grep -nE '^### AD-'` (AD numbers) and, inside an AD both sides touched, the numbered rules.
   - Backlog: row IDs new on both sides, and branch rows whose **title** matches a master row under another ID (the branch once numbered master's rows differently; identity is the title, not the ID).
   - Drizzle migrations: duplicate numbers in `packages/database/drizzle`, and the journal's `when` order.
4. **Renumber the branch side first, in its own commit, before merging**, so the merge only has content conflicts. `sync-tools/renumber-prd-refs.py` does the PRD (3.x sections, FR numbers, 4.x interface); restrict section shifts to lines that say PRD, Section or §, because story numbers such as 3.13-3.19 look the same. Skip `.memlog.md` history entries.
5. **Merge:** `git merge --no-commit --no-ff origin/master`. Then per conflicted file:
   - Take **theirs** when `git diff <base> HEAD -- file` shows the branch changed nothing in that hunk.
   - **Both** (ours then theirs, by date) for two additions at the same place, such as amendment paragraphs.
   - **Token-level 3-way** for long lines both sides edited: `git checkout --conflict=diff3 -- file`, then `sync-tools/tokmerge.py file tok,theirs,...` (one choice per hunk; `keep` leaves it for hand work). Check for inline conflict markers afterwards; two edits at the same token will clash and need hand work.
   - `sync-tools/resolve.py file ours|theirs|both ...` for plain choices.
   - A rule-number clash inside one AD (it happened in AD-14): keep master's numbers, give the branch's rules the next free numbers, and write the old number into the rule text.
6. **Backlog board:** rebuild it as master's board plus the rows only the branch has. Drop branch copies of master rows. A branch-only row whose ID clashes, or whose numeric ID is not in master (counters are frozen), gets a new ID: `uv run --python 3.11 --with pyyaml scripts/backlog-new-id.py TYPE --date <the row's created date>`. Then remap the old ID tree-wide in branch-authored files only, rename detail files and folders, and record old to new in `backlog-id-renumbering-2026-11-16.md` (add a section per sync). **Keep an ID that master's code or comments cite**; only the check-17 finding remains (currently BUG-073, BUG-074, BUG-075, IDEA-095, IDEA-096).
7. **After the merge, before committing:**
   - `grep -rn '<<<<<<<\|>>>>>>>'` over the tree, no hits.
   - `schema.ts` still imports everything master uses (the first sync dropped `jsonb`, because the branch had removed it from the import; master's columns still call it). `cd packages/database && npx vitest run jsonb-columns.test.ts && npx tsc --noEmit`.
   - New plain `jsonb()` columns from master fail the ratchet: read how master reads them in SQL (`#>> '{}'` and `::text::jsonb` are the two safe patterns), then add them to `MASTER_PLAIN_JSONB_ALLOWED` in `packages/database/jsonb-columns.test.ts` with that evidence.
   - `python scripts/backlog-check.py`. On Windows it wrongly flags every legacy ID for check 17 (backslash board path); call `backlog_ids.check_ids` with `_bmad-output/implementation-artifacts/backlog.yaml` as a forward-slash path to see the real findings. FIND-126's note length is master's own.
   - `pnpm install`, rebuild `packages/domain` and `packages/database` dist, then the backend and web type-check and the suites that touch the changed areas.
8. **Commit** with a message that lists the collisions and how each was resolved; add the follow-ups that were not done. Update `session-handoff-prompt-*.md` if the state changed.

## Divergences from master we are keeping on purpose

| Area | Branch | Master |
|---|---|---|
| PRD | 3.19-3.22 (duplicates, groups, place and area, audience country), FR131-FR141, 4.22 EventGroup | 3.18 Background Vendor Jobs, FR116-FR130, 4.21 Job |
| Spine AD-14 | Rules 7 (pin trust) and 8 (geocode input hygiene) | Rules 3-6 (country filter, proximity bias, ...) |
| Spine | AD-36..39, AD-42, AD-43 (branch only) | AD-40, AD-41, AD-44..54 |
| Backlog | 57 rows with new date-format IDs; table in `backlog-id-renumbering-2026-11-16.md` | master's board |
| `schema.ts` | `customJsonb` on 27 columns (BUG-261019-ud2) | plain `jsonb()` |
| Ratchet test | `jsonb-columns.test.ts` with an allow-list of master's four plain columns | none |
| EXPERIENCE.md | master's "location is always a map link" rule won; the branch's precision-based place line plan is unbuilt | master's rule |

## Mistakes to avoid (all happened on 2026-11-16)

- Merging first and renumbering after: it made the conflicts unreadable. Renumber, commit, then merge.
- Running a token-level diff over a 6,000-line file: it never finished. Use `git diff -U0` hunks and diff only inside them.
- Renaming an ID tree-wide, which also rewrote five master-owned docs: reverted afterwards. Exclude files that master owns.
- Assuming a clean `git merge` means the code still compiles: the dropped `jsonb` import was only caught by running the ratchet test.
