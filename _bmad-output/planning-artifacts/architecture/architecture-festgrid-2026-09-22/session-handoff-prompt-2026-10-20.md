# Prompt for the new session (paste as the first message)

The new session has to be able to reach `sulha199/fest-grid-bmad` (the Claude GitHub App installed for the
other account, or the repo attached to the session). It cannot see this session's transcript, so the repo
carries the state in `session-handoff-2026-10-20.md`, in the same folder.

```
You are taking over a long-running BMad Method planning session for FestGrid / FestDaily (personalized
Discovery: event groups, event identity, the place model). The previous session ran on another account and
you cannot see its conversation. Everything that matters is in the repo.

SETUP
1. Repo: sulha199/fest-grid-bmad. If it is not in your session, attach it. Then:
   git fetch origin claude/ecstatic-shannon-e8eh9h
   If your session's designated branch is that one, `git pull origin claude/ecstatic-shannon-e8eh9h`.
   If your harness gave you a different branch, create it from that one and push only to yours:
   git checkout -B <your-branch> origin/claude/ecstatic-shannon-e8eh9h
   Tell me the branch name you ended up on.
2. Read, in this order, before touching anything:
   CLAUDE.md
   _bmad-output/project-context.md
   _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md
   _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/session-handoff-2026-10-20.md
   the newest 40 entries of _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/.memlog.md
   _bmad-output/planning-artifacts/festgrid-architecture-spine.md (AD-14, AD-30, AD-36 to AD-41; skim the rest)
   _bmad-output/planning-artifacts/architecture/architecture-festgrid-2026-09-22/reviews/triage.md

WHAT TO DO
3. Reply with at most 12 lines: where the work stands, what is ADOPTED versus PROPOSED, and your single next
   action. Then carry on with handoff section 5 (analyse the landed Round 3 results, calibrate the pin-trust
   floor, amend the spine, log it in the memlog). Do not wait for me unless a decision is mine to make.
4. After that, in order: PRD update (skill bmad-prd, intent Update), UX (bmad-ux), epics (bmad-form-epics),
   bmad-check-implementation-readiness. Stop and ask before starting each one.

RULES
- Planning isolation: write under _bmad-output/ only (plus docs/infrastructure when CLAUDE.md section 4 asks,
  and the POC scripts under apps/backend/scripts/poc-event-insight/). Never edit apps/ or packages/ source.
- No pull requests unless I ask. Push only to your designated branch. Use your own session's commit trailers.
- Do not redo the Reviewer Gate or re-open ADOPTED decisions. PROPOSED items wait for my yes or no.
- Label every decision [ADOPTED, user-directed], [PROPOSED] or [ASSUMPTION]. Log decisions in the memlog with
  _bmad/scripts/memlog.py (append only; another session shares that file).
- Numbering: next AD is AD-42; next backlog ids are BUG-072, IDEA-092, FIND-093.
- Never print a token, cookie, JWT or env value. Production SQL is run by me or by my local session, not you.
- Coaching mode: logic first, UI and UX after. Answer direct questions directly before anything else.
- Before each commit run the spine lint and the backlog checker (commands are in handoff section 7).
```
