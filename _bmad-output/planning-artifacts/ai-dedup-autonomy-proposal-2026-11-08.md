# AI dedup review: from "Claude assists" to "Claude decides, moderators audit" (proposal, 2026-11-08)

**Status:** proposal, input to `bmad-prd` and then epic formation (`epic-formation-gate.md`, feature axis). Nothing here is built or approved.
**Owner request:** "maximize Claude's capability beyond the ruleset/floor; the goal is to minimize manual real-user moderation" (conversation, 2026-11-08).

## The capability (one sentence, written before membership)

A moderator opens the queue and finds only the pairs Claude could not decide with confidence: every other pair was decided, recorded with the reasoning behind it, and is one click to undo.

## Where the manual work comes from today (AD-45, built through FIND-125)

- The daily review only merges what the deterministic floor passes, and **never rejects**, so every clearly-different pair waits for a person.
- The floor blocks merges Claude would get right (a marketing-prefixed name, a bilingual name, an ordinal in a name).
- Every apply run, even a plain AI merge, needs the owner's approval click (AD-45 Rule 6).
- A reject cannot be undone in the app; the owner reopens it by SQL.
- Nobody measures how often Claude is right, so autonomy cannot be widened on evidence.
- Observation from the first attended loop (2026-11-07, four floor-refused pairs): three looked decidable from the text alone (#146 merge, #147 and #149 reject); #148 ("Konser Pulih" vs "Konser Pulih#2") is genuinely ambiguous and is the kind of pair a person should keep.

## The autonomy ladder (what the epic would build)

| Tier | Who decides | Needs |
|---|---|---|
| A. floor-passing merge | Claude, unattended | exists (daily review) |
| B. clearly-different reject | Claude, unattended | reversible reject, measured precision |
| C. reasoned merge beyond the floor | Claude plus a second independent pass that argues the pair is different | rationale schema, verifier, lower caps, measured precision |
| D. everything else | a moderator | the queue, now short |

## Members (rows `IDEA-114` to `IDEA-120`; sizes are estimates from FIND-120, 124 and 125)

| Row | Letter | What | Effort |
|---|---|---|---|
| `IDEA-114` | a, the mechanism | Decision provenance: record who or what decided, why (a rationale code), the confidence and the run id, in the database; overlaps `FIND-114` (run id not stored) | m |
| `IDEA-115` | b, the gate | Replay and precision report: replay moderator-resolved suggestions through Claude's reasoning and report agreement per class | m |
| `IDEA-116` | c | Richer evidence in the export (captions, links, account type, perhaps the poster image), with the hash and privacy rules | m |
| `IDEA-117` | d | Reversible reject: a soft "AI-dismissed" state or an un-reject in the app, with the moderation screen | l |
| `IDEA-118` | e | Reasoned decisions with a rationale, a second-pass verifier and caps, in shadow first | l |
| `IDEA-119` | f | Audit: a sampled weekly review of Claude's decisions, a digest, and an automatic pause when the audited error rate passes a threshold | m |
| `IDEA-120` | g | Standing approval policy: an AD-45 amendment and the owner's environment setup for narrow, capped classes | s |

`IDEA-113` (list and badge AI-assisted merges, with undo) is the moderator-facing audit view and a candidate member at formation. Other candidates: `FIND-114`, `FIND-116`, `FIND-126` (tunable caps), `FIND-128`. Formation decides.

**Not in the epic:** reducing the inflow of false "mid" pairs at ingestion (the AD-30 matcher): it ships alone and gives a different outcome.

## Gate

`IDEA-115` (the replay and precision report) is the go/no-go for `IDEA-118` and `IDEA-120`. If Claude's measured agreement with moderators does not support a class, that class stays with people. The dataset caveat: on 2026-11-08 all 20 escalation issues were open (no `outcome:` label exists yet), so the history is the database's moderator-resolved suggestions, whose size is unknown from a cloud session. If it is small, weeks of shadow-mode daily runs are the longest part.

## Risks to carry into the PRD

- Event text is untrusted public content: a reasoning-based path widens what a prompt injection could reach. Bounds: structured rationale only, the evidence hash, the verifier, caps scaled by measured trust, reversibility, the audit and the pause.
- Real autonomy needs the approval gate to change (AD-45 Rule 6 limit); that is a PRD and owner decision, not a story.

## Owner decisions (settled 2026-11-08, recorded in the PRD, Section 3.18)

1. Acceptable error rate per class, on the audit sample, rolling 30 days: merges at most 1%, rejects at most 3%.
2. Claude may reject unattended only once a reject is reversible in the app (`IDEA-117`); until then it proposes rejects and a moderator confirms them in one batch.
3. Approval: a standing policy class by class, within daily caps. Every class keeps the per-run click until it has met its target with at least 200 audited decisions made live over 30 consecutive days; the owner then records the change in AD-45. The owner's reason: a click does not stop persuasion through event text, so the controls that matter are the second pass, the caps, the undo, the audit and the pause.
4. Audit: a 10% random weekly sample per class; a class pauses at twice its target (judged over at least 50 audited decisions) or after 3 errors in 7 days.
5. Shadow: at least 30 days and at least 200 compared decisions per class before it can go live.

Open assumptions the PRD pass introduced, for the owner to confirm before the story named: the replay counting rule (`IDEA-115`), the second pass for rejects (`IDEA-118`), the 7-day undo window (`IDEA-117`), the minimum of 50 audited decisions and the owner-only resume (`IDEA-119`), the cap ceilings (`FIND-126`).
