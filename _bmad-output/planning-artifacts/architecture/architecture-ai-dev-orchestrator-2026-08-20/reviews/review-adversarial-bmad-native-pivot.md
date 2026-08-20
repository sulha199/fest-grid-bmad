---
name: 'Adversarial Review — BMad-Native Pivot'
type: review
purpose: adversarial-critique
altitude: initiative
status: final
created: '2026-08-20'
target: '../ARCHITECTURE-SPINE.md'
companions_reviewed:
  - '../../../../specs/spec-ai-dev-orchestrator/SPEC.md'
  - '../../../../specs/spec-ai-dev-orchestrator/state-machines.md'
  - '../../../../specs/spec-ai-dev-orchestrator/stack.md'
---

# Adversarial Review — BMad-Native Pivot (AD-5 rewrite, AD-4 fix, AD-9 prefix rule, AD-10 addition)

## Verdict

The rewrite is a real improvement in intent (canonical real files, dual-tier gating, a safety boundary on planning-doc edits), but it fails its own stated goal of "BMad-native" fidelity in at least one load-bearing, first-run-breaking way (wrong config path), contains a direct self-contradiction between the spine (AD-3) and its own state-machines.md companion on the AUTO_FIX counter's increment condition, leaves the SQLite-loss reconciliation path fully unspecified against a live repo that today already has stories sitting in exactly the ambiguous states this gap concerns, and asserts a git-safety guarantee (AD-4's `git add -A` justification) whose precondition the document's own Open Questions section admits is unbuilt — the last of which is a genuine data-corruption risk given `TARGET_REPO_PATH` can be this repo.

Two independently-correct implementers, each following every AD to the letter, will diverge on: (a) the AUTO_FIX attempt counter (AD-3 vs. state-machines.md disagree on the trigger condition), (b) what `sprint-status.yaml`'s story-key format actually is (spine's own example doesn't match the real file), and (c) how to react to a pre-existing `in-progress`/`review` story with no SQLite counterpart (unspecified either way).

---

## 1. Fidelity to the real files

### 1.1 — CRITICAL: wrong config file for path resolution

`state-machines.md` (line 7) and `stack.md` (line 42) both state that `planning_artifacts`/`implementation_artifacts` are "resolved from the target project's own `_bmad/core/config.yaml`." SPEC.md's Assumptions (line 106) repeats this claim. This is **factually wrong** against the real repo:

- `_bmad/core/config.yaml` (actual contents): `user_name`, `project_name`, `communication_language`, `document_output_language`, `output_folder`. **No `planning_artifacts` or `implementation_artifacts` key exists in this file.**
- `_bmad/bmm/config.yaml` (actual contents): has `planning_artifacts: "{project-root}/_bmad-output/planning-artifacts"` and `implementation_artifacts: "{project-root}/_bmad-output/implementation-artifacts"` — the actual keys needed.
- The real `bmad-epic-readiness-check` SKILL.md, Step 3, confirms this directly: *"Load `{project-root}/_bmad/bmm/config.yaml` and resolve `project_name`, `user_name`, `communication_language`, `planning_artifacts`, `implementation_artifacts`."* — `bmm/config.yaml`, not `core/config.yaml`.

Any implementer who builds path resolution to the letter of `state-machines.md`/`stack.md` will read a file that lacks the keys it needs and fail (or silently fall through to an undefined default) on the very first run, against every target repo, including this one. This is not a cosmetic error — CAP-1, CAP-5, CAP-12, and effectively every capability depend on these two paths resolving correctly before anything else happens. This must be fixed to `_bmad/bmm/config.yaml` (with `core/config.yaml` at most a fallback for `project_name`/`user_name`/`communication_language`, which *are* duplicated in both files in the real repo).

### 1.2 — Story-key format: spine's own canonical example doesn't match the real file

The spine's Consistency Conventions table states: *"Epic/story ids are the real BMad keys as they appear in `epics.md`/`sprint-status.yaml` (e.g. `"1"`, `"1.3a"`), never a separately-invented numbering scheme."* AD-4 repeats the same example for commit messages ("references the epic/story key, e.g. `1.3a`").

Checking the real files:
- `epics.md` uses dotted section headers: `### Story 0.7a: Build the NavRailItem primitive...` — `"1.3a"`-style keys are accurate **here**.
- `sprint-status.yaml`'s actual keys are full dash-slugs, not dotted keys: `0-7a-nav-item-primitive`, `0-1-initialize-pnpm-monorepo`, `0-15a-local-dev-email-adapter-stub`, etc. There is no `"1.3a"`-shaped key anywhere in the real `sprint-status.yaml`.

So the spine presents a single example (`"1.3a"`) as *the* real key "as it appears in `epics.md`/`sprint-status.yaml`" when in fact the two files use two different, non-trivially-related formats (a dotted epic.story.suffix vs. a full kebab-case slug derived from the story title). Nowhere in the spine, SPEC.md, or state-machines.md is a mapping function specified between the two. `parse-epics.ts` and `parse-sprint-status.ts` (Structural Seed) are listed as separate, independent parse modules with no stated shared-key contract between them.

Concretely: implementer A reads the spine's own example literally and has `parse-sprint-status.ts` index its status map by dotted key (`"1.3a"`) — this will never match any real key and every status lookup silently fails or throws. Implementer B, working from the raw file, correctly indexes by the slug. Both believe they matched AD-5's "real BMad keys" rule to the letter; only one actually works against this repo. This is exactly the kind of two-implementers-diverge failure the review was asked to hunt for, and it's caused by the architecture's own illustrative example being wrong for one of the two files it claims to describe.

**Recommendation:** the spine/state-machines.md need to state explicitly that `epics.md` story ids are dotted (`1.3a`) while `sprint-status.yaml` keys are full slugified titles, and specify (or delegate to `parse-story-file.ts`) the actual derivation rule (lowercased, spaces→dashes, roughly title-derived — note it is *not* a pure mechanical slug of the AC title either; e.g. `0-7a-nav-item-primitive.md` is a materially shortened slug versus the full story title "Build the NavRailItem primitive and its interaction hook," so this isn't even a deterministic transform an implementer can derive from the title alone without seeing more real examples).

### 1.3 — Readiness report real shape has an `addenda` field the spec's parser doesn't model, and AD-5's "overwrites" claim contradicts the real convention

`parse-readiness-report.ts` (Structural Seed) is declared to round-trip `epic-{N}-readiness.md <-> { swept, findings, prerequisiteKeys }`. The real `epic-1-readiness.md` in this repo has a materially richer shape:

```yaml
epic: 1
swept: true
date: 2026-07-31
addenda:
  - date: 2026-08-01
    trigger: "Dynamic Page Title & Meta Tags rule added to project-context.md"
    stories_corrected:
      - 1.6
      - 1.7
stories_covered: [1.1, 1.2, 1.3a, 1.3b, 1.3, 1.4, 1.5, 1.6a, 1.6, 1.7, 1.8]
```

Two problems:

1. `addenda` and `stories_covered` aren't in the parser's stated shape at all — an implementer building `parse-readiness-report.ts` strictly to the Structural Seed's declared type will drop these fields on any write, silently destroying real history recorded by prior human-run `bmad-epic-readiness-check`/`bmad-correct-course` passes the first time the orchestrator touches an already-swept report.
2. AD-5 states plainly: *"CAP-14's forced re-sweep bypasses that check and overwrites the report."* But the real convention this repo already uses for a correction to an already-swept epic is **append an `addenda` entry**, preserving the original `stories_covered`/date/findings — not a wholesale overwrite. AD-10's forced re-sweep (CAP-14) is exactly this same scenario (a correction to an epic already swept, triggered by new information). A literal "overwrite" implementation would destroy the addenda-history convention the real artifacts already rely on, which is a real fidelity regression against the very repo this design claims to target.

## 2. SQLite-loss reconciliation (Q2) — unspecified, and not hypothetical for this repo

Nothing in AD-5, state-machines.md, or the Deferred section of the spine specifies what happens when the SQLite checkpoint is **absent** (not corrupted — genuinely never-existed or deleted) but a real story is already sitting at `in-progress` or `review` in `sprint-status.yaml`. The spine only describes the checkpoint's *contents* ("`autoFixAttempts` per story, and which story was mid-flight") and its purpose ("crash-resume within a single run") — it never states the reconciliation policy when the ephemeral half of the state is missing but the durable half implies a story mid-pipeline.

This is not a contrived edge case. **This repo's actual `sprint-status.yaml`, right now, has `0-4`, `0-5`, `0-6`, and `0-7` all at `review`**, produced entirely by real human/BMad-skill work with zero orchestrator involvement and thus zero SQLite checkpoint. If a user runs `dev an epic 0` against this repo the very first time the orchestrator exists, it will immediately encounter this exact situation on real data, not in a crash-recovery scenario but as the *starting* condition.

The design gives no answer to:
- Does the orchestrator treat these as `autoFixAttempts = 0` and pick up the pipeline mid-way (e.g., re-run Tier-2 Deep Code Review on a diff it never produced and has no `current_code` for, since `current_code` is explicitly SQLite/in-memory-only and not reconstructable from the real files per AD-5)?
- Does it treat "found `in-progress`/`review` with no checkpoint" as a foreign/external-work condition to leave untouched and skip past?
- Does it treat it as an anomaly and route straight to HITL?

All three are defensible; none is specified. Two implementers building "to the letter" will each pick one, and only one of the three is safe (leave external/foreign in-progress-or-review work alone unless explicitly HITL-confirmed) — the other two either silently reprocess work the orchestrator never actually produced (Tier-2 reviewing a `current_code` diff that doesn't exist) or halt on every single run against a repo with any pre-existing human-driven review backlog, which given this repo's actual state would mean **every** `dev an epic 0` invocation halts immediately at HITL before doing anything, defeating CAP-5's autonomy goal. This needs to be pinned down before implementation, not left as an emergent behavior of whichever interpretation an implementer happens to choose.

## 3. AD-3 vs. state-machines.md — a direct, load-bearing contradiction on the AUTO_FIX counter

This is the single clearest case of the two canonical texts disagreeing outright, not just being underspecified.

**AD-3 (spine):** *"`story.autoFixAttempts` increments immediately after an AUTO_FIX patch is applied (from either tier) **and the following Tester run still fails** — before the next Reviewer call."*

**state-machines.md rubric (companion, describing the same counter):** *"The counter increments on **every applied AUTO_FIX patch**, tier-agnostic, **whether or not the following Tester run passes** — not only on a post-patch Tester failure."*

These are opposite conditions. AD-3 conditions the increment on the post-patch Tester run failing; state-machines.md explicitly and pointedly denies that condition ("not only on a post-patch Tester failure" — read plainly, it means the increment happens regardless of Tester's post-patch result, including when Tester *passes*). Both documents are declared canonical (SPEC.md's companions include both; the spine explicitly says "already fixed in the spec's `state-machines.md` companion — inherited here, not re-derived" for node topology and the rubric specifically).

Under `MAX_AUTO_FIX_ATTEMPTS = 1` (the default), this distinction is not cosmetic: under state-machines.md's rule, a story's **first** AUTO_FIX patch — even one that immediately fixes everything and lets Tester pass — burns the entire budget, so any *second* AUTO_FIX need (from Tier-2, downgrading a Tier-1 APPROVE) is instantly forced to `NEEDS_HUMAN` with zero further attempts, regardless of severity. Under AD-3's rule, a successful patch doesn't count against the budget at all, so Tier-2 gets a full attempt of its own. This changes how often stories reach HITL by a wide margin and is exactly the kind of ambiguity that produces two implementations with materially different autonomy/escalation behavior while each one is fully compliant with *a* canonical document. **This must be resolved as a single authoritative rule before implementation** — recommend picking AD-3's condition (only count a patch that didn't fix the problem) since it's the more sensible reading of "retry ceiling," and fixing state-machines.md's rubric text to match, since state-machines.md's current wording is the newer-sounding, more precisely-worded of the two and thus the more likely one an implementer trusts over the spine's shorter aside.

## 4. AD-4 x AD-5 ownership table — does `sprint-status.yaml` distinguish tier progress? (Q3)

Confirmed: it does not, and this is a real (if minor) information loss, not a blocking bug.

The ownership table lists exactly one `in-progress → review` transition, attributed jointly to `ComplexWorker (Tier-1)` and `DeepCodeReview (Tier-2)`, and exactly one `review → done`, owned solely by `GitCheckpoint`. There is no listed `review → in-progress` (or any) reversion transition anywhere in the table for the case where Tier-2 downgrades an already-`review`-flagged story to `AUTO_FIX` and routes back through `Tester`. Per the node topology (`DeepCodeReview --> Tester: Tier-2 verdict = AUTO_FIX`), the story re-enters the Tester/patch loop while `sprint-status.yaml` still reads `review` the entire time — a human or another BMad skill glancing at the file during that window sees "awaiting/in code review" when the story is actually back in an automated patch-and-retest cycle behind the scenes.

This is tolerable as a coarse-grained status (BMad's real five-value enum has no tier concept to begin with, so no status value *could* fully capture this without inventing one, which AD-5 explicitly forbids). But it should be called out as a known, accepted information gap rather than left implicit — currently a reader has to reconstruct this by cross-referencing the topology diagram against the ownership table; the ownership table alone reads as if `review` unambiguously means "awaiting or in code review," which is only sometimes true.

## 5. AD-10 vs. CAP-1 Phase A — a scope gap, not a violation, but a real spirit-vs-letter gap

AD-10's `Binds:` line is `CAP-12, CAP-14` and its `Rule:` names only `EpicReadinessCheckNode` and `CorrectCourseNode`. Planner (CAP-1) is not named anywhere in AD-10 and is not bound by it. So **CAP-1 Phase A does not violate AD-10's letter** — AD-10 restricts writes *to* the PRD/architecture files themselves; CAP-1 Phase A writes *to* `epics.md`, deriving its content *from* the PRD/architecture, which is a different act and is nowhere forbidden.

It does, however, sit uncomfortably close to AD-10's own stated `Prevents:` rationale — *"an autonomous rewrite of planning documents a human never reviewed."* `epics.md` **is** a planning document (it's the very first artifact listed under `planning_artifacts`, and the real skill that produces it is explicitly framed as collaborative — see below), and CAP-1 Phase A produces a brand-new epic/story decomposition of it fully autonomously, with **no HITL step described anywhere** in SPEC.md or state-machines.md between "no `epics.md` entry exists" and "coarse breakdown is written." The node topology diagram goes straight from `[*] --> EpicReadinessCheck`/`Planner`, no HITL branch prior to Planner's first write.

Checked against the real `bmad-create-epics-and-stories` SKILL.md this is meant to match: it explicitly frames itself as *"a partnership, not a client-vendor relationship... Work together as equals,"* uses a step-file architecture that says *"WAIT FOR INPUT: If a menu is presented, halt and wait for user selection,"* and only proceeds past a step when the user explicitly selects "Continue." The real skill is thus genuinely, structurally interactive — not just conventionally so. CAP-1 Phase A's success criterion ("running `dev an epic <name>` writes a coarse epic/story breakdown into `epics.md`") describes this happening with no human step at all.

This is a real gap between what CAP-1 claims to match and what it actually does, and it is arguably a bigger autonomy concern than anything AD-10 currently covers (AD-10 only gates *findings that require* a PRD/architecture edit; it says nothing about Planner *generating new epics.md content from* the PRD/architecture in the first place). Recommend either: (a) explicitly widening AD-10 (or adding a sibling AD) to require a HITL confirmation gate before Planner's first autonomous write to a previously-epic-less `epics.md`, or (b) if the intentional design decision is that CAP-1 Phase A stays autonomous, stating that decision explicitly as a deliberate, named exception to AD-10's rationale rather than leaving the reader to infer it from AD-10's narrow `Binds:` line.

## 6. Real risk to this live repo: AD-4's `git add -A` justification rests on an unbuilt precondition

This is the most concrete "could actually hurt the live repo" finding.

AD-4 states: *"`git add -A` is correct **because** CAP-5's loop is serial: GitCheckpoint always fires right after a story clears both tiers and before the next story starts, so **the working tree only ever contains that one story's changes at commit time**."* This is presented as an already-true guarantee justifying the blanket `git add -A`.

But the spine's own Deferred section, immediately below, lists as **still open**: *"Uncommitted-work safety check when `TARGET_REPO_PATH` is this repo — should the orchestrator refuse to run against a dirty working tree from an active human session? Not yet decided; revisit before the first run against a live repo rather than a freshly-cloned one."* SPEC.md's Open Questions repeats the same unresolved item.

These two statements are in tension: AD-4 assumes the tree is clean of anything except the orchestrator's own in-flight story at commit time; the Deferred/Open Questions section admits there is currently **no mechanism at all** to guarantee that when `TARGET_REPO_PATH` is a live repo a human is actively working in (which the design explicitly permits — "may be this repo itself" appears repeatedly, including in Structural Seed and SPEC.md's Constraints). If a user runs `dev an epic <name>` against this repo while they have *any* unrelated uncommitted edit sitting in the working tree (a WIP fix, a half-finished experiment, an untracked scratch file not yet gitignored), `git add -A` followed by `git commit` will **silently fold that unrelated human work into the story's "done" commit**, indistinguishable in history from the story's actual diff, the moment the first story clears both review tiers. There is no staging-diff check, no pre-flight `git status --porcelain` gate, and no mention of scoping `add` to paths touched since the run started, anywhere in AD-4, SPEC.md, or state-machines.md.

Given this repo's git status is normally worked in directly by a human (confirmed: this session's own git status shows a clean tree with recent real commits), this is a plausible, not theoretical, data-corruption vector the first time someone points the orchestrator at this repo mid-session rather than a fresh clone. **Recommend resolving the Deferred open question before any implementation lands, not after** — at minimum, GitCheckpoint should snapshot `git status --porcelain` at run start and either refuse to run on a dirty tree, or scope its `add` to only the files it can prove it (or the story's Tester run) actually touched, rather than relying on the "serial loop, so the tree is always clean" assumption that nothing currently enforces.

## 7. Minor / lower-severity notes

- **Stack table**: `yaml 2.9.0`'s stated justification (comment-preserving round-trip for `sprint-status.yaml`) is validated against the real file — it does contain hand-written inline comments (e.g. the `# reset from review to ready-for-dev 2026-08-05 — ...` note above the `0-7` entry), so the dependency choice and its rationale are sound and match real data. No issue found here.
- **`readiness_dir` path**: confirmed real — `_bmad-output/planning-artifacts/epic-readiness/epic-{N}-readiness.md` exists today for epics 0–6, matching state-machines.md's stated path exactly.
- **Story file naming**: confirmed real — `{implementation_artifacts}/<epic>-<story>-<slug>.md` matches actual filenames (`0-7a-nav-item-primitive.md`, `0-1-initialize-pnpm-monorepo.md`, etc.), including lettered-suffix stories.
- **`project-context.md` "Reference Documents" section**: confirmed real, with the exact structure (Planning & Requirements / Architecture & Infrastructure / UX Design subsections) state-machines.md's fallback-resolution note assumes.
- The Epic Readiness Check's numbering-rule (Epic 0 append vs. lettered-suffix insertion) is faithfully reflected in state-machines.md/SPEC.md against the real `SKILL.md` — no drift found there.
