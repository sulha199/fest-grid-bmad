---
title: 'AI dedup review piece B2b-2: the apply workflow, its credential gate, and the AD, PRD and runbook that govern it'
type: 'feature'
created: '2026-11-01'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/specs/ai-dedup-review/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The apply script (B2b-1, on `master`) cannot run: there is no workflow, no gate on the write credential, no kill-switch variable, and the PRD and AD-30 still say only a moderator approves a mid pair.

**Approach:** One workflow with two modes and two environments (read-only for `validate`, write plus a required reviewer for `apply`), guard steps around the script, and the AD, PRD amendment, database notes and runbook that make an AI accept a recorded, bounded, owner-gated action. Moderator-facing views of AI merges stay deferred.

## Boundaries & Constraints

**Always:**
- **Workflow** `.github/workflows/dedup-review-apply.yml`: `workflow_dispatch` only; the job runs only from `master`; inputs `run_tag`, `mode` (choice `validate` | `apply`), `live` (boolean), `decisions` (at most 65,535 characters), `invoker_hash`; `run-name` carries mode and tag; `permissions: contents: read`; 15 minute timeout.
- **Two environments, one job:** the job's environment is `dedup-review-live` for `apply` and `dedup-review` otherwise. `validate` gets only `DEDUP_REVIEW_READONLY_DATABASE_URL` and never sees the write secret. Both environments allow deployment from `master` only; `dedup-review-live` also requires the owner's approval, so every `apply` run, dry run included (it uses the write credential), waits for a click. `validate`, the skill's shadow mode, needs none.
- **Inputs never enter shell text.** They arrive through `env:`; decisions are written with `printf` to `$RUNNER_TEMP/decisions.json`; `DEDUP_REVIEW_INVOKER_HASH` and `DEDUP_REVIEW_APPLY_DISABLED` (read from the repository variable of that name) go to the script as environment variables; `--live` is passed only for `apply` with `live` true. `DATABASE_URL` is set only on the credential-check and script steps.
- **Concurrency:** all `apply` runs share one group and are serialized (never cancel one in progress; GitHub drops an older pending run, which the caller can re-dispatch); `validate` runs are grouped by `run_tag`. The script's advisory lock is the real guard.
- **Guards after the script:** missing `DEDUP_REVIEW_APPLY_BEGIN`/`END` markers fail the job; a non-zero exit after a live run fails it with a message that merges may already be committed and must not be re-run blind; the job summary holds counts and fixed reason codes only.
- **Public by design:** dispatch inputs show on the run page and in the log (ids, hashes, reasons), so nothing private may go into them.
- **Paper trail:** AD-45 (new) with a one-line cross-reference in AD-30 Rule 9; the PRD amendment; `3-database.md` (the write consumer and its role); `7-event-dedup.md` (runbook: validate then apply, disable, roll back with `mergeId`, a lost report); both architecture diagrams; `project-context.md`; `event-dedup-flow.html`; a setup checklist in the workflow header and the runbook.
- **Ratchet:** a test over the workflow text pins the properties above (no `inputs.` inside a `run:` block, the write secret only in the live environment's expression, `cancel-in-progress` false, the marker and live-exit guards).

**Ask First:** The write secret's name (proposed `DEDUP_REVIEW_APPLY_DATABASE_URL`, in `dedup-review-live`) and the role it holds (your earlier suggestion: the migration role; the script also refuses a role without BYPASSRLS or superuser, which only the first approved dry run proves); two environments with an approval for every apply run; the PRD wording shown at this checkpoint.

**Never:** Change the apply script; a push, schedule or branch trigger; the write secret in `dedup-review`; print anything but counts and reason codes; close `FIND-109` here; a moderator UI or list view (deferred).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Validate | `mode` validate | runs in `dedup-review`, read-only secret, no approval, counts in the summary | N/A |
| Dry run / live | `mode` apply, `live` false / true | waits for approval in `dedup-review-live`; dry run rolls back, live commits | N/A |
| Kill switch | variable set to anything but empty, `0`, `false` | script prints a disabled report; job succeeds; summary says disabled | N/A |
| Script fails | exit non-zero, live | job fails: merges may be committed, do not re-run blind | N/A |
| No markers | script printed none | job fails | N/A |
| No secret | write or read-only secret missing | credential step fails naming it | N/A |
| Not `master` | dispatched from a branch | job skipped | N/A |
| Two apply runs | overlap | second waits; an older pending one is cancelled | caller re-dispatches |

</frozen-after-approval>

## Code Map

- `.github/workflows/dedup-review-apply.yml` -- new; mirror `dedup-review-export.yml`
- `apps/backend/src/dedup-review-workflow.test.ts` -- new; reads both workflow files as text
- `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` -- AD-45; AD-30 Rule 9 pointer
- `_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md` -- 3.7 matching and 3.9.3 Moderator Tools
- docs: `docs/infrastructure/3-database.md`, `7-event-dedup.md`, `architecture-diagram.md`, `high-level-overview.md`; `_bmad-output/project-context.md`; `planning-artifacts/diagrams/event-dedup-flow.html`; `DESIGN.md`; `backlog.yaml`, `deferred-work.md`

## Tasks & Acceptance

**Execution:**
- [ ] Workflow and its text ratchet -- as above -- the properties cannot drift silently
- [ ] AD-45, AD-30 pointer, PRD amendment -- wording approved here -- governs the AI accept
- [ ] Docs, diagrams, runbook, setup checklist -- `FIND-112` done; new backlog rows for the list view and a narrow write role

**Acceptance Criteria:**
- Given `mode` validate, when it runs, then it uses only the read-only secret and no approval.
- Given `mode` apply, when dispatched, then it waits in `dedup-review-live` and no step before approval holds the write secret.
- Given a run whose log lacks the markers, or a live run that exits non-zero, then the job fails with the message above.
- Given the workflow file, when the ratchet runs, then it fails if an input appears in a `run:` block or the write secret leaves the live environment.

## Spec Change Log

## Design Notes

Proposed PRD text. In 3.7 Matching, after "rejecting it records a dismissal": "**(Amended 2026-11-01; AD-45)** A moderator may also have an AI reviewer accept a queued mid-score match for them, only when the pair passes fixed deterministic checks, within per-run and per-day limits, and the merge is recorded as AI-assisted and can be undone like any merge. The reviewer never rejects, and any pair the checks refuse, including one whose dates are one or two days apart, stays for a moderator." In 3.9.3 Moderator Tools, append: "**(Added 2026-11-01)** The merge journal records whether a moderator or the AI reviewer made each merge."

## Verification

**Commands:**
- `pnpm --filter backend test` -- expected: the workflow ratchet passes; sandbox-only failures as before
- `pnpm lint && pnpm build` -- expected: no errors
- `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/dedup-review-apply.yml'))"` -- expected: no error
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exits as on `master` (78)

**Manual checks (owner, after merge):**
- Create `dedup-review-live` (branch rule `master`, required reviewer), add the write secret there, add the variable `DEDUP_REVIEW_APPLY_DISABLED` as `false`. This session cannot create environments, secrets or variables.
- Dispatch `validate` with `{"schemaVersion":1,"decisions":[]}` and your account's hash; expect a clean report or the one invoker refusal.
