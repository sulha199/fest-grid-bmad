# AI-assisted dedup review: design record

Status: design agreed 2026-10-30 (bmad-quick-dev session, owner: shulha). Split into three pieces after an
architecture review and an adversarial code review of the first single-spec draft. This file is the shared
context for the specs. Piece A is built and merged (PR 119); B1, the read-only export, is built and verified on prod (`FIND-107`); B2a (the `resolved_via` flag)
is merged; B2b-1, the apply engine, is built (`FIND-108`); B2b-2, the workflow and paper trail (`FIND-112`), and C, the
skill (`FIND-104`), are deferred.

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
- Merges are recorded under the **moderator who invoked the skill** (decision 2026-10-31, replacing the earlier
  dedicated moderator user and the `DEDUP_REVIEW_MODERATOR_EMAIL` variable). The skill reads the Claude account email
  from its session context and passes its SHA-256 (lowercased, trimmed) as a workflow input, never the address: the
  repo is public and workflow inputs show in run pages and logs. Apply compares it with `sha256(lower(users.email))`
  in SQL, requires an active `role = 'moderator'` user, and stops if there is none. This is transparency, not
  authentication: anyone who can dispatch the workflow can supply any hash, so the real guards stay the
  `dedup-review` environment (`master` only), the deterministic floor and the caps. `users.id` is the Supabase auth
  id (`user-provisioning.ts`), so never insert a user with a random id.
  Known limits and rules for B2b (from the B2a review): the hash of an email is unsalted and low-entropy, so it hides
  the address from a casual reader of the log but not from someone who already guesses it; the match trims in SQL
  (`lower(btrim(users.email))`) and refuses unless **exactly one** active moderator matches; the Claude account email
  may differ from the app's Google login, so `validate` mode must run the same match and report "no moderator for this
  invoker" before any `apply` is attempted; anyone who can dispatch can attribute AI merges to any moderator, which
  the audit trail cannot tell from the real one except by `performed_via`.
- Whether a decision was a person's or the AI's is a flag, not an identity: `event_match_candidates.resolved_via`
  and `event_merges.performed_via` (`moderator` | `ai_skill`), written only by the shared resolve path (B2a). Caps
  count `ai_skill` rows. The export's `recentlyResolved` reads the same flag.
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
| **B1** | Evidence contract and hash in `packages/domain`, the read-only export script and workflow, docs (`FIND-107`) | Dark: a human dispatches the export and reads the JSON. **Built 2026-10-31.** | A |
| **B2a** | `resolved_via` / `performed_via` flag (merged, PR 131) | Behaviour-preserving; marks every resolution as a person's or the AI's | B1 |
| **B2b-1** | Decision judge, floor and caps in `packages/domain`; apply script (`FIND-108`). **Built 2026-10-31.** | Dark: code and tests, nothing can run it | B2a |
| **B2b-2** | `dedup-review-apply` workflow, write secret, kill-switch variable, new AD, PRD amendment, runbook (`FIND-112`) | Dark: a human dispatches it, `validate` before `apply` | B2b-1 |
| **C** | `moderator-dedup-review` skill (`SKILL.md`), labels, `dedup-insight` issue, shadow-mode acceptance | The daily skill | B on `master` |
| C2 (later) | `review-insights` mode | Reads closed, labelled issues | weeks of C data |

B was split into B1 and B2 on 2026-10-31 so the read-only half could be run against prod first. C must follow B2's
merge (the skill dispatches both workflows, which must exist on `master`).

## 5. Requirements carried into B (from both reviews)

1. **Contract in `packages/domain/src/events/`**: decision validator, cap, evidence hash, with 100% tests (project-context
   Testing Rules). Only DB glue stays in `apps/backend`. AJV is a backend dependency; hand-validate in domain or keep
   the AJV schema in backend. Decisions contain ACCEPT entries only (`{suggestionId, evidenceHash, reasons[]}`);
   escalations never reach apply. `additionalProperties: false`, uuid format, unique suggestion ids, `maxItems`,
   `maxLength` on text. The LLM's field is `reasons` (not `signals`, which is export evidence).
2. **Evidence hash, not `updatedAt`**: nothing writes `events.updatedAt` on enrichment or merge (`timestamps` is
   `defaultNow()` only). Hash the canonical evidence the LLM saw: names, location, links, detail level, `deletedAt`,
   `mergedIntoEventId`, each schedule's date/time/location, suggestion status, `undoneMergeCount`. Recompute at apply.
   *As built in B1:* the hash is `hashDedupReviewEvidence` (`apps/backend/src/lib/events/dedup-review-export.ts`, SHA-256
   of the canonical string from `packages/domain`); B2 imports that function instead of copying it. The evidence holds
   every field the reviewer sees; `deletedAt` and `mergedIntoEventId` are not in it because a pair with either set is
   dropped as stale before export, so they are constant for every exported pair, and B2 must re-check them itself when it
   re-reads the pair. Under `REPEATABLE READ` the export hashes one consistent snapshot.
3. **Deterministic floor at apply** (apply recomputes `evaluateBacklogRow`). *Open design question for B's spec:* the
   floor must be weaker than the tier thresholds (otherwise the LLM adds nothing) yet bound the blast radius.
   Candidate: at least one hard anchor (same account, shared link, or venue match) AND a schedule date inside the
   existing ±90-day window AND not already a high-tier pair (the drain script owns that case). Threshold values must
   be read from the domain constants, not copied.
   *As built in B2b-1 (2026-10-31, after an architecture and code review of the spec):* tier `mid`; no earlier undo; anchor `organizerMatch`
   or a shared link plus a venue match (not `sameAccount`); no venue conflict; day gap 0, or up to 90 with a shared link; every
   schedule of the new event covered inside that window; names do not contradict (`namesContradict`). The 0.3 name floor of
   the first draft was dropped: it equals the ingestion admission floor, so it rejected nothing. Live runs are `READ COMMITTED`
   with row locks and a savepoint per decision, not `REPEATABLE READ` (a long snapshot hides rows other writers add to a loser).
4. **Starvation**: export drops `kind: 'stale'` rows before applying its limit, takes a `skip_ids` input fed from open
   `dedup-escalate` issues, and emits `totalPending` and `skippedCount`.
5. **Undo loop**: `undoEventMerge` returns a suggestion to `pending` with `resolvedAt` null. Export carries
   `undoneMergeCount` per suggestion (from `event_merges.undone_at`); apply refuses ACCEPT when above 0 (reason
   `previously-undone`).
6. **Dry-run fidelity**: one outer transaction for the whole run with a savepoint per decision, rolled back at the end
   unless `--apply`. Reject two decisions touching the same event, or process sequentially. Dry-run output sets
   `dryRun: true` and omits `mergeId`.
7. **Caps**: per-dispatch cap (10) plus a per-24h cap counted from `event_merges.performed_via = 'ai_skill'` rows **including undone ones** (the journal keeps the flag after an undo; counting only live merges would let a re-merge after an undo bypass the cap) plus `ai_skill` rejections on `event_match_candidates` (a reject writes no journal row, and undo clears the suggestion's flag); a kill-switch
   variable that makes apply exit without writing.
8. **Workflows**: export sets `DATABASE_URL` and `BACKEND_PORT: '4001'` (`env.ts` requires it); the workflow writes the
   decisions input to `$RUNNER_TEMP/decisions.json`; a `run_tag` input is echoed in `run-name` and the log so the
   skill can find its run (dispatch returns no run id); decisions input is at most 65,535 chars.
9. **Credentials** (decided with the owner 2026-10-31). Export (B1, built): the secret `DEDUP_REVIEW_READONLY_DATABASE_URL`
   in the `dedup-review` environment, holding the URL of a read-only role that **bypasses RLS** (every table it reads has
   RLS, so a plain read-only role sees no rows): `backup_ro` is expected to work and `readonly_2` is expected not to since
   migration 0084; neither is verified, and the first manual run settles it. The script also runs in a `READ ONLY`
   transaction. Apply (B2): the **owner's suggestion is to reuse the DB user the migration job uses**, which is
   `secrets.DATABASE_URL` in the `production` environment (the table owner, bypasses RLS, can also run DDL). It is
   acceptable for v1 because the protections sit elsewhere: the dedicated `dedup-review` environment limited to `master`,
   ACCEPT-only decisions, the per-run and per-day caps and the kill switch. It means copying that secret into the
   `dedup-review` environment (or accepting the `production` environment's protection rules). A narrow role stays the
   better long-term option and costs a role, grants on about nine tables, `BYPASSRLS` and a secret. B2 also gets two modes:
   `validate` (default; runs every check on the read-only secret and runs no merge) and `apply` (the write secret), so
   shadow mode never touches the write credential.
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

Verified 2026-10-31 (first run of the export): the cloud session can dispatch a workflow from `master` and read its
job log, and a `run_tag` in `run-name` is enough to find the run (dispatch returns no run id, so the tag is how a
caller finds its run); the `dedup-review` environment let a `master` run start; the secret was present. That run
failed with SQLSTATE 42883 (`similarity()` not resolvable for the role). After the search-path fix (PR 128) the
re-run (tag `verify-trgm-1`) succeeded: 134 pending, 30 pairs exported, no email and no URL query string in the
output, `scanLimited` false. The role therefore bypasses RLS and resolves `pg_trgm`.

Findings from that run: the one log line is about 98k characters for 30 pairs, so `get_job_logs` with
`return_content` spills to a file the session must slice (the skill must read it from the saved file, not inline);
all 200 `recentlyResolved` rows were system expiries, so the cap hides human decisions (a follow-up should leave
`expired` rows out or count them separately).

Still not verified: whether `readonly_2` can run the evidence path after RLS (expected not to); the size of a
50-pair export; the pending count against the moderator page (compare by eye).
