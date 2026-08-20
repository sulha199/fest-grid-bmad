---
name: 'Adversarial Review — CAP-12/13/14 Amendment'
type: review
target: architecture-ai-dev-orchestrator-2026-08-20/ARCHITECTURE-SPINE.md (amended 2026-08-20)
reviewer-lens: 'two independent implementers, each obeying every AD to the letter, still build incompatibly'
created: '2026-08-20'
---

# Adversarial Review — Two-Tier Review, Shared Retry Budget, Epic Readiness, Correct-Course

## Scope

This review targets only the material added/amended in the 2026-08-20 amendment: AD-2 (two-tier verdict), AD-3
(shared retry budget), AD-5 (readinessReport ownership), AD-9 (HITL directive parsing), and CAP-12/CAP-13/CAP-14.
Companions read in full: `SPEC.md` and `state-machines.md` (mermaid, two-tier rubric, Epic Readiness Check section,
Correct-Course Escalation section, Entry points section).

Method: for each ambiguity, construct two implementers who both satisfy the literal AD/CAP text but produce
observably different behavior or wiring.

---

## Finding 1 (Critical) — AD-4 was not amended for two-tier review; its literal text still permits checkpointing after Tier-1 alone

`AD-4`'s rule text: *"the GitCheckpoint node runs immediately after a story's verdict is APPROVE... Exactly one
commit per completed story, whether reached via the autonomous loop or a manual-review AUTO_FIX (CAP-6)."*

Nothing in AD-4 was touched by this amendment — it still speaks of "a story's verdict" (singular), which AD-2
explicitly confirms Tier-1 alone can produce (`ReviewVerdict` is returned by Tier-1 on every attempt). Yet the
Capability Map row for **CAP-13 explicitly lists AD-4 as one of its governing ADs**, and `state-machines.md`'s
amended "Git checkpoint policy" section says checkpointing fires only *"after that story clears **both** review
tiers (Tier-1 Reviewer APPROVE, then Tier-2 Deep Code Review APPROVE)."*

Two implementers:
- **Implementer A** reads the spine as self-sufficient per its own framing (line 115: node topology/rubric are
  "inherited... not re-derived" from state-machines.md, but AD-4's checkpoint-timing rule is presented as the
  complete, standalone contract for when GitCheckpoint fires) and wires `GitCheckpoint` directly off Tier-1's
  `APPROVE`, exactly as AD-4 literally says — silently bypassing Tier-2 review and defeating CAP-13's entire
  purpose.
- **Implementer B** cross-references `state-machines.md`'s Git checkpoint policy section and correctly gates
  `GitCheckpoint` on Tier-2's `APPROVE`.

This is not a subtle reading gap — it is the single most consequential place the amendment needed to touch AD-4
and didn't, despite the Capability Map asserting AD-4 already governs CAP-13.

**Recommendation:** amend AD-4's rule text itself to say the checkpoint fires only after *both* tiers return
`APPROVE` (mirroring state-machines.md), not just after "a story's verdict is APPROVE."

---

## Finding 2 (High) — What `current_code` Tier-2 reviews is unpinned: same field Tier-1 saw, cumulative across AUTO_FIX rounds, or re-fetched?

`GraphState.current_code` is documented as *"most recent diff/patch under review"* — singular, one field, no
file-provenance list (AD-4 explicitly leans on this: *"current_code needs no file-provenance list... because the
working tree only ever contains that one story's changes at commit time"*).

But within a single story, `current_code` can be overwritten multiple times across AUTO_FIX rounds before Tier-1
ever reaches APPROVE. Neither AD-2, AD-3, nor CAP-13's text says whether:
- `current_code` accumulates into the story's full cumulative diff as each AUTO_FIX patch lands, or
- it's replaced each time with only the latest incremental patch (matching the field's literal "most recent"
  wording).

CAP-13 says Tier-2 reviews *"the finished diff"* — if `current_code` only ever holds the last incremental patch,
an implementer who takes AD-1's `ExecPort` at face value could reasonably have `DeepCodeReviewNode` re-run `git
diff` against the story's start point to get the true finished diff, while another implementer just reuses
`state.current_code` as-is. These produce genuinely different review inputs (and therefore different verdicts) for
any story that went through more than one AUTO_FIX round before Tier-1 approved.

**Recommendation:** state explicitly whether `current_code` is cumulative-per-story or last-patch-only, and
whether Tier-2 is required to consume `GraphState.current_code` verbatim or is permitted/expected to re-derive the
diff via `ExecPort`.

---

## Finding 3 (High) — AD-3's increment trigger is literal-vs-spirit ambiguous, and the literal reading has a loophole

AD-3: *"`story.autoFixAttempts` increments immediately after an AUTO_FIX patch is applied (from either tier) **and
the following Tester run still fails** — before the next Reviewer call."*

Read literally, the trigger is conjunctive: patch applied **and** Tester still fails. If Tester *passes* after a
patch but the Reviewer (Tier-1) still doesn't return APPROVE (e.g., it flags a different, non-test-covered issue
and returns AUTO_FIX again), the counter does not increment under a literal reading — because the specific Tester
run that followed the patch didn't fail. This creates a loophole where a story can cycle through multiple AUTO_FIX
rounds indefinitely as long as each round's Tester run happens to pass, since the ceiling never engages.

Two implementers:
- **Implementer A** codes exactly the literal conjunction: increment only when Tester fails post-patch.
- **Implementer B** reads the AD's *intent* ("prevents an unbounded AUTO_FIX loop burning tokens on a story that
  is genuinely stuck") and increments on every applied AUTO_FIX patch regardless of the following Tester outcome,
  since that's the only reading that actually bounds the loop in all cases.

These two implementations allow different numbers of real AUTO_FIX rounds before forcing NEEDS_HUMAN, and diverge
specifically on the tests-pass-but-Reviewer-still-unhappy path.

**Recommendation:** either confirm the literal reading is intended (and accept/document the loophole) or drop the
"and the following Tester run still fails" clause so the counter increments on every applied patch, tier-agnostic.

---

## Finding 4 (Medium-High) — No GraphState field carries a reviewer's specific fix rationale into the AUTO_FIX step

Per the "manual review" Entry point text, *"an AUTO_FIX verdict (from either tier) has the Complex Worker/Reviewer
node itself apply the recommended patch"* — meaning even a Tier-2 (`DeepCodeReviewNode`) downgrade's specific
finding (which edge case, which AC gap) must reach `ComplexWorker` for it to act on.

`GraphState` is fixed to exactly `spec, tasks_queue, current_code, terminal_output, error_status, human_feedback`
(SPEC.md Constraints, "no ad hoc state additions without revising this contract"). None of these six fields is
obviously earmarked for "reviewer's fix instructions." Two implementers will diverge on where this data lives:
- **Implementer A** overloads `current_code` to append review commentary above/alongside the diff.
- **Implementer B** overloads `human_feedback` even though the source isn't a human.
- **Implementer C** treats this as out-of-GraphState scope and passes it as transient in-memory context between
  the same LangGraph tick's node calls (only viable if Tier-2's downgrade and the AUTO_FIX patch application
  happen inside the same node invocation rather than as separate graph nodes — itself unspecified, see Finding 5).

**Recommendation:** name the field (existing or new) that carries a reviewing tier's rationale into the AUTO_FIX
step, for both Tier-1 and Tier-2 downgrade paths.

---

## Finding 5 (Medium) — `AUTO_FIX` in the mermaid has no corresponding file in the Structural Seed; is it a real node?

`state-machines.md`'s diagram treats `AUTO_FIX` as its own state (`ComplexWorker --> AUTO_FIX`, `AUTO_FIX -->
Tester`, `DeepCodeReview --> AUTO_FIX`), but the spine's Structural Seed file list has no `auto-fix.ts` — only
`epic-readiness-check.ts, planner.ts, complex-worker.ts, speed-worker.ts, tester.ts, deep-code-review.ts, hitl.ts,
correct-course.ts, git-checkpoint.ts`. The Entry points prose clarifies (only for the manual-review path) that
`ComplexWorker` itself is "the sole AUTO_FIX executor," implying `AUTO_FIX` is not a distinct graph node but an
internal branch of `complex-worker.ts` — but this is never stated for the primary `dev an epic` loop, and never
stated in the spine at all (AD-1..AD-9 never mention an `AUTO_FIX` node or clarify this).

Two implementers: one builds a literal `AUTO_FIX` graph node (as the diagram's boxes suggest, calling back into
`DeepCodeReviewNode` or `ComplexWorker` via some port), the other inlines it into `complex-worker.ts` as the Entry
points text for manual review implies. This affects both the file layout and how state flows into Finding 4's
missing field.

---

## Finding 6 (Medium) — `correct-course:` prefix matching is not specified precisely, despite AD-9 naming silent no-op as exactly the failure it prevents

AD-9's own "Prevents" clause: *"a flagged response silently no-oping instead of routing to `CorrectCourseNode`."*
Yet neither AD-9, CAP-14, nor the Correct-Course Escalation section in `state-machines.md` specifies:
- case sensitivity (`Correct-Course:` vs `correct-course:`),
- leading/trailing whitespace tolerance,
- whether the colon must be immediately followed by content or a space is required/optional.

Two implementers: one does `response.trim().toLowerCase().startsWith('correct-course:')`, the other does an exact
`response.startsWith('correct-course:')`. A human who types `"Correct-course: ..."` or pastes a leading space
routes correctly under the lenient implementation and silently falls through to "unflagged, resume at Planner"
under the strict one — precisely the failure mode AD-9 claims to guard against, undermined by its own
under-specification.

---

## Finding 7 (Medium) — EpicReadinessCheckNode's scope/mode has no explicit GraphState signal

The mermaid shows two distinct entries into `EpicReadinessCheck`: `[*] --> EpicReadinessCheck` (mandatory,
full-epic sweep, no report yet) and `CorrectCourse --> EpicReadinessCheck` (forced re-sweep, scoped to *remaining
not-yet-approved stories only*, seeded with the flagged text, ignoring any existing report). Nothing in AD-5, AD-9,
or CAP-12/14's prose says how `EpicReadinessCheckNode` is supposed to *know* which mode it's in — GraphState's
fixed six fields have no "sweep scope" or "force" flag. The two most plausible implicit mechanisms (which edge
invoked the node; `human_feedback` being non-null) are never named as the intended signal, so implementers could
diverge on how (or whether) they thread this through, and whether a first-time sweep could accidentally get scoped
down if it reuses the same code path as a correct-course resweep.

---

## Finding 8 (Low-Medium) — CAP-12's "optional, force-recheck" CLI mechanism is prose-only, no flag name specified

CAP-12's success criterion and the Epic Readiness Check section both describe re-running the sweep "on request"
via "a CLI flag" — but no flag name, no default, and no syntax appears anywhere in the spine, SPEC.md, or
state-machines.md. The spine's own Deferred section explicitly punts only on the *parsing library* choice
(commander/yargs/manual), not on the flag's name/shape existing at all. Two implementers will independently invent
different flag names (`--force-readiness`, `--recheck-epic`, `--readiness-force`, etc.) — low-stakes for a
personal tool, but a real point of incompatibility if the CLI surface is ever meant to be interoperable across
either implementer's build (e.g., docs, scripts, muscle memory).

---

## Finding 9 (Low) — Partial-report-on-crash question is contingent on an unstated internal-node-structure assumption

The task prompt raised: what if a crash occurs mid-sweep, leaving `Epic.readinessReport` partially written? Given
LangGraph's SQLite checkpointer persists state at node-boundary granularity, if `EpicReadinessCheckNode` is
implemented as a *single* atomic node (matching the Structural Seed's one-file-per-node layout), a mid-execution
crash would leave no checkpoint at all for that node's update — `readinessReport` would remain fully absent, not
partial, and the "absence = mandatory sweep" signal in AD-5 would hold cleanly. But nothing in AD-5 or CAP-12
actually asserts that `EpicReadinessCheckNode` must be a single atomic node internally (as opposed to a Gate-1 /
Gate-3 pair of internal steps that could plausibly be split into separate graph nodes/edges, each individually
checkpointed) — that constraint is implied by the file layout, never stated as a rule. An implementer who splits
Gate 1 and Gate 3 into two graph nodes reintroduces exactly the partial-write crash scenario AD-5's simple
absence-check doesn't handle.

---

## What checks out (no divergence found)

- `tasks_queue` write ownership is consistently described everywhere as Planner-only for both CAP-12 and CAP-14 —
  AD-5, SPEC.md Constraints, and both state-machines.md sections agree; no contradiction found here.
- AD-9's rule (parsing lives in the node, not the port) is consistent with the HITL escalation sequence and the
  Correct-Course Escalation section — no split-brain on *where* parsing happens, only on *how precisely* (Finding
  6).
- AD-3's "shared budget, no second independent ceiling for Tier-2" is consistently stated in AD-3, the Tier-2
  rubric bullets, and SPEC.md Constraints — internally consistent, modulo Finding 3's increment-trigger ambiguity.

---

## Summary Table

| # | Severity | Area | Divergence risk |
| --- | --- | --- | --- |
| 1 | Critical | AD-4 vs. two-tier gating | GitCheckpoint could fire after Tier-1 alone if AD-4 is trusted as complete |
| 2 | High | Tier-2 review input | Same `current_code` vs. cumulative diff vs. re-fetched via ExecPort |
| 3 | High | AD-3 increment trigger | Literal conjunctive reading vs. "every applied patch" reading |
| 4 | Medium-High | Reviewer rationale → AUTO_FIX | No named field carries fix instructions between tiers/nodes |
| 5 | Medium | `AUTO_FIX` node existence | Diagram implies a node; Structural Seed has no file for it |
| 6 | Medium | `correct-course:` parsing | Case/whitespace unspecified; risks the exact silent no-op AD-9 names |
| 7 | Medium | Readiness sweep scope signal | No GraphState field distinguishes full vs. scoped/forced sweep |
| 8 | Low-Medium | Force-recheck CLI flag | No name/default specified anywhere |
| 9 | Low | Partial-report crash edge case | Depends on unstated single-node-vs-split-node assumption |
