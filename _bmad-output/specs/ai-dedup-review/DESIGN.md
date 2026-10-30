# AI-assisted dedup review: design record

Status: design agreed 2026-10-30 (bmad-quick-dev session, owner: shulha). Split into three pieces after an
architecture review and an adversarial code review of the first single-spec draft. This file is the shared
context for the three specs. Piece A has a spec; B and C are deferred (`FIND-107`, `FIND-104` on the backlog).

## 1. Goal

A repo skill, invoked daily from a Claude **cloud** session (no DB credentials), reviews the pending
`event_match_candidates` queue. It covers cases the deterministic dedup (`decideMatchTier`) leaves at mid but a
reader would call obvious: bilingual or abbreviated names, venue aliases, a registration-deadline post vs a
race-day post, small date drift. It auto-accepts only when very sure, escalates the rest as GitHub issues, and
records an insight per pair so the deterministic rules and the rubric can improve.

GitHub Actions is only the DB bridge (it already holds the DB secrets); the cloud session is the decider.

## 2. Decisions already made

- Decider is the cloud Claude session; Actions never runs an LLM (a later option: `claude-code-action`).
- v1 auto-**ACCEPT** only. Never auto-reject. Everything else is escalated.
- Shadow mode (apply as a dry run) is the default; `live` must be passed explicitly.
- Merges are recorded under a **dedicated moderator user** (the owner creates it; a `users` row with
  `role = moderator`). Its email is read from the repository variable `DEDUP_REVIEW_MODERATOR_EMAIL` (owner-chosen
  2026-10-30; the address is deliberately not written in this repo, which is public, and a workflow must never echo
  it), never hardcoded. Create the account by signing in to the app once with that Google account, then promote it
  (`UPDATE users SET role = 'moderator' WHERE email = ...`): `users.id` is the Supabase auth id
  (`user-provisioning.ts`), so a hand-inserted row with a random id would collide on that account's first sign-in
  (email is unique). Every `role = 'moderator'` user also receives the moderator alert emails
  (`getModeratorEmails`: dangerous reports, scraper audit, provider down), so that inbox gets them. This makes AI merges
  identifiable in `event_merges.performed_by_moderator_id`, lets apply count a per-24h cap, and keeps
  `outcome:accepted` labels free of AI decisions.
- Escalations are GitHub issues labelled `dedup-escalate`; status is open/closed. The LLM-written insight per pair
  feeds a rolling `dedup-insight` issue.
- The skill reads AD-30 Rules 7 and 9, AD-40, `docs/infrastructure/7-event-dedup.md` and `project-context.md`
  at run time and copies no thresholds.

## 3. Trust model (the repo is PUBLIC, verified 2026-10-30)

- Actions logs, job summaries and issues are world-readable. No usernames, no account ids, no emails. Emit an
  account-type enum and a same-account boolean instead. Names, locations and links go in code fences in issues,
  with no `@` mentions. `review-insights` trusts labels only, never comment text (anyone can comment).
- Event names, locations and links are untrusted text (prompt injection). The LLM must never widen what apply
  does: apply recomputes the evidence server-side and enforces a deterministic floor; the LLM only narrows.
- The skill dispatches workflows with `ref=master` only. The dedup secrets live in a dedicated GitHub
  environment (e.g. `dedup-review`) whose deployment branches are limited to `master`, so a pushed branch cannot
  run edited code against the secrets. (Environment settings were not verified; the owner configures them.)
- Print export and apply results as single-line `JSON.stringify` between markers; never inside a code fence in
  `$GITHUB_STEP_SUMMARY`.

## 4. The three pieces

| Piece | Scope | Ships | Depends on |
|---|---|---|---|
| **A** | Extract `resolveSuggestedMatch`, row lock, characterization tests, ratchet | Behaviour-preserving change to the live moderator mutation; fixes a latent race | none |
| **B** | Domain contract, export, apply, two workflows, environment and moderator user, floor and caps, new AD, PRD amendment, docs | Dark: a human runs the workflows by dispatch, dry run first | A |
| **C** | `SKILL.md`, labels, `dedup-insight` issue, shadow-mode acceptance | The daily skill | B on `master` |
| C2 (later) | `review-insights` mode | Reads closed, labelled issues | weeks of C data |

A+B may share a PR if wanted; C must follow B's merge (the skill dispatches B's workflows, which must exist on
`master`).

## 5. Requirements carried into B (from both reviews)

1. **Contract in `packages/domain/src/events/`**: decision validator, cap, evidence hash, with 100% tests (project-context
   Testing Rules). Only DB glue stays in `apps/backend`. AJV is a backend dependency; hand-validate in domain or keep
   the AJV schema in backend. Decisions contain ACCEPT entries only (`{suggestionId, evidenceHash, reasons[]}`);
   escalations never reach apply. `additionalProperties: false`, uuid format, unique suggestion ids, `maxItems`,
   `maxLength` on text. The LLM's field is `reasons` (not `signals`, which is export evidence).
2. **Evidence hash, not `updatedAt`**: nothing writes `events.updatedAt` on enrichment or merge (`timestamps` is
   `defaultNow()` only). Hash the canonical evidence the LLM saw: names, location, links, detail level, `deletedAt`,
   `mergedIntoEventId`, each schedule's date/time/location, suggestion status, `undoneMergeCount`. Recompute at apply.
3. **Deterministic floor at apply** (apply recomputes `evaluateBacklogRow`). *Open design question for B's spec:* the
   floor must be weaker than the tier thresholds (otherwise the LLM adds nothing) yet bound the blast radius.
   Candidate: at least one hard anchor (same account, shared link, or venue match) AND a schedule date inside the
   existing ±90-day window AND not already a high-tier pair (the drain script owns that case). Threshold values must
   be read from the domain constants, not copied.
4. **Starvation**: export drops `kind: 'stale'` rows before applying its limit, takes a `skip_ids` input fed from open
   `dedup-escalate` issues, and emits `totalPending` and `skippedCount`.
5. **Undo loop**: `undoEventMerge` returns a suggestion to `pending` with `resolvedAt` null. Export carries
   `undoneMergeCount` per suggestion (from `event_merges.undone_at`); apply refuses ACCEPT when above 0 (reason
   `previously-undone`).
6. **Dry-run fidelity**: one outer transaction for the whole run with a savepoint per decision, rolled back at the end
   unless `--apply`. Reject two decisions touching the same event, or process sequentially. Dry-run output sets
   `dryRun: true` and omits `mergeId`.
7. **Caps**: per-dispatch cap (10) plus a per-24h cap counted from the dedicated moderator's merges; a kill-switch
   variable that makes apply exit without writing.
8. **Workflows**: export sets `DATABASE_URL` and `BACKEND_PORT: '4001'` (`env.ts` requires it); the workflow writes the
   decisions input to `$RUNNER_TEMP/decisions.json`; a `run_tag` input is echoed in `run-name` and the log so the
   skill can find its run (dispatch returns no run id); decisions input is at most 65,535 chars.
9. **Credentials**: apply uses the write `DATABASE_URL` (say so in the AD; "no new credential" forbids a least-privilege
   apply role, a recorded trade-off). Export: try `PROD_READONLY_DATABASE_URL` (`readonly_2`; doc 7 says it runs
   `--evaluate-only`, but migration 0084 enabled RLS and doc `3-database.md` says `readonly_2` cannot read RLS tables)
   before falling back to `PROD_BACKUP_DATABASE_URL` (`backup_ro`: BYPASSRLS, broader than needed). Verify
   `similarity()` works under the chosen role with a manual dry export. **Unresolved with the owner.**
10. **Docs and decisions**: a NEW AD (next free number after AD-44) for the credential-less-agent-through-CI-bridge
    pattern, with a one-line cross-reference in AD-30 Rule 9; a PRD amendment (the PRD says a moderator approves mid
    pairs; add the PRD to the spec's context); `docs/infrastructure/3-database.md` (second consumer of the read role);
    a runbook (rollback via `undoEventMerge` with the `mergeId` list, how to flip live mode, how to disable);
    `architecture-diagram.md` and `high-level-overview.md` ("GitHub Actions" subgraph).
11. **Ratchet extension**: the apply script must contain a call `resolveSuggestedMatch(` (an unused import does not
    count), plus a raw-SQL pattern for `UPDATE event_match_candidates` and an aliased-import check.
12. Evidence must flag a pair already at high tier; add a test that the evidence tier equals `decideMatchTier`'s
    output. `evaluateBacklogRow` omits the tagged-handle leg (documented in its comment); note that in the rubric.
    Evidence also needs fields it does not return today: location, links, schedules, categories, detail level,
    account type, source-post count.

## 6. Requirements carried into C

- `SKILL.md`: dispatch export (`ref=master`, `run_tag`), read logs, read the rubric docs, decide per pair,
  dispatch apply (dry run in shadow), open escalation issues, close issues for `recentlyResolved`, append a run
  summary to the rolling `dedup-insight` issue, report to the user.
- Escalation issue: the **suggestion id in the title** (dedupe by `in:title`, not by label or body text); create the
  issue and its labels in one call so a partial failure cannot leave a label-less duplicate.
- Labels: `dedup-escalate`; one `pattern:<tag>` from a fixed set (`name-language`, `venue-alias`,
  `deadline-vs-race-day`, `date-drift`, `link-only`, `other`); `outcome:accepted` or `outcome:rejected` once
  resolved (only from a human moderator's decision); `dedup-learned` only after the owner confirms a change was made.
- The `dedup-insight` issue carries a "last run" stamp, backlog count and oldest pending age (monitoring when the
  daily session stops). Never list dry-run `mergeId`s as undo ids.
- Acceptance is manual: one shadow run after B is on `master` (confirms dispatch, log reading, labels, summary).
  The skill stops with a clear message if dispatch or log reading is denied. `live` only after shadow runs are
  reviewed by the owner.
- C2 `review-insights`: group issues by pattern with outcome counts and propose one fix class per group
  (deterministic rule, rubric edit, or export field); never edits code or ADs or opens PRs. Replay the closed
  issues' pairs through `evaluateBacklogRow`/`decideMatchTier` before proposing a rule change, and keep them as a
  regression corpus (precedent: the golden-prompt eval). Suggested trigger: five unlearned issues with one pattern.
  `bmad-form-epics` is the natural intake.

## 7. Facts verified while reviewing

- Before Piece A, only `merge-events.ts` (accept flip :248, undo :344) and the resolver's REJECT wrote
  `event_match_candidates.status`; ingestion only inserts (`process-ingestion-job.ts:133`, `onConflictDoNothing`).
  Piece A moved the REJECT into `resolve-suggested-match.ts`. Master's IDEA-107 added a third writer,
  `lib/events/expire-match-suggestions.ts` (sets `expired`, guarded by `status = 'pending'`), allowed by the ratchet.
- `DbExecutor` (`set-event-primary-post.ts:23`) has no `transaction`, so a shared function must run inside a
  caller-owned transaction.
- `db/client.ts` uses `max: 1`, so two concurrent transactions cannot run through it; the race tests hold the row
  from a second, separate connection.
- A moderator's REJECT between the resolver's pending check and the merge is overwritten today (no pending guard).
- The backend suite runs a row-count ratchet; new DB tests must clean up what they create.

## 8. Not verified

Whether the cloud session's token can dispatch workflows and read job logs (listing works); GitHub environment
branch rules and required reviewers; whether `readonly_2` can run the evidence path after RLS; whether dispatch
returns a run id in the current API; `get_job_logs` truncation on large logs.
