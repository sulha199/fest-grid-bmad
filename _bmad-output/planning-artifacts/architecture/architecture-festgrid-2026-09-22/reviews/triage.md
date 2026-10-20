# Reviewer Gate triage (2026-10-20)

Four reviewers ran against `festgrid-architecture-spine.md` as amended on 2026-10-19 (commit `cad868a`):
the rubric walker (19 findings: 3 critical), the verified-current lens (51 claims: 34 confirmed, 9
contradicted, 8 could not be verified), the adversarial two-units lens (22 pairs: 4 critical) and a
data-integrity lens (20 findings: 2 critical). Their files sit beside this one. Overlap was heavy
(the same defect was found by two to four reviewers), so the table is by cluster.

Gate verdict before triage: **not safe to build from**. After triage: the clear fixes are in the spine;
what remains is listed under "Needs the owner" and in the `[PROPOSED]` / `[ASSUMPTION]` tags.

| Cluster | Found by | Disposition |
|---|---|---|
| A split moves `schedules.event_id` but not `calendar_additions.event_id`; no main schedule per child; open copy-set; locks; corrections/reports | RW-3, DI-1, DI-4, DI-5, DI-12 to DI-14, ADV-10 | **Applied** (AD-38 Rule 4, AD-30 Rule 9 amendment) |
| Series stem rule and Tier 1 title pattern have the same shape and opposite `kind`; series hard cap would hide SCH events | RW-11, DI-2, ADV-2, ADV-1 (part) | **Applied** (AD-36 Rule 12: kind from a membership test, one derivation function, SCH fixture) |
| Ordinals: three assigners, `max + 1`, slot collisions on re-extraction | RW-5, DI-3, ADV-3 | **Applied** (AD-38 Rule 3: `siblingOrdinal(k, j) = k + 100 j`, normalizer before the per-event loop); the three reviewers proposed three formulas, the adversarial one was taken |
| "Same place" has three definitions; inputs do not exist | RW-2, ADV-11, DI-16 | **Applied** (AD-38 Rule 1: one `isSamePlace`, computed not stored, gazetteer as a versioned file) |
| Group integrity: no single writer, racy creation, no "confirmed", no Enforced-by | RW-10, ADV-1, DI-7, DI-8, DI-15, DI-19, ADV-22 | **Applied** (AD-36 Rule 16, Rule 5 amendment, detector table) |
| Organizer key space and stability | ADV-4, DI-8, RW-11 | **Applied** (uuid FK to the profile, organizer-authored publisher, twin-merge repoint) |
| Discovery collapse: uuid type error, no request switch, not on master, dissolved groups still collapse | RW-8, VC-3, VC-6, ADV-5, DI-15 | **Applied** (AD-36 Rule 13: delivery gate, `groupCollapse`, pipeline order, EXPLAIN gate) |
| Delayed notification: no queue, no sender support, 5-minute drain | RW-9, VC-2, ADV-13, DI-11 | **Applied as `[PROPOSED]`** (AD-36 Rule 14: `notify_due_at` claimed by the existing drain). This replaces the SQS delay the owner confirmed: **needs the owner** |
| Gemini quota: live extraction is BYOK, the system key is fenced by AD-10 | RW-1, VC-1, VC-5, ADV-17, DI-11 | **Applied as `[PROPOSED]`** (AD-38 Rule 5: two options, ledger, Pacific day, models named). **Needs the owner** |
| `pin_trust`: shipped predicate misdescribed, circular with area keys, stored verdict with no re-derive, incomplete consumer list, no cutover | RW-6, RW-7, VC-4, ADV-7, ADV-9 | **Applied** (AD-14 Rule 4 rewritten; tagged `[PROPOSED]`, the adoption tag was not supported by the decision log) |
| Place facts: precision stored and derived, seven writers, undefined combinations, area storage deferred, legacy `NULL`s | RW-12, RW-13, ADV-6, ADV-8, ADV-19, DI-9, DI-10, DI-16 | **Applied** (AD-39 Rules 1, 2, 7; `locationPrecision` derived; storage shape fixed as `[ASSUMPTION]`) |
| Account fallbacks in three places; curator audience area vs the AD-34 auto-confirm; "everything else is partial" vs the flowchart | RW-13, ADV-14, VC-17 | **Applied** (AD-39 Rule 3). The curator consequence needs the owner |
| Filter semantics: two "area" filters, lane as a second query, `tierFor` on an empty key set | ADV-18 | **Applied** (AD-39 Rule 5) |
| Matcher/sweep: system actor, queue bound, unordered pair index, sibling merges, backfill creates duplicates after the only sweep | RW-15, ADV-12, ADV-16, DI-17 | **Applied** (AD-30 Rules 7 and 9 amendments; AD-38 Rules 5 and 6) |
| One group per event vs programme item at two places | DI-6, ADV-20 | **Applied** (precedence: the programme wins; siblings tied by shared post and name) |
| Place split has no exemption for dependent stages or routes; activity split has no criterion; AD-30 says "superseded" | RW-4 | **Applied** (`isRoute`, own follow-up IDEA-089, AD-30 wording corrected) |
| Operational envelope silent (flags, metrics, rollback, migration order) | RW-16, DI-18 | **Applied** (AD-38 Rule 8, AD-39 Rule 7 table) |
| Adoption tags not supported by the decision log | RW-17 | **Applied** (AD-14 Rule 4, AD-38 Rule 4 re-tagged; Rule 6(b) tagged `[ASSUMPTION]`) |
| Wording and provenance of production claims | VC-8 | **Applied** (AD-14 Rules 3a and 5, AD-30 Rule 5) |
| AD-37: unwrap fragment aborts on non-JSON strings; three spellings; top-level string; existing readers; Drizzle pin age | RW-18, VC-9 to VC-13, ADV-21, DI-20 | **Applied** (AD-37 rewritten) |
| Original sentences left in place beside amendments that contradict them | RW-19 | **Applied** for AD-14 Rule 3 and AD-36 Rule 10; AD-36 Rule 1 gained the detector table |
| Account-default pin trust: a copied default drives Nearby | ADV-9 (d) | **Applied** (AD-14 Rule 4 (d)) |
| Favorites copy vs merge direction; `favoriteCount` multiplied | ADV-15 | **Applied** (AD-36 Rule 15: undo by invariant, distinct users) |

## Needs the owner (surfaced in the reply)

1. Which key the split backfill uses for Flash Lite re-extraction (AD-10 amendment for the system key, or
   contributors' keys), and the real quota numbers (owner-reported; Google's page lists none).
2. The notification mechanism: the database due time claimed by the existing 5-minute drain (proposed)
   instead of an SQS `DelaySeconds`.
3. New auto-detected curators stay `AWAITING_APPROVAL` (not scraped) until a moderator sets the audience
   area; curators already `CONFIRMED` keep being scraped with an unset area.
4. Smaller defaults taken as `[ASSUMPTION]`: "In your area" means `same` and `inside` only; other
   accounts' default location supplies an area (never a pin); pin-trust floor and the `full_match`
   clause; the `siblingOrdinal` stride of 100; the area-key storage shape.

## Not applied

- DI-15's alternative of dropping `member_count`: kept, with one recompute writer.
- RW-6's `pin_evaluated_with` as a separate column from a version string: applied as one text column.
- RW-7's mandatory partial index on coordinates: conditional on the EXPLAIN gate.
- ADV-22 items with no carrier today (moderator notification channel, `extracted_event_count`): recorded
  under Deferred in AD-36.
- Reviewer-run SQL (DI) was knowledge, not a run: each story confirms enum, advisory-lock and expression-index
  behavior on the scratch database.
