# Graph Topology & State Machines

Companion to [SPEC.md](SPEC.md). Diagrams and node-transition detail live here per Spec Law (diagrams never belong in the kernel).

## Real artifact paths (resolved the same way BMad itself resolves them)

Generalized to any BMad-managed target project — never hardcoded to festgrid specifically. Resolved from the target project's own **`_bmad/bmm/config.yaml`** (not `_bmad/core/config.yaml` — confirmed against the real `bmad-epic-readiness-check` skill's own Step 3: `core/config.yaml` only has `project_name`/`user_name`/`communication_language`/`document_output_language`/`output_folder`; `planning_artifacts` and `implementation_artifacts` live in `bmm/config.yaml`) and `_bmad-output/project-context.md` at run start:

- `planning_artifacts` = `<TARGET_REPO_PATH>/_bmad-output/planning-artifacts` (from `bmm/config.yaml`)
- `implementation_artifacts` = `<TARGET_REPO_PATH>/_bmad-output/implementation-artifacts` (from `bmm/config.yaml`)
- `epics_file` = `{planning_artifacts}/epics.md`
- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`
- `readiness_dir` = `{planning_artifacts}/epic-readiness`
- `readiness_report` = `{readiness_dir}/epic-{N}-readiness.md` — real shape: `{ epic: number, swept: boolean, date: string, addenda: { date: string, trigger: string, stories_corrected: string[] }[], stories_covered: string[], findings: string }`. A `CorrectCourse`-forced re-sweep **appends** a new `addenda` entry (preserving prior `date`/`stories_covered`/findings) — it never wholesale-overwrites the report; matches the real convention this repo already uses for a correction to an already-swept epic.
- story files = `{implementation_artifacts}/<epic>-<story>-<slug>.md`
- PRD / architecture reference = resolved from `project-context.md`'s "Reference Documents" section (festgrid's own convention), falling back to scanning `planning_artifacts` for `*architecture-spine.md` or `specs/*/SPEC.md` if that section is absent

**Story-key formats are two different, non-interchangeable things** (a real fidelity gap found on review — the two files do not share one key format):
- `epics.md` section keys are **dotted** (e.g. `0.7a`, from `### Story 0.7a: ...`).
- `sprint_status`/story-filename keys are **dash-slugs** (e.g. `0-7a-nav-item-primitive`) — **not** a mechanical transform of the story title (the real title "Build the NavRailItem primitive and its interaction hook" shortens to `nav-item-primitive`, a judgment call, not a deterministic derivation).
- To **locate an existing** story, prefix-match the dotted key's dash-equivalent against real filenames/`sprint_status` keys (`0.7a` → any key/filename starting `0-7a-`) — this prefix IS deterministic.
- To **create a new** story (Planner materializing a story file, CAP-1 Phase B), Planner itself chooses the descriptive slug suffix using the same judgment `bmad-create-story` applies (an LLM call, not a string transform); that choice becomes the durable key from then on.

## GraphState (fixed contract — see SPEC.md Constraints)

```
GraphState {
  spec: string                 // path to the target project's PRD (resolved above) — top of the real BMad document hierarchy this run decomposes from
  tasks_queue: Epic[]          // a FRESH in-memory parse of epics.md + sprint-status.yaml + any already-materialized story files for the epic in play — re-read as needed, never itself durable
  current_code: string | null  // the story's cumulative diff so far (grows across AUTO_FIX rounds, not just the latest patch); Tier-2 reviews this field verbatim, never re-derives via ExecPort
  terminal_output: string | null
  error_status: "ok" | "auto_fixed" | "needs_human" | null
  human_feedback: string | null
}
```

`Epic`/`Story` shapes mirror what's parsed from the real files plus a small amount of ephemeral, SQLite-only run-state that has no real-file counterpart (`autoFixAttempts`) — see State & Write Ownership below.

## Node topology

```mermaid
stateDiagram-v2
    [*] --> DirtyTreeCheck: run start
    DirtyTreeCheck --> [*]: git status --porcelain is non-empty — REFUSE to start, ask user to commit/stash
    DirtyTreeCheck --> EpicReadinessCheck: clean tree, no readiness_report yet, or swept=false (mandatory)
    DirtyTreeCheck --> Planner: clean tree, readiness_report already swept=true (sweep skipped by default)
    EpicReadinessCheck --> Planner: prerequisite stories inserted into epics.md/sprint-status.yaml directly by this node; then Planner decomposes/dispatches
    Planner --> PhaseAConfirm: epic has no epics.md entry yet — draft coarse breakdown, pause for HITL confirmation before writing
    PhaseAConfirm --> Planner: human confirms — breakdown committed to epics.md
    Planner --> ForeignWorkSkip: next story already in-progress/review/done in sprint-status.yaml with no SQLite record from this run
    ForeignWorkSkip --> Planner: left untouched, advance to next backlog/ready-for-dev story
    Planner --> SpeedWorker: story tagged standard (story file materialized first, Gate 2 checked)
    Planner --> ComplexWorker: story tagged complex (story file materialized first, Gate 2 checked)
    SpeedWorker --> Tester
    ComplexWorker --> Tester
    Tester --> ComplexWorker: Tier-1 review pass (verdict)
    ComplexWorker --> Tester: Tier-1 verdict = AUTO_FIX (ComplexWorker applies its own patch, same call)
    ComplexWorker --> DeepCodeReview: Tier-1 verdict = APPROVE
    DeepCodeReview --> GitCheckpoint: Tier-2 verdict = APPROVE (both tiers now APPROVE)
    DeepCodeReview --> Tester: Tier-2 verdict = AUTO_FIX (DeepCodeReview applies its own patch, same call)
    DeepCodeReview --> HITL: Tier-2 verdict = NEEDS_HUMAN (downgrade)
    GitCheckpoint --> Planner: commit created (code + story file + sprint-status.yaml), story marked done, next story
    ComplexWorker --> HITL: Tier-1 verdict = NEEDS_HUMAN
    Tester --> HITL: blocking/unclassifiable failure
    HITL --> HITLTimeout: no terminal response within HITL_TIMEOUT_MS
    HITLTimeout --> HITL: send escalation email, keep waiting
    HITL --> Planner: human_feedback resolves (unflagged), resume
    HITL --> CorrectCourse: human_feedback flagged correct-course:
    CorrectCourse --> EpicReadinessCheck: forced re-sweep of remaining stories, seeded with the flagged feedback (ignores swept)
    CorrectCourse --> HITL: re-sweep's own Gate 1 finds an out-of-epic-scope (PRD/architecture) gap — second pause, recommends real bmad-correct-course/bmad-prd/bmad-architecture
    Planner --> [*]: epic complete, sprint-status.yaml shows every story done
```

`AUTO_FIX` is **not a separate graph node** — it is a verdict value. Whichever node decides it (Tier-1 `ComplexWorker` or Tier-2 `DeepCodeReview`) applies its own patch within that same node invocation, then the graph transitions straight to `Tester`. No cross-node handoff of "what to fix" through `GraphState` is needed — the node that found the issue already holds full context on it and fixes it itself, in the same call.

## Dirty-tree pre-flight gate

Resolves what was previously an open question. `AD-4`'s `git add -A` safety depends on the working tree containing only the orchestrator's own in-flight changes at commit time — nothing enforced that before this fix. At run start, before anything else, the orchestrator runs `git status --porcelain` against `TARGET_REPO_PATH`. Any pre-existing uncommitted or untracked change **refuses the run** (hard error, not a warning) with a message asking the user to commit or stash first. This matters most exactly when `TARGET_REPO_PATH` is a live repo a human actively works in (explicitly permitted, SPEC.md Constraints) — without this gate, an unrelated in-progress human edit would be silently folded into the next story's "done" commit.

## Foreign-work policy

Not hypothetical: a real target project's `sprint_status` can already have stories at `in-progress`/`review`/`done` produced entirely by human/real-`bmad-*`-skill work, with zero orchestrator involvement and thus no SQLite checkpoint entry. When Planner is choosing the next story to dispatch: if a story is already at anything other than `backlog`/`ready-for-dev` **and** the current run's SQLite checkpoint has no record of it, the orchestrator treats it as **foreign work it did not produce** — it is left untouched and skipped, advancing to the next `backlog`/`ready-for-dev` story in the epic. It is never silently resumed, re-reviewed, or reprocessed. Adopting such a story into an orchestrator run requires an explicit opt-in (a CLI flag naming that specific story), not a default behavior. This also means: on a project with an existing human-driven review backlog, `dev an epic <name>` does not halt at HITL for every pre-existing story — it works around foreign work, not into it.

## CAP-1 Phase A confirmation gate

`epics.md` is itself a planning document, and the real `bmad-create-epics-and-stories` skill it mirrors is explicitly interactive (every menu is a "WAIT FOR INPUT" step). So when Planner needs to generate a brand-new coarse decomposition for an epic that has no `epics.md` entry at all (CAP-1 Phase A), it does not write that decomposition autonomously: it drafts the breakdown, then pauses at a HITL confirmation (reusing the same `HITLPort`/HITL node as CAP-7, framed as "review this proposed epic breakdown before it's committed") before the draft is written to `epics.md`. This is narrower than `AD-10` (which only forbids writes *to* the PRD/architecture files themselves) but addresses the same underlying concern — an autonomous write to a planning document a human hasn't reviewed — for the one case AD-10 doesn't already cover.

## Accepted gap: `sprint_status` can't distinguish review sub-state

`review` covers three different real situations — Tier-1 reviewing, Tier-2 reviewing, and mid-AUTO_FIX after a Tier-2 downgrade sends the story back through `Tester` — with no way to tell which from the status value alone. This is accepted rather than worked around: BMad's real five-value status enum has no tier concept, and inventing a sixth value would violate the "real enum only" rule (SPEC.md Constraints, `AD-5`). A precise view of where a story actually is requires cross-referencing the audit log, not `sprint_status` alone.

## State & Write Ownership (real artifacts)

Ownership is scoped per file and per which real BMad skill would perform that exact write — not a single blanket writer. Since the graph executes nodes sequentially per story/epic (never two nodes concurrently mutating the same file), this ownership is enforced by turn order:

| Artifact / transition | Sole writer | Matches real skill |
| --- | --- | --- |
| `readiness_report`, prerequisite-story insertion into `epics.md`/`sprint-status.yaml` | `EpicReadinessCheckNode` | `bmad-epic-readiness-check` |
| `epics.md` initial epic decomposition (if missing) | `Planner` | `bmad-create-epics-and-stories` |
| Story file materialization (full ACs/tasks/dev notes) + `sprint-status.yaml` `backlog → ready-for-dev` | `Planner` | `bmad-create-story` |
| Story's own task checkboxes; `sprint-status.yaml` `ready-for-dev → in-progress` | `SpeedWorker` / `ComplexWorker` (whichever is dispatched) | `bmad-dev-story` |
| Review findings appended to the story file; `sprint-status.yaml` `in-progress → review` | `ComplexWorker` (Tier-1) and `DeepCodeReview` (Tier-2) | `bmad-code-review` |
| Code commit + `sprint-status.yaml` `review → done` | `GitCheckpoint` | (checkpoint policy, CAP-11) |

`Epic.readinessReport`'s `swept` field is what makes a later CAP-12 sweep on that epic optional (skipped by default). `CorrectCourse` always forces a fresh sweep regardless.

**`sprint-status.yaml` status discipline:** only the real enum values are ever written (`backlog`/`ready-for-dev`/`in-progress`/`review`/`done` for stories; `backlog`/`in-progress`/`done` for epics). A HITL pause is never represented as a status value — it exists only in the SQLite checkpoint (ephemeral run-state: `autoFixAttempts`, which story was mid-flight) and the audit log, so the file's schema never diverges from what other BMad tooling or a human expects.

## Reviewer verdict rubric — two tiers, one enum

Fixed three-value verdict — no free-form outcomes (SPEC.md Constraints). Both tiers below produce the same `ReviewVerdict`; Tier-2 only ever runs on a Tier-1 `APPROVE` and can downgrade it.

**Tier 1 — lightweight Reviewer (Complex Worker/Reviewer node, every implementation attempt):**

- **APPROVE** — implementation matches the story file's acceptance criteria and the architecture reference, no architectural deviation, tests pass.
- **AUTO_FIX** — a fixable issue exists (lint, minor type error, small alignment gap) that a worker node can resolve without human judgment; applies its own patch, routes back through Tester.
- **NEEDS_HUMAN** — triggers HITL when any of:
  - the implementation deviates from the architecture reference in a way that changes a design decision,
  - the story's acceptance criteria are ambiguous or internally conflicting,
  - the change touches a security-sensitive surface (auth, secrets, data access boundaries),
  - AUTO_FIX attempts on the same story have reached `MAX_AUTO_FIX_ATTEMPTS` (default 1) — forces NEEDS_HUMAN regardless of what the failure itself looks like. The counter increments on **every applied AUTO_FIX patch**, tier-agnostic, whether or not the following Tester run passes — not only on a post-patch Tester failure. **This is the single authoritative rule** for the counter, superseding any narrower "only on Tester failure" phrasing elsewhere. Accepted tradeoff: because the budget is shared across both tiers, a single successful Tier-1 fix can consume the entire default budget before Tier-2 ever gets its own turn — intentional, fail-fast by default; raise `MAX_AUTO_FIX_ATTEMPTS` if that's too aggressive for a given project.

**Tier 2 — Deep Code Review (CAP-13, only on a Tier-1 `APPROVE`, gates `GitCheckpoint`, matches real `bmad-code-review`):**

Three parallel lenses against the finished diff — correctness, edge-case coverage, acceptance-criteria coverage — aggregated into one verdict, findings appended to the story file's review section:

- **APPROVE** — all three lenses clear; proceeds to `GitCheckpoint`.
- **AUTO_FIX** — a lens finds a fixable gap; `DeepCodeReviewNode` applies its own patch in the same call, then the graph transitions to `Tester`. **Consumes the same `MAX_AUTO_FIX_ATTEMPTS` budget** as Tier-1 (no second, independent retry ceiling).
- **NEEDS_HUMAN** — a lens finds something outside the fixable set (same triggers as Tier-1) or the shared attempt budget is already exhausted; routes to HITL.

## Epic Readiness Check (CAP-12) — matches `bmad-epic-readiness-check` exactly

Runs once per epic, before Planner dispatches that epic's first story:

- **Gate 1 (Architecture/Infrastructure Completeness):** does any story, or the epic's pipeline as a whole, bypass a mandated adapter, call an external service directly, introduce an API surface with no backing layer, or depend on infra with no IaC/deploy story?
- **Gate 3 (Foundational/Cross-cutting Dependency Completeness):** does this epic depend on shared tooling/infrastructure with no owning story anywhere in `epics.md` — checked both within this epic and for reuse across other epics in the same file?

Reads `project-context.md`, the architecture reference, and infra docs the same way the real skill does. New prerequisite stories get full sections written into `epics.md` at the correct position (never blind-appended) and `backlog` entries into `sprint-status.yaml`, positionally matching.

**Mandatory vs. optional:** mandatory the first time an epic is touched (`readiness_report` absent, or its `swept` field is `false`). Once `swept: true`, a later `dev an epic <name>` invocation treats the sweep as optional — skipped by default, forced with `--recheck-readiness`.

**Crash safety:** `EpicReadinessCheckNode` is a single atomic graph node performing both gates internally (not split across two nodes/edges) — a crash mid-sweep leaves no checkpoint update at all, so `readiness_report` stays fully absent, not partially written; the absence check stays clean.

Gate 2 (UI Complexity & Reusability) is **not** run here — it's per-story and belongs to Planner's story-materialization step (CAP-1 Phase B), matching how `bmad-create-story` scopes it in real BMad.

## Correct-Course Escalation (CAP-14)

A HITL resolution can be flagged rather than a plain unblock: the human's free-form response starts with `correct-course:` (case-insensitive, whitespace-trimmed match — `response.trim().toLowerCase().startsWith('correct-course:')`, e.g. `Correct-course: switch the Speed Worker's model alias...` still matches). The HITL node inspects the response text for that prefix after `HITLPort.prompt()` resolves:

- **Unflagged** — resumes at Planner exactly as before; only the current story is affected.
- **Flagged** — routes to `CorrectCourse`, which **forces** a fresh `EpicReadinessCheck` against the epic's remaining not-yet-approved stories, seeded with the human's stated change, ignoring `swept`. The re-swept prerequisites/re-scoping go through the same ownership rules as a first-time sweep, then the loop resumes.
- **Out-of-scope finding** — if that forced re-sweep's own Gate 1 determines the real fix needs an architecture or PRD change (not just prerequisite stories), it does **not** edit those documents itself: the readiness report notes the finding and the run halts at a **second** HITL pause recommending the user run the real `bmad-correct-course`, `bmad-prd`, or `bmad-architecture` skill manually.

Correct-course reuses CAP-12's machinery entirely rather than being a separate implementation.

## HITL escalation sequence

1. Graph reaches a HITL node (NEEDS_HUMAN verdict, blocking Tester failure, or an out-of-scope readiness finding) and prints a **short, one-line summary** via `readline` — not a full context dump.
2. The user can type an expand command (e.g. `show diff` / `show output`) to print the full diff, reviewer reasoning, or Tester output on demand before answering, or respond directly with free-form feedback.
3. A `setTimeout` for `HITL_TIMEOUT_MS` (default 300000ms) starts in parallel with the terminal `readline` wait.
4. If the terminal responds first: timeout is cleared, `human_feedback` is populated. The HITL node checks the response for a `correct-course:` prefix — flagged responses route to `CorrectCourse`, unflagged responses resume directly at Planner.
5. If the timeout fires first: exactly one notification email is sent via Resend to `HITL_NOTIFY_EMAIL`, describing the pending decision; the terminal prompt remains open and still accepts input afterward (no re-timeout — single escalation, not a repeating alarm).

## Entry points

- **`dev an epic <name>`** — the dirty-tree gate runs first and refuses to start on an unclean `TARGET_REPO_PATH`. `EpicReadinessCheck` then runs if `readiness_report` is absent or `swept: false` (skipped by default otherwise). Planner materializes/locates stories in `epics.md` (pausing for a HITL confirmation if this is the epic's first-ever decomposition, CAP-1 Phase A), skips any story that's foreign work (see Foreign-work policy), and drives Speed/Complex Worker → Tester → Tier-1 Reviewer → (APPROVE → Tier-2 Deep Code Review → GitCheckpoint → next story | AUTO_FIX loop | HITL pause) across every remaining story in the epic until the epic is complete or halted at HITL.
- **manual epic/story review** — user points the Reviewer node at an already-implemented epic/story set. For each story: an APPROVE verdict still passes through Tier-2 Deep Code Review before being recorded `done` (GitCheckpoint only fires if that story didn't already have one); an AUTO_FIX verdict (from either tier) has that tier's own node apply the recommended patch and re-run Tester; a NEEDS_HUMAN verdict still triggers HITL. No separate `dev an epic` invocation is needed to apply the resulting patches.

## Git checkpoint policy

- Depends on the dirty-tree pre-flight gate having already refused a dirty starting tree — `git add -A` is only safe because the working tree contains nothing but the orchestrator's own changes from run start onward.
- One commit per completed story, created immediately after that story clears **both** review tiers — not after every node/state transition, so intermediate AUTO_FIX iterations (from either tier) don't pollute history.
- The commit includes the story's code changes, its updated story file (task checkboxes, review findings), and its `sprint-status.yaml` entry (flipped to `done`) together.
- Commit message references the story/epic key (e.g. `1.3a`) so history stays traceable back to `epics.md`.
- The orchestrator only ever runs local `git commit` — it must never `git push`, force-push, or touch remotes automatically (SPEC.md Constraints).
- Manual-review patches (see Entry points) get their own checkpoint commit the same way, whether or not the story already had one from an earlier dev-an-epic run.
