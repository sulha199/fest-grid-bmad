# Review R4 triage (2026-10-20)

Three independent reviews of the 2026-10-20 amendments (spine at commit `6549a03`): the **adversarial two-units** lens
(`review-r4-adversarial-two-units.md`, 17 findings: 1 critical, 8 high, 6 medium, 2 low), the **data-integrity** lens
(`review-r4-data-integrity.md`, 16 findings: 1 critical, 7 high, 5 medium, 3 low) and the **code review** of
`apps/backend/scripts/poc-event-insight/series-phrase.ts` and its tests (15 findings, run with the `code-review` skill at high
effort, 12 confirmed by running them). Overlap was heavy: the two architect reviews reached the same critical finding and the
same four or five high ones from different directions, which is the best evidence the clusters below are real.

Gate verdict before triage: **not safe to build from.** Read literally, the amendments hid events that option B promised to leave
visible, grouped the AKMU Asia Tour across four countries (the owner's own example), took no lock for groups with no organizer, and
let different brands collapse when the place text repeated the store. After triage: the clear fixes are in the spine (AD-36 Rule
17 and in-place edits, AD-30 Rule 7, AD-14 Rules 4 and 5, AD-38 Rule 5) and in the POC code (revision 3); what remains is listed
under "Needs the owner".

| Cluster | Found by | Disposition |
|---|---|---|
| Option B has no carrier; `confirmed_at` overloaded; Rule 4 collapses every member; "identical core" is pairwise and non-transitive | R4A-1, R4D-1 | **Applied** (AD-36 Rule 17.1, Rule 4, Rule 13, detector table): the decision is per member, `events.group_collapse_key` (equality of a per-event canonical key); the score decides only the link tier. The two reviews proposed two shapes (a key, an enum); the key was taken because equality gives the Dum Dum triple a deterministic answer |
| Revision 2 stripped a store brand when the place text repeated it; different brands collapsed (126 pairs at 0.85 or above in a 20,000-pair fuzz) | CR-1 | **Applied**: revision 3 removes a trailing run only if it is a *known venue* (in the place text of at least 15 distinct events; malls 16 to 236, store brands 1 to 9 on the export). Verified on the export: the result did not change between thresholds of 3 and 40 |
| Country: `eventCountry()` answers `id` for foreign events with no country in the text; reads the account default's and the geocoder's own address as the poster's words; not stored; no invariant; merge, undo, split, level change unspecified | R4A-3, R4D-2, R4D-3, R4A-9 | **Applied** (Rule 12 area scope, Rule 17.2, AD-14 Rule 4 (e)): `events.country_key` and `event_groups.country_key`, a composite foreign key, unsettled (NULL) attaches to nothing, stated text only, several countries named means none, Indonesian names. The foreign-key shape was tested on the scratch database by the reviewer |
| The attach lock is NULL for a group with no organizer (`pg_advisory_xact_lock` is strict: no lock, no error); nothing is compare-and-set; recount can deadlock; the nightly check is blind or fires on every roll; the daily cap is a silent drop | R4A-2, R4A-11, R4A-12, R4A-15, R4D-4 | **Applied** (Rule 17.3, Rule 16): never-NULL key per (detector, country), lock order, `FOR NO KEY UPDATE`, conditional `UPDATE`, `lock_timeout`, nightly reconcile on open groups, cap counts creations |
| Membership is not a function of the data: arrival order, chains, IDF drift, no stored basis, dissolve not sticky, renamed members stay hidden | R4A-4, R4D-5 | **Applied** (Rule 17.1): compare with the stem (no chain), pinned `name_token_df` snapshot, join journal, add-only re-attach, revalidate hook on name or place writes, exclusions table |
| Detector precedence omits `series_phrase`; pool undefined; place-split groups are per post and never roll; enum and schema paragraph incomplete | R4A-5, R4D-13, R4A-17 | **Applied** (Rule 17.4) |
| Notifications: N pushes per promo for one user; "after the claim" ambiguous; recipient account not stored; claim by linked, not primary, post | R4A-6 | **Applied** for the mechanism (Rule 17.5); **needs the owner** for the per-user rule |
| AD-30 Rule 7: exact-repeat merge ignores rejections, has no undo memory, no locks, no correction transfer, date-only match, about 111 events in one run; unordered-pair index breaks the live `ON CONFLICT`; `superseded` and expiry collide with the index | R4A-7, R4D-6, R4D-7 | **Applied**: the exact-repeat merge stays `[PROPOSED]` with six preconditions and a capped first run; the ordered constraint is kept; expiry is derived; `superseded` is reopened, never re-inserted |
| Hashtag evidence: undefined terms; the guard does not separate good from generic tags (98% of tags count as rare); "only event of its post" unreadable at ingestion | R4A-8, R4D-10 | **Applied**: own switch, default off, until `isEvidenceTag()` exists with fixtures; `posts.extracted_event_count`; tags read once and journaled; tag joins are link-only, so a wrong one hides nothing |
| Derive job: no journal for the re-geocode, order can leave 158 pins untrusted forever, cached pins never get `result_type`, stale inputs, switch gate | R4D-8 | **Applied** (AD-14 Rule 4 derive paragraph) |
| Aggregates: `deleted_at` writers outside the ratchet; hard-delete recount; `isSamePlace` not transitive; unknown-area cap deletes a whole series | R4D-9, R4A-10 | **Applied** (Rule 17.6) |
| Eligibility: three definitions of "the organizer"; the measurement counted curator events the rule excludes; cross-poster same-place duplicates fall between the detector and the matcher | R4A-13, R4A-14 | **Applied** (Rule 17.7, Rule 12 numbers re-cut: cross-account 22 clusters and 53 events, same-account 26 and 94; BWF, RSIH, Denmark Open and AKMU are curator-only today) |
| Split: group id without country, late sibling after dissolve, copy list, legacy `notified_at`, ordinals share a tunable normalizer; Rule 5 simplification loses preview, idempotency and duplicate check; gate misplaced | R4D-11, R4D-12, R4D-14, R4D-15, R4A-16 | **Applied** (AD-38 Rule 5 paragraph, Rule 17.2) |
| Conventions: hand-written SQL, soft-delete wording, jsonb, project-context carries none of the new rules | R4D-16, R4A-17 | **Applied** (Rule 17.4, `project-context.md`) |
| Safety net has no carrier and the switch does not undo | R4D-5, R4A-15 | **Applied** (Rule 17.8): bulk `dissolveBySource`; the nightly list has no delivery channel until IDEA-090, and the rule says so |
| Code: numeric tokens count as shared words; a bare number is a "place run"; connectors in the place text; possessives; `a`/`an` dropped; non-Latin marks shredded; whole-word drop and leftover connector in `groupName`; `idfFrom([])` is NaN; duplicates inflate df; null place throws; `groupName` re-derives an unweighted decision; duplicated run logic; weak tests | CR-2 to CR-15 | **Applied** in revision 3 (`series-phrase.ts`, 19 tests; POC suite 278 of 278). Residual, documented in the file: word order changes the key; a single word plus a year never groups; `Run-Kenes` with no space keeps the partial word |

## Owner decisions (2026-10-20, after the triage)

1. **Notifications:** suppress per `(user, group)`. Adopted in AD-36 Rule 17.5 (`event_group_notifications`, the insert is the per-user claim).
2. **Cost of the country scope:** read as acceptable (the safe direction); Round 4 still sizes it.
3. **Exact-repeat merge:** adopted for both paths (live matcher and sweep) on the owner's yes. The date test became identity, not overlap, after a 16-cluster sample (AD-30 Rule 7: 56 clusters, about 94 events instead of 63 and 111).
4. **PostgreSQL version:** production runs 17.6, so `ON DELETE SET NULL (group_id)` is usable (AD-36 Rule 17.2).
5. **Date gap:** `GAP` 120 days within one account, 30 days across accounts, adopted (AD-36 Rule 12).

## Needs the owner (as written at triage time)

1. **Notifications for a cross-account group** (Rule 17.5): accept one push per `(group, source post)` (a user subscribed to three
   malls hears three times), or suppress per `(user, group)`. Recommendation: suppress.
2. **The cost of the country scope** (Rule 12): an Indonesian event whose only pin is a wrong foreign one, with no area key and no
   country in its text, stays ungrouped. It is the safe direction; Round 4 sizes it.
3. **The exact-repeat merge** (AD-30 Rule 7) is still `[PROPOSED]` and now carries six preconditions; it needs your yes and the PRD
   sentence.
4. **PostgreSQL version** for `ON DELETE SET NULL (column)` (15 or later): to verify on production before the migration.

## Not applied, and why

- R4D-1's alternative carrier (`events.group_join` enum with `strong_count`): the per-member key replaces it and also fixes the non-transitive triple.
- R4A-9's alternatives to a country-name list (a "result agrees with the query" test, or an extractor `country` with verbatim evidence): recorded in AD-14 Rule 4 (e) as untested options; they need the 87 labels and the probe responses.
- R4D-8's alternative of a lock per name token instead of per country: more locks for the same effect, and sorted-order discipline to avoid deadlock.

## Limits of the reviews

No two-session run was possible, so the lock conflicts rest on PostgreSQL documentation; Supavisor was not exercised; the data is the
author's in-sample export with labels from names only and a crude place check; `ON DELETE SET NULL (col)` was tested on PostgreSQL
16.15, not on production.
