# Epic Formation Gate (backlog → epic)

**Status:** active convention
**Created:** 2026-09-05
**Owns:** the step between `backlog.yaml` triage and `bmad-create-story`
**Companions:** `backlog-spec.md` (the board), `story-split-gate.md` (per-story Gates 1/2/3)

## 1. Why this exists

The board has two exits and no middle:

| Exit | Gates applied | Sees across rows? |
|---|---|---|
| `bmad-quick-dev` on one row | none | no |
| CC proposal → `bmad-create-story` | Gates 1/2/3, per story | only within one proposal |

`story-split-gate.md`'s gates fire **per story**, so they can catch *"this story needs a
layer that doesn't exist"* but never *"these five rows all need the **same** layer that
doesn't exist."* That is a cross-row observation and nothing in the pipeline reads more
than one row at a time.

`bmad-epic-readiness-check` **is** the cross-story form of Gates 1 and 3 — but it only
runs against an epic that already exists in `epics.md`, and nothing ever creates one from
backlog rows. This document is that missing step, and only that step. Everything
downstream (`epic-readiness-check` → `create-story` → `dev-story` → `code-review` →
`epic-readiness-review`) is unchanged.

### The inversion

| | Greenfield ritual | Formation from the board |
|---|---|---|
| Input | PRD requirements | evidence: rows pointing at real code |
| An epic is | a user capability | **an invariant** |
| Spec flows | spec → epic → code | code → epic → **spec reconciliation** |
| Done means | the capability ships | the defect class **cannot recur** |

The spec still gets written. It is written last, not skipped — §6.

## 2. Numbering

**New feature epic** — the next integer. `Epic 9`, `Epic 10`, … Unchanged ritual: `bmad-prd`
→ direct `epics.md` append → `bmad-epic-readiness-check`.

**Improvement epic** — derived from the epic that owns it:

| Thing | Form | Example |
|---|---|---|
| Epic heading in `epics.md` | `Epic N.i<k>` | `Epic 0.i1` |
| `sprint-status.yaml` key | `epic-N-i<k>` | `epic-0-i1` |
| Story keys | `N-i<k><letter>-<slug>` | `0-i1a-build-the-guarded-call-wrapper` |

Integer epic numbers keep meaning *"a product capability"* — which is what FR coverage,
PRD traceability, and retrospectives are all indexed on. An improvement epic is visibly
derivative and sorts next to its parent.

**Which N?** The epic that owns the **mechanism**, not the one with the most symptoms. When
the mechanism is cross-cutting — a shared helper, primitive, or convention used beyond one
epic — N is **0**, per Gate 3's existing rule that cross-cutting dependencies get a
foundational story under Epic 0. Most improvement epics will be `epic-0-i<k>`; that is
expected, not a smell.

`<k>` increments per owning epic, never globally, and is never reused.

## 3. Story letters

| Letter | Role | Count |
|---|---|---|
| `a` | **The mechanism.** The one shared helper, wrapper, rule, or convention the invariant lives in. | 0 or 1 |
| `b`…`y` | **Adoption.** One per call site or surface. Small, mechanical, individually testable. | 1+ |
| `z` | **The ratchet.** Reserved. Always last. See §4. | exactly 1 |

`a` is skipped only when `bmad-epic-readiness-check` finds the mechanism already exists. An
unused `a` is legal but **must** be justified in the readiness report — the gap is the
prompt to explain it.

`z` is **specified first and built last.** Its acceptance criteria are written at formation
time, because they are what "done" means for the epic; it is implemented after adoption,
because it can only pass once adoption is complete.

## 4. The ratchet (mandatory)

> A ratchet is executable and fails when the invariant is violated.

Acceptable:

- a lint rule or type constraint that rejects the old shape at lint/compile time
- a test that fails on regression, including a repo-wide sweep test
- a check wired into an existing runner already on the path — CI, `backlog-check.py`, a
  codegen assertion

Not acceptable, and not negotiable:

- a paragraph in `project-context.md`, the PRD, or the architecture spine with nothing
  enforcing it
- a code comment, a checklist item, a retro action item
- a script that exists but no pipeline runs

**The ratchet test is the epic test.** A cluster that cannot be ratcheted is not an
improvement epic — it is a batch of fixes wearing an epic's clothes, and the whole reason
this document exists is that batches of fixes don't stop the class from returning. When a
cluster fails §5.4, route it instead:

- one sweep story under the owning epic, if the rows share a surface, or
- `bmad-quick-dev` per row, if they don't.

Both are fine outcomes. Neither gets an epic number.

## 5. Formation criteria

All five must hold. Any failure → not an epic.

1. **≥3 open rows.** Two rows are two quick-devs.
2. **One sentence states the invariant**, present tense, positive form — *"every X goes
   through Y"* — and **every member row is a violation of it.** A row that needs an "and
   also" belongs to a different cluster. Write the sentence before deciding membership; a
   cluster you can only describe as a list is a tag, not an invariant.
3. **A single mechanism can host it** — one that exists, or one buildable in a single `a`
   story. Two mechanisms means two epics.
4. **It is ratchetable**, per §4.
5. **Combined effort is worth ≥3 stories.** Three `xs` rows that share a surface are a
   sweep story, not an epic.

### Candidate generation

Signals, in ascending order of strength:

| Axis | Source | Strength |
|---|---|---|
| Shared `touches` prefix | check 7 output | weak — a generator only |
| Shared `parent` chain | `parent` field | weak |
| Shared `deferred-work.md` section / DW ids | row `note` | medium |
| Shared architecture-spine AD | `festgrid-architecture-spine.md` | strong |
| **Shared repair shape** | reading the notes and asking *"what would the fix be?"* | strongest |

**Tags are a candidate generator, never an epic boundary.** `web:events` groups rows that
share a directory and nothing else; the spec's own check-7 note already says a tag carried
by a third of the board carries no information. The epic-worthy question is not *"do these
touch the same code?"* but *"would fixing this properly once kill all of them?"*

### Rejections are recorded

A cluster that fails a criterion is written into the formation report with the criterion it
failed. Without that, the next session re-proposes it and re-litigates it from scratch.

## 6. Spec reconciliation routing

Decided per member row, at formation time, and written into the epic entry:

| The row's fix… | Route |
|---|---|
| changes user-visible behaviour or a declared PRD/spine interface | PRD amendment task carried in the `z` story |
| changes MVP scope | `bmad-correct-course` **first**; the row re-enters as a `CC` |
| establishes a new invariant | new `AD-n` on the architecture spine, written in the `a` story — not deferred to `z` |
| internal only | no PRD, no spine |

The new-`AD-n` case belongs in `a` and not `z` because the mechanism story is where the
invariant becomes real; recording it later means adoption stories are written against an
undocumented rule.

## 7. Ritual

0. **Freeze the input.** `backlog-check.py` clean. Record the date and open-row count in the
   formation report; the board moves, the report must say which board it read.
1. **Generate candidates** across §5's axes.
2. **Apply §5's criteria.** Write the formation report: accepted epics, rejected clusters
   with the failing criterion, and rows left unclustered.
3. **Draft each accepted epic**: invariant sentence, owning epic N, member row ids, story
   list `a`/`b`…/`z` with `z`'s acceptance criteria, and §6 routing per row.
4. **Re-scoring sweep** across the rest of the board, `skipped` rows included — §9.1. Late
   members join their epic here; everything else gets a `note` and is re-priced later, not
   now.
5. **Append to `epics.md`.** Never `bmad-create-epics-and-stories` — its Step 1 overwrites
   the file wholesale, the same reason Epics 6 and 7 were appended directly.
6. **Register in `sprint-status.yaml`**: `epic-N-i<k>: backlog` plus every story key.
7. **Stamp `epic:` on each member row.** Status stays `triaged` — execution ownership does
   not transfer until stories exist, per the board's one-owner rule.
8. **`bmad-epic-readiness-check`** on the epic. Gate 1/3 across all its stories at once;
   this is where `a` is validated, replaced, or dropped.
9. **`bmad-create-story`** per story in letter order. Normal promotion intake
   (`backlog-spec.md` §13) applies: story keys land on the member rows and status becomes
   derived from here on.
10. **Close out** with `bmad-epic-readiness-review`, then `bmad-retrospective`.

Sequencing across the formed epics is not decided here — it is a lens at read time, §9.3.

Steps 5–7 are one commit. `epics.md`, `sprint-status.yaml`, and `backlog.yaml` move
together or they drift, which is the failure the board was built to end.

## 8. Board contract

`backlog.yaml` gains one optional field, `epic:` — see `backlog-spec.md` §3 and checks 10
and 11 in §9. Nothing else about the board changes; `impact`/`effort` stay meaningful right
up to promotion, and lenses are unaffected.

## 9. Re-scoring and ordering

Two facts the board deliberately refuses to store — a frozen `effort`, and `priority` —
meet epic formation here.

### 9.1 A mechanism re-scores rows it did not include

`backlog-spec.md` §3 calls `effort` "a property of the work itself, so it does not move
when goals do." True, and unchanged — but it is measured **against the codebase as it
stands**, and a mechanism story landing is the one event that legitimately re-scores it. A
row that needed the whole guard now needs one call site: `m` becomes `xs`.

So every formation pass ends with a **re-scoring sweep**: for each accepted epic, read the
rest of the board — rows outside the epic, and `skipped` rows too — and flag every row whose
effort would drop if this mechanism existed. Each flagged row goes one of two ways:

| The flagged row | Where it goes |
|---|---|
| Violates the **same** invariant | Joins the epic as an adoption story (`b`…`y`). It was always a member; becoming cheap is just what made it visible. |
| A **different** invariant that happens to become cheap | Stays where it is, with a `note` naming the epic that will re-price it. Re-score its `effort` only once that epic's `a` story is `done`. |

The second rule is the load-bearing one: **re-scoring on a promise is how a board starts
lying.** `effort` tracks the code, not the plan.

### 9.2 Reopening a `skipped` row

A skip is reversible, but only for one of the two reasons a row gets skipped:

| Skip reason | When a mechanism makes it cheap |
|---|---|
| **cost** — not worth the effort | Reopen. Status back to `backlog`; append (never rewrite) a note naming the epic that changed the price. The stated reason is now false, so the decision no longer holds. |
| **value** — we do not want this | Stays skipped. Cheap is not a reason to build something nobody wants. |

This only works if the skip said which one it was, so `backlog-spec.md` §5 now requires the
note to classify itself. A skip that does not is **unreopenable by rule** — the safe
default, because the alternative is guessing at someone's past decision from its price tag.

### 9.3 Epic order is a query, not a field

Epics carry no priority field, for the same reason rows carry no `priority`
(`backlog-spec.md` §3): a stored composite is a hand-maintained derived value, it goes
stale silently, no check can detect that it has, and one scalar cannot serve two
weightings.

- **`epics.md` order is insertion order and never means priority.** §13 forbids
  renumbering, so file order is chronological by construction. It is not a plan; do not
  read it as one.
- **Execution order is produced by a lens** (`backlog-spec.md` §11) applied to member rows
  and lifted to their epics: an epic ranks by the members the active lens selects. Change
  the lens and the order changes, with no epic and no row edited — the same property that
  made lenses right for rows in the first place.
- Two constraints outrank every lens, because they are facts rather than weightings:
  1. **Within an epic**: `a` → `b`…`y` → `z`. Dependency, not preference.
  2. **Across epics**: if a member row `blocks` a row in another epic, its epic goes first.
     Already on the board — this only reads it at epic scope.

The payoff a stored priority could never have: because §9.1 re-scores rows when a mechanism
lands, an epic's rank **legitimately moves after an unrelated epic ships**. A number written
down at formation time would be wrong exactly then, and nothing would say so.

## 10. Genericity

> The observation procedure is a function of the criteria, not of the board's contents.

- No criterion, axis, or threshold may name a specific row, cluster, tag value, or a count
  taken from one day's board. §5's thresholds are expressed in row counts and effort —
  properties any board has.
- **Adding rows must not change how existing rows are read.** A bigger board has exactly
  three sanctioned effects: a new row joins a cluster; a previously rejected candidate
  crosses criterion 1 or 5; or a new row reveals a broader invariant that subsumes two
  narrower ones. The third is real and allowed, but it is a **merge** and must be declared
  as one in the formation report — never applied silently.
- Delaying the formation pass is about having the full input present for a single run. It
  is **not** about tuning the method on more data. A method that needs the data to be tuned
  is not a method; it is a fit to one board, and it will re-fit itself every time the board
  moves.

§5's rejection records are what make this checkable: a candidate that was rejected under
criterion 1 and later accepted is visibly a threshold effect rather than a changed reading.

## 11. Stability test

§10 is a claim. This is how it gets tested, and it is cheap enough to be worth doing before
trusting any formation pass.

1. **Full run.** Cluster the whole open set. Record accepted epics, rejected candidates
   with their failing criterion, and unclustered rows.
2. **Ablation runs, ≥2.** Repeat the observation on subsets: one dropping ~25% of rows at
   random, one dropping a single member from each accepted cluster. Each ablation run is
   **blind** — a fresh context given only its subset and this document, never the full
   run's output. A run that can see the previous answer confirms it; it does not test it.
3. **Compare on the intersection** — the rows present in both runs.

| Difference between runs | Verdict |
|---|---|
| A row is unclustered in the subset because its cluster fell below criterion 1 or 5 | allowed — threshold effect |
| The invariant is worded differently but partitions the same rows | allowed — wording variance |
| A row moves from one invariant to another | **fail** |
| A cluster splits, or two merge, with no new row causing it | **fail** |
| A row's §6 spec-reconciliation routing changes | **fail** |

The test measures **membership, not prose.** Clustering is an LLM judgment and the same
invariant will be worded differently on different runs; that is variance, not instability.

**On failure:** the affected cluster's invariant sentence is describing its members rather
than stating a rule — criterion 2 — because a rule does not change when unrelated evidence
is added or removed. Rewrite the sentence or drop the cluster. Do not resolve a flip by
keeping whichever run's answer reads better; the disagreement is the finding.

Run it once before the first formation pass, and again whenever a criterion in this
document is edited — a change to the method is the only thing that is *supposed* to change
the output.

## 12. Tooling — specified, not yet built

`backlog-check.py --cluster`: emit candidate groupings across §5's four mechanical axes
(tag prefix, `parent` chain, shared `deferred-work.md` section, shared AD reference) as
input to a reading pass. Those axes are already fully specified here and are
item-independent, so the tool only saves the reading pass from recomputing them by hand —
nothing about the method depends on it existing, which is §10's point applied to its own
tooling. Build it whenever convenient, before or after the board grows. The fifth axis,
repair shape, is not mechanizable and stays a reading pass permanently.

## 13. Do not

- Do not form an epic that has no ratchet. §4 is the admission test, not a formality.
- Do not use a `touches` tag as the epic boundary.
- Do not run `bmad-create-epics-and-stories` — it overwrites `epics.md`.
- Do not renumber an existing epic to make room. `<k>` and `N` are both append-only.
- Do not move member rows to `promoted` at formation. Only stories do that.
- Do not re-verify the member rows' findings at formation time. The board records that a
  finding exists; formation groups them. A second opinion on each is a different pass.
- Do not tune a criterion to make a particular cluster come out. If a criterion is wrong it
  is wrong for every board, and §11 must be re-run after the edit.
- Do not run an ablation in a context that has seen the full run's output. §11 step 2.

## 14. Status

No formation pass has been run and no stability test has been run. This document defines
the method only — no clusters have been proposed, and no rows carry `epic:` yet.
