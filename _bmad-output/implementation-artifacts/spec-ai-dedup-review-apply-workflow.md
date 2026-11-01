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

**Problem:** The apply script (B2b-1, on `master`) cannot run: no workflow, no gate on the write credential, no kill-switch variable, and the PRD and AD-30 still say only a moderator approves a mid pair.

**Approach:** One workflow with an input-check job, a read-only `validate` job and a gated `apply` job, a guard script with real tests around the script's output, and the AD, PRD amendment, database notes and runbook that make an AI accept a recorded, bounded, owner-released action. Moderator-facing views of AI merges stay deferred.

## Boundaries & Constraints

**Always:**
- **Workflow** `.github/workflows/dedup-review-apply.yml`: `workflow_dispatch` only; inputs `run_tag`, `mode` (choice, default `validate`), `live` (boolean), `decisions` (required), `invoker_hash` (required); `run-name` carries mode, `LIVE` when it is a live apply, and the tag; `permissions: contents: read`; 15 minute timeout; every job runs only from `master`. The environment branch rule, not the `if`, is the control.
- **Three jobs, static environments.** (1) `inputs`: no environment, no secret; fails unless `mode` is `validate` or `apply`, `live` is not true with `validate`, `invoker_hash` is 64 hex, `run_tag` matches the script's rule. (2) `validate` in `dedup-review`, read-only secret only. (3) `apply` in `dedup-review-live`, write secret only, which requires the owner's approval, so every apply run (dry run included, it uses the write credential) waits for a click. `validate` is the skill's shadow mode and needs none. Each secret is referenced in exactly one job, with no `||` fallback.
- **Inputs never enter shell text:** they arrive through `env:`; decisions are written with `printf '%s'` to `$RUNNER_TEMP/decisions.json`; the invoker hash goes in `DEDUP_REVIEW_INVOKER_HASH`; `--run-tag` is always passed; `--live` only for `apply` with `live` exactly `true`; `DATABASE_URL` only on the credential-check and script steps.
- **Hardening of this new file:** `actions/checkout` with `persist-credentials: false`; `pnpm install --frozen-lockfile --ignore-scripts` (verified to build and run the script); actions are NOT pinned by SHA because this session cannot look the SHAs up (see Ask First).
- **Kill switch:** the variable `DEDUP_REVIEW_APPLY_DISABLED` lives in `dedup-review-live` (settings there need an admin) and is passed to the script. The `apply` job refuses unless it is exactly `false` or `0`, so a deleted or misspelled variable stops apply rather than allowing it.
- **Fresh code:** the commit is fixed at dispatch and an approval can come days later, so after approval the `apply` job fails unless `GITHUB_SHA` is the current head of `master`.
- **Concurrency:** all `apply` runs share one group, serialized, never cancelled in progress; `validate` groups by `run_tag`. GitHub drops an older pending run, and a run waiting for approval probably holds the slot (verified by a manual check). The script's advisory lock is the real guard.
- **Guard script** `scripts/dedup-review-apply-guard.sh`, run in the same step as the script with its exit status captured: a non-zero status fails the job (for a live apply the message says the run is one transaction and usually rolled back, that the one exception is a report lost after commit, which the script says on stderr, and to check `event_merges` where `performed_via = 'ai_skill'` before any re-run); a zero status still needs both markers, valid JSON and a `mode` that matches (`disabled` always allowed); the summary shows mode, kill switch, `usedLast24h` (`n/a` when null), counts and a count per reason code, never an id, a `mergeId` or text.
- **Public by design:** dispatch inputs show on the run page and in the log (ids, hashes, reasons, tag). The skill sends `reasons: []`.
- **Paper trail:** AD-45 with pointers from AD-30 Rules 7 and 9; the PRD amendment; `3-database.md`; `7-event-dedup.md` (stale statements rewritten, runbook: validate then apply, disable, roll back from the database's `event_merges` list not from the log, a lost report); both architecture diagrams; `project-context.md`; `event-dedup-flow.html`; `DESIGN.md` (shadow mode is `validate`); a setup checklist in the workflow header and the runbook.
- **Tests** (`apps/backend/src/dedup-review-workflow.test.ts`): the guard script run against fixtures (markers present or absent, status 0 or 1, live or not, mode mismatch, disabled report); a text scan of the workflow after stripping comments: no `${{` in any `run:` body, only the `workflow_dispatch` trigger, `permissions` only `contents: read`, `cancel-in-progress` false, the write secret only in the `apply` job and the read-only one only in `validate`, `--ignore-scripts` and `persist-credentials: false` present.

**Ask First:** The write secret's name (proposed `DEDUP_REVIEW_APPLY_DATABASE_URL`, in `dedup-review-live`) and the role it holds (your earlier suggestion: the migration role, with an expiry for that exception, proposed 2026-12-31, after which a narrow role replaces it); SHA-pinning (this session cannot read the actions' repositories: either you supply the SHAs, or the write secret is created only after the actions here are pinned); the repository settings AD-45 lists as preconditions; the PRD wording shown at this checkpoint.

**Never:** Change the apply script; a push, schedule or branch trigger; the write secret in `dedup-review` or at repository level; print anything but counts and reason codes; close `FIND-109`; a moderator UI or list view.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Validate | `mode` validate | `validate` job, read-only secret, no approval, counts in the summary | N/A |
| Dry run / live | `mode` apply, `live` false / true | waits for approval; head check; dry run rolls back, live commits; run name shows `LIVE` | N/A |
| Kill switch on | variable set to anything but `false`/`0` | the job refuses before the script runs, naming the variable | job fails |
| Variable missing | deleted or misspelled | same: apply refuses | job fails |
| Script fails | non-zero status | job fails with the message above | N/A |
| No markers, or wrong mode | status 0 | job fails | N/A |
| Master moved | approval came after a new commit | `apply` fails: re-dispatch | job fails |
| Bad inputs | `live` with `validate`, bad hash or tag, empty decisions | the `inputs` job fails; nothing else runs | N/A |
| Two apply runs | overlap | the second waits; an older pending one is cancelled | caller re-dispatches |

</frozen-after-approval>

## Code Map

- `.github/workflows/dedup-review-apply.yml` -- new; mirror `dedup-review-export.yml`
- `scripts/dedup-review-apply-guard.sh` -- new; summary and guards, testable
- `apps/backend/src/dedup-review-workflow.test.ts` -- new; run from `apps/backend` (paths resolve from the working directory)
- `festgrid-architecture-spine.md` -- AD-45; pointers in AD-30 Rules 7 and 9
- PRD 3.7 and 3.9.3; `3-database.md`; `7-event-dedup.md` (lines about "built, not wired"); `architecture-diagram.md` (export row, `GHA_DE`, header stamp); `high-level-overview.md`; `project-context.md`; `event-dedup-flow.html`; `DESIGN.md`; `backlog.yaml`, `deferred-work.md`

## Tasks & Acceptance

**Execution:**
- [ ] Workflow, guard script and tests -- as above
- [ ] AD-45 (rules: bridge, floor and caps bound model error only, credential protection comes from the settings below, owner-role exception with an expiry, accepted public exposures, a gate that releases the credential and does not review decisions, kill switch, retention), PRD amendment, pointers
- [ ] Docs, diagrams, runbook, setup checklist; `FIND-112` done; new rows `FIND-114` (narrow write role, run id in the journal) and `IDEA-113` (moderator list and badge of AI merges), each with its `deferred-work.md` heading

**Acceptance Criteria:**
- Given `validate`, when it runs, then no step has the write secret and no approval is needed.
- Given `apply`, when dispatched, then it waits in `dedup-review-live` and no step before approval holds the write secret.
- Given a missing variable, a moved `master`, missing markers or a non-zero status, then the job fails with a fixed message.
- Given the workflow file, when the test runs, then it fails if an input reaches a `run:` body or a secret leaves its job.

## Spec Change Log

- 2026-11-01, architecture and code review before approval: one job with a dynamic environment replaced by three jobs with static ones (a repository-level secret of the same name would otherwise reach `validate`, and the ratchet could not prove isolation); guards moved into a tested script run in the script's own step (a later step cannot see the exit status); the "may already be committed" claim narrowed (the run is one transaction); kill switch moved to the live environment and fails closed when absent; head-of-`master` check after approval; install hardening added for this file; PRD wording corrected (a shared link can pass a 1 to 2 day gap). KEEP: `validate` as the shadow mode, an approval on every apply run, no change to the script.

## Design Notes

Proposed PRD text. 3.7 Matching, after "rejecting it records a dismissal": "**(Amended 2026-11-01; AD-45)** A moderator may also release an AI reviewer to accept a queued mid-score match, only when the pair passes fixed deterministic checks, within per-run and per-day limits; the merge is recorded as AI-assisted and can be undone like any merge within the undo window. The reviewer never rejects. A pair whose dates differ stays for a moderator unless it shares a registration link (then up to 90 days), and any pair the checks refuse stays for a moderator." 3.9.3 Moderator Tools, append: "**(Added 2026-11-01)** The merge journal records whether a moderator or the AI reviewer made each merge."

Preconditions AD-45 states, all repository settings the owner controls: a ruleset on `master` requiring a reviewed pull request, a CODEOWNERS file covering the workflows and the dedup code, `production` and `dedup-review-live` limited to `master`, no repository or organization secret named like the two database secrets, "prevent self-review" off while the owner is the only reviewer. The owner role is already in `production`, used by seven workflows without a reviewer; this workflow adds a copy behind a gate and does not reduce that exposure.

## Verification

**Commands:**
- `pnpm --filter backend exec tsx --test src/dedup-review-workflow.test.ts` -- expected: pass
- `pnpm lint && pnpm build` -- expected: no errors
- `uv run --python 3.11 --with pyyaml python3 -c "import yaml; yaml.safe_load(open('.github/workflows/dedup-review-apply.yml'))"` -- expected: no error
- `uv run --python 3.11 --with pyyaml scripts/backlog-check.py` -- expected: exits as on `master` (78)

**Manual checks (owner, after merge):**
- Create `dedup-review-live` (branch rule `master`, required reviewer), its secret and its variable `DEDUP_REVIEW_APPLY_DISABLED` set to `false`. This session cannot create environments, secrets or variables.
- Dispatch `validate` with `{"schemaVersion":1,"decisions":[]}` and your account's hash: a clean report or the one invoker refusal.
- Dispatch three `apply` runs in a row and watch the concurrency group (how a waiting run holds the slot).
- From a throwaway branch workflow that requests each environment, confirm the branch is refused. This session can run that check once the environments exist.
