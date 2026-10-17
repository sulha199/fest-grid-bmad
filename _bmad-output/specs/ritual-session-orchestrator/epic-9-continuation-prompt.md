# Epic 9 — orchestrator continuation prompt

Paste everything below the line into a **fresh** Claude Code cloud session on repo `sulha199/fest-grid-bmad`, branch `ccr-7467d77d-u04a85`.

---

Continue the Epic 9 ritual batch with the `ritual-orchestrator` skill (invoke it via the Skill tool first, then follow it). Work on branch `ccr-7467d77d-u04a85` only; commit and push there (`git push -u origin ccr-7467d77d-u04a85`). Do NOT open a pull request. Do NOT call `EnterWorktree`. Read `CLAUDE.md`, `_bmad-output/project-context.md` and the PRD (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`) as the repo requires.

## What Epic 9 is

"Boolean, nested and richer date AI event filters" (feature epic, `epics.md` → Epic 9; spec `_bmad-output/specs/spec-ai-prompt-event-filter/SPEC.md` CAP-6/CAP-7; plan `_bmad-output/planning-artifacts/ai-filter-boolean-nested-query-upgrade-plan.md`; readiness report `_bmad-output/planning-artifacts/epic-readiness/epic-9-readiness.md`, approved). Backlog rows: IDEA-069 (driving), FIND-083, BUG-060 (all `epic: epic-9`).

## State when this prompt was written (verify with `git log`, `scripts/sprint-status-tool.py get <key>`)

Done and verified, status `review` (pushed):
- 9-1a filter expression tree types / Zod / normalize / flat conversion
- 9-1b relative date grammar (span, multi-weekday `dayOfWeek`, `temporalFilter`)
- 9-2 compile filter expressions to query conditions (`not`, null-inclusive SQL)
- 9-3 expose expressions through GraphQL, resolvers, Widgets (backend + web codegen regenerated)

Still `backlog` (create-story then dev-story, in this order):
9.4 Gemini extraction v2 → 9.5 tree summary renderer (en + id) → 9.6 overlay / FilterHub long-summary UI → 9.7 golden-prompt evals → 9.8 rate-limit `resolvePromptToEventFilter` (Postgres counter) → 9.9z ratchet (+ PRD §3.15/§4.18 and `filter-vocabulary.md` amendment). Story dependencies are in `epics.md`; `resolve-targets.ts --epic 9` gives the order.

## Setup (same as before)

- Mailbox runner: `_bmad-output/specs/ritual-session-orchestrator/mailbox-runner/` (`node_modules` present). Mailbox dir: `../mailbox`. Preset: `--config all-claude-medium` (all Claude, medium effort). One story in flight at a time, sequential.
- Launch a child detached, then watch with `Monitor` (`timeout_ms` 1800000; when it expires, just re-arm the same watch — the child keeps running):
  - launch: `npx tsx src/launch-detached.ts --mailbox ../mailbox --label "<story>/<skill>" -- npx tsx src/dispatch-ritual.ts --skill <bmad-create-story|bmad-dev-story> --story <id> --mailbox ../mailbox --cwd /home/user/fest-grid-bmad --config all-claude-medium --prompt "<see below>"`
  - watch: `npx tsx src/watch-log.ts --mailbox <abs mailbox> --label "<story>/<skill>"`
- Relay child approval requests: read `mailbox/pending/<id>.json`, write `mailbox/answers/<id>.json` as `{"requestId":"<id>","approve":true,"answeredAt":"<ISO>"}`.
- Minimum human-in-the-loop policy (user's standing instruction): auto-approve routine in-repo child tool calls (reads, edits, per-package test/lint/build, codegen, local git add/commit on this branch, `scripts/sprint-status-tool.py`); auto-answer design questions with the recommended default; ASK THE USER before anything destructive or outward-facing (pushes by a child, deletes outside the repo, external network calls, any DB target that is not the local sandbox). Inspect each request before approving; the seed script has its own local-only guard.
- Never edit `backlog.yaml` from a child; tell children to skip the backlog-promotion intake step. The orchestrator attaches story keys to IDEA-069 / FIND-083 / BUG-060 itself at the end (IDEA-069 ← all Epic 9 stories; FIND-083 ← 9.1b, 9.3, 9.5; BUG-060 ← 9.8) and runs `uv run --python 3.11 --with pyyaml scripts/backlog-check.py`.

## Prompts that worked

create-story: `/bmad-create-story <id>` + "Epic 9 readiness sweep is done (planning-artifacts/epic-readiness/epic-9-readiness.md): skip Gate 1/3 and run Gate 2 only. Stories <done ones> are implemented (review) — build on them. Spec: …/SPEC.md. Minimise questions: choose the recommended default and record it in Dev Notes. Do NOT edit backlog.yaml… skip the backlog-promotion intake step. Do not push."

dev-story: `/bmad-dev-story <id>` + "Pre-Coding Approval Gate: the user's dispatch instruction for the whole Epic 9 batch (create-story and dev-story for every story, minimum human-in-the-loop) APPROVES this gate as the story is currently scoped (list the packages/files the story lists) — tick it with that provenance and proceed. If implementation would need anything beyond the story's own listed scope (new dependency, DB migration, files outside the listed packages/files, behaviour the story marks out of scope), STOP and report. Pick recommended defaults and note them in Dev Agent Record. Do NOT edit backlog.yaml. Run the per-package commands the story lists; do not repeatedly run repo-wide `pnpm test`. Commit locally; do not push."
(Without the gate sentence the dev-story child stops and asks for approval before coding.)

## Lessons learned — follow these

1. Dispatch dev-story with `dispatch-ritual.ts` directly, NOT `run-act-with-checks.ts`: its auto "fix" loop would try to repair environment test failures, and it runs the full repo suite even when the child stopped early. Run checks yourself.
2. A child's "final result" can be empty or say it is "waiting for a background job" — a finished session cannot be woken. ALWAYS verify: `git log`/`git status`, the story file's checkboxes and Status, `npx tsx src/verify-story.ts --story <id> --implementation-artifacts ../../../implementation-artifacts --expect-status <review|ready-for-dev>`, and re-run the story's per-package test/lint/build yourself (`pnpm --filter @festgrid/domain|@festgrid/graphql-select test|lint|build`, `pnpm --filter backend|web build`). Note: `@festgrid/backend` / `@festgrid/web` are NOT valid filters — use `backend` / `web`.
3. A session/worker restart kills children. Check `pgrep -af run-ritual`; clear any orphaned `mailbox/pending/*.json`; resume with `npx tsx src/run-ritual.ts --mailbox ../mailbox --label "<story>/<skill>" --resume-label "<story>/<skill>" --cwd /home/user/fest-grid-bmad --model claude-sonnet-5 --effort medium --prompt "…"` launched via `launch-detached.ts` with a different launch label (`…-resume`). Tell the resumed child to finish in the foreground and not to wait for notifications. A resumed child may lose its mutating-command permission channel (git add/commit fails with `AbortError: Stream closed`) — then commit yourself.
4. The repo's Stop hook demands a clean tree: after each child event run `git add -A && git commit -m "wip(<story>): …" && git push -u origin ccr-7467d77d-u04a85` (include the `Co-Authored-By` / `Claude-Session` trailer lines your system prompt specifies). WIP commits per story are fine.
5. Environment: the DB is a local sandbox; `pnpm seed` (repo script, refuses non-local targets) was run, so backend tests have seeded users. Known pre-existing test failures — do not chase them: backend `uses newestPostPublishedAt when the account has prior posts`, `falls back to env.scrapeInitialLookbackDays when the account has no posts`, `scraper lambda daily-batch branch: per-target incremental newerThan (FIND-035)`; infrastructure `FestgridBackendStack …` (9 CDK tests: sandbox npm registry TLS "self-signed certificate"). `ai-processor lambda manual-extraction branch (Story 4.2b)` failed before seeding and passes after. Judge new work against this list.
6. Board checker `scripts/backlog-check.py` was already failing (68 failures) before Epic 9; only make sure you add none.
7. Children sometimes re-run the whole repo test suite repeatedly — tell them not to; harmless but slow.

## Finish

After 9.9z: end-of-batch pass `pnpm lint`, `pnpm build`, `pnpm test` once (compare to the baseline in point 5); attach story keys in `backlog.yaml` as above; optionally `bmad-epic-readiness-review` and `bmad-code-review` per the user's wishes; push; report concisely per story (outcome, deviations such as `apps/web/fix-codegen.js` gaining a `FilterNodeInput` dedup, two `packages/domain` type widenings in 9.3, and `collectExactDates` NOT-fix) and what still needs human review. Do not create a PR unless asked.
