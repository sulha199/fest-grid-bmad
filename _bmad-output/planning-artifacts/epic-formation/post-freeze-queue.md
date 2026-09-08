# Post-freeze queue — board changes deferred until the formation pass lands

**Created:** 2026-09-07
**Why this file exists:** the board is frozen for the in-flight formation pass
(49 open rows + 5 unstarted stories). Every item below changes `backlog.yaml` or
`backlog-spec.md`, so recording them as backlog rows now would mutate the frozen
input. They live here until the pass is committed, then get raised as rows and
triaged normally.

---

## 1. Global ID counter (agreed, forward-only)

**Problem, two layers.** The shallow one is lookup: `BUG-022` and `FIND-022`
both exist, so a bare number identifies nothing. The deeper one is that
`backlog-spec.md` §4 makes the ID immutable while `type` stays mutable — *"If an
item is reclassified, the `type:` field changes and the ID does not. A stale
prefix is cosmetic."* So the ID encodes a mutable field into an immutable key,
which is the one place this board breaks its own rule (no stored `priority`,
derived `status`, `effort` re-scored against the code).

**Decision.** Keep the typed prefix; make the number global. The next row takes
the next number regardless of type — `BUG-050`, `IDEA-051`, `FIND-052`. A bare
number then identifies exactly one row, the prefix stays useful at a glance, and
its staleness is already accepted as cosmetic.

**Forward-only. Do not renumber.** A renumber breaks `ref` chains, `parent`,
`blocks`, `superseded_by`, notes citing IDs, story files, commit messages, and
the formation report itself — and §4's immutability rule exists to prevent
exactly that. High cost, cosmetic gain.

**Work items**
- `backlog-spec.md` §4: state the global-counter rule and that it applies to IDs
  issued from that date forward.
- New check: a new-format ID's number must be unique across all types.
- `backlog-check.py --find <n>`: list every row whose number is `<n>`, across
  types. This is what actually kills the legacy ambiguity — the migration never
  will, because old IDs keep their numbers forever.

---

## 2. Atomic rows: enforce at triage, and make fractional membership illegal

**The evidence is from the 2026-09-07 formation pass itself.** Counted from its
Step 4 output, **eight rows were used fractionally** — FIND-015 (*"lint-gate
sub-scope only"*), FIND-017 (*"IAM-grant sub-scope only"*), FIND-006 (*"bundles
a second, unrelated defect… residual on the row"*), and FIND-018, BUG-011,
FIND-022, FIND-016, FIND-010 as *"fractional halves"*.

Two rejections were **caused** by it:
- *Typed error contract* — failed criterion 1 at *"only 1 unambiguous member"*,
  while FIND-018, BUG-011 and FIND-022 each carried a piece of it.
- *Test-clock/timezone* — *"only 2 clean members"*, with FIND-016 fractional.

So non-atomic rows do not merely make reading harder. **They suppress epics that
the evidence supports**, by starving criterion 1 of clean members.

**Where to enforce — not at capture.** §10 says *"Capture is cheap by design — a
row is one line"*, and cheap capture is what stops things being lost. Splitting
at capture taxes the wrong step.

**Triage is the right step.** §10's triage already says *"Set `type`, sharpen
`touches`, and either promote or skip."* Add: **split a multi-concern row into a
`parent` plus child rows.** §6's carve-out machinery already does this; today it
is only required at promotion.

**And the enforceable half — fractional membership becomes illegal.** In
`epic-formation-gate.md` §5: when the reading pass can take only *part* of a row,
that row must be carved into children before any part of it can be a member. The
run already detects these; it flags them as residuals instead of stopping. Turn
the flag into a stop, and criterion-1 counts rise on their own.

**Not mechanically checkable, and do not fake it.** A tag-count proxy (many
`touches` ⇒ multi-concern) produces false positives: FIND-022 legitimately spans
many areas for one concern. The real test — *does the fix have one shape?* — is
criterion 2 one level down, and stays a reading pass.

---

## 3. Archiving terminal rows — not yet, and it will not help formation

**Measured 2026-09-07:** 76 rows, of which 8 are terminal (6 `done`, 1 `skipped`,
1 `superseded`) — about 10%. At §3's ~30 tokens/row the whole board is ~2.6k
tokens, against the ~35k of `sprint-status.yaml` that motivated a separate file
in the first place.

**It would not make formation cheaper.** `--cluster` and the reading pass already
filter to open rows, so archiving terminal ones changes formation's cost by
nothing. The benefit is a human scrolling the file — real, but smaller than it
looks.

**It adds a failure mode.** Checks 6 (orphan child of a `done` parent), 9 (blocks
a terminal target) and §5's derived status all need terminal rows present, so the
runner would have to load both files, and a row archived while something still
references it becomes a new class of broken link.

**Trigger, not a date.** Revisit when terminal rows exceed half the board, or the
file passes ~10k tokens. When it happens: one logical board across two files
(`backlog.yaml` + `backlog-archive.yaml`), the runner loads both, checks
unchanged, and an archived row is never edited again.

---

## 4. Gate gaps the 2026-09-07 pass exposed in §2 and §5

Both surfaced as the run correctly refusing to guess, which is the checkpoint
working — but they are defects in the document, not in the run.

**§2's kind rule reads as forbidding mixed membership.** *"A cluster of
`bug`/`finding` rows is an improvement epic… A cluster of `idea`/`proposal` rows
is a FEATURE epic"* was written to say what determines an epic's **kind**. The
run read it as a membership constraint and therefore could not make IDEA-011 a
member of `epic-0-i5`. Fix: state that kind is set by the **driving** rows, and
that a row of another type may be a member when it violates the same invariant.

**§5's absorption rule only covers stories.** *"When an unstarted story joins a
cluster it keeps its key"* is written for `sprint-status.yaml` stories and says
nothing about a board row that an epic answers. Fix: a board row absorbed by an
epic carries `epic: <key>`, and when the story that answers it exists, that story
key joins the row's `stories` — so the row derives to `promoted` and closes with
the epic through the ordinary §5 mechanism. It is **answered, not replaced**, so
`superseded_by` is wrong for this case; reserve that for a row another *row*
supersedes.

Ruled this way for the in-flight pass (IDEA-011 → `epic-0-i5`, no adoption story
of its own, `a` settles the apply-on-change question). The document should be
amended to match rather than leaving the next pass to re-derive it.

**Ninth fractional row.** FIND-011 belongs in `epic-0-i6` on merit — unused props
and an unscaled variant on `SubscribedAccountCard` are prop-contract defects on
the exact card the invariant governs — but it also covers `EventDetailView`,
outside the card. It is a carve candidate under item 2 above, bringing the
fractional count from the pass to nine.
