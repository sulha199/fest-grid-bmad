---
name: bmad-form-epics
description: 'Clusters open backlog rows that share one mechanism into an epic — a mechanism story, adoption stories, and a ratchet — per epic-formation-gate.md, so the shared thing is built once instead of re-solved row by row. Covers piled-up bugs and findings (improvement epics) and two or more features needing the same mechanism (feature epics), including reopening a row skipped on price. Also runs that method''s stability test. Use when the user says "form epics from the backlog", "cluster the backlog into epics", "run epic formation", "these two features need the same thing", or "run the formation stability test".'
---

# Form Epics From The Backlog

**Goal:** Turn open `backlog.yaml` rows that share one mechanism into an epic, following
`epic-formation-gate.md` — an improvement epic from bugs and findings, or a feature epic
from ideas and proposals (§2). That document is the method; this skill is its execution order,
its delegation to the runner, and its human checkpoint. It adds no rules of its own.

**Why this exists:** `bmad-quick-dev` fixes one row with no gates. `bmad-create-story` runs
Gates 1/2/3 but sees one story. Neither can observe that N rows need the *same* missing
mechanism, so the mechanism never gets built and each row re-solves it locally.
`bmad-epic-readiness-check` is the cross-story form of Gates 1 and 3 — but it needs an epic
to already exist. This skill is what creates one from the board; everything downstream is
unchanged.

**Your Role:** Cluster proposer and scribe. You do not decide that a cluster is real — you
propose it with its invariant sentence and the user attacks that sentence (Step 4). You do
not invent criteria, thresholds, or numbering: every rule comes from the gate document.

## Conventions

- Bare paths (e.g. `epic-formation-gate.md`) resolve from `{planning_artifacts}`.
- `{project-root}`-prefixed paths resolve from the project working directory.
- `runner` = `uv run --python 3.11 --with pyyaml {project-root}/scripts/backlog-check.py`

<critical>
Never restate the gate document's rules in your output, your reasoning, or any file you
write. Cite them (`§5 criterion 2`, `§9.2`) and read them from the source. A second copy of
the criteria is a second thing to drift, which is the exact failure the board exists to
prevent. If the doc and your memory of it disagree, the doc is right.
</critical>

<critical>
Anything the runner computes, the runner computes. Do not re-derive checks, collision
groups, candidate axes, or lens rankings by reading YAML yourself — a subtly wrong
reimplementation reports "clean" on a broken board, per `backlog-spec.md` §9.
</critical>

## Paths

- `board` = `{implementation_artifacts}/backlog.yaml`
- `board_spec` = `{implementation_artifacts}/backlog-spec.md`
- `gate` = `{planning_artifacts}/epic-formation-gate.md`
- `sprint_status` = `{implementation_artifacts}/sprint-status.yaml`
- `epics_file` = `{planning_artifacts}/epics.md`
- `report` = `{planning_artifacts}/epic-formation/formation-{{date}}.md`

## Execution

<workflow>

<step n="0" goal="Pick the intent">
  <action>If the user asked for the stability test, ablation, or "is this generic", jump to Step 9. Otherwise run a formation pass, Steps 1-8.</action>
  <action>Load `{{gate}}` in full and `{{board_spec}}` §§3, 5, 9, 11. These are the rules for everything below.</action>
</step>

<step n="1" goal="Freeze the input">
  <action>Run `{{runner}}`. Record the date, the open-row count, the unstarted-story count, and that checks 1-13 are clean. §5's input set spans BOTH files, so the freeze must name both.</action>
  <check if="any check fails">
    <output>The board is not clean: {{failures}}. Formation reads the board as evidence, so a failing check means the evidence is wrong.</output>
    <ask>Fix the failures first, or proceed anyway? [fix/proceed]</ask>
    <check if="user says fix"><action>HALT</action></check>
  </check>
  <critical>Check 13 failures are not defects — they are re-pricing judgments that have come due (`{{gate}}` §9.1). Surface them here: an `effort` that is about to change is an input to clustering, so resolve them with the user before proposing anything.</critical>
</step>

<step n="2" goal="Generate candidates">
  <action>Run `{{runner}} --cluster` for the four mechanical axes, the cost-skipped list, and the unstarted stories §5 includes in the input set.</action>
  <action>Then run the fifth axis yourself — the reading pass over each open row's title and note, asking *"what would the fix actually be?"* This is the axis the runner cannot compute and the only one strong enough to decide a boundary. Read `{{board}}` rows and, where a row's `ref` points at one, the tier-1 note or `deferred-work.md` section it cites.</action>
  <critical>The unstarted stories get the SAME reading pass, against their story files, and no mechanical axis reaches them — a story carries no `touches`, no `parent`, no DW citation. Read each one's ACs and ask whether it and some open row are two framings of one problem. Watch specifically for **rival designs**: a row and a story proposing different mechanisms for the same outcome each look reasonable alone, and building either strands the other. That is the case this input set exists to catch.</critical>
  <critical>A `touches` tag is a candidate generator, never an epic boundary (`{{gate}}` §5). The runner already marks the broad tags as too broad to be candidates; do not resurrect them.</critical>
</step>

<step n="3" goal="Apply the criteria">
  <action>For each candidate, write the invariant sentence FIRST — present tense, positive form — then test membership against it. A cluster you can only describe as a list has already failed §5 criterion 2.</action>
  <action>Apply all five criteria from `{{gate}}` §5. Any failure means it is not an epic.</action>
  <action>For each rejected candidate, record the criterion it failed and the routing it gets instead (§4: a sweep story under the owning epic, or per-row `bmad-quick-dev`). A rejection without a recorded reason gets re-proposed and re-litigated next session.</action>
  <action>When an unstarted story lands in a cluster, decide its fate explicitly per §5: it keeps its key and becomes an adoption story under the new epic, OR goes `wont-do` with a note naming the sibling that supersedes it. Never renumber it, and never leave the absorption unrecorded — a story that silently changes epics is the drift the board exists to prevent.</action>
  <action>Determine what KIND of epic each accepted cluster is, per §2. A cluster of `bug`/`finding` rows is an improvement epic (`epic-N-iK`) — determine its owning N: the epic that owns the MECHANISM, not the one with the most symptoms; 0 when the mechanism is cross-cutting. A cluster of `idea`/`proposal` rows is a FEATURE epic taking the next integer, where `z` is optional, criterion 3 is read strictly in criterion 4's place, and the spec route is `bmad-prd` first rather than §6 amendment.</action>
</step>

<step n="4" goal="Human checkpoint — the user attacks the invariant">
  <critical>Do not write any file before this step completes. Formation is a proposal; the judgment is the user's.</critical>
  <output>Present, per accepted epic: the invariant sentence, the proposed key (`epic-N-iK`), member row ids, the draft story list (`a` / `b`…`y` / `z`), and the §6 spec-reconciliation routing per row. Then the rejected candidates with their failing criterion, then the rows left unclustered.

  Ask the user to attack each invariant sentence directly: if they cannot restate it as "so anything that does X is a bug" without adding a caveat, the sentence is wrong.</output>
  <ask>Which of these hold? Reword, merge, split, or drop any of them.</ask>
  <action>Apply their corrections. Re-run §5's criteria against any cluster they changed — a reworded invariant can change membership.</action>
</step>

<step n="5" goal="Draft each accepted epic">
  <action>Assign story letters per `{{gate}}` §3. `a` is the mechanism; `b`…`y` are adoption, one per call site or surface; `z` is the ratchet.</action>
  <action>Write `z`'s acceptance criteria NOW, before any other story's — they are what "done" means for the epic (§3). The ratchet must be executable per §4; if you cannot name a lint rule, a test, or a check on an existing runner, the cluster failed §5 criterion 4 and goes back to Step 3. For a feature epic `z` is optional (§2) — propose one anyway when the epic's whole justification is the shared mechanism, since it is what stops the second feature forking the first one's helper.</action>
  <action>Record the §6 routing per member row: a PRD amendment task carried in `z`, a `bmad-correct-course` referral, a new `AD-n` written in `a`, or nothing for internal-only rows.</action>
</step>

<step n="6" goal="Re-scoring sweep">
  <action>Per `{{gate}}` §9.1, read the rest of the board — rows outside every accepted epic, plus the cost-skipped rows the runner listed — and flag each row whose `effort` would drop if one of these mechanisms existed.</action>
  <action>A flagged row that violates the SAME invariant JOINS that epic as an adoption story, and IS re-scored now: its `a` story is a committed prerequisite inside the same epic, so the estimate is conditional on the same unit of work, not on a promise (§9.1). Record the post-mechanism effort in the formation report, not only in the field.</action>
  <action>A flagged row that merely becomes cheap and stays OUTSIDE the epic gains `reprice_on: <epic key>` and keeps its current `effort` — nothing binds it to a mechanism that may never be built (§9.1).</action>
  <action>For a `cost:`-skipped row whose price this mechanism falsifies, reopen it to `backlog` and APPEND to its note; never rewrite the original reason. A `value:`-skipped row is untouched no matter how cheap it becomes (§9.2). When a skip's note reads as a value-for-price judgment, apply §9.2's test — *would you do it if it were free?* — rather than the words the note happens to use.</action>
  <critical>Re-scoring a joining row is what makes criterion 5 answerable and what makes a reopen decision possible at all — you cannot judge value-for-price without the new price. But it is provisional: Step 8's `bmad-epic-readiness-check` is what validates `a` is buildable as one story. Say so in the report, and if that check later drops or reshapes `a`, every row re-scored here must be re-examined and a row reopened only for the promised price returns to `skipped`.</critical>
</step>

<step n="7" goal="Write the three files, one commit">
  <critical>`epics.md`, `sprint-status.yaml` and `backlog.yaml` move together. Splitting them is how a board row ends up describing an epic that was never written.</critical>
  <action>APPEND each epic to `{{epics_file}}` as `### Epic N.iK: ...` with the invariant sentence, its stories in full sections, and a `**Note:**` recording the formation date and member row ids. Never run `bmad-create-epics-and-stories` — its Step 1 overwrites the file wholesale.</action>
  <action>Register `epic-N-iK: backlog` plus every story key in `{{sprint_status}}`, inserted positionally, never overwriting existing entries.</action>
  <action>Stamp `epic: epic-N-iK` on each member row in `{{board}}`. Leave status at `triaged` — only stories move a row to `promoted` (§7 step 7).</action>
  <action>Write `{{report}}`: the frozen board date and row count, accepted epics, rejected candidates with failing criteria, unclustered rows, and every re-scoring decision from Step 6.</action>
  <action>Run `{{runner}}` and confirm clean before committing. Check 11 fires if any epic lacks its `z` story.</action>
</step>

<step n="8" goal="Report and hand off">
  <output>**Formation pass complete — {{date}}, {{n}} open rows read**

    Accepted: {{epic keys with invariant sentences}}
    Absorbed stories: {{unstarted story keys, and whether re-parented or superseded}}
    Rejected: {{candidate + failing criterion + routing}}
    Re-scored: {{rows reopened or given reprice_on}}
    Report: {{report}}

    **Next step:** `bmad-epic-readiness-check` on each new epic — Gate 1/3 across all its
    stories at once, which is where `a` is validated, replaced, or dropped. Then
    `bmad-create-story` per story in letter order.

    Sequencing across these epics is NOT decided here — it is a lens at read time
    (`{{runner}} --lens <name>`, `{{gate}}` §9.3).</output>
</step>

<step n="9" goal="Stability test (§10)">
  <action>Run a full formation pass over the whole open set, per Steps 1-3. Record accepted, rejected-with-criterion, and unclustered.</action>
  <action>Build at least two subsets: one dropping ~25% of rows at random, one dropping a single member from each accepted cluster.</action>
  <critical>Each ablation run MUST be blind. Spawn one subagent per subset via `runSubagent`, giving it ONLY that subset's rows and `{{gate}}`. Never include the full run's output, your reasoning about it, or the names of the clusters it produced. A run that can see the previous answer confirms it; it does not test it.</critical>
  <action>Compare on the intersection — rows present in both runs — using §10's difference table. Threshold effects and re-wordings are allowed; a row moving between invariants, an uncaused split or merge, or changed §6 routing is a failure.</action>
  <action>Measure membership, not prose. The same invariant worded differently across runs is variance, not instability.</action>
  <action>On failure, report which cluster flipped and state the diagnosis §10 gives: its invariant sentence is describing its members rather than stating a rule (§5 criterion 2). Do not resolve a flip by keeping whichever run reads better — the disagreement is the finding.</action>
  <output>Report accepted/rejected per run, the intersection comparison, and a verdict: stable, or the clusters whose invariants need rewriting before any formation pass is trusted.</output>
</step>

</workflow>
