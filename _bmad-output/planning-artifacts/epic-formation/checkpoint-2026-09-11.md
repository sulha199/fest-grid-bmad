# Formation pass 2026-09-11 — Step 4 checkpoint rulings

**Frozen input:** superseded — see "What is still owed" item 4; the sweep freezes at
`bec358b`. The Step 4 output below was produced against `95e8a82`, 41 open unclustered rows + 5 non-epic unstarted
stories + IDEA-004 (re-score sweep only). Runner clean.
**Status:** the pass stopped at Step 4. **Nothing has been written to `epics.md`,
`sprint-status.yaml` or `backlog.yaml`.** These are the human rulings; the pass is
not finished and must not be written up until the missing generation sweep runs
(see "What is still owed" below).

---

## Why this file exists

The run produced two epics, seven clustered rows, and a coverage table showing
`user-visible` at 18% (4 of 22). Interrogating *how* it generated candidates —
rather than reading its conclusions — found the cause, which was a defect in
`epic-formation-gate.md`, not in the run. That fix is committed (`4b4e642`).

The rulings below were made in conversation and would otherwise be lost. §5's
"a disposition that exists only in the chat transcript is lost" applies to
checkpoint rulings just as much as to dispositions.

---

## 1. Root cause found — the generator, not the criteria

Asked on what basis it generated feature-axis candidates, the run answered that all
three arrived via a `parent` chain or a tag group, and that it *"did not
independently sweep `idea`/`proposal` rows asking what journey does this serve."*

It had no reason to. §5's generation table offered `touches`, `parent`,
`deferred-work` ids, spine AD, and shared repair shape — **every one a proxy for
implementation proximity**, the strongest of them being the mechanism question
itself. The 2026-09-08 amendment corrected the admission test (criterion 3) and left
the generator mechanism-only. A correct sieve fed by the wrong hopper.

**Fixed in `4b4e642`:** §5 now separates improvement-axis and feature-axis
generation, gives the feature axis its own sources (PRD capability, `EXPERIENCE.md`
journey, user-side surface), and requires both passes to report candidate counts
separately — so "zero because the board has none" and "zero because nothing
generated any" stop looking alike.

**Two rejections were correct and are upheld.** IDEA-020/021/022 and IDEA-008+009
were both proposed by the reviewer and both correctly rejected on criterion 3's
feature form — 021 and 022 carry notes stating they are independently shippable,
and IDEA-008 alone delivers the complete cap-and-CTA outcome. Both reviewer
proposals grouped by *topic*, which is the tag-not-an-invariant error criterion 2
exists to catch. Evidence the criteria are not too lax.

---

## 2. Rulings

### Epic 9 → **improvement axis, `epic-1-i1`** (was: feature, Epic 9)

Owning N is 1: Stories 1.3b and 1.3g own the mechanism. No `epic-1-i*` existed.

**Invariant (replaces the capability sentence):**

> Every card surface renders its image slot, thumbnail and favorite/date badge
> through the shared `event_card_*` primitive — never a local size, never a local
> fallback.

Reasons: (a) the capability sentence joined two rules with "and"; (b) this form is
tighter and covers all four members — BUG-023's hardcoded `w-5 h-5`, FIND-023's
local `'No image available'` branch, and the two new compositions; (c) the journey
test does not actually pass — IDEA-017 shipping without IDEA-016 leaves the surfaces
*inconsistent*, not the outcome incomplete, which is an invariant violation;
(d) decisive — a feature epic has no mandatory ratchet, and "consistently across
every surface" is precisely what regresses silently when surface #5 arrives.
FIND-023's note documents that exact drift already happening.

Consequences: `z` becomes **mandatory** and needs real ACs (the proposed shape is
right). §6 routing changes from `bmad-prd` first to **a new `AD-n` on the
architecture spine, written in `a`**.

### `epic-0-i7` → cluster accepted, **sentence rewritten**

The original joined producer and consumer obligations with "and", and its second
half — *"prefers a correct match over blindly trusting"* — is unfalsifiable.

> **No consumer uses a Geoapify-resolved location without reading its confidence
> signal.**

One rule; the producer obligation follows from it. Both drafted `z` criteria test
this directly. Members (BUG-027 `a`, BUG-017 `b`, IDEA-023 `c`), letters and §6
routing stand unchanged.

### BUG-025 → **`carve-first`**, not `adopt: epic-0-i5`

Two defects in one row: `isAuthenticated=false` hardcoded, and the missing
location/AI-filter buttons. Post-freeze-queue item 2 — carve before any part can be
a member. The hardcode is `quick-dev`; the filter-parity half is
`adopt: epic-0-i5 (pending)` **only if** i5's `a` owns which controls render.
i5's invariant says *cursor and filter-reset state*, which is not that. Do not widen
the invariant to fit the row; let `bmad-epic-readiness-check` settle `a`'s scope.

### IDEA-001 vs `3-6l` → **rival designs; `3-6l` wins on quota**

Not a supersession — `superseded_by` is for a row superseded by another *row*.
IDEA-001's retry loop multiplies Gemini requests per post against the 500 RPD
ceiling IDEA-009 cites; `3-6l` is one call regardless of slide count.

IDEA-001 → `skipped`, reason `value: 3-6l delivers the same outcome within the RPD
budget`. A **`value:`** skip, so §9.2 never reopens it on price.

### IDEA-006 + IDEA-008 → one `bmad-prd` pass, dispatched

Both are `cross:prd` / `spec-first` and both land in PRD §8.x. Deciding the
subscription cap without knowing what claiming an account grants, or defining
claiming without the tier limits, yields two contradicting sections. Dispatched
2026-09-11 as a Sonnet session on this branch.

---

## 3. What is still owed before this pass can be written up

1. **The feature-axis generation sweep** — the pass §5 now requires and that no run
   has done: all 19 in-scope `idea`/`proposal` rows read against the PRD's
   capabilities and `EXPERIENCE.md`'s journeys. Everything the run did on the
   improvement axis stands; only generation is missing.
2. **The candidate nobody assembled: BUG-010 + BUG-013 + FIND-009.** Three rows,
   criterion 1 clears. It never formed because BUG-010 was read inside the
   `cross:i18n` group while BUG-013 and FIND-009 were read as singletons — no pass
   ever had all three in view. The 2026-09-08 run rejected a "test-clock/timezone"
   cluster at *"only 2 clean members"*, so this is the second near-miss. A candidate
   invariant to test, not to assume: *every rendered date comes from one formatter
   given an explicit timezone, and never emits an invalid date.*
3. **`cross:prd` and `pkg:domain` were never read.** The run flagged skipping both;
   each had ≥2 in-scope rows. `cross:prd` is expected to fail — it is a process tag
   meaning "needs PRD work", not a domain — but that is a conclusion from reading
   them, which has not happened.
4. **Re-freeze: the new input commit is `bec358b`, not `95e8a82`.** The dispatched
   PRD pass landed and appended to IDEA-006's and IDEA-008's notes, exactly as
   expected — resolving a spec is what should change a `spec-first` row's
   disposition. Runner clean at `bec358b`. Verified independently: only `note`
   changed on those two rows (no `status`/`effort`/`impact`/`epic`), no `backlog_id`
   was written into the PRD (§8), and every section and symbol PRD 3.17 / 4.20 / 6
   cite resolves — 3.9.3, 3.13, 3.16, 4.8's `UserRole.MODERATOR`, 4.9, and the
   `view_switched` / `subscription_default_location_set` PostHog precedents all
   exist. Section numbers 3.17 and 4.20 are unique and follow 3.16 / 4.19.

   **Two dispositions change as a result:**
   - **IDEA-008** leaves `spec-first`. The cap is resolved to 5
     (`MAX_SUBSCRIBED_ACCOUNTS_FREE_USER`), enforcement, the moderator exemption and
     the CTA's two PostHog events are all stated, and the row's note says no open
     question remains. At `effort: m` its new disposition is **`promote`**, not
     `quick-dev` (see item 5).
   - **IDEA-006** stays blocked, but on a different thing. PRD 3.17 now specifies
     the claim flow, so the *spec* question is answered; `epics.md`'s Epic 8 is
     still a bare placeholder, which the PRD pass correctly declined to touch under
     CLAUDE.md's Planning Isolation guardrail. Re-route from `spec-first` to
     **`blocked: epics.md Epic 8 needs bmad-create-epics-and-stories`**.

5. **A gap the verification exposed in the disposition table itself.** It shipped with
   `quick-dev` as the only route for a standalone row, described as "`bmad-quick-dev`,
   any time" — but §3's effort scale says `m` is 2–4 stories. Several rows the run
   put in `quick-dev` are `m`. Fixed the same day: `promote` added as the standalone
   route for `m`/`l` rows, going to `bmad-create-story` under the epic that owns the
   surface. **The 19 `quick-dev` rows must be re-split on `effort` during the sweep**
   — this was not the run's error, the table gave it nowhere else to put them.

## 4. Dispositions upheld as reported

All other dispositions from the run's Step 4 output were checked and stand:
5 `spec-first`, 4 `blocked`, 1 `adopt` (FIND-008 → `epic-0-i6`), 1 `sweep`
(IDEA-019 → `epic-0-i5`), 2 `reprice_on: epic-0-i2`, 1 `carve-first` (FIND-010),
19 `quick-dev`. FIND-010's un-run cross-check against the card cluster is moot —
it resolves after the carve.
