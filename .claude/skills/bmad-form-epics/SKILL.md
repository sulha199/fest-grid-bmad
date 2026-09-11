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

## Model

Per `{{gate}}` §12, split by **failure visibility**: a step whose errors reach the Step 4
checkpoint is safe on whatever model is driving; a step whose errors are silent is not.

- Steps 1, 3, 5, 7, 8 run on the driving model. Step 3 included — a weak invariant sentence
  is exactly what Step 4 exists to catch.
- **Step 2's reading pass and Step 6's re-scoring sweep** are the silent-failure steps: you
  cannot attack a cluster that was never proposed, and a row never flagged is never
  re-priced. When driving on a cheaper model, spawn each as its own subagent with
  `model: opus` and hand back the findings. When already driving on the strong model, run
  them inline.
- This is a prudent default, not a measurement. §11's model-fitness experiment is what
  settles it; if a cheaper model comes back stable there, drop the split.

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
  <action>Evaluate EVERY mechanical group the runner prints, including ones you expect to fail criterion 1. Record the row count you used to dismiss each. A group skimmed and skipped without a recorded count is indistinguishable later from a group that was read and rejected.</action>

  <action>Now run the SECOND generation pass — the feature axis (`{{gate}}` §5). This is a separate sweep, not a re-reading of the groups above. Read every open `idea`/`proposal` row against the PRD's capabilities and `EXPERIENCE.md`'s journeys, and ask of each: which capability does this fill a gap in, and does another row fill a gap in the same one? Rows that share an answer are a candidate.</action>
  <critical>Do NOT generate feature candidates from `touches`, `parent`, or a shared repair shape. Every one of those is a proxy for implementation proximity, and a journey is not an implementation property — two rows can serve one capability with disjoint `touches`, no common parent, and no shared fix. A pass on 2026-09-11 produced three feature candidates and all three arrived via a tag or a `parent` chain, because those were the only generators it had; disjoint `touches` is not evidence against a feature cluster.</critical>
  <action>Record the candidate count from each pass separately, and carry both into the Step 4 output. Zero feature candidates from a real sweep is a finding about the board; zero because no sweep ran is a finding about the method.</action>
</step>

<step n="3" goal="Apply the criteria">
  <action>For each candidate, decide its axis first (§2: a defect class or a user-facing capability), then write §5 criterion 2's sentence for THAT axis — the invariant, or the capability from the user's side — before deciding membership. A cluster you can only describe as a list has already failed criterion 2 either way.</action>
  <action>Apply all five criteria from `{{gate}}` §5, using the form of criteria 2 and 3 that matches the axis. Any failure means it is not an epic.</action>
  <critical>NEVER apply the mechanism form of criterion 3 to a feature cluster (`{{gate}}` §2). That error measurably suppressed user-visible work in the 2026-09-08 pass — 30% of `user-visible` rows clustered against 64% of `internal`. Two features can share no mechanism at all and still be one journey.</critical>
  <action>For each rejected candidate, record the criterion it failed and the routing it gets instead (§4: a sweep story under the owning epic, or per-row `bmad-quick-dev`). A rejection without a recorded reason gets re-proposed and re-litigated next session.</action>
  <action>When an unstarted story lands in a cluster, decide its fate explicitly per §5: it keeps its key and becomes an adoption story under the new epic, OR goes `wont-do` with a note naming the sibling that supersedes it. Never renumber it, and never leave the absorption unrecorded — a story that silently changes epics is the drift the board exists to prevent.</action>
  <action>Determine what KIND of epic each accepted cluster is, per §2 — this decides WHICH FORM of criteria 2 and 3 you just applied, so if you picked the wrong kind, go back and re-apply §5 in the right column.
    - **Improvement epic** (`epic-N-iK`), driven by `bug`/`finding` rows: criterion 2 is the invariant form, criterion 3 the mechanism form, criterion 4 mandatory. Owning N is the epic that owns the MECHANISM, not the one with the most symptoms; 0 when it is cross-cutting.
    - **Feature epic** (next integer), driven by `idea`/`proposal` rows: criterion 2 is the capability form, criterion 3 the JOURNEY form, `z` optional, spec route `bmad-prd` first.
    Kind is set by the driving rows, not by unanimity — a member of another type does not flip it (§2).</action>
</step>

<step n="4" goal="Human checkpoint — the user attacks the invariant">
  <critical>Do not write any file before this step completes. Formation is a proposal; the judgment is the user's.</critical>
  <output>Present, per accepted epic: the invariant sentence, the proposed key (`epic-N-iK`), member row ids, the draft story list (`a` / `b`…`y` / `z`), and the §6 spec-reconciliation routing per row. Then the rejected candidates with their failing criterion.

  Then **every unclustered row, grouped by its disposition** (`{{gate}}` §5): `quick-dev`, `adopt: <epic>`, `sweep: <epic>`, `reprice_on: <epic>`, `carve-first`, `spec-first`, `blocked: <what>`, `stays-skipped`. Sort by `impact` inside each group, `compliance` and `user-visible` first. Close with the balance line: `N accepted members + M unclustered = K open rows read`.

  Ask the user to attack each invariant sentence directly: if they cannot restate it as "so anything that does X is a bug" without adding a caveat, the sentence is wrong.</output>
  <critical>Never present unclustered rows as a bare list or as "the rest". Every open row carries a named next action, and the arithmetic must balance — a row in neither the accepted set nor the disposition groups has been silently dropped. If it does not balance, find the missing rows before presenting anything.</critical>
  <critical>The disposition groups are the checkpoint's real payload. The first pass left 14 of 20 `user-visible` rows unclustered and the user could not see it, because the report presented them undifferentiated; the bias was found by counting the board days later. Sorting by `impact` inside each group is what puts the arguable omissions where they get argued.</critical>
  <ask>Which of these hold? Reword, merge, split, or drop any of them. Then: does any `quick-dev` row actually belong in an epic, and does any epic member actually belong in `quick-dev`?</ask>
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
  <action>Write `{{report}}`: the frozen board date, commit and row count, accepted epics, rejected candidates with failing criteria, every re-scoring decision from Step 6, and the **unclustered rows grouped by disposition** exactly as presented at Step 4 — including the balance line and the per-`impact` sort. The report is what the next pass reads to avoid re-litigating; a disposition that exists only in the chat transcript is lost.</action>
  <action>Add a **coverage table** to the report: clustered vs unclustered counts per `impact` value. A pass that clusters one impact class far below the others has found a real asymmetry or has a biased criterion, and the table is what makes the next reader ask which.</action>
  <action>Run `{{runner}}` and confirm clean before committing. Check 11 fires if any epic lacks its `z` story.</action>
</step>

<step n="8" goal="Report and hand off">
  <output>**Formation pass complete — {{date}}, {{n}} open rows read**

    Accepted: {{epic keys with invariant sentences}}
    Absorbed stories: {{unstarted story keys, and whether re-parented or superseded}}
    Rejected: {{candidate + failing criterion + routing}}
    Unclustered by disposition: {{counts per disposition, then the rows per group}}
    Coverage: {{clustered/unclustered per impact value}}
    Balance: {{accepted members}} + {{unclustered}} = {{open rows read}}
    Re-scored: {{rows reopened or given reprice_on}}
    Report: {{report}}

    **Next step:** `bmad-epic-readiness-check` on each new epic — Gate 1/3 across all its
    stories at once, which is where `a` is validated, replaced, or dropped. Then
    `bmad-create-story` per story in letter order.

    Sequencing across these epics is NOT decided here — it is a lens at read time
    (`{{runner}} --lens <name>`, `{{gate}}` §9.3).</output>
</step>

<step n="9" goal="Stability test (§11)">
  <action>Ask which model to test, or use the driving model. Every run below uses THAT model — full run and ablations alike.</action>
  <critical>The control that makes the test mean anything: a full run and its ablations MUST use the same model (`{{gate}}` §11). Mix them and a membership flip could be method instability or two models disagreeing, and nothing in the output tells you which.</critical>

  <action>Build the subsets first, from the frozen input set (§5 — rows AND unstarted stories): one dropping ~25% at random, one dropping a single member from each cluster the full run will accept. Compute them mechanically before any run so no subset is chosen to flatter a result.</action>

  <action>Spawn every run as a SEPARATE cold subagent via the Agent tool, all with the chosen `model`, none nested:
    - one **full run**: the whole input set, Steps 1-3 only, returning accepted clusters (with invariant sentences and members), rejected candidates with failing criteria, and unclustered items.
    - one **ablation per subset**: identical instructions, that subset only.
    Give each subagent `{{gate}}` and its own slice of input, and NOTHING else.
  </action>
  <critical>Blindness is structural here, not a matter of discipline: a cold subagent cannot see the full run's output unless you put it in the prompt. Do not. Never include the full run's clusters, your reasoning about them, or even their names in an ablation's prompt — a run that can see the answer confirms it rather than testing it.</critical>

  <action>Compare on the intersection using §11's difference table. Threshold effects and re-wordings pass; a row moving between invariants, an uncaused split or merge, or changed §6 routing fails. Measure membership, not prose.</action>
  <action>On failure, name the cluster that flipped and give §11's diagnosis: its invariant sentence is describing its members rather than stating a rule (§5 criterion 2). Never resolve a flip by keeping whichever run reads better — the disagreement IS the finding.</action>

  <action>Write the verdict to `{{planning_artifacts}}/epic-formation/stability-{{date}}-{{model}}.md`, recording the model, the frozen input (date, row count, unstarted-story count), each run's output, and the comparison. §11 requires the model on every run — two verdicts compared later are guesswork without it.</action>

  <check if="the user asked to compare two models">
    <action>Repeat the whole procedure per model, then compare the two VERDICTS (not the two clusterings) against §11's model-fitness table: both stable → the cheaper model can drive formation; cheap unstable and strong stable → the model is the constraint; both unstable → the method is at fault and no model spend fixes it.</action>
  </check>

  <output>Per model: accepted/rejected per run, the intersection comparison, and a verdict — stable, or the clusters whose invariants need rewriting before any formation pass is trusted.</output>
</step>

</workflow>
