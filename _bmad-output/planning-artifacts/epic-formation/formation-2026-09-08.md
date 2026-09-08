# Epic Formation Pass — 2026-09-08

**Method:** `epic-formation-gate.md`. **Skill:** `bmad-form-epics`.
**Frozen input:** 2026-09-08, `backlog-check.py` clean at checks 1-13. 49 open rows (48 `backlog` + 1 `triaged`) + 5 unstarted `sprint-status.yaml` stories (§5's input set spans both files).
**Model:** driving model (Sonnet) for Steps 1/3/5/7/8; Step 2's reading pass run as a separate `opus` subagent per §12's failure-visibility split. Step 6 (re-scoring sweep) folded into Step 3's per-candidate analysis rather than run as a second silent-failure pass, since no accepted epic produced a late-joining member — see "Re-scoring sweep" below.

---

## Accepted epics (7)

### `epic-0-i1` — Templated, throttled moderator notifications
**Invariant:** Every outbound moderator notification is sent through one templated, throttled helper whose rendering escapes HTML.
**Members:** BUG-003, FIND-020, FIND-021
**Stories:** `a` (mechanism — DB-backed `notifyAllModerators`, escaping, throttle), `b` (BUG-003 adoption), `c` (FIND-020 adoption), `z` (ratchet)
**§6 routing:** new AD-n written in `a`, covers all three members.
**Residual:** FIND-020's DB-dependency risk (depends on the same DB it may be reporting on) is not addressed by this epic and stays on the row.
**Design decision carried in:** `a` uses the DB-backed helper, not the out-of-band CloudWatch+SNS alternative FIND-020's own note also records — the user already rejected the out-of-band option for the sibling alert in Story 3.4q, so this was taken as settled rather than re-litigated.

### `epic-0-i2` — Guarded outbound vendor calls
**Invariant:** Every outbound call to an AI/scraping vendor goes through one guarded wrapper enforcing a per-key lock, a request timeout, retry backoff, and a recorded vendor-DPA check.
**Members:** BUG-011, BUG-012, FIND-004
**Stories:** `a` (mechanism), `b` (Gemini sync-path adoption), `c` (async inference-path adoption), `z` (ratchet)
**§6 routing:** new AD-n written in `a` (FIND-004 is `impact: compliance`).
**Not members (see re-scoring sweep below):** FIND-017 (capacity-heuristic sub-issue), FIND-018 (quota sub-issue), IDEA-009 (quota-aware trigger) — each would need an "and also" to justify direct membership (§5 criterion 2).

### `epic-0-i3` — CI-enforced infrastructure and build-config checks
**Invariant:** Every Lambda's configuration and the backend's lint strictness are asserted by a CI check, not left to memory.
**Members:** BUG-002, FIND-015 (lint-gate sub-scope only), FIND-017 (IAM-grant sub-scope only)
**Stories:** `a` (mechanism + lint-gate restore), `b` (Lambda-timeout check), `c` (IAM-grant check), `z` (ratchet)
**§6 routing:** internal only for all three.
**Residual:** FIND-015's DB-setup-docs and irreversible-enum-migration sub-issues; FIND-017's FK `ON DELETE` risk. None are CI-checkable invariants and none are addressed here.
**Deliberately not merged:** the reading pass flagged that this candidate, the (rejected) test-clock/timezone candidate, and the (rejected) design-token candidate are all "add a CI check." They were kept separate rather than folded into one epic — a single combined invariant could not be restated as "so anything that does X is a bug" without heavy per-case caveats (§5 criterion 2), since each needs a genuinely different tool (infra-config assertion vs. clock-pinning vs. token-lint).

### `epic-0-i4` — Proposal landing verification
**Invariant:** Every edit a proposal declares — to a planning doc, a story's ACs, or a story's existence — is confirmed present in its target artifact by an automated check, not assumed.
**Members:** FIND-001, FIND-002, FIND-003
**Stories:** `a` (mechanism, extends `backlog-check.py`), `b` (FIND-001 remediation), `c` (FIND-002 remediation), `d` (FIND-003 remediation), `z` (ratchet — new numbered check in `backlog-check.py`)
**§6 routing:** internal only — process tooling.
**Evidence this class recurs:** BUG-004 and BUG-016 already fixed one instance each, individually, and are `done` — the class kept returning because nothing checks it, only individual incidents get fixed.

### `epic-0-i5` — Shared list-pagination and filter-state controller
**Invariant:** Every list/pagination surface manages its cursor, filter-reset, and scroll-anchor state through one shared controller, not local per-page state.
**Members:** BUG-018, BUG-019, BUG-020, **IDEA-011**
**Stories:** `a` (mechanism — also settles IDEA-011's on-change-vs-Apply question), `b` (Discovery/event-list adoption), `c` (moderator-tools adoption), `z` (ratchet)
**§6 routing:** IDEA-011 establishes a new cross-cutting convention → new AD-n written in `a`. BUG-018/019/020 are internal-only fixes riding the same mechanism.
**Kind ruling:** mixed membership is allowed — §2's kind rule determines what KIND the epic is from its driving rows, not that every member share one type. Bugs drive this epic, so it stays an improvement epic (`epic-0-i5`); IDEA-011 (type `proposal`) does not flip it to a feature epic.
**IDEA-011's absorption:** it becomes a member with `epic: epic-0-i5`, gets **no adoption story of its own** — it is the rule `a` must implement, not a symptom of one. When `a`'s story key exists, it is added to IDEA-011's `stories` field alongside the bug rows'; IDEA-011 then derives to `promoted` through the ordinary §5 mechanism and closes with the epic. No `superseded_by`, no new vocabulary — it is answered, not replaced. (This mechanic is not spelled out in the gate for a non-story `proposal` row; recorded here as the ruling applied.)

### `epic-0-i6` — One SubscribedAccountCard for every subscribed-account display
**Invariant:** Every place that displays a subscribed social-media account renders it through one `SubscribedAccountCard` whose props are fully specified and gracefully degrade on missing input.
**Members:** FIND-011 (fractional — see below), BUG-005, FIND-012
**Stories:** `a` (finish the card/`AccountAvatar` contract), `b` (Post Selection adoption), `c` (Subscribed Accounts settings adoption + detail-surface variant decision), `z` (ratchet)
**§6 routing:** internal only for all three.
**FIND-011 membership — kept on merit, not on count:** unused props and an unscaled variant on `SubscribedAccountCard` are prop-contract defects on the exact card whose contract this invariant governs; that is why it belongs, independent of what it does to the member count. FIND-011 is itself fractional: it **also** covers `EventDetailView`, outside the card. That portion is not addressed by this epic — noted as a carve candidate, not carved now (board frozen for this pass; queued in `post-freeze-queue.md`).
**Detail-surface correction applied during Step 4:** FIND-022's subscribe/unsubscribe icon toggle is **not** a rival convention for the settings list. Its own note places it on the shared-account-info surface (a coauthor account shown on post/event detail) — a different surface from `settings/account/subscriptions-content.tsx`. `c`'s scope was revised accordingly: keep the shipped `SwipeToReveal`+`Trash2` for the settings list unchanged; if `SubscribedAccountCard` also serves the detail surface, `c` settles it as a context/variant prop (list → swipe-to-reveal delete, detail → toggle), not as picking one convention to win.

### `epic-2-i1` — One mutation-result handler for favorite/calendar toggles
**Invariant:** Every mutation-result handler for a favorite/calendar-toggle null-checks its payload and derives its count/state delta from the response, settling multi-item fan-outs per item.
**Members:** BUG-007, BUG-008, BUG-009, FIND-006 (fractional — see below)
**Stories:** `a` (fixes `EventDetailWrapper.tsx`'s 4 handlers, resolving BUG-007/008/009 directly), `b` (adopt to the 3 other favorite-mutation call sites), `c` (missing test coverage), `z` (ratchet)
**§6 routing:** internal only for all members.
**FIND-006 membership:** fractional — only its favorite-cache-sync test-coverage half is a member; its scroll-anchor/jsdom-untestable half is unaddressed, residual on the row.
**Open convention conflict — not resolved by this epic:** BUG-008/Story `a` preserves the existing optimistic ±1 pattern. FIND-022 (a separate row, not a member here) mandates no optimistic state change — confirm-then-refetch — for its own new subscribe-toggle mutation. Whichever ships first sets the house convention for the other; this pass does not adjudicate it.

---

## Rejected candidates

| Candidate | Members considered | Failing criterion | Routing |
|---|---|---|---|
| Carousel-slide capture | IDEA-001, 3-3e, 3-6l | §5 criterion 2 — a rival design, not a violation-cluster: 3-6l's own note records rejecting IDEA-001's re-trigger-loop approach | Recommend marking IDEA-001 `superseded_by: 3-6l` (a human decision — the §5 "keeps its key" absorption mechanic is written for `sprint-status.yaml` stories, not backlog rows like IDEA-001). 3-3e/3-6l stay as already-sequenced stories, no epic. |
| Typed error contract | FIND-014 (clean) + fractional halves of FIND-018, BUG-011, FIND-022 + IDEA-008 (feature, not a violation) | criterion 1 — only 1 unambiguous member | FIND-014 → `bmad-quick-dev`. Revisit if the fractional rows are ever split into child rows. |
| Test-clock/timezone/locale | BUG-010, FIND-009 + fractional FIND-016 | criterion 1 — only 2 clean members | `bmad-quick-dev` per row. |
| Design tokens (sizes/colors) | FIND-008, BUG-023 | criterion 1 — only 2 members | `bmad-quick-dev` per row (both `xs`). |
| Orphaned-reference sweep | BUG-001, FIND-013 (+ FIND-011, resolved to `epic-0-i6` above) | criterion 1 (without FIND-011) **and** criterion 3 — no single buildable mechanism; i18n-key usage, prop usage, dead markup, and stale params each need a different tool | `bmad-quick-dev` per row. |
| Subscribe-eligibility guard | IDEA-008, FIND-022 (fractional), IDEA-006 | criterion 1 — IDEA-006 explicitly needs its own `bmad-prd` pass first | Leave parked. IDEA-008's cap (5) conflicts with PRD §8.2 ("e.g., 2") — surface for whenever IDEA-008 is promoted, likely `bmad-correct-course` first if it changes MVP scope (§6). |
| AIProcessingQueue enqueue | BUG-014, BUG-015 | criterion 1 — only 2 rows | Share the exact queue/consumer surface — recommend **one sweep story** under Epic 3 (§4 fallback), not per-row quick-dev. |
| Single declaration point for extracted fields | IDEA-012 (clean) + fractional FIND-016/FIND-022 | criterion 1 — only 1 clean member | IDEA-012 proceeds as a normal row. Real evidence exists (3.6l/3.6i/3.6j/3.6k all edit the same prompt file and must hand-rebase) — revisit if more rows accumulate. |
| Unified calendar renderer | IDEA-003, FIND-010 (fractional) | criterion 1, and mixes idea/finding types (§2) | IDEA-003 stays parked pending its own `bmad-ux` pass (per its own note). FIND-010's DW-027 is already annotated as not independent of it. |
| Degraded card-input render | BUG-013, BUG-005 (claimed by `epic-0-i6`), 3-7c (not a violation) | criterion 1, and criterion 2 — too generic to be one mechanism | BUG-013 → `bmad-quick-dev`. 3-7c proceeds as a normal story. |

---

## Re-scoring sweep (§9.1)

No accepted epic produced a late-joining adoption member — every row checked either joined at Step 3 on the merits above, or stays outside with `reprice_on`. Three rows carry `reprice_on: epic-0-i2`, pending that epic's `a` story:

| Row | Why it would get cheaper | Current effort (unchanged) |
|---|---|---|
| FIND-017 | capacity-heuristic sub-issue would use the wrapper's real-usage data instead of a static heuristic | `m` |
| FIND-018 | quota sub-issue (no pagination/quota on two mutations) would be covered by the wrapper | `m` |
| IDEA-009 | quota-aware auto-extract trigger would consume the wrapper's budget accounting instead of building its own | `m` |

No `cost:`-skipped row exists on the board (runner confirms the cost-skipped list is empty), so §9.2 reopening does not apply this pass.

---

## Unclustered rows

BUG-001, IDEA-002, IDEA-003, IDEA-005, IDEA-006, BUG-013, BUG-014, BUG-015, FIND-007, FIND-008 (\*), FIND-009 (\*), FIND-010, FIND-013, FIND-014 (\*), FIND-016, FIND-019, FIND-022, IDEA-001 (\*), IDEA-008, IDEA-010, IDEA-012 (\*), BUG-010 (\*), BUG-017, BUG-023 (\*)

(\*) = disposed of above (rejected-candidate routing or reprice_on), listed here for completeness of the open-row inventory.

Genuinely unaddressed with no shared-mechanism partner found this pass: **FIND-007, FIND-019, BUG-017, IDEA-002, IDEA-005** (possibly stranded by CC-018's consent gate — human call on whether to skip), **IDEA-010**.

**Unstarted stories not absorbed:** 0-24 (AC12 is a viewport-specific repro that didn't reproduce — no mechanism to cluster around), 3-4c (outreach-only, DoD is a go/no-go decision, not code), 3-3e/3-6l (already correctly sequenced; see carousel-capture rejection above), 3-7c (proceeds as a normal story).

---

## Board-level finding: fractional multi-cause rows

Nine rows this pass carried more than one distinct repair inside a single row, such that only part of the row's content matched any candidate's invariant: **FIND-020, FIND-015, FIND-017, FIND-006, FIND-018, FIND-016, FIND-022, BUG-011, FIND-011.** This is not a finding about any one epic — it recurred across the whole board and drove two of the ten rejections directly:

- **Typed error contract** died at criterion 1 with "only 1 unambiguous member" while FIND-018, BUG-011, and FIND-022 each carried a piece of the same underlying error-mapping gap, spread across three otherwise-unrelated rows.
- **Test-clock/timezone** died at "only 2 clean members" with FIND-016 fractional (its locale-flow-proof sub-issue would have made a clean 3rd member, but the rest of FIND-016 belongs elsewhere).

The board's own batching convention (`backlog-spec.md` §12: "one row per deferring session, not one per finding") is what produces this — it optimizes for keeping the open set enumerable (§9's check-7 rationale) at the cost of making some rows unclusterable without a split. No action taken on the board this pass (frozen); a future triage pass could consider splitting the nine rows above into their constituent findings, which would very likely surface at least one more viable epic candidate (typed error contract in particular) once its evidence isn't scattered across unrelated rows.

---

## Next steps

`bmad-epic-readiness-check` on each of the 7 epics — Gate 1/3 across all its stories at once, where `a` is validated, replaced, or dropped. Then `bmad-create-story` per story in letter order. Sequencing across these epics is not decided here — it is a lens at read time (`backlog-check.py --lens <name>`, gate §9.3).
