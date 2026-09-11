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
| An epic is | a user capability | **an invariant**, or a capability the board shows gaps in (§2's two axes) |
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

### Formation is not only for improvement epics

Two *features* that need the same mechanism cluster on the same evidence, by the same
criteria — an `idea` or `proposal` row is board input like any other.

**Kind is set by the driving rows, not by unanimity.** A row of another type may be a member
whenever it violates the same invariant or fills a gap in the same capability; it does not
flip the epic's kind. One `proposal` inside a bug-driven cluster leaves it an improvement
epic (ruled 2026-09-08 for IDEA-011 in `epic-0-i5`). The observation is
identical; only the outputs differ:

| | Improvement epic | Feature epic formed this way |
|---|---|---|
| Number | `N.i<k>` | the next integer |
| Rows | `bug`, `finding` | `idea`, `proposal` |
| The invariant is | a rule the code violates | the mechanism both features need |
| Ratchet `z` | mandatory | **optional** |
| Spec | §6 routing | **`bmad-prd` first** — a new capability needs requirements before stories, and formation does not replace that |

`z` is optional because a feature epic's done-test is that the capability ships, not that a
class cannot recur — which is also why check 11 exempts integer epics. Add one anyway when
the epic's whole justification is the shared mechanism: it stops the second feature quietly
forking the first one's helper, which is the failure that made the epic worth forming.

Criterion 4 (ratchetable) therefore cannot be the admission test here. **Its replacement is
criterion 3's feature form (§5), not a stricter reading of its mechanism form** — see the
correction below.

### Two axes, and the error of using one for both

**Corrected 2026-09-08.** This section previously said criterion 3 "takes its place and is
read strictly." That was wrong, and it was measured wrong: after the first formation pass,
`internal` rows clustered at 64% and `latent` at 60%, while **`user-visible` clustered at
30%** — 14 of 20 left out, 8 of them `idea` rows. Requiring a shared *mechanism* set a
higher bar for exactly the work a user can see.

The cause is that a shared mechanism is an **implementation** predicate. Internal and latent
defects *are* mechanism problems, so they cluster on it naturally. Features are outcome
problems: two of them can share no mechanism at all — a quota guard, a trigger, a status
display — while being one thing to the person using the product.

| | Improvement epic | Feature epic |
|---|---|---|
| The sentence states | an **invariant** — *every X goes through Y* | a **capability**, from the user's side — *a subscriber sees events from a new account without waiting for the daily batch* |
| Members are | violations of it | **gaps** in it |
| Cohesion is | one **mechanism** can host it | one **journey** can host them |
| Done means | the class cannot recur (ratchet) | the capability ships |

**Never apply the mechanism test to a feature cluster.** That is the specific error this
correction removes. Ask instead whether the members are steps or facets of one journey.

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

**The ratchet test is the epic test** (for improvement epics — a feature epic formed by
clustering is governed by criterion 3 instead, §2). A cluster that cannot be ratcheted is not an
improvement epic — it is a batch of fixes wearing an epic's clothes, and the whole reason
this document exists is that batches of fixes don't stop the class from returning. When a
cluster fails §5.4, route it instead:

- one sweep story under the owning epic, if the rows share a surface, or
- `bmad-quick-dev` per row, if they don't.

Both are fine outcomes. Neither gets an epic number.

## 5. Formation criteria

### The input set

> Formation reads **un-built intent, wherever it is recorded.**

| Source | In? | Because |
|---|---|---|
| `backlog.yaml` rows at `backlog` / `triaged` | yes | the obvious case |
| `sprint-status.yaml` stories at `backlog` / `ready-for-dev` | **yes** | a story nobody has started is a requirement that happens to already have a story file. Nothing is built; the design is still open. |
| `sprint-status.yaml` stories at `in-progress` / `review` / `done` | no | code exists. A problem with it is a `bug` or `finding` row, not an input to clustering. |
| `skipped` rows | only via §9.2's sweep | a `cost:` skip can rejoin; a `value:` skip cannot. |

Excluding unstarted stories was the original error: a requirement recorded as
`3-6l-extract-events-from-multi-image-carousel-posts…` and one recorded as an `IDEA` row
are the same kind of thing, and reading only the board means two framings of one problem
never meet. Rival *designs* for the same work are the specific damage — each looks
reasonable alone, and building either strands the other.

**When an unstarted story joins a cluster it keeps its key.** Story keys are stable like row
IDs (§13 forbids renumbering). It becomes an adoption story under the new epic, or — when a
sibling supersedes it — goes `wont-do` with a note naming its replacement. Its execution
state stays owned by `sprint-status.yaml` throughout; the epic only re-parents it. Record
the absorption in the formation report: an unstarted story that silently changes epics is
the drift this whole board exists to prevent.

**A board row an epic answers is absorbed differently.** It is *answered*, not replaced, so
`superseded_by` is the wrong vocabulary — reserve that for a row superseded by another row.
The absorbed row carries `epic: <key>`, and when the story that answers it exists, that story
key joins the row's `stories`; the row then derives to `promoted` and closes with the epic
through §5's ordinary mechanism. It needs no adoption story of its own when it is the rule
the mechanism implements rather than a symptom of its absence.

### The criteria

All five must hold. Any failure → not an epic.

Criteria 2 and 3 have a form per axis (§2). Pick the axis from what the cluster is about —
a defect class or a user-facing capability — then apply that column and no other.

1. **≥3 open rows.** Both axes. Two rows are two quick-devs.
2. **One sentence, written before membership is decided.** Both axes; the forms differ.
   - *Improvement:* the **invariant**, present tense, positive — *"every X goes through Y"* —
     and every member row is a **violation** of it.
   - *Feature:* the **capability**, present tense, from the user's side — *"a subscriber sees
     events from a new account without waiting for the daily batch"* — and every member row
     is a **gap** in it.
   Either way, a row needing an "and also" belongs to a different cluster, and a cluster you
   can only describe as a list has failed this criterion.
3. **Cohesion.**
   - *Improvement:* **a single mechanism can host it** — one that exists, or one buildable in
     a single `a` story. Two mechanisms means two epics.
   - *Feature:* **a single journey can host them** — shipping the members separately leaves
     the capability *visibly incomplete to a user*. If any member can ship alone and a user
     gets the whole outcome, it is not a member.
4. **It is ratchetable**, per §4. **Improvement epics only, and mandatory there.** Feature
   epics are not required to ratchet (§2); criterion 3's feature form is what guards them
   against inflation, and that guard is falsifiable — name the user who is left with an
   incomplete outcome, or drop the member.
5. **Combined effort is worth ≥3 stories.** Both axes. Three `xs` rows that share a surface
   are a sweep story, not an epic.

### Candidate generation

**Generation is per axis, and the two axes need different generators.** This is separate
from §2's correction to the *criteria*. Getting criterion 3 right only decides what passes;
it cannot admit a cluster the generator never proposed.

**Improvement axis** — signals in ascending order of strength:

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

**Feature axis** — none of the above will find one, and this is why:

Every improvement signal is a proxy for *implementation proximity*. `touches` is a
directory. `parent` is capture history. An AD is a mechanism. "Shared repair shape" asks
what the fix would be. A journey is none of these — two rows can serve one capability while
sharing no tag, no parent, no AD and no repair shape at all, which is exactly what §2 says
about features.

So the feature axis needs its own generator, run as a **separate pass**, not as a second
reading of groups the mechanical axes produced:

| Axis | Source |
|---|---|
| Shared PRD capability or section | the PRD — which capability does this row fill a gap in? |
| Shared user journey | `EXPERIENCE.md` — which journey does a user hit this in? |
| Shared surface *from the user's side* | the screen or flow, not the component tree |

Read every open `idea`/`proposal` row against these, and ask of each: **which capability
does this fill a gap in, and does another row fill a gap in the same one?** Rows that share
an answer are a candidate. Their `touches` sets may be disjoint; that is not evidence
against them.

**Measured 2026-09-11.** Before this section existed, a pass over 41 rows generated three
feature-axis candidates, and all three arrived via a `parent` chain or a tag group — the run
reported, accurately, that it *"did not independently sweep `idea`/`proposal` rows asking
what journey does this serve."* It had no reason to: the only generators this document gave
it were mechanism-shaped. The sieve had the right holes and the wrong hopper.

Run the two generation passes independently and record the candidate count from each. One
pass producing zero candidates is a finding about the board; producing zero because nothing
generated any is a finding about this document.

### Rejections are recorded

A cluster that fails a criterion is written into the formation report with the criterion it
failed. Without that, the next session re-proposes it and re-litigates it from scratch.

### Every open row gets a disposition

**Added 2026-09-11.** A formation report that lists only what clustered makes its own blind
spot invisible. The first pass left 14 of 20 `user-visible` rows out and reported them as an
undifferentiated tail, so the 30%-vs-64% gap was found by counting the board afterwards
rather than at the checkpoint where it could have been argued.

So: **every open row appears exactly once** — inside an accepted epic, or in the unclustered
list under a named next action. Not "the rest"; a route. Assert the arithmetic in the report
(`accepted members + unclustered = open rows read`) and stop if it does not balance, because
a row in neither set has been silently dropped.

| Disposition | When | What happens next |
|---|---|---|
| `quick-dev` | genuinely standalone, and small — `xs`/`s` | `bmad-quick-dev`, any time |
| `promote` | genuinely standalone but `m`/`l`, so it needs a story, not a patch | `bmad-create-story` under the epic that owns the surface |
| `adopt: <epic>` | violates an **already-formed** epic's invariant | added as an adoption story under that epic |
| `sweep: <epic>` | shares a surface with an epic but is not epic-worthy itself (criterion 5) | one sweep story under the owning epic |
| `reprice_on: <epic>` | not worth doing at today's price; a pending mechanism changes that price | re-examined when that epic lands (§9.1) |
| `carve-first` | the row bundles more than one concern, so only part of it is a member | split into `parent` + children, then re-read |
| `spec-first` | cannot be sized until a PRD or UX decision exists | `bmad-prd` / `bmad-ux`, then back to the board |
| `blocked: <what>` | waiting on infrastructure or an external dependency | nothing now; the note names the dependency |
| `stays-skipped` | a `value:` skip §9.2 does not reopen | nothing, no matter how cheap it becomes |

**Group by disposition, and inside each group sort by `impact`** — `compliance` and
`user-visible` first. A flat list buries the rows whose absence is most worth questioning,
which is precisely how the first pass's bias survived its own checkpoint.

`quick-dev` is a legitimate answer and usually the commonest one. A singleton is not a
formation failure; forcing it into an epic is. What the report must not do is reach that
answer silently.

**`quick-dev` and `promote` split on `effort`, not on merit.** Both mean *this row stands
alone*; they differ only in whether that row is a patch or a story. §3's scale already draws
the line — `xs` is "one file, one edit, no story needed" and `s` is "one story" — so a row at
`m` (2–4 stories) or `l` routed to `bmad-quick-dev` is being sent somewhere that cannot hold
it. Added 2026-09-11, after the disposition table shipped with `quick-dev` as the only
standalone route and several `m` rows landed there.

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

0. **Freeze the input.** `backlog-check.py` clean. Record the date, the open-row count, and
   the unstarted-story count (§5's input set spans both files) in the formation report; both
   move, and the report must say which state it read.
1. **Generate candidates** across §5's axes.
2. **Apply §5's criteria.** Write the formation report: accepted epics, rejected clusters
   with the failing criterion, and every unclustered row under a disposition from §5's
   table, grouped by disposition and sorted by `impact` within each group. The report
   balances: accepted members + unclustered = open rows read.
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
| A **different** invariant that happens to become cheap | Stays where it is, carrying `reprice_on: <epic key>`. Its `effort` is re-scored only once that epic's `a` story is `done`. |

The second rule is the load-bearing one: **re-scoring on a promise is how a board starts
lying.** `effort` tracks the code, not the plan.

**A member row is re-scored at formation. A non-member row waits.** The difference is not
timing, it is whether anything binds the row to the mechanism. A member's `a` story is a
committed prerequisite *inside the same epic*: if `a` never lands, the adoption story never
lands either, so the estimate is conditional on the same unit of work rather than on a
promise made elsewhere. A non-member is bound to nothing — the epic it is waiting on may be
dropped, and it would sit there carrying a price for a mechanism that never existed.

This is also what makes the re-scoring *decidable at formation*, which it has to be:
criterion 5 sizes the epic from its members' effort, and the decision to reopen a skipped
row is a value-for-price judgment that cannot be made without the new price. Record it as
post-mechanism effort in the formation report, not just as a changed field.

**One loop to close:** `bmad-epic-readiness-check` (ritual step 8) is what validates that
`a` is real and buildable as one story — and it runs *after* formation. If it drops or
reshapes `a`, every member row re-scored at formation must be re-examined, and a row that
was reopened only because of the promised price goes back to `skipped` with the reason
appended.

**Nothing re-prices itself.** `effort` is a judgment about size; no runner can decide that
`m` became `xs`. What the runner can do is notice the row is *due* — check 13 flags any row
whose `reprice_on` epic has landed its `a` story, and keeps flagging it until someone
re-scores `effort` and clears the field. So you run no special command: the flag appears in
the next `backlog-check.py` / `bmad-sprint-status` you were going to run anyway, and the
lenses keep reading the old `effort` until you act — which is correct, because a lens
ranking on a value nobody has confirmed is a lens that lies. The pending flag is the honest
intermediate state, not a delay to engineer away.

Epic **order**, by contrast, needs no trigger at all: §9.3 computes it at read time, so the
moment a re-score lands the next lens read already reflects it. There is no stored order to
update and no command to run.

### 9.2 Reopening a `skipped` row

Most real skips are **both** cost and value — *the value did not justify that price.* A
reason shaped like that is relative, and a price change falsifies it. So the classification
is not a vocabulary choice between two pure motives; it is one question:

> **Would you do it if it were free?**

| Answer | Tag | When a mechanism makes it cheap |
|---|---|---|
| **yes** | `cost:` | Reopen. Status back to `backlog`; append (never rewrite) a note naming the epic that changed the price. The stated reason referenced the price and dies with it. This is where "worth doing, just not for that effort" belongs — the common case, not an edge one. |
| **no** | `value:` | Stays skipped. Cheap is not a reason to build something nobody wants, and a cheaper version of a thing you chose against is still the thing you chose against. |

The question is decidable in one beat and needs no re-litigation of the original debate,
which is what makes it safe to answer years later by someone who was not there.

This only works if the skip recorded the answer, so `backlog-spec.md` §5 now requires the
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

### Record the model, and hold it fixed

Every run — full and ablation — records which model produced it. Two verdicts compared a
week apart are otherwise guesswork.

**The control: a full run and its ablations must use the same model.** Mix them and the test
stops answering its own question — a membership flip could be instability in the method or
disagreement between two models, and nothing in the output distinguishes them.

That control is also what turns this into a **model-fitness experiment**, which is a
different question worth asking: *can a cheaper model drive formation at all?* Run the whole
test twice, wholly on each model, and compare the two verdicts.

| Both stable | The method is generic and the cheaper model can drive it. Any per-step model split is over-cautious. |
| Cheap unstable, strong stable | The model is the constraint, not the method. Keep the strong model on the steps §12 names. |
| Both unstable | The method is at fault, not the model. Fix the invariant sentences before spending anything on either. |

The third row is why the experiment is worth running before trusting a first pass: a bad
result on the cheap model is not automatically a reason to buy a better one.

**On failure:** the affected cluster's invariant sentence is describing its members rather
than stating a rule — criterion 2 — because a rule does not change when unrelated evidence
is added or removed. Rewrite the sentence or drop the cluster. Do not resolve a flip by
keeping whichever run's answer reads better; the disagreement is the finding.

### What this test does not detect

**A cluster nobody proposed.** A miss appears in neither run, so it can never show up as a
difference. The ablation measures the stability of what was found, not the completeness of
the finding — which is the opposite of what its cost suggests, and worth stating plainly
before anyone reads a "stable" verdict as "nothing was missed".

It also does not replace §7 step 4. The failure it detects — an invariant that describes its
members rather than stating a rule — is the same one a human catches by trying to say *"so
anything that does X is a bug"* and finding they need a caveat. You are the cheaper detector,
and you are in the loop anyway.

### So when is it worth the tokens

Every run re-reads the whole input set, so the cost scales with the board. Spend it
deliberately:

| Situation | Do |
|---|---|
| First formation pass, clusters read cleanly at step 4 | **skip it.** Step 4 already did the work. |
| A cluster you could not confidently restate as a rule, but did not want to drop | one blind ablation dropping a member of *that* cluster |
| A criterion in this document was edited | one ablation — the method changed, which is the only thing that should change the output |
| Choosing whether a cheaper model can drive formation | drive a real pass on it and judge at step 4; that answers it for free |
| A formation pass you intend to trust without a step-4 review | the full matrix — but reconsider skipping the review instead |

The full-matrix run in §11 is the expensive end of that table, not its default. The minimum
useful form is **one full run plus one ablation**, and the full run is not overhead — it is
the formation pass you were going to do anyway.

## 12. Running it

| Step | Belongs to | Because |
|---|---|---|
| checks 1-13, candidate axes, lens ranking | `scripts/backlog-check.py` | a rerun must produce the identical answer |
| the invariant, the criteria, the sweep, the epic entry | `bmad-form-epics` | it needs a reading pass |

The split is `backlog-spec.md` §9's rule one level up: mechanical work goes to the committed
runner because a re-derived check reports "clean" on a broken board, and judgment stays out
of the script because a scripted judgment is fake precision.

**`backlog-check.py --cluster`** emits candidate groupings across §5's four mechanical axes
(tag prefix, `parent` chain, shared `deferred-work.md` section, shared AD reference), plus
the `cost:`-skipped rows §9.2's sweep reads. Groups larger than six are reported as too
broad to be candidates — on the 2026-09-05 board that is `app:backend` (15), `web:events`
(14) and `pkg:ui` (11), which is this document's tag claim measured rather than asserted.
The fifth axis, repair shape, is not mechanizable and stays a reading pass permanently.

### Which steps need the stronger model

Split by **failure visibility**, not by difficulty. A step whose errors reach the human
checkpoint is safe on a cheaper model, because you catch them there. A step whose errors are
*silent* is not, because nothing downstream detects an omission.

| Step | If it goes wrong | |
|---|---|---|
| §7 step 1 freeze, 5 draft, 7 write, 8 report | the runner, the checks, or you catch it | cheaper model |
| §7 step 3 criteria and invariant sentence | **you attack it at step 4** — that is what the checkpoint is for | cheaper model |
| **§7 step 2 reading pass** | **silent — you cannot attack a cluster that was never proposed** | stronger model |
| **§7 step 4 (ritual) re-scoring sweep** | **silent — a row never flagged is never re-priced** | stronger model |

So the economical arrangement is inverted from the usual: a cheap driver that spawns the two
silent-failure passes as stronger-model subagents. Both passes are bounded — one read over
the input set, once — so the expensive part stays small.

None of this is settled until §11's model-fitness experiment says so. Until then it is a
prudent default, not a measurement.

**`bmad-form-epics`** owns execution order, the human checkpoint at ritual step 3, and the
blind subagent structure §11's ablation needs. It carries none of this document's rules —
it cites them. A skill that copied the criteria would be a second copy to drift, which is
the failure the board exists to prevent. The reason it is a skill at all rather than a
prompt is §10: a procedure that varies with how it was asked for that day is not generic.

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

No formation pass has been run and no stability test has been run. The method, the runner
support (§12) and the skill are in place; no clusters have been proposed, and no rows carry
`epic:` or `reprice_on` yet.
