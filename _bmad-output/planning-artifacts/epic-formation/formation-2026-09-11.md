# Epic Formation Pass — 2026-09-11 (completing the Step-4-stalled run)

**Method:** `epic-formation-gate.md` §5/§7. **Skill:** `bmad-form-epics`.
**Frozen input:** `bec358b` (per checkpoint item 4's re-freeze). 41 open unclustered rows + 5
non-epic unstarted stories (untouched by this pass — no candidate below draws on them) + IDEA-004
(re-score sweep only, untouched). The seven 2026-09-08 epics are settled and out of scope.
**Session:** fresh context, per checkpoint's own instruction — does not inherit the stalled run's
commitment to its conclusions, only its written-down reasoning.
**Scope:** gate ritual **Steps 2–4 only**. No writes to `epics.md`, `sprint-status.yaml`, or
`backlog.yaml`. This file is the record; nothing downstream has been touched.
**Inputs read, in the order specified:** `checkpoint-2026-09-11.md` (in full), `epic-formation-gate.md`
§5 (in full), `backlog.yaml` (all 41 in-scope rows), PRD §3 (`prd.md`, all of Features), and both
`EXPERIENCE.md` files.

---

## 0. What this pass inherits vs. what it does

**Inherited, not re-derived (per checkpoint):**
- The seven 2026-09-08 epics.
- The improvement-axis rejection table (checkpoint §4) — 7 named clusters + 5 dead-on-arithmetic.
- Two accepted improvement-axis epics from the stalled run, both carrying human rulings:
  **`epic-1-i1`** (was "Epic 9") and **`epic-0-i7`**.
- `BUG-025 → carve-first`, `IDEA-001 → skipped (value)`, `IDEA-006 → blocked`, `IDEA-008 → promote`.
- Two feature-axis clusters already correctly proposed and rejected: **IDEA-020/021/022** and
  **IDEA-008+IDEA-009**.

**Done this pass (the four owed items):**
1. The feature-axis generation sweep — genuinely run for the first time, over all 19 idea/proposal
   rows, against PRD capability and `EXPERIENCE.md` journey.
2. The BUG-010+BUG-013+FIND-009 candidate — assembled and tested against a stated sentence.
3. `cross:prd` and `pkg:domain` — read in full.
4. The 19-row `quick-dev` bucket — re-split on effort into `quick-dev` (xs/s) and `promote` (m/l).

---

## 1. Candidate counts — reported separately, per §5's requirement

| Axis | Candidates generated this pass | Accepted | Rejected | Note |
|---|---|---|---|---|
| **Improvement** | 3 (BUG-010+BUG-013+FIND-009; `cross:prd`; `pkg:domain`) | 0 | 3 | These are the three items this session owed. The axis's earlier work (2 accepted: `epic-0-i7`, `epic-1-i1`; 12 rejected across the stalled run + 2026-09-08) is inherited, not re-run. |
| **Feature** | 0 | 0 | 0 | Reported as **zero from a genuine sweep** — every capability sentence was written and every one of the 19 rows was checked against the other 18 for a shared answer. This is a finding about the board (§1 below), not about the method: the sweep ran and is shown in full in §2. |

**Which is being reported:** the feature-axis row is *zero because a real sweep ran and found none* —
not zero because nothing generated any (that was the pre-2026-09-08-amendment failure mode; this
pass is the corrected generator, run properly). Confirmed via the per-row capability table in §2:
every one of the 19 rows got an explicit capability/journey sentence and an explicit reason no
partner shares it.

---

## 2. Feature-axis sweep — full detail

Read against PRD §3 (Features) and both `EXPERIENCE.md` files. For each row: which capability
sentence does it fill a gap in, and does another of the 19 share that answer?

| Row | Capability the row fills a gap in | Shares with another row? | Disposition this pass |
|---|---|---|---|
| IDEA-001 | PRD 3.7 multi-image extraction completeness | No — rival design to story `3-6l`, not a capability gap another row shares | **Settled: skipped (value)**, per human ruling. Not re-litigated. |
| IDEA-002 | None — cosmetic rebrand, not a PRD capability | No | Singleton — see §4 |
| IDEA-003 | PRD 3.6 Calendar View — mobile multi-day rendering | No other idea/proposal row touches calendar multi-day rendering | Singleton — see §4 (flag: `EXPERIENCE.md`'s "Mobile Multi-Day Calendar Spanning" section, added 2026-08-24, already specifies exactly this behavior in full; worth checking against that section before drafting a story, since the "no UX design exists yet" premise in the row's own note may be stale — **not acted on**, freeze holds) |
| IDEA-005 | PRD 3.7 "Personalized Reminders" / push-notification-adjacent image performance | No other row touches push-notification-triggered caching | Singleton — see §4 |
| IDEA-006 | PRD 3.17 Self-Service Account Claim | No | **Settled: blocked** (epics.md Epic 8), per human ruling |
| IDEA-008 | PRD §6 subscription cap | Yes — IDEA-009 (see below) | **Settled rejected** (checkpoint, correctly, criterion 3 — ships complete value alone). Disposition now `promote` (spec resolved) |
| IDEA-009 | PRD 3.7/3.11 subscription onboarding — auto-extract + wizard redirect | Considered against IDEA-008 (settled reject) and against IDEA-010 (see below) | **Settled rejected** with IDEA-008. Checked against IDEA-010 fresh this pass: different gaps in different capabilities — IDEA-009 is "a new subscriber sees their events without waiting for the daily batch," IDEA-010 is "Post Selection accurately shows account scrape status." Shipping IDEA-009 alone delivers its whole outcome regardless of IDEA-010 — criterion 3 fails, not a candidate. |
| IDEA-010 | PRD 3.10 Manual Post Selection — Inactive Account Handling | No (checked against IDEA-009, rejected — see above) | Singleton — see §4 |
| IDEA-012 | PRD 3.4/4.1 Event Details Centralization | No other row extends the event-detail info set | Singleton — see §4 |
| IDEA-013 | None — scraper-ops observability, not a user-facing PRD capability | Fails criterion 2 outright (no capability sentence "from the user's side" exists) | Singleton — see §4 |
| IDEA-015 | None — internal cost/latency research task | Fails criterion 2 outright | Singleton — see §4 |
| IDEA-016 | PRD 3.16 display minimization — calendar-row thumbnail/fallback | Yes — IDEA-017 (both feed the same `event_card_*` primitive) | **Already committed**: member of `epic-1-i1` (improvement axis, per human ruling — the "Epic 9" feature candidate this pair originally formed was overruled to an invariant cluster with BUG-023/FIND-023). Not available to re-propose as a feature cluster. |
| IDEA-017 | PRD 3.16 display minimization — masonry thumbnail/fallback | Yes — IDEA-016 | Same as above — `epic-1-i1` member. |
| IDEA-018 | None — webhook-token entropy, an internal security hardening item | Fails criterion 2 outright | Singleton — see §4 |
| IDEA-019 | PRD 3.1 FilterHub — temporal filter | No other idea/proposal row touches discovery filtering | Singleton, but shares a **surface** (not a journey-capability) with `epic-0-i5` — **already ruled**: `sweep: epic-0-i5` |
| IDEA-020 | PRD 3.16/event detail — Instagram embed performance (broad) | Yes — split into IDEA-021, IDEA-022 | **Settled rejected** (own notes: both splits independently shippable) |
| IDEA-021 | Same as IDEA-020 (the `omitscript` sub-fix) | Yes, same cluster | **Settled rejected** — "could be picked up on its own ahead of IDEA-020's larger questions" |
| IDEA-022 | Same as IDEA-020 (the query-split sub-fix) | Yes, same cluster | **Settled rejected** — "no open design questions left" |
| IDEA-023 | PRD 3.3/3.7 location — event-detail map-link trust | Its producer-side counterpart is BUG-027 (a `bug`, not scoped to this idea/proposal-only sweep) | **Already committed**: member of `epic-0-i7` (improvement axis, per human ruling). Not available to re-propose. |

**Result: zero new feature-axis clusters.** Every row either (a) is already committed to an accepted
improvement-axis epic (`epic-1-i1`: IDEA-016/017; `epic-0-i7`: IDEA-023), (b) is already a
correctly-rejected feature cluster (IDEA-020/021/022; IDEA-008+IDEA-009), (c) is disposed of by an
explicit human ruling (IDEA-001 skipped, IDEA-006 blocked), or (d) is a genuine singleton — no other
of the 19 rows answers the same capability sentence, including three (IDEA-013, IDEA-015, IDEA-018)
that fail criterion 2 immediately because they have no PRD capability at all — they are internal/ops
rows, not feature material on either axis.

**This is a finding about the board, not the method.** The board's `idea`/`proposal` rows each tend to
close out a complete, independently-shippable slice of their PRD section (own notes repeatedly say
"no open design questions left" / "independently shippable" / "delivers the whole outcome"), which is
consistent with how this board's intake works — most ideas arrive already scoped to one gap, not as
partial slices of one journey.

---

## 3. The three owed reading passes

### 3a. BUG-010 + BUG-013 + FIND-009

**Sentence tested:** *every rendered date comes from one formatter given an explicit timezone, and
never emits an invalid date.*

| Row | What it actually is |
|---|---|
| BUG-010 | Missing configuration — `layout.tsx` never wires a real `timeZone` into `useScopedTimezone`, so no timezone reaches the formatter at all. |
| BUG-013 | An unguarded value inside the pipeline — `isNaN` only covers `parseDateTime`'s own internal fallback; the resulting `dateObj` is passed unguarded into `getEventDayDiff`/`formatRelativeDayOrDate` downstream. |
| FIND-009 | A **test-harness** gap — `packages/ui` tests don't pin the clock (`vi.useFakeTimers()`/`setSystemTime`), so they fail on wall-clock rollover. This is not a claim about the formatter's behavior at all; it's a claim about what the tests exercise. |

**Verdict: rejected.** FIND-009 needs an "and also" to join the sentence — it is not a violation of
"comes from one formatter given an explicit timezone, never invalid," it is a defect in how the tests
observe that formatter. **Criterion 2 fails for FIND-009's membership.** Dropping it leaves BUG-010 +
BUG-013 — 2 clean members — so the cluster then also fails **criterion 1** (≥3 rows). This is the
second near-miss the checkpoint predicted (the 2026-09-08 run's "test-clock/timezone" cluster died the
same way, "only 2 clean members"). Routing: each row stands alone — see §4 (BUG-010 `quick-dev`,
BUG-013 `quick-dev`, FIND-009 `quick-dev`).

### 3b. `cross:prd` (BUG-026, IDEA-006, IDEA-008)

Read in full (none had been read together before this pass):

- **BUG-026** — recurring weekday-narrowed schedules extracting as one contiguous span; PRD-resolved
  (`applicableDaysOfWeek`), now an implementation story against `packages/domain`/`ai-processor`.
- **IDEA-006** — self-service account claim; PRD-resolved (§3.17), blocked on `epics.md` Epic 8.
- **IDEA-008** — subscription cap; PRD-resolved (§6), ready to size.

**Verdict: rejected, criterion 2.** `cross:prd` never named a domain or mechanism — it meant "needs a
PRD decision before this can be sized," a process state, not an invariant. All three needed that
decision; all three have now received it, **independently**, from three unrelated PRD sections (4.4
Schedule / §3.17 / §6). No sentence restates "a weekday-recurrence correctness fix, an ownership-claim
flow, and a subscription cap" as one rule — this is exactly the tag-not-an-invariant trap §5 names.
Confirms the checkpoint's prediction that this tag was expected to fail, now on read evidence rather
than assumption. Each row keeps its own individual disposition (§4).

### 3c. `pkg:domain` (BUG-026, FIND-018)

- **BUG-026** — weekday-recurrence matching in `buildEventsQueryCondition.ts`/`drizzle-where.ts`
  (event-query correctness).
- **FIND-018** — AI Event Filter (Epic 7) resolver hardening: timezone handling, a hardcoded fallback
  window, missing pagination/quota on two mutations, unmapped DB exceptions, a summary-renderer
  blemish.

**Verdict: rejected, criterion 1 and criterion 2.** Only 2 rows (criterion 1 fails regardless).
Independent of the count, no shared mechanism exists either: one is a date-range/weekday matching
correctness fix, the other is validation/quota/error-mapping hardening on a different resolver
entirely. `pkg:domain` is a package-directory tag, not an invariant — same failure shape as
`cross:prd`. Both rows keep their individual dispositions (§4); FIND-018 already carries
`reprice_on: epic-0-i2` from an earlier pass, unaffected by this rejection.

---

## 4. Accepted epics (inherited from the stalled run, recorded here for completeness)

Nothing in this section is newly decided — reproduced per gate ritual step 3 so it exists somewhere
other than a chat transcript, per the checkpoint's own stated reason for its existence. §6 routing not
independently re-derived where the checkpoint only confirms it "stands unchanged."

### `epic-1-i1` (was proposed as feature "Epic 9"; reclassified to improvement axis by human ruling)

**Invariant:** Every card surface renders its image slot, thumbnail and favorite/date badge through
the shared `event_card_*` primitive — never a local size, never a local fallback.
**Owning N:** 1 (Stories 1.3b and 1.3g already own the mechanism).
**Members:** BUG-023 (`b` — hardcoded `w-5 h-5` favorite icon), FIND-023 (`c` — local "No image
available" fallback branch), IDEA-016 (`d` — WeeklyCalendarView thumbnail/fallback adoption), IDEA-017
(`e` — masonry default-state thumbnail/fallback adoption). `a` = the mechanism story extending the
shared `event_card_*` tokens to cover thumbnail sizing and fallback consistently.
**`z`:** mandatory, needs real acceptance criteria (not yet drafted this pass).
**§6 routing:** new `AD-n` on the architecture spine, written in `a`.

### `epic-0-i7`

**Invariant:** No consumer uses a Geoapify-resolved location without reading its confidence signal.
**Members:** BUG-027 (`a` — producer, adds `confidence`/`countryCode` to `LocationDetails` and all
three `geoapify-client.ts` response mappers), BUG-017 (`b` — consumer, sub-venue mismatch), IDEA-023
(`c` — consumer, map-link confidence gating).
**§6 routing:** stands unchanged per checkpoint (not independently re-derived this pass).

---

## 5. Full disposition table — all 41 rows, quick-dev/promote split applied

Grouped by disposition, sorted by impact within each group (compliance/user-visible first, per §5).
No `compliance`-impact rows exist in this 41-row set.

### Accepted-epic members (7)

| Row | Impact | Letter | Epic |
|---|---|---|---|
| BUG-027 | user-visible | a | epic-0-i7 |
| BUG-017 | user-visible | b | epic-0-i7 |
| IDEA-016 | user-visible | d | epic-1-i1 |
| IDEA-017 | user-visible | e | epic-1-i1 |
| IDEA-023 | cosmetic | c | epic-0-i7 |
| BUG-023 | cosmetic | b | epic-1-i1 |
| FIND-023 | cosmetic | c | epic-1-i1 |

### `adopt: epic-0-i6` (1)

| Row | Impact | Why |
|---|---|---|
| FIND-008 | cosmetic | `AccountAvatar`'s hardcoded `border-slate-*` violates epic-0-i6's shared-component invariant directly — adopted, not a quick-dev. |

### `sweep: epic-0-i5` (1)

| Row | Impact | Why |
|---|---|---|
| IDEA-019 | user-visible | Shares the FilterHub surface with epic-0-i5's cursor/filter-state mechanism, but is not itself epic-worthy (criterion 5). |

### `sweep: Epic 3` (2) — inherited from the 2026-09-08 rejected-candidate routing, unaltered

| Row | Impact | Why |
|---|---|---|
| BUG-014 | user-visible | Shares the AIProcessingQueue/consumer surface with BUG-015; only 2 rows, criterion 1. |
| BUG-015 | latent | Same surface as BUG-014. |

### `reprice_on: epic-0-i2` (2)

| Row | Impact |
|---|---|
| IDEA-009 | user-visible |
| FIND-018 | latent |

### `carve-first` (2)

| Row | Impact | Why |
|---|---|---|
| BUG-025 | user-visible | Two concerns bundled: the `isAuthenticated=false` hardcode (quick-dev-sized) and the filter-parity half (`adopt: epic-0-i5`, contingent on that epic's `a` scope). Per human ruling. |
| FIND-010 | latent | Multi-concern row (loading-state flash, unmanaged focus, unpruned map, loose assertion, unresolved layout-unification question) — no single shape. |

### `spec-first` (2)

| Row | Impact | Needs |
|---|---|---|
| IDEA-020 | user-visible | `bmad-architecture`/`bmad-ux` (own note, explicit) |
| FIND-022 | user-visible | `bmad-spec` (own note: "Ready for bmad-spec") |

### `blocked` (2)

| Row | Impact | What it's waiting on |
|---|---|---|
| IDEA-006 | user-visible | `epics.md` Epic 8 needs `bmad-create-epics-and-stories` |
| IDEA-002 | cosmetic | New brand visuals — CC-002's own deferral, never lifted; this is an external design-asset dependency, not a sizing gap, so `blocked` fits better than the generic "quick-dev by rule" the 2026-09-08 rejection used before `blocked` existed as a distinct disposition |

### `skipped — value` (1)

| Row | Impact | Reason |
|---|---|---|
| IDEA-001 | user-visible | `3-6l` delivers the same outcome within the Gemini RPD budget. Per human ruling — a `value:` skip, unreopenable by §9.2. |

### `promote` (m/l rows, standalone) — 9

| Row | Impact | Effort |
|---|---|---|
| IDEA-010 | user-visible | m |
| IDEA-012 | user-visible | m |
| BUG-026 | user-visible | m |
| IDEA-022 | user-visible | m |
| IDEA-008 | user-visible | m |
| IDEA-003 | user-visible | m |
| IDEA-005 | user-visible | l |
| FIND-016 | internal | m |
| IDEA-015 | internal | m |

### `quick-dev` (xs/s rows, standalone) — 12

| Row | Impact | Effort |
|---|---|---|
| BUG-001 | user-visible | xs |
| BUG-010 | user-visible | s |
| BUG-013 | user-visible | xs |
| FIND-014 | latent | s |
| FIND-007 | internal | s |
| FIND-009 | internal | xs |
| FIND-013 | internal | xs |
| FIND-019 | internal | s |
| IDEA-013 | internal | s |
| IDEA-018 | internal | xs |
| IDEA-021 | internal | xs |
| BUG-024 | cosmetic | xs |

### Balance line

```
accepted-epic members (7) + adopt (1) + sweep:epic-0-i5 (1) + sweep:Epic 3 (2)
+ reprice_on (2) + carve-first (2) + spec-first (2) + blocked (2) + skipped (1)
+ promote (9) + quick-dev (12)
= 7 + 1 + 1 + 2 + 2 + 2 + 2 + 2 + 1 + 9 + 12 = 41 ✓ = open rows read (41)
```

---

## 6. Coverage table — clustered vs. unclustered, per impact, across all 41

"Clustered" = row is a member of, or adopted/swept into, an epic surface (`epic-1-i1`, `epic-0-i7`,
`epic-0-i6` via adopt, `epic-0-i5`/`Epic 3` via sweep). Everything else — including `promote`,
`spec-first`, `blocked`, `reprice_on`, `carve-first`, `skipped` — is unclustered: it stands alone,
whatever its eventual route.

| Impact | Clustered | Unclustered | Total | Clustered % |
|---|---|---|---|---|
| user-visible | 6 | 16 | 22 | 27% |
| latent | 1 | 3 | 4 | 25% |
| internal | 0 | 9 | 9 | 0% |
| cosmetic | 4 | 2 | 6 | 67% |
| compliance | 0 | 0 | 0 | — |
| **Total** | **11** | **30** | **41** | **27%** |

### Verification addendum (2026-09-11, reviewing session)

Checked against `backlog.yaml` rather than read from this report's own summary:

- **§5's table is exact.** 41 rows listed, 41 unique, no duplicates, and the set matches the
  in-scope set precisely — none added, none dropped. Every `promote` row is `m`/`l` and every
  `quick-dev` row is `xs`/`s`, all 41 `impact` values correct. This was re-derived from primary
  evidence because the prior 19-row list was never written down — a gap in
  `checkpoint-2026-09-11.md`, not in the run that produced it.
- **`sweep: Epic 3` is genuinely inherited.** Doubted on review, then confirmed at
  `formation-2026-09-08.md` line 85: *"AIProcessingQueue enqueue | BUG-014, BUG-015 | criterion 1 —
  only 2 rows | …recommend one sweep story under Epic 3."* The 2026-09-11 stalled run had lost that
  routing and put both rows in `quick-dev`; this pass **recovered** it.

**Two corrections to this section.**

**1. The coverage definition changed, so 27% is not comparable to the earlier figures.** This table
counts `adopt` and `sweep` rows as clustered. Every previous coverage number — the 30%/64% that
motivated the two-axis correction, and the stalled run's 18% — counted **epic members only**. Under
that same definition this pass is:

| Impact | Clustered | Total | % |
|---|---|---|---|
| user-visible | 4 | 22 | **18%** |
| cosmetic | 3 | 6 | 50% |
| latent | 0 | 4 | 0% |
| internal | 0 | 9 | 0% |
| **Total** | **7** | **41** | **17%** |

**`user-visible` is unchanged at 18%.** The generator fix moved the headline number by nothing. That
is the honest result and it is the one worth recording: the feature-axis sweep ran properly and found
nothing, so the low number is now a fact about this board rather than an artifact of a missing
generator. Both definitions are legitimate; mixing them across passes is not.

**2. A limit on what the zero proves.** The human ruling that moved "Epic 9" to `epic-1-i1` took
IDEA-016 + IDEA-017 — the one pair on this board that demonstrably shares a capability — out of the
feature pool *before* this sweep ran. The sweep found zero among what remained. The strongest
counter-candidate available to the reviewer was a performance journey (*a user browsing media-heavy
surfaces doesn't wait on images*: IDEA-005 + IDEA-020); it dies on **criterion 1** with 2 clean
members once IDEA-021/022 are removed as settled. So the zero holds — but it is zero from a pool the
best candidate had already left, not zero from a full field.

**3. IDEA-003's disposition did change, and the report says it did not.** §2 flags that
`EXPERIENCE.md`'s "Mobile Multi-Day Calendar Spanning" section (line 124, cross-referenced from the
Calendar View section) already specifies this behaviour, making the row's own *"no UX design exists
yet"* note stale — then says *"not acted on, freeze holds."* But the row moved from `spec-first` (its
disposition in the stalled run) to `promote` here, which **is** acting on it. The move is correct —
the staleness is real, confirmed on review — and it should be recorded as a decision rather than as
an untaken observation. **Board follow-up:** IDEA-003's note needs updating; it is currently wrong.

**Stated plainly:** coverage is low and internal-impact rows have zero cluster coverage this pass.
This is not explained away. Two things are true at once: (1) the feature axis, run properly for the
first time, found nothing to cluster — most `idea`/`proposal` rows on this board are genuinely
complete, independently-shippable slices, not partial journeys; the zero is real, not a method gap.
(2) The improvement axis's 27% overall — barely changed from this session's three new reading
passes, all three of which failed — is consistent with the 2026-09-08 pass's own finding that most of
this board is singletons. The three passes owed this session (BUG-010+BUG-013+FIND-009, `cross:prd`,
`pkg:domain`) were near-misses and tag-groups respectively, not missed epics; none should have
clustered, and none did. The honest read is that this 41-row board, after two independence-tested
generation passes on both axes, mostly *is* `quick-dev`/`promote` material — 21 of 41 rows (51%) route
there — plus a handful of rows genuinely blocked or awaiting spec work.

---

## 7. Next steps

Nothing is written. To proceed: apply this report's rulings and dispositions in one commit spanning
`epics.md` (append `epic-1-i1` and `epic-0-i7`'s full story lists, including `z`'s acceptance
criteria, not yet drafted), `sprint-status.yaml` (register both epics' story keys), and `backlog.yaml`
(stamp `epic:`/`adopt`/`sweep`/`reprice_on`/`blocked`/`skipped`/effort-based disposition per §5 above
on all 41 rows) — gate ritual steps 5–7. Then `bmad-epic-readiness-check` on both epics (step 8).
