# Production findings and the event-group opportunity (2026-10-19)

Source: read-only queries against production (PostgreSQL 17.6, Supabase) on 2026-10-19, run from the product owner's machine with the existing `readonly_2` role. Aggregates plus public event data only (event names, dates, venues, public captions of the venue account). No user, favorite or token table was read. Nothing was written, committed to the database or deployed. The queries are in [prod-findings-2026-10-19-queries/](prod-findings-2026-10-19-queries/).

## 1. Summary

1. **An "event group" is a real, measurable gap.** The Sleman City Hall (SCH) *8th Anniversary: REBORN* programme is stored three different ways at once (§4), and 20 of its 21 in-programme events carry no trace of the umbrella name.
2. **No deterministic rule discovers groups.** Dates, venue and account only *suggest children for an anchor that already has a name*; on their own they produce hundreds of false umbrellas (§5). The anchor must come from the title ("Umbrella - Child"), a keyword with an organizer, an extraction field, or a person.
3. **Deduplication is a prerequisite, and the built matcher has low recall.** 446 same-account, same-name duplicate pairs exist; the matcher proposes 23 of them (5%). 147 candidates are pending, 75 older than 7 days, and no merge has ever been performed (§6).
4. **Two data-quality findings that block area filtering** (§3): `schedules.location_details` is double-encoded in all 1,460 rows, and 379 of 1,460 pins (26%) lie outside Indonesia, including the SCH venue.
5. **Open items not measured:** the plan of today's list query (the local database that the capture needs is hung), and the mechanism behind the double-encoding.

## 2. Production check (the runbook's items)

| Item | Result |
|---|---|
| `jit` | **off** (PG 17.6; `max_connections` 60, `shared_buffers` 224 MB, `work_mem` ~2 MB, `max_parallel_workers_per_gather` 1) |
| Table size | `posts` 2,337 rows / 6.2 MB, `events` 1,339 est. / 2.5 MB, `schedules` 1,720 est. / 1.9 MB, 500 account profiles |
| Events | 1,394, none soft-deleted, 253 stubs (18%), 431 open. Created: Aug 31, Sep 434, Oct 929 (to Oct 19). |
| Events per post | 1.08 events per event-post. 1,326 posts have 1 event, 38 have 2 or more (max 10). |
| `grouping_reason` on posts | null 1,457, single-event 738, dependent-stages 61, program-lineup 47, separate-events 29, roundup 5 |
| Schedules | 1,725 (1.24 per event). 265 (15%) have no location; 1,460 have a pin. |
| Legacy accounts for the bulk update (IDEA-075 Profile enrichment) | 466 accounts with no type and no status, **463 of them without a default location** |
| Unused indexes | `event_types_idx`, `event_name_idx`, `event_location_idx`, `schedule_location_idx`, `schedule_performers_idx`, `schedules_slug_unique` (0 scans) |
| Plan of today's list query | **Not measured.** The resolver builds its SQL dynamically, and capturing it needs the local Postgres, which accepted the TCP connection and then dropped every session. At this size the plan will not matter yet. |

## 3. Data-quality findings

**Pack artifacts.** The pack in `prod-readonly-check.ts` reports "country (none) 1725", "with_admin_area 0" and "location_without_coordinates 1460". All three are artifacts: `location_details` is a jsonb *string* holding JSON text in every non-null row (1,460 of 1,460), so `->>'countryCode'` and `->'coordinates'` are always null. Coordinates are in `schedules.latitude` and `longitude` (1,460 pinned). Parse with `(location_details #>> '{}')::jsonb`. The mechanism is **not verified**; a candidate is the transaction-pooler client path (`prepare: false`) against the direct local database, but that is a hypothesis.

**Parsed country mix (1,460 pins):** id 933 (64%), none 160, us 104, fr 41, dk 27, my 24, in 23, es 19, eg 13, ca 11, br 10, lb 7. `with_admin_area` was not re-measured on parsed data.

**Wrong-country pins (BUG-066 Geocoding can land in the wrong country, now seen in production).** 379 pins lie outside Indonesia's bounding box. Some are right (Denmark Open, an Egypt event), many are not: Sleman City Hall at roughly (34, -84) in the US, Galeria Mall Jogja in Mexico, Plaza Ambarrukmo outlets in New York, "Online" in Montpellier. 26 SCH schedules are affected.

## 4. Case study: SCH *8th Anniversary: REBORN*

Keyword confirmed by the product owner: **"8th Anniversary"**. It appears in 14 post captions from three accounts (slemancityhall 7 plus 4 with no owner name on the same account id, tirta_lie 2, sarangbuah.id 1), in 7 event names, 11 event descriptions and 3 schedule titles. The two third-party accounts mean the same anniversary ("8th anniversary @slemancityhall"), so the keyword links **across accounts**.

The programme is stored three ways:

| Representation | Rows | Detail |
|---|---|---|
| One umbrella event with 3 to 4 schedules (Circus Entertainment, Special Performance: Pongki Barata, Spectacular Fireworks Show) | 4 rows for 28 Oct to 1 Nov, plus a Creative Market variant and a month-long (1 to 31 Oct) row | Three come from three distinct Instagram posts with the same caption (Sep 16); one from an Oct 12 post ingested twice as post and reel. This is the intended `program-lineup` behaviour (regression fixture 1 in `cc-024-reference-posts`). |
| The same programmes as standalone child events | 9 distinct children: Circus, Guest Star Pongki Barata, Line Dance Carnival, Zumba Anniversary, SCH Choir Competition 2026, SCH Halloween Dance Competition 2026, Spectacular Fireworks Show, Creative Market, Creative Workshop | Post `e464fcc3`: 7 events (`separate-events`). The same programme therefore exists as schedules inside the umbrella and as events. |
| A venue agenda post | 10 unrelated events across 40 days | Post `4936055f` has a caption **identical** to `e464fcc3` (418 chars) but extracted into 10 events instead of 7. Same input, different output. |

Duplicates multiply it: SCH Choir Competition 4 rows, Halloween Dance 3, Line Dance 3, Tirta Lie's Bakmi Festival 12.

**Keyword coverage of the in-programme events.** Of 21 SCH-family events (the `SCH` competitions, Circus, Pongki Barata, Line Dance, Zumba, Fireworks, Creative Market and Workshop; 3 of them, two September 3x3 Basketball rows and a September SUPER O2 Zumba row, probably are not part of the anniversary), **1 carries "8th Anniversary"** in its name, description or linked caption. The keyword does attach the *road-to* events: Jogja Otomotif Show #8 (two rows, description names it) and Tirta Lie's Bakmi Festival (cross-account captions). It does not attach the programme's own children.

## 5. Signals measured

| Signal | Result | Verdict |
|---|---|---|
| Title "Umbrella - Child" (same account, 2+ distinct children) | 17 groups, 52 events; spot-checked, all genuine (VICTORIA TOURNAMENT, Logolepsy 2026, UGM RunFest 2026) | Precise, free, and gives the group name. Covers about 4% and misses SCH. |
| Keyword plus organizer (`8th Anniversary` with `Sleman City Hall`) | Attaches the umbrella rows and cross-account road-to events; 1 of 21 children | Good anchor, poor child finder. Needs a named anchor per group; a bare "anniversary" is generic (not measured). |
| Children co-extracted in one `separate-events` post | 29 posts | Natural lineups, but includes false groups (the 40-day venue agenda; stages of one competition split into separate events). A 7-day bound would admit `e464fcc3`. |
| Umbrella schedule titles equal other events' names | 139 umbrellas, 221 children | Mostly duplicates ("BWF World Junior Championships 2026" vs "World Junior Championships 2026"). Usable only after deduplication. |
| Wording "rangkaian", "road to", "dalam rangka", "part of", "series" | 100 events (7%) | The phrase is in the text but the umbrella name is not extracted as a field. |
| Date containment, same account | 387 candidate umbrellas, up to 219 children | **Unusable alone**: mall-wide promo campaigns. |
| Date containment, umbrella spanning 3 to 7 days | 172 candidates, up to 38 children | **Still unusable alone**: a mall runs many promos in any week. |

## 6. Deduplication prerequisite

- Stories 3.6v (match new posts to existing events and enrich in place) and 3.6w (let moderators merge duplicate events with slug redirects) are built and at `review`. `event_merges` has 0 rows; `event_match_candidates` has 147 pending, none resolved, 75 older than 7 days.
- **Recall:** 446 same-account, same-normalized-name pairs; 23 in the candidate list. Of the 147 candidates, 128 are same-account and 33 same-name. 3 pairs touch the SCH family.
- 91 same-name clusters hold 181 redundant event rows (13% of the catalogue). Posts: 114 groups share a caption (132 redundant of 2,337); 7 platform post ids sit on two rows (post and reel).

Grouping over unmerged duplicates would build groups of copies, so the matcher's recall and the moderator queue come first.

## 7. Design direction (for `bmad-architecture` to decide)

A group is **neither a merge nor a schedule**: a merge says "these rows are one event", a schedule says "this event has several dates", a group says "these distinct events belong to a named programme".

| Option | Fit | Problem |
|---|---|---|
| A. Group entity (name, optional anchor event, window) with a nullable group on each event | Handles umbrella-less groups (Vifation 2026, tournaments), cross-account members, one group per event | A migration and a moderation surface |
| B. Reuse "related events" (Story 3.6u) | Exists | Related by shared post only; cannot express cross-post or cross-account groups |
| C. `parent_event_id` on events | Smallest | Needs the umbrella to exist as an event; fails for tournaments with only children |

**Recommended: A.** Populate in tiers: (1) auto-apply the "Umbrella - Child" title; (2) auto-suggest children of a named anchor inside its window, requiring the same venue and either a shared post or a schedule-title match; (3) person confirms, or the extractor emits a "part of" name. The tier-2 combination has **not** been measured for precision. At 1,394 events, a confirmation queue of a few dozen groups is feasible.

Two consequences to decide explicitly: (a) the `program-lineup` rule currently keeps lineups as schedules, which hides each programme from listing, filters and the calendar; (b) children without a location could inherit the umbrella's venue, which depends on fixing the wrong-country pins first.

## 8. Backlog rows proposed

| Proposed | Type | Title |
|---|---|---|
| BUG-068 | bug | `schedules.location_details` is stored as a JSON string, not an object, in every production row |
| FIND-091 | finding | Production measurements: wrong-country pins, matcher recall 5%, caption duplicates, and the pack's artifacts (links this write-up) |
| IDEA-084 | idea | Event groups: a named programme with children, detected by title, anchor and suggestion, confirmed by a person |
| IDEA-085 | idea | Raise the duplicate matcher's recall and clear the moderator queue before grouping |

Existing rows involved: BUG-066 (wrong country), BUG-063 (adminArea never written), BUG-064 (online and multi-venue events), IDEA-073 (area ladder), IDEA-081 (target-area resolver), IDEA-074 (personalized Discovery).

## 9. Not verified

- The mechanism of the double-encoding, and whether it exists in the local database.
- The plan and cost of today's list query on production data.
- Precision of the tier-2 suggestion rule; whether other organizers also use a generic "anniversary" phrase.
- Production Supabase specifics the runbook lists as unverified (RLS, pooler `SET LOCAL`) were not exercised: `readonly_2` is a different role from the runbook's `festgrid_poc_ro`.
- Everything here is a single snapshot of about 7 weeks of data.
