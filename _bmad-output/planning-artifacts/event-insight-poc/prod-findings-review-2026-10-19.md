# Review of the production report and the event-group plan (AD-36) — 2026-10-19

**What this is.** A check of two things you pushed: the production findings (`results/prod-findings-and-event-groups-2026-10-19.md` and its query files) and the event-group plan (AD-36 in `festgrid-architecture-spine.md`, IDEA-084 / IDEA-085 / BUG-068 / FIND-091). **I did not edit the report or AD-36.** Where I think AD-36 needs a change, §4 lists it as a proposed amendment for you to accept or reject. I have no access to production: everything below is code reading, your report's numbers checked for consistency, and measurements on a **scratch** PostgreSQL 16.15 (the repo seed grown to production's row count: not production data).

## 0. Result in brief

1. **The report holds up.** Its arithmetic is consistent (§1), its SQL is read-only-safe, and the two big findings — the double-encoded `location_details` and the wrong-country pins — are real. Two statements need correcting: the **double-encoding is not caused by the pooler** (reproduced, §2), and the **"5% recall" is not a clean measure** of the matcher (§5).
2. **BUG-068 is bigger than one column and cheaper to fix than the report assumed.** The cause is the application's own client (Drizzle 0.30.10 + postgres.js): it affects **all 27 `jsonb` columns**, in every environment. A two-line change plus one `UPDATE` per column fixes it (note `backlog/BUG-068-…md`). It blocks every SQL-side use of location data, including AD-36 Rule 9.
3. **AD-36's shape is sound** (a group entity and a nullable FK, three tiers, immediate-apply with moderator oversight, plan-only reshape, two hard sequencing gates). I found **ten gaps**, four of which would bite on the first day of implementation: the group's anchor is not handled by merges (G1), the reshape multiplies notifications (G2), the dedup gate is measured with a weak yardstick (G3), and nobody is working the moderator queue the plan relies on (G4).
4. **Production is much smaller than the scale proposals assumed**, and `jit` is off. Today's Discovery page costs about 8–10 ms on a scratch database of the same row count. The scale items (IDEA-076, IDEA-082, FIND-088) are not urgent; the data-quality items (BUG-068, BUG-066, duplicates) are.
5. Your open questions on the report's §9 now have answers: the mechanism (§2), whether it exists locally (yes), and the plan of the list query (§3, on scratch only; the production pack still has to run on your machine).

## 1. What I checked

| Check | How | Result |
|---|---|---|
| Your 12 query files are read-only | each one through `assertReadOnlySql` (the policy the production pack enforces) | 12 of 12 pass |
| They run | on a scratch database with the repo schema | 11 of 12 run. `loc.sql` fails at `jsonb_object_keys(location_details)`: "cannot call … on a scalar" — expected, because every value is a JSON string (it is BUG-068 itself; `loc2.sql` / `loc3.sql` are the corrected versions) |
| Report arithmetic | recomputed from the report's own numbers | consistent: 1,725 schedules = 1,460 pinned + 265 without a location; 1,725 / 1,394 = 1.24 per event; Aug 31 + Sep 434 + Oct 929 = 1,394; 253 / 1,394 = 18% stubs; 379 / 1,460 = 26% outside Indonesia; 23 / 446 = 5.2%. The country list sums to 1,372 of 1,460 (88 pins in countries not listed) |
| Events per post | 1,326 posts with 1 event + 38 with 2 or more = 1,364 posts; 1,394 events → at most 1.02, not 1.08 | **Resolved by the production run (see `prod-check-results-review-2026-10-19.md`): 1.08 is right.** The pack's definition (distinct primary posts, `events.post_id`) gives 1,286 posts and 0 events without a post; the report's 1,364 counts something else (plausibly posts reached through the `event_posts` link table; not checked). My "does not reconcile" was wrong about the number |
| Mechanism of the double encoding | probe script, five client configurations, plus the Drizzle 0.31.0 / 0.33.0 / 0.36.0 / latest driver sources | reproduced; §2 |
| The updated production pack | role created on scratch from `01-create-readonly-role.sql`, then the whole pack run as that role | every item runs, including the new "JSON encoding of jsonb columns" item. 250 POC tests pass, typecheck clean, backlog checker unchanged at its 69 existing failures (none on the new rows) |

## 2. BUG-068: the double encoding

`results/jsonb-encoding-probe.generated.md` (script: `scripts/poc-event-insight/probe-jsonb-encoding.ts`, scratch databases only):

| client configuration | Drizzle `jsonb()` insert | `$1::jsonb` with a JSON string | `client.json(obj)` |
|---|---|---|---|
| default (`prepare: true`) | **string** | **string** | object |
| `prepare: false` (what `db/client.ts` uses for the pooler) | **string** | **string** | object |
| `prepare: false` + `max_lifetime` | **string** | **string** | object |
| serializers 114 / 3802 set to pass-through | object | object | n/a |

- **Cause:** Drizzle 0.30.10's `jsonb` already returns `JSON.stringify(value)`; postgres.js 3.4.9 stringifies a `json`/`jsonb` parameter **again**. Drizzle's postgres-js driver only neutralizes the date types in 0.30.10; from 0.33.0 it also neutralizes OIDs 114 and 3802 (checked in the 0.33.0 tarball; absent in 0.31.0; 0.32.x not checked).
- **So the pooler is cleared**, and so is "does it exist locally": yes, my scratch database (written by the same code path) shows `string` for 2,008 of 2,008 schedules.
- **Scope:** 27 `jsonb` columns (I said 26 earlier; the schema has 27), all written through Drizzle. Only four of them are visible to the read-only role; the pack reports their `jsonb_typeof`. The reader-side damage is the SQL-side `->>` in the AI filter (`resolvers.ts:3401–3402`) and every planned SQL-side use. Reads through Drizzle are unaffected, which is why nothing looked broken.
- **Superseded 2026-10-19 (same day):** the fix mechanism is now `customJsonb` on the 27 columns, not the serializer line. `deferred-work.md` shows the team fixed three columns this way on 2026-08-29, the pass-through serializers would make those three columns error (probe), and the swap is migration-neutral. See `backlog/BUG-068-jsonb-columns-double-encoded-by-drizzle.md`. **Fix order matters** and is rehearsed in the probe: (1) stop writing strings (pass-through serializers, or Drizzle ≥ 0.33.0), (2) convert existing rows with `(col #>> '{}')::jsonb` where `jsonb_typeof = 'string'`. With step 1 done and step 2 not, Drizzle reads old and new rows alike; SQL-side reads see only the new ones.
- **Not fixed by this:** BUG-066 (379 pins in the wrong country, including Sleman City Hall at about (34, −84)). That is the geocoder choosing the wrong place; the encoding only hid it from SQL.

## 3. Production against what the scale proposals assumed

| Assumption in `proposal-posthog-and-list-scale.md` / the POC | Production (your snapshot) | Consequence |
|---|---|---|
| JIT could turn on above cost 500k and cost ~50 ms per page | **`jit = off`** | the JIT cliff is not a production risk today; keep the plan-guard rule (cheap insurance), drop urgency on the JIT half of FIND-087 |
| Phase 0: 4,200 events a month, an open set of about 5,000 | about 1,400 posts and 1,400–1,500 events a month at the October pace; **431 open** events of 1,394 | one third of the monthly volume and a twelfth of the open set. At this pace the catalogue at month 6 is about 9k, not 25k |
| the page statements cost tens to hundreds of ms at 30k–300k events (the count alone 31–348 ms), `proposal-posthog-and-list-scale.md` §3 | **≈ 8–10 ms** for a full page, count ≈ 2 ms (`results/perf-request-prodsize.generated.md`; scratch, 1,412 events, 1,082 open — a larger open set than production's) | IDEA-076 (ids + hydrate), IDEA-082 (junction candidates) and FIND-088 (the count) are **not urgent**; leave them `backlog` with the trigger "page p95 > 50 ms or open set > 20k" |
| the pack's country / adminArea / coordinate counts | artifacts of BUG-068 (your §3) | fixed in the pack: it now reads through `(location_details #>> '{}')::jsonb` and uses the `latitude` / `longitude` columns |
| events per post 1.0 | 1.02–1.08 (see §1) | the forecast's 1.0 is fine |
| 463 of 466 legacy accounts lack a default location | as reported (not re-measured) | IDEA-075's bulk update is the right size (466 accounts, not thousands) |

What is urgent is **data quality**: BUG-068 (blocks every SQL-side location use), BUG-066 (a quarter of the pins), and duplicates (13% of the catalogue are redundant rows: 91 same-name clusters, 181 redundant events).

## 4. AD-36 review

### 4.1 What is right

A group is neither a merge nor a schedule (Rule 1) — I agree, and the three mechanisms stay separate. One nullable `group_id` rather than a join table is justified by the three observed cases. Immediate-apply with moderator oversight reuses PRD §3.7's posture instead of a new gate. The plan-only reshape (Rule 6) and the two hard sequencing gates (Rules 9 and 10) are the right restraint.

### 4.2 Gaps

| # | Gap | Evidence | Proposed amendment |
|---|---|---|---|
| **G1** | **The anchor is not handled by a merge.** Rule 7 covers `events.group_id`, not `event_groups.anchor_event_id`. A merge soft-deletes the loser (`deletedAt` + `mergedIntoEventId`, `merge-events.ts:221`), so the FK's `ON DELETE SET NULL` never fires and the anchor keeps pointing at a dead row. The SCH umbrella exists as four duplicate rows (report §4), so the first moderator merge hits this. | `merge-events.ts` repoints favorites, calendar additions, reports, event posts and aliases and journals each list for the undo; groups are not among them | Rule 7: a merge repoints `anchor_event_id` from loser to winner and journals it (`repointedGroupAnchorIds`) so `undoEventMerge` restores it; "active members" = `group_id` set and `deleted_at is null` |
| **G2** | **The reshape multiplies notifications.** One notification is sent per event (`notifyNewEvent` claims `notified_at` per event). Today a `program-lineup` post is one event; after Rule 6 it is N visible events. Production has 47 such posts, and the 29 `separate-events` posts already send one per non-stub child. The PRD states the rule: "Push notifications are sent per event, not per post" (Per-Event Handling → Notifications), so grouped events need a **PRD change**, not only a code change. | `notify-new-event.ts`; `process-ingestion-job.ts` (`shouldNotify = !isStub`, one call per inserted event) | Rule 6: amend the PRD rule for grouped events — notify once per group (the anchor, or one digest per post) and mark the children `notified_at` at insert; decide this before the reshape ships |
| **G3** | **The dedup gate's yardstick is weak.** Rule 10 asks for recall "measurably above the observed 5%" and `event_merges` > 0. One merge satisfies the second; the first is not a clean number (§5). | §5 | Rule 10: state the gate as measured on the **reachable** pairs (§5 query) — for example "pairs the matcher can reach are ≥ 80% in `event_merges` or `dismissed`, and no candidate older than 7 days" — and make the number part of the story's acceptance test |
| **G4** | **Nobody is working the moderator queue the plan leans on.** 147 candidates pending, 75 older than 7 days, 0 merges ever. "Notify, don't block" is safe only if the effect of an unreviewed group is harmless. | report §6 | Rule 4: give the unreviewed state a **bounded effect**: until confirmed (Tier 1 or a moderator), a group shows only a "Part of …" link on the event page; collapsing in Discovery and any inheritance (Rule 9) apply to confirmed groups only. Add a per-tier kill switch (config flag) and a daily cap on suggestions |
| **G5** | **Discovery flooding and the audience area.** A group puts 9–21 events from one venue in the same weeks (the SCH family alone is 21 events) into a ranked list; nothing says how Discovery treats siblings. Separately, a child with no stated audience area could take its group's — the user's own priority ("target area matters more than location") — and that does **not** depend on BUG-068 the way location inheritance does. | report §4; `proposal-target-area-and-scan-safety.md` | add to the plan: Discovery shows at most k events per group per page (k = 2 as a starting value, measured with the same scoring work) or one group card; and record "audience area may be inherited from the group" as an open decision for the filtering/scoring discussion, not as shipped behavior |
| **G6** | **Tier 2 has no defined anchor source and no organizer.** "Keyword plus organizer" needs a keyword. In the case study the product owner supplied "8th Anniversary"; nothing in the plan produces such a keyword for the next programme, and the schema has no organizer field on a group (`anchor_event_id` is nullable). | report §4, §7 | Tier 2 = a **seeded anchor**: a Tier 1 umbrella event or a moderator-created group carries `(keyword, organizer_account_id)`; new posts are matched against the seeded list **in memory at ingest**, not by scanning captions (no table scan, consistent with the scan-safety rule). Add `organizer_account_id` to `event_groups` |
| **G7** | **The venue test depends on broken location data.** Tier 2 requires the children to "share its venue"; production's own venue (Sleman City Hall) has 26 schedules pinned in the wrong country and the details are double-encoded. A coordinate comparison will miss real children and may match false ones. Third-party captions ("8th anniversary @slemancityhall") are right to be excluded, but the plan should say why. | report §3, §4 | until BUG-066 and BUG-068 are fixed, compare venue by **normalized venue name** plus account, not coordinates; third-party captions never attach an event on their own (keep, state it as a rule) |
| **G8** | **No index plan.** `events.group_id` is a new FK that is read for "children of a group" and "group of an event" and is scanned on `ON DELETE SET NULL`; `events.source_social_media_account_id` (the same-account join for Tier 1 and for the report's own duplicate queries) has **no index**. | `schema.ts` events indexes: name, types, categories, location, post_id only | `group_id` partial index (`WHERE group_id IS NOT NULL AND deleted_at IS NULL`); an index on the source account; run the new statements through `plan-guard.ts` on the volume seed |
| **G9** | **Tier 1's precision is a small sample.** "17 groups … all genuine"; the report does not say how many were read. If all 17, the 95% upper bound on the error rate is about 18% (rule of three). | report §5 | call it "no false group seen in 17", not "precise"; `source = 'title_pattern'` already lets the moderator detach rate measure it after launch — make that rate a named post-launch metric |
| **G10** | **Extraction is not deterministic, groups hang on its output.** The identical 418-character caption became 7 events in one post and 10 in another (report §4). A re-extraction can change the child set; the events table has a unique key on `(post_id, extraction_ordinal)`, so ordinals that move can orphan or duplicate children. | report §4; `events_post_id_extraction_ordinal_unique` | Rule 3: detection is idempotent and re-run after every ingest and re-extraction; only a moderator (or an explicit detach) ever clears `group_id`; a re-extraction never dissolves a group |

### 4.3 Outdated statements to correct (no design change)

- Rule 11 and the report's §3 / §9 call the double-encoding mechanism "a hypothesis" involving the pooler. It is verified and it is the client's serializer (§2). Rule 9's gate itself is right; its reason should cite the verified mechanism.
- Rule 10's "5%" should point at §5 below once the reachable-pair figure exists.
- The Binds line lists the double-encoding as BUG-068 `location_details`; it is 27 columns.

## 5. The "5% recall" (IDEA-085)

The report counts **446** same-account, same-normalized-name pairs and finds **23** of them in the candidate list. That is not the matcher's recall, because the matcher cannot act on most of those pairs by design (the code in `match-event-to-existing.ts` and the PRD's Cross-Post Event Matching rule, FR114):

| class | why the matcher cannot or should not match it |
|---|---|
| created before the matcher produced its first candidate | `findMatchingEvent` only runs when a **new** item is ingested; it never sweeps existing rows |
| two events of the same post | the matcher excludes events that share the new item's post (sibling guard); a 10-event agenda is not a duplicate |
| schedule dates more than 2 days apart | `DATE_WINDOW_DAYS = 2`; same name on different weeks is usually a recurring event, not a duplicate |
| reachable | the only class that is a matcher miss; and inside it, a **low** score (no candidate row) may be correct |

`results/prod-findings-review-2026-10-19-queries/recall-classes.sql` splits the 446 into these classes with counts and how many are in the candidate list. It passes the read-only policy and I checked its class logic on a rolled-back synthetic fixture (six pairs, three classes, counts as expected). **Run it with your `readonly_2` role** (it needs `event_posts` and `event_match_candidates`, which the report's queries already use). The honest recall is `in_candidate_list / pairs` **within class 4**. **Result (production, 2026-10-19):** class 4 had 166 pairs of which 21 were in the candidate list, 193 were legacy pairs and 86 were more than two days apart — **but my query had a dating bug that mis-filed pairs**; the corrected query and the analysis are in `prod-check-results-review-2026-10-19.md` §2. The honest recall on reachable pairs is at most 23/168 ≈ 14%. Original text: if class 4 is small, the matcher is mostly fine and the work is the moderator queue (G4), not the algorithm. If it is large, the next step is a replay: run the matcher's `computeMatchScore` on those pairs offline (events, schedules and links are readable) and see which signal fails. I can build that replay.

## 6. Tooling changes made in this pass

- `readonly-policy.ts` (the production pack): events-per-post counts only events with a post and prints `events_without_post`; a new item reports `jsonb_typeof` for `schedules.location_details`, `social_media_account_profiles.default_location`, `events.links` and `posts.additional_image_urls`; the location, pin and country items read through the normalizing expression and the `latitude` / `longitude` columns. `01-create-readonly-role.sql` grants the two extra columns (an **existing** role must have the grants re-applied).
- `probe-jsonb-encoding.ts`: new, scratch-only (local-only guard), includes the fix-order rehearsal.
- `recall-classes.sql`: new, read-only.
- Results saved: `results/jsonb-encoding-probe.generated.md`, `results/perf-request-prodsize.generated.md`.

## 7. Decisions I need from you

1. **BUG-068 (decided 2026-10-19; mechanism superseded, see §2):** fix by the two-line serializer change now (my recommendation: smaller, reversible, no Drizzle upgrade) or by upgrading Drizzle to ≥ 0.33.0? And may the fix be scheduled ahead of the personalization work, since it blocks it?
2. **AD-36:** which of G1–G10 do you want folded into the spine as amendments? My order: G1, G2, G3, G4 first (each changes a rule), then G6–G8, with G5, G9, G10 as story-level notes.
3. **Run `recall-classes.sql`** (and re-run the updated pack, which also prints the JSON-encoding item), and send the output back the same way as before.
4. The earlier open items still stand: how the UI renders stub events, the Geoapify key through the cloud environment variable (never pasted in chat), the PostHog consent and region, and then the discussion you asked for: **filtering and scoring for an event that has a target area but no recorded location** (G5's audience-area question belongs there).

## 8. Not verified

- Anything about production itself: I read your report and ran nothing against it.
- The Drizzle versions between 0.31.0 and 0.33.0 (where exactly the pass-through serializers arrived).
- That the pass-through serializer is safe for **every** process that writes jsonb (searched the non-test code for raw jsonb parameters: none; Lambdas that build their own client were not enumerated).
- The recall classes on production (the query is validated on a synthetic fixture only).
- The effect of group collapsing on Discovery ranking (G5): no measurement.
