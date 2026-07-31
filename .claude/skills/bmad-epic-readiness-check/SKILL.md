---
name: bmad-epic-readiness-check
description: 'Runs a one-time epic-level architecture and foundational-dependency sweep (Gate 1 + Gate 3 from story-split-gate.md) across all of an epic''s stories before any are created individually, producing consolidated prerequisite stories and an epic readiness report. Use when the user says "run epic readiness check", "check epic N readiness", or before creating the first story of a new epic.'
---

# Epic Readiness Check

**Goal:** Run Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness) from `story-split-gate.md` ONCE against an entire epic's story list, instead of once per individual story. `bmad-create-story` pays these two gates' cost on every story it creates unless this report exists and is marked swept — see its Step 3.5.

**Why this exists:** Gate 1 and Gate 3 findings are typically epic-wide (an adapter/queue/schema gap affects most stories in a pipeline epic), not story-specific. Running them per-story re-derives the same conclusion repeatedly at full subagent cost. Gate 2 (UI Complexity & Reusability) stays out of this sweep — it is genuinely story-specific and remains per-story in `bmad-create-story`.

**Your Role:** Epic-level architecture auditor. You are not writing any individual story's Acceptance Criteria or Tasks — that remains `bmad-create-story`'s job. Your output is: a consolidated findings report, any new prerequisite stories written into `epics.md` (with full sections, not bare backlog keys), and the corresponding `sprint-status.yaml` entries.

## Conventions

- Bare paths (e.g. `story-split-gate.md`) resolve from `{planning_artifacts}` unless otherwise noted.
- `{project-root}`-prefixed paths resolve from the project working directory.

## On Activation

### Step 1: Resolve the Workflow Block

Run: `python3 {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow`

If the script fails, resolve `customize.toml` → `_bmad/custom/bmad-epic-readiness-check.toml` → `_bmad/custom/bmad-epic-readiness-check.user.toml` yourself, in that order, using the same merge rules as `bmad-create-story` (scalars override, arrays append).

### Step 2: Load Persistent Facts

Load every `workflow.persistent_facts` entry as foundational context, same semantics as `bmad-create-story` (entries prefixed `file:` are paths to load; others are facts verbatim).

### Step 3: Load Config

Load `{project-root}/_bmad/bmm/config.yaml` and resolve `project_name`, `user_name`, `communication_language`, `planning_artifacts`, `implementation_artifacts`.

## Paths

- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`
- `epics_file` = `{planning_artifacts}/epics.md`
- `readiness_dir` = `{planning_artifacts}/epic-readiness`
- `readiness_report` = `{readiness_dir}/epic-{{epic_num}}-readiness.md`

## Execution

<workflow>

<step n="1" goal="Determine target epic">
  <action>If the user provided an epic number, use it. Otherwise ask: "Which epic should I run the readiness sweep for?"</action>
  <action>Set {{epic_num}}.</action>
  <check if="{{readiness_report}} already exists and its `swept` field is true">
    <output>Epic {{epic_num}} already has a readiness report ({{readiness_report}}, swept on its recorded date). Re-running will overwrite it.</output>
    <ask>Re-run anyway? [y/n]</ask>
    <check if="user says no">
      <action>HALT</action>
    </check>
  </check>
</step>

<step n="2" goal="Load the full epic scope">
  <action>Load {{epics_file}} in full.</action>
  <action>Extract every story under "### Epic {{epic_num}}: ..." up to (not including) the next "### Epic" header — this is the FULL set of story ACs for the epic, not just one story.</action>
  <action>Also extract the epic's declared "FRs covered" line.</action>
  <action>Load {implementation_artifacts}/sprint-status.yaml to know which of the epic's stories already exist as story files (for context on what's already built vs. still backlog).</action>
  <action>Load `_bmad-output/project-context.md`, the architecture spine, and `docs/infrastructure/index.md` (reading specific shards under `docs/infrastructure/` if the epic's scope plausibly touches backend/queues/infra — same judgment `bmad-create-story` applies).</action>
  <action>Scan `epics.md` for OTHER epics' stories that reference the same external services, tables, or infra this epic's stories reference (needed for Gate 3's cross-epic reuse check — e.g. Epic 3 and Epic 4 both calling Gemini).</action>
</step>

<step n="3" goal="Run Gate 1 and Gate 3 once, epic-wide, in a single subagent pass">
  <critical>These gates evaluate the WHOLE epic's story list as one unit, not story-by-story. This is what makes the sweep cheaper than N individual runs — the subagent reasons about shared dependencies directly instead of each story rediscovering them.</critical>

  <action>Use ONE `runSubagent` call with persona Winston (`bmad-agent-architect`) to evaluate Gate 1 and Gate 3 together against the same evidence. They share the same owning persona and the same input (the epic's full story ACs) — splitting them into two separate subagent calls only pays context-loading overhead twice for no reasoning benefit.
    Provide ALL of the epic's story ACs together, plus the cross-epic references gathered in Step 2.
    Ask Winston to evaluate both gates and report findings as two clearly labeled sections in a single response:
    - **Gate 1 — Architecture / Infrastructure Completeness (epic-wide):** per `story-split-gate.md`'s Gate 1 heuristics, does any story (or the epic's pipeline as a whole) bypass the backend/API layer, call external services directly instead of through a mandated adapter, introduce API surfaces with no backing layer, or depend on infra with no IaC/deploy story? Report findings once, not per story — if the same gap affects multiple stories, say so explicitly rather than repeating it.
    - **Gate 3 — Foundational / Cross-Cutting Dependency Completeness (epic-wide + cross-epic):** per `story-split-gate.md`'s Gate 3 heuristics, does this epic depend on shared tooling/infrastructure (i18n, analytics, GraphQL scaffold, a named reusable utility, an external-service adapter, a shared data table) that has no owning story anywhere in `epics.md`, and that other epics also need or would need? Explicitly check for reuse across epics, not just within this one.
  </action>

  <note>Gate 2 (UI Complexity & Reusability) is intentionally NOT run here — it stays per-story in `bmad-create-story`, since UI scope varies story to story and this sweep would either skip it shallowly or blow up in scope trying to evaluate every story's UI at once.</note>
</step>

<step n="4" goal="Apply the numbering rule to each finding">
  <critical>Every finding must map to exactly one of these three placements. Never renumber an existing story — only append (Epic 0) or insert a new lettered story (everywhere else).</critical>

  <action>For each gap found, classify it:
    - **Tooling/infrastructure gap** (an adapter, IaC, a GraphQL/codegen scaffold, an i18n/analytics/testing/validation foundation — "how do we build things," reusable across features by nature) → new Epic 0 story. Number it sequentially after Epic 0's current highest story number (check `epics.md`). Write a full `### Story 0.N: ...` section (As a/I want/So that + Acceptance Criteria) and a `**Note:**` line explaining which gate and which epic's sweep surfaced it, mirroring the style of existing Stories 0.6-0.8.
    - **Shared data-ownership gap** (a table/entity conceptually originated by this epic but read by others, following the precedent of Story 1.1 scoping `events`/`schedules` to Epic 1 rather than Epic 0) → lettered suffix within THIS epic (e.g. `{{epic_num}}.Na`), positioned immediately before the first story in this epic that needs to write it. Full section + `**Note:**` explaining the gate and the cross-epic reuse evidence.
    - **Single-story architecture/UI split** (a layer or component needed by exactly one story in this epic, not reused elsewhere) → lettered suffix directly off that one story (e.g. `{{epic_num}}.Na` immediately before/after, matching the `1.3a`/`1.3b`/`1.6a` pattern). Full section + `**Note:**`.
  </action>
  <action>If a finding is a correction to an EXISTING story's AC (not a new story — e.g. a story's scope needs narrowing), note the correction but do not create a new story number for it; that correction gets applied when that story is actually created via `bmad-create-story` (or apply it directly to `epics.md` now if the fix is unambiguous and epic-wide, e.g. removing a bypassed layer from an AC).</action>
</step>

<step n="5" goal="Write the new stories into epics.md and sprint-status.yaml">
  <action>For each new story determined in Step 4, insert its full section into `epics.md` at the correct position (do not append everything at the end — Epic 0 insertions go after Epic 0's last existing story; epic-scoped lettered insertions go immediately adjacent to their anchor story).</action>
  <action>Append a corresponding `backlog` entry to `{{sprint_status}}` — insert positionally to match `epics.md` (e.g. a `{{epic_num}}.Na` key goes immediately before/after its anchor story's key), never overwrite existing entries.</action>
  <action>Do NOT change the status of any already-created story as part of this sweep — this step only adds new backlog stories, it does not create or mark any story ready-for-dev.</action>
</step>

<step n="6" goal="Write the epic readiness report">
  <action>Create or overwrite {{readiness_report}} with:
    - Frontmatter: `epic: {{epic_num}}`, `swept: true`, `date` (current date), `stories_covered` (list of story IDs evaluated).
    - Gate 1 findings (or "No gap found").
    - Gate 3 findings (or "No gap found").
    - List of new prerequisite story keys created, with their epics.md section and their numbering-rule classification (tooling / shared-data / single-story-split).
    - Any AC corrections applied directly to existing stories in `epics.md`.
  </action>
</step>

<step n="7" goal="Report completion">
  <output>**Epic {{epic_num}} Readiness Sweep Complete**

    Gate 1: {{gate_1_summary}}
    Gate 3: {{gate_3_summary}}

    New prerequisite stories added: {{list of new story keys}}

    Report: {{readiness_report}}

    **Next step:** Create Epic {{epic_num}}'s stories one at a time via `bmad-create-story`, in `epics.md` order. Each will skip Gate 1/Gate 3 (citing this report) and only run Gate 2.
  </output>
</step>

</workflow>
