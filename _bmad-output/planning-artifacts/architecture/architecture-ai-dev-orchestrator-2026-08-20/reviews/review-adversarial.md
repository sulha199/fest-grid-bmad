---
name: 'Adversarial Review — AI Dev Orchestrator Architecture Spine'
type: review
target: '../ARCHITECTURE-SPINE.md'
method: 'two-implementer divergence probe (one level down)'
status: draft
created: '2026-08-20'
---

# Adversarial Review — ARCHITECTURE-SPINE.md (AI Dev Orchestrator)

## Method

For each finding below I construct two developers/agents, each building one piece of the orchestrator one level down from the spine (typically: **Dev A = Planner node + LLMPort**, **Dev B = Tester node + ExecPort adapter**, with variants naming Complex Worker/GitCheckpoint where the focus area demands it). Both read the spine, SPEC.md, stack.md, and state-machines.md. Both follow every AD to the letter. I show that they can still ship incompatible code — clashing shapes, dual ownership, or ambiguous contracts — because the spine states an invariant without pinning the *shape* the invariant operates over.

**Verdict up front:** the spine's ADs are well-formed as prohibitions (what must never happen) but under-specified as contracts (what must exactly be true). All 6 AD's *intent* survives a two-implementer split; the *literal text* of AD-1, AD-3, AD-4, and AD-5 does not, because none of them pins down a method signature, a merge/ownership rule, or a staging scope. This is the expected failure mode for an "initiative altitude" spine, but four of the gaps below are severe enough that two compliant implementations would not link/compose without a rewrite.

---

## Finding 1 — Port method signatures are named, not shaped (AD-1)

**Severity: Critical.** AD-1 pins the port *names* (`LLMPort`, `ExecPort`, `NotifyPort`, `HITLPort`) and the *rule* that all side effects cross them. It does not specify a single method signature, parameter, or return type for any of the four. Nothing else in the spine, SPEC, stack.md, or state-machines.md does either.

**Two compliant, incompatible builds:**

- **LLMPort.** Dev A (Planner) designs `LLMPort.complete(prompt: string): Promise<string>`, with the model alias pre-bound at construction time in `bootstrap.ts` (composition root builds one `LLMPort` instance per node role, each already pointed at its resolved `ORCH_MODEL_*` alias). Dev C (Complex Worker) independently designs `LLMPort.complete(messages: ChatMessage[], model: string): Promise<{content: string; usage: TokenUsage}>`, expecting to import `env.ts` directly inside `complex-worker.ts` and pass the resolved alias per call. Both satisfy AD-6 to the letter ("resolves through env.ts", "no bare model string") and AD-1 to the letter ("only depends on port interfaces"). They cannot be wired into the same `bootstrap.ts` — one design needs 4 pre-bound instances, the other needs 1 shared instance plus per-call model params, and the return shapes differ (raw string vs. structured object), so every node's error-handling and audit-logging code (AD-8) also diverges downstream.
- **ExecPort.** Dev B (Tester) needs to run build/test pipelines, plausibly multi-step (`npm run build && npm test`), so designs `ExecPort.run(command: string): Promise<{stdout, stderr, exitCode}>` backed by `child_process.exec` (shell:true). Dev D (GitCheckpoint) needs to run `git add` then `git commit -m "..."` and reasonably designs `ExecPort` around `execFile`-style argv arrays for safety (`run(cmd: string, args: string[])`, no shell interpretation) to avoid quoting/injection bugs in commit messages that may contain story titles pulled from spec.md text. Both are AD-1-compliant ("every side effect... goes through one of these ports"); neither adapter can serve both callers without one of them being rewritten, and the shell-vs-argv choice has real security consequences (message injection into `git commit -m` if the commit message is ever shell-interpolated).
- **HITLPort / NotifyPort race.** State-machines.md describes a `setTimeout` racing a `readline` wait. Nothing says which port owns that race. Dev E puts it inside `ReadlineHITLAdapter` (which would then need a reference to `NotifyPort` to fire the escalation email itself — collapsing two ports into one adapter's responsibility). Dev F keeps ports single-purpose and puts the race in `hitl.ts` (the node awaits `hitlPort.prompt()` racing a local `setTimeout`, and on timeout calls `notifyPort.sendEscalation()` directly, then continues waiting on the still-pending `hitlPort.prompt()`). Both satisfy AD-1; they imply different port shapes (does `HITLPort.prompt()` need to be cancellable/abortable, or does it return a promise that's simply left dangling after the node moves on to call `notifyPort`?) and different composition-root wiring (does `ReadlineHITLAdapter` take a `NotifyPort` in its constructor, or not?).

**Recommendation:** add an AD (or a `types.ts`/port-signatures appendix, since the spine explicitly defers "exact JSONL schema" to implementation but ports are load-bearing, not an implementation detail) that fixes: exact method names + signatures for all 4 ports; whether `LLMPort` takes a model param or is pre-bound per node; whether `ExecPort` is shell-string or argv-array; and who owns the HITL/Notify timeout race.

---

## Finding 2 — `tasks_queue` mutation ownership and GraphState reducers are unspecified (AD-5)

**Severity: Critical.** AD-5 says "the SQLite checkpointer... is the single source of truth for `tasks_queue`, story status, and attempt counts" and "nodes read and write state only via `GraphState`." It does not say **which node writes which field**, nor — critically for LangGraph — **what merge/reducer strategy each `GraphState` channel uses** when a node returns a partial state update. LangGraph channels need an explicit reducer (default is overwrite-on-write) per key; this is never mentioned.

**Two compliant, incompatible builds:**

- Dev A (Planner) assumes GitCheckpoint already flips the just-approved story's status to `done` before handing control back to Planner (per the diagram edge `GitCheckpoint --> Planner: commit created, next story`), so Planner's own write to `tasks_queue` only ever *adds* new stories or *selects* the next pending one — it never touches a story's `status` field.
- Dev B (Tester) assumes Tester itself is the sole writer of per-story status (since Tester is the node that "yields a pass/fail report," CAP-4), so Tester writes `story.status = 'tested_failed' | 'tested_passed'` directly into the `tasks_queue` array it receives, read-modify-write, and returns the *entire* `tasks_queue` array as its partial state update (since no reducer is specified, both devs independently assume "last write wins / full replacement" is the contract — but Dev A's code was built against a `tasks_queue` slice it read one step earlier in the graph. If Tester's write and Complex Worker's `story.autoFixAttempts` increment (AD-3) happen against two different in-memory copies of the same `Epic[]` read at different points, and both return full-array overwrites, one silently clobbers the other with no error — this is a straightforward last-write-wins data loss bug that is entirely consistent with both devs following AD-5 to the letter.

Compounding this: `story.autoFixAttempts` is referenced by AD-3 as if `Story` already has that field, but `Story`'s shape is never defined anywhere in the spine, SPEC, or companions — only fragments leak out across different ADs and capabilities (`status` in AD-5's prose, `tag: complex|standard` in CAP-2/CAP-3, `autoFixAttempts` in AD-3, `id` implied by "epic/story ids are strings" in Consistency Conventions). Two implementers who each independently reconstruct `Story` from these fragments will not produce the same TypeScript type, and one may omit a field the other's node reads.

**Recommendation:** add an AD that (a) publishes the full `Story`/`Epic` type (not just `ReviewVerdict`), (b) states the reducer/merge strategy per `GraphState` channel — especially whether `tasks_queue` updates are full-array replacement or a keyed patch — and (c) names exactly one node as the writer of each mutable field (`story.status`, `story.autoFixAttempts`) rather than leaving "nodes... write state" open to multiple writers.

---

## Finding 3 — Git staging scope through ExecPort is unconstrained (AD-4)

**Severity: High.** AD-4's rule is "issuing `git add`/`git commit`... through `ExecPort`." It says nothing about staging scope. CAP-11's own success criterion is narrower than the AD text: "`TARGET_REPO_PATH` has exactly one new commit containing **that story's changes**" — implying scoped staging — but AD-4 as literally written permits `git add .`.

**Two compliant, incompatible builds:**

- Dev D (GitCheckpoint) implements `git add .` (or `git add -A`) followed by `git commit -m "story X.Y: ..."` through a generic `ExecPort.run(cmd)`. This satisfies AD-4's literal text ("issuing git add/git commit... through ExecPort") but violates CAP-11's success criterion the moment `TARGET_REPO_PATH` has *any* pre-existing unrelated dirty state when the run starts (a very plausible real-world condition for a "local sandbox" pointed at a real dev repo) — the commit now contains more than "that story's changes."
- Dev B (Tester/ExecPort) — reasoning from CAP-11's stricter success text rather than AD-4's looser rule text — builds `ExecPort` with a dedicated `stageFiles(paths: string[])` method and expects the worker node to report which files it touched (via `current_code`, or a new field) so GitCheckpoint can stage precisely. But `current_code` is documented as `string | null` — "most recent diff/patch under review," a single blob, not a file-path list — so there is no GraphState field carrying a file-path provenance list for GitCheckpoint to consume. Dev B's design cannot actually be implemented against the fixed `GraphState` shape without adding a field, which AD-5/SPEC.md Constraints forbid ("no ad hoc state additions without revising this contract").

Both devs are individually AD-4-compliant; one produces commits that can silently include unrelated uncommitted work (a correctness and safety problem — this is a code-modifying autonomous agent), the other cannot be built at all against the current `GraphState` contract. Neither outcome is acceptable, and the AD text doesn't rule either path out.

**Recommendation:** tighten AD-4 to state the staging scope explicitly (e.g., "stages only files touched by the current story's diff, tracked via `current_code`'s file list") and, if scoped staging is intended, either extend `current_code`'s shape (structured `{diff: string, filesChanged: string[]}` rather than a bare string) or add an explicit AD amendment naming the mechanism.

---

## Finding 4 — AUTO_FIX ceiling override: internal rubric check or external post-hoc override? Increment timing? (AD-2 + AD-3)

**Severity: High.** This is the sharpest ambiguity in the spine because two of its own source documents phrase it two different ways.

- AD-3's rule text: "reaching `MAX_AUTO_FIX_ATTEMPTS`... forces `verdict = NEEDS_HUMAN` **regardless of what the Reviewer's own rubric would otherwise return**." This phrasing describes an **external override**: the Reviewer runs its rubric, produces a verdict (possibly `AUTO_FIX`), and a separate check afterward overrides it.
- state-machines.md's rubric section lists the ceiling as **one of the rubric's own `NEEDS_HUMAN` triggers** ("NEEDS_HUMAN — triggers... when... AUTO_FIX attempts on the same story have reached `MAX_AUTO_FIX_ATTEMPTS`"), i.e. an **internal** check baked into the same decision function that produces the verdict in the first place, not a wrapper around it.

**Two compliant, incompatible builds:**

- Dev C (Complex Worker/Reviewer, internal design) writes one function, `decideVerdict(review, story)`, whose first check is `if (story.autoFixAttempts >= MAX_AUTO_FIX_ATTEMPTS) return 'NEEDS_HUMAN'`, folded directly into rubric evaluation — matching state-machines.md's prose exactly. AD-2's invariant ("the only value the ...node may return from a review... is the only value graph edges branch on") is satisfied by construction: there's exactly one verdict value, ever.
- Dev C' (same node, external-override design, matching AD-3's literal wording) writes `runRubric(review): ReviewVerdict` with no counter awareness at all, and a *second*, separate function/graph-edge wrapper `applyCeiling(verdict, story): ReviewVerdict` that overrides `AUTO_FIX → NEEDS_HUMAN` post-hoc. This also satisfies AD-2 (still exactly one final value crosses the edge) and matches AD-3's text more literally than Dev C's design does.

Both are "correct" readings of two different canonical documents for the same behavior — this is not a hypothetical divergence, it is baked into the spine's own inconsistency between AD-3's wording and state-machines.md's rubric list.

**Second, independent ambiguity layered on top — increment timing and off-by-one semantics.** AD-3: "`story.autoFixAttempts` increments each AUTO_FIX cycle." Unclear whether "cycle" means (a) *the Reviewer emitting an `AUTO_FIX` verdict* or (b) *the worker completing patch application and re-entering Tester* (state-machines.md: `AUTO_FIX --> Tester: patch applied`). With `MAX_AUTO_FIX_ATTEMPTS` defaulting to `1`:
  - **Reading X:** counter starts at 0; Reviewer's first `AUTO_FIX` verdict increments it to 1 *before* the ceiling check runs against that same verdict → `1 >= 1` is already true → the very first `AUTO_FIX` is immediately overridden to `NEEDS_HUMAN`, meaning **zero real fix attempts ever execute** at the documented default.
  - **Reading Y:** the ceiling check happens *before* incrementing, so the first `AUTO_FIX` verdict is honored and executed (counter goes 0→1 only after), and only a *second* would-be `AUTO_FIX` verdict is overridden, since `1 >= 1` is now true on the next check.

These two readings differ by a full retry cycle at the documented default value, are both defensible from AD-3's text alone, and materially change observed system behavior (an orchestrator that never auto-fixes anything vs. one that fixes once). This is exactly the kind of two-implementer split the review is looking for: Dev C and Dev C' each write code that is individually correct against AD-3's literal words yet produces different visible behavior.

**Recommendation:** rewrite AD-3 to state explicitly: (1) the ceiling check is [internal to the rubric function | an external post-hoc override] — pick one and make state-machines.md's rubric list match it; (2) the exact increment point (on `AUTO_FIX` verdict emission vs. on Tester re-entry after patch apply); (3) whether the increment happens *before* or *after* the ceiling comparison for that same cycle, with a worked example at the default `MAX_AUTO_FIX_ATTEMPTS=1` spelling out how many real fix attempts occur.

---

## Finding 5 — Audit logging: adapter-side or node-side? (AD-8, cross-cutting with AD-1)

**Severity: Medium.** AD-8 says every LLM call, shell command, verdict, and HITL event "appends one JSONL line... via a dedicated audit logger." It doesn't say *who calls the audit logger*.

**Two compliant, incompatible builds:** Dev A designs adapters that self-log (`NineRouterLLMAdapter` and `LocalExecAdapter` each call the audit logger internally on every call, so nodes stay logging-agnostic). Dev B designs nodes that explicitly wrap each port call with a logging call (`auditLog(...); await execPort.run(...)`), assuming adapters are "pure" I/O with no cross-cutting concerns, consistent with AD-1's hexagonal framing where adapters just implement the port contract. If Dev A's `LLMAdapter` (self-logging) is composed with Dev B's node code (which also logs LLM calls itself), every LLM call is logged **twice**; conversely if Dev B's `ExecPort` node-side logging pattern is composed with an adapter nobody told to self-log, shell commands are logged **zero** times. Both outcomes violate AD-8's "every... shell command" guarantee while each half was individually AD-8-compliant in isolation.

**Recommendation:** name exactly one layer (adapter or node) as the audit-logging call site, or state that adapters are wrapped by a single cross-cutting decorator at the composition root rather than left to per-adapter/per-node discretion.

---

## Summary Table

| # | Focus area | AD(s) | Severity | Root cause |
|---|---|---|---|---|
| 1 | Port method signatures | AD-1 | Critical | Ports named, not shaped — no signatures anywhere in spine/SPEC/companions |
| 2 | `tasks_queue` write ownership + reducer strategy | AD-5 | Critical | "Nodes... write state" doesn't say which node owns which field or how partial updates merge |
| 3 | Git staging scope | AD-4 | High | AD-4's rule text is looser than CAP-11's success criterion; no file-provenance field exists to support scoped staging even if intended |
| 4 | AUTO_FIX ceiling: internal vs. external override; increment timing | AD-2, AD-3 | High | AD-3's wording ("regardless of... rubric") contradicts state-machines.md's rubric list (ceiling *as* a rubric trigger); increment-before/after-check order unstated |
| 5 | Audit log call site | AD-8 (crosses AD-1) | Medium | "via a dedicated audit logger" doesn't name adapter vs. node as the call site |

## What's already solid

AD-2's three-value verdict enum, AD-6's alias-indirection rule, and AD-7's fail-fast config are all tight enough that two implementers converge without ambiguity — these are genuine invariants, not just named concepts. The hexagonal boundary itself (AD-1's *prohibition* — no node touches `fs`/`child_process`/`fetch` directly) is unambiguous even though the port *shapes* crossing that boundary are not; tightening the signatures (Finding 1) would make AD-1 complete rather than merely directionally correct.
