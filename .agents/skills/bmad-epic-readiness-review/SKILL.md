---
name: bmad-epic-readiness-review
description: 'Post-implementation epic-level review — the counterpart to bmad-epic-readiness-check. Runs after all of an epic''s stories are done, reconciling the epic readiness report''s prerequisites against actual completion, collecting any per-story escape-hatch findings, and running one final Gate 1 pass against the as-built code (not just planned ACs). Use when the user says "review epic N readiness", "close out epic N", or before running a retrospective on a completed epic.'
---

# Epic Readiness Review

**Goal:** Verify an epic is objectively, architecturally closed after implementation — not just that its story files exist and are marked `done`. This is the automated counterpart to `bmad-retrospective`'s Step 10 "Critical Readiness Exploration," which asks the user how the codebase feels; this skill checks instead of asking.

**Your Role:** Post-hoc architecture auditor, not a facilitator. You are not re-litigating team process or lessons learned (that's `bmad-retrospective`'s job) — you are answering one question: does the as-built epic still satisfy the architecture, and is every gap this epic surfaced actually closed or explicitly, knowingly still open?

**Relationship to other skills:**
- `bmad-epic-readiness-check` runs BEFORE any story in the epic is created, against planned ACs.
- `bmad-create-story` runs per-story, citing that report, with a lightweight non-subagent guard for anything novel.
- This skill runs AFTER all stories are `done`, against the actual as-built code, and reconciles everything the first two produced.
- `bmad-retrospective` should run after this skill (or use its report) so its readiness discussion has objective evidence instead of pure self-report.

## Conventions

Same as `bmad-epic-readiness-check`: bare paths resolve from `{planning_artifacts}` unless noted; `{project-root}`-prefixed paths resolve from the project root.

## On Activation

### Step 1: Resolve the Workflow Block

Run: `python3 {project-root}/_bmad/scripts/resolve_customization.py --skill {skill-root} --key workflow`

Fallback (if the script fails): read `customize.toml` → `_bmad/custom/bmad-epic-readiness-review.toml` → `_bmad/custom/bmad-epic-readiness-review.user.toml` in that order, same merge rules as other skills in this project (scalars override, arrays append).

### Step 2: Load Persistent Facts and Config

Load `workflow.persistent_facts` the same way as `bmad-create-story`. Load `{project-root}/_bmad/bmm/config.yaml` for `project_name`, `user_name`, `communication_language`, `planning_artifacts`, `implementation_artifacts`.

## Paths

- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`
- `epics_file` = `{planning_artifacts}/epics.md`
- `readiness_report` = `{planning_artifacts}/epic-readiness/epic-{{epic_num}}-readiness.md`
- `review_report` = `{planning_artifacts}/epic-readiness/epic-{{epic_num}}-review.md`

## Execution

<workflow>

<step n="1" goal="Determine target epic and verify completion">
  <action>If the user provided an epic number, use it. Otherwise ask which epic to review.</action>
  <action>Load {{sprint_status}}. Find all story keys for this epic (pattern "{{epic_num}}-N-..." and lettered variants like "{{epic_num}}-Na-..."), excluding the epic key and retrospective key.</action>
  <action>Count total stories vs. stories with status "done".</action>
  <check if="not all stories are done">
    <output>Epic {{epic_num}} has {{pending_count}} stories not yet done: {{pending_story_list}}. This review is only meaningful once implementation is complete.</output>
    <ask>Continue with a partial review anyway? [y/n]</ask>
    <check if="user says no">
      <action>HALT</action>
    </check>
  </check>
</step>

<step n="2" goal="Load the epic readiness report and all story files">
  <action>Load {{readiness_report}} if it exists. If it does not exist, note this explicitly — the review can still run, but there is no pre-hoc baseline to reconcile against, so flag this as a finding itself (the epic was never swept before story creation).</action>
  <action>Load every story file for this epic from {implementation_artifacts} (all "{{epic_num}}-N-*.md" and lettered variants).</action>
  <action>From each story file, extract:
    - The "File List" under Dev Agent Record (the as-built file paths).
    - Any "Architecture & UX Gate Findings" section, specifically looking for language indicating the per-story lightweight guard fired (i.e. the story ran a fresh Gate 1/3 despite a swept report because something looked novel to it).
    - The "Out of Scope" section's deferred prerequisite story keys, if any.
    - The Pre-Coding Approval Gate checklist state (was it fully resolved, or shipped with an explicitly accepted gap?).
  </action>
</step>

<step n="3" goal="Reconcile prerequisite completion">
  <action>For every prerequisite story key listed in {{readiness_report}} (or surfaced by individual stories' Out of Scope sections if no epic-wide report exists), check its current status in {{sprint_status}}.</action>
  <action>Classify each as: ✅ Done, ⏳ In Progress/Ready-for-dev (not yet actually built), or ❌ Still Backlog (never started).</action>
  <action>For any prerequisite that is NOT done, check whether any story in this epic explicitly accepted that gap (an "accepted by the user" note in its Pre-Coding Approval Gate or Dev Notes). If accepted, record as a known, deliberate gap. If NOT accepted anywhere, this is a real finding — the epic shipped depending on unbuilt infrastructure.</action>
</step>

<step n="4" goal="Collect escape-hatch findings and unresolved Out-of-Scope items">
  <action>Compile every "Architecture & UX Gate Findings" note across the epic's stories where the lightweight guard fired a fresh Gate 1/3 check (from Step 2). For each, note whether its finding was itself resolved (a prerequisite created and completed) or is still open.</action>
  <action>Compile every distinct deferred item across all stories' "Out of Scope" sections that references a prerequisite story key not covered by {{readiness_report}} — these are gaps discovered mid-epic, after the initial sweep, that need the same reconciliation as Step 3.</action>
</step>

<step n="5" goal="Run one final epic-wide Gate 1 pass against the as-built code">
  <critical>This is the check nothing else in the workflow performs. bmad-epic-readiness-check and bmad-create-story only ever evaluate planned ACs — this step evaluates what was actually shipped.</critical>
  <action>Use `runSubagent` with persona Winston (`bmad-agent-architect`).</action>
  <action>Provide: the full list of File Lists collected in Step 2 across all of the epic's stories, the architecture spine, `docs/infrastructure/index.md` (plus relevant shards), and project-context.md.</action>
  <action>Ask Winston to actually read the as-built files (not just trust the story files' descriptions) and verify: does the epic's implemented code still respect the architecture — correct layer boundaries, correct queue/adapter usage, no direct external-service calls bypassing a mandated adapter, no database access from layers that shouldn't have it? Report any drift between what stories claimed and what the code actually does.</action>
</step>

<step n="6" goal="Epic-wide Gate 2 duplication check">
  <action>Compare the File Lists across all of the epic's stories for signs that a reusable component/hook/util was quietly duplicated in more than one place instead of being split into its own story by Gate 2 during per-story creation (Gate 2 only ever saw one story's draft at a time and could not see this).</action>
  <action>If duplication is found, note it as a finding (not a blocker) — recommend a follow-up consolidation story if warranted.</action>
</step>

<step n="7" goal="Write the epic review report and report completion">
  <action>Write {{review_report}} with: prerequisite reconciliation table (Step 3), escape-hatch/unresolved Out-of-Scope findings (Step 4), Gate 1 as-built findings (Step 5), Gate 2 duplication findings (Step 6), and an overall verdict: CLOSED (everything resolved or explicitly accepted) or OPEN (unresolved gaps exist, listed explicitly).</action>
  <output>**Epic {{epic_num}} Readiness Review Complete — Verdict: {{verdict}}**

    Prerequisites: {{done_count}} done, {{pending_count}} pending, {{accepted_gap_count}} explicitly accepted gaps.
    As-built Gate 1: {{gate_1_summary}}
    Gate 2 duplication check: {{gate_2_summary}}

    Report: {{review_report}}

    **Recommended next step:** Run `bmad-retrospective` for Epic {{epic_num}} — this report's findings should ground its Step 10 readiness discussion instead of relying on self-report alone.
  </output>
</step>

</workflow>
