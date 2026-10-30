---
backlog_id: IDEA-111
title: "Insight POC case: the Erafone Run 2026 Yogyakarta family (12 live events): which are series or programme members and which only complement the main event"
captured: 2026-10-28
---

# IDEA-111 — Erafone Run 2026 Yogyakarta: series, programme, or a post that complements the main event

## Why this case

The owner asked (2026-10-28) to take the live list at `https://fest-grid.vercel.app/en?q=erafone` and record each event as either a member of an event series / programme or a post that only complements the main event's data, with the post and event ids kept so it can be checked again after the race (2026-10-31). It is a compact real example of every pattern the insight POC and the dedup work meet at once: one organizer race with categories, programme items, pre-event logistics, reposts by curators, and a registration date that split one category into two events.

Terms (PRD 3.19): **Series** = the same activity at different places or dates; **Programme** = different activities under one named umbrella, each promoted on its own. A **repost** is a duplicate (PRD 3.18), not a group member. A **category** (5K, 10K) is not a group member either: by the 2026-10-28 owner decision (personalization plan, Revision 10) category siblings are one event whose tracks carry the difference.

## Proposed roles

- **MAIN**: the event the others hang off.
- **CATEGORY**: a race category (5K, 10K). Complements the main event as a track (personalization plan, Revision 10); never its own card once merged.
- **PROGRAMME**: a different activity under the same umbrella, promoted on its own (PRD 3.19 Programme). Stays its own event, grouped.
- **PRE-EVENT**: happens before the race day, at another place or online, for the same participants. Programme member or own event; to decide.
- **REPOST**: the same event posted by another account. A duplicate of the main event (PRD 3.18), not a series.
- **UNCLEAR**: needs the post opened.

The roles come from names, dates, accounts and categories. The captions were not read (the curators' captions are cleared after extraction anyway, PRD 3.16). Counts: 1 main, 2 categories, 2 programme items, 2 pre-event items, 4 reposts, 1 unclear.

## The 12 events in the list on 2026-10-28

### 1. MAIN — Erafone Run 2026 Yogyakarta Series
- event id `193c3095-2b43-4df0-b109-a9b5fc8adf20`, slug `ig_p_Deges-ppkj_`, account `erafone.run`
- schedule: 2026-10-31 @ Museum Gunungapi Merapi, Yogyakarta
- post `Deges-ppkj_` (post id `909d6569-13a4-4fa5-a27a-40a6a50b9309`) primary, p, account `erafone.run`
- post `DepKUx4mNbs` (post id `9fe0d3ef-d9a0-47d9-8c3e-41535d4b85e8`), p, account `myrace.organizer`
- post `De9ZQgHmGEb` (post id `de672307-653f-4f6b-bb2e-bf0ce24c3685`), p, account `erafone.run`
- why: The organizer's own race post (primary, organizer-authored, 3 posts across 2 accounts). Everything else hangs off it.

### 2. CATEGORY — Erafone Run 2026 - 5K Yogyakarta Series
- event id `d840f229-293d-456f-8d70-75cc05d549c0`, slug `ig_p_DetI5f1mHw8`, account `erafone.run`
- schedule: 2026-10-31 16:15
- post `DetI5f1mHw8` (post id `3ba0e8b8-672c-4ead-8606-8e91acbd3459`) primary, p, account `erafone.run`
- why: 5K on race day (16:15). A category of the main event: by the 2026-10-28 owner decision it complements the main event as a track (5K), it is not a separate event.

### 3. CATEGORY — Erafone Run 2026 - Yogyakarta Series (10K)
- event id `6f3befc9-2743-4d38-ad75-0b45c285c5aa`, slug `ig_p_Des6xstmDdE`, account `erafone.run`
- schedule: 2026-10-31 16:00
- post `Des6xstmDdE` (post id `97b1b216-f002-4ebe-9e66-ef9ea34da3d8`) primary, p, account `erafone.run`
- why: 10K on race day (16:00). Same as the 5K: a track of the main event.

### 4. PROGRAMME — Zumba bersama Zin Elda at Erafone Run 2026 Yogyakarta Series
- event id `8d07edec-bba5-4858-a22d-566e8ef6430f`, slug `ig_p_DeZM9RjmFDR`, account `erafone.run`
- schedule: 2026-10-31 16:50 @ Museum Gunungapi Merapi Yogyakarta
- post `DeZM9RjmFDR` (post id `f36cf255-f362-4dd5-a4bd-2c5a3909afd4`) primary, p, account `erafone.run`
- post `DebmTdemD0T` (post id `c0448cc8-c8ef-4585-b0a8-ba9f59880335`), p, account `erafone.run`
- post `DebHU6OmKBQ` (post id `2e2178fb-7788-4eea-9dff-d30c906a82f4`), p, account `erafone.run`
- post `DebAidImM2n` (post id `9bbd7576-0a98-4505-a5b4-31fdde0f5ed3`), p, account `erafone.run`
- post `DebVKyQmCck` (post id `cf484492-b038-43af-a05e-a662e1f82dd6`), p, account `erafone.run`
- post `DebdpcHGDk2` (post id `857262fa-275c-462d-94ac-93d54332767b`), p, account `erafone.run`
- post `De3p0RGGCW2` (post id `e41b67df-1693-4b62-a658-b6ad5d7b49fb`), p, account `erafone.run`
- why: Zumba with a named instructor, 16:50 on race day; 7 posts from the organizer account. A different activity under the race umbrella.

### 5. PROGRAMME — erafone Run 2026 Yogyakarta Series - Music Performance
- event id `9e17d813-633f-4c3f-96b8-bffdb97fabf0`, slug `ig_p_Deges-ppkj_~1`, account `erafone.run`
- schedule: 2026-10-31 16:20 @ Museum Gunungapi Merapi, Yogyakarta
- post `Deges-ppkj_` (post id `909d6569-13a4-4fa5-a27a-40a6a50b9309`) primary, p, account `erafone.run`
- post `DeqqeVGmHkv` (post id `84c94fe8-526a-4e63-b53f-95993bfd186f`), p, account `myrace.organizer`
- post `De9E8KymKq9` (post id `7ea79d1d-1a99-440a-9fb7-55f752dff3e5`), p, account `erafone.run`
- why: Music Performance: a second event extracted from the SAME post as the main event; a different activity with its own audience, 16:20 on race day.

### 6. PRE-EVENT — Race Pack Collection Video Content Challenge - Erafone Run 2026 Yogyakarta Series
- event id `be8f727d-6e17-4595-8e0f-c454236533fa`, slug `ig_p_DeyLr38mKW4`, account `erafone.run`
- schedule: 2026-10-28
- post `DeyLr38mKW4` (post id `2f293b18-6293-4fdb-83ce-9dbc8de06337`) primary, p, account `erafone.run`
- why: A video content challenge tied to the race pack collection (2026-10-28, no place). Another activity of the programme.

### 7. PRE-EVENT — erafone Run 2026 Yogyakarta Series - Race Pack Collection
- event id `b24ccec4-c9ab-47a8-8ae2-be806afd592a`, slug `ig_p_Deq4tXAmKX4`, account `myrace.organizer`
- schedule: 2026-10-28 12:00 @ Plaza Ambarrukmo Mall Jogja, Mini Atrium - Hall A-B, Lantai 2
- post `Deq4tXAmKX4` (post id `536ba386-1775-43aa-8541-43badd2d96ef`) primary, p, account `myrace.organizer`
- why: Race Pack Collection, 2026-10-28 12:00 at a mall, posted by the race organizer account. Presumably for registered runners; a different date and place, so it belongs to the programme, not to the race-day event.

### 8. UNCLEAR — Erafone Run 2026 Yogyakarta Series
- event id `1a756a6b-207d-471f-a1a4-c20446e8e41d`, slug `ig_p_De1V1jOoOUv`, account `erafone.run`
- schedule: 2026-10-30
- post `De1V1jOoOUv` (post id `db4d7e16-6319-4fbc-bd15-14459cb674b8`) primary, p, account `erafone.run`
- why: Same name as the main event but dated 2026-10-30 with a city-level place. Could be the day before the race (expo or pack collection day two). Open the post before deciding.

### 9. REPOST — ERAFONE RUN 2026
- event id `740e250b-5ab6-4e84-b116-ba0b08a133fe`, slug `ig_p_De5-FdRBKy6`, account `stefanieprior`
- schedule: 2026-10-31 @ Museum Gn Merapi Yogyakarta
- post `De5-FdRBKy6` (post id `6ec8b38c-8c19-4898-9d03-84b180067225`) primary, p, account `stefanieprior`
- why: Probably a repost (another account, name in capitals, race-day date and venue). Account type not checked.

### 10. REPOST — erafone Run 2026
- event id `ae380658-a391-4a96-a076-4c6bdff3c5b5`, slug `ig_p_DenwVJloExf`, account `infoeventjogja`
- schedule: 2026-10-31 @ Museum Gunungapi Merapi Yogyakarta
- post `DenwVJloExf` (post id `f8ad60e2-d132-4dfe-bf99-fde03a37bf2b`) primary, p, account `infoeventjogja`
- why: A curator repost of the main event, different spelling of the name.

### 11. REPOST — erafone Run 2026 Chapter Yogyakarta
- event id `50614e70-9a87-4c4e-8fa7-4627a55f6cea`, slug `b4cf163405d7`, account `infoeventjogja`
- schedule: 2026-10-31 @ Museum Gunungapi Merapi, Yogyakarta
- no source post (legacy event)
- why: Legacy event from 2026-08-31 with no source post and a slug without the ig_ prefix; "Chapter Yogyakarta" is the only evidence of a series name above the Yogyakarta chapter.

### 12. REPOST — erafone Run 2026 Yogyakarta Series
- event id `bae556ef-eb9e-4dff-9b8d-b8c66e8bb6cb`, slug `ig_p_DeeBrOrmHw7`, account `laridijogja`
- schedule: 2026-10-31 @ Museum Gunungapi Merapi Yogyakarta
- post `DeeBrOrmHw7` (post id `d37e1d22-da3a-4276-8afc-6991a4232b74`) primary, p, account `laridijogja`
- post `DeeiPxlEv7u` (post id `7f4cd7f2-5e72-49fe-bc8e-247e39fbd32a`), p, account `wisatasleman`
- why: A curator repost of the main event (two accounts now: the second post was merged in by the 2026-10-28 drain). A duplicate across accounts, which the current dedup rules do not link.

## Related events that are NOT in the list (past)

### ig_p_DetWr5oGOKq — Erafone Run 2026 Yogyakarta Series - 5K
- event id `72f21a9b-6d1f-44c6-9ad8-09522aad89c2`; schedule: 2026-10-20
- post `DetWr5oGOKq` (post id `c92305f1-7954-4b07-b78c-c0234d443d09`) primary, account `erafone.run`
- post `Det7EEsIRu7` (post id `adb9e4b1-6bbf-4437-b70d-94923b81a12e`), account `erafone.run`
- post `Det8LyLIhn9` (post id `2a88d825-7b6e-473e-b03e-d59ac51cc1ab`), account `erafone.run`
- post `Det77N1oh7e` (post id `e7368288-de3c-4237-97ec-cc64f63b73d5`), account `erafone.run`
- post `Det7pDnoo_I` (post id `917c06c2-6401-4c40-882a-7d83e3309779`), account `erafone.run`
- post `De5XupxEtLb` (post id `0f5d5c05-6f34-4eb3-851a-3c5ccf79a8f9`), account `erafone.run`
- Past (2026-10-20): the 5K posts of the organizer account. Absorbed the plain "Yogyakarta Series" post (Det7EEsIRu7) in the 2026-10-28 drain. The 5K therefore exists as TWO events: this one dated 2026-10-20 (possibly a registration date) and the race-day 5K above. Only 11 days apart, so no rule links them.

### ig_p_De8fZ4cmL-G — erafone Run 2026 Yogyakarta Series
- event id `af59b27c-f7c5-43e3-b2cc-b9f188fdd7c2`; schedule: 2026-10-26
- post `De8fZ4cmL-G` (post id `419fd523-a81d-4e95-bd8f-15699bce2efd`) primary, account `erafone.run`
- post `De9lhEomNse` (post id `6a193697-9c61-4fea-98d7-7e4cbdcbf049`), account `erafone.run`
- Past (2026-10-26): two organizer posts about the same "Yogyakarta Series" day at "Kaki Merapi, Yogyakarta"; merged by the 2026-10-28 drain.

## Merged by the 2026-10-28 dedup drain (PR #102), for the record

- `ig_p_DeeiPxlEv7u` → `ig_p_DeeBrOrmHw7` (curator repost folded into the first curator repost; suggestion 9bd9d642)
- `ig_p_Det7EEsIRu7` → `ig_p_DetWr5oGOKq` (the plain "Yogyakarta Series" post into the 5K event; suggestion 3b231492; owner: merging 5K and 10K is fine)
- `ig_p_De9lhEomNse` → `ig_p_De8fZ4cmL-G` (the 2026-10-26 pair; suggestion 698bae36)

The curator reposts in the list (4 events) were NOT merged into the main event: the rules link only the same account or two stubs.

## What the insight POC should do with it

1. **Tracks from several posts.** The main event's tracks come from the 5K post, the 10K post and the main post together. Expected: two tracks (5K, 10K) with their own start times (16:15, 16:00), union by label, stable labels across posts ("5K" never "5 km").
2. **One category, two events.** The 5K is split across two dates (2026-10-20, possibly a registration date, and 2026-10-31). A registration window is a schedule of the event (spine Rule 5), so the target is one 5K event with two schedules.
3. **Programme items** (Music Performance, Zumba, Race Pack Collection, Video Content Challenge) carry their own audience; the insight is extracted per event, not copied from the main event.
4. **Reposts** must give the same insight as the main post; a disagreement between the reposts and the organizer post is a measurable inconsistency.
5. **POC set.** Three of these posts are already in the local POC post set (`Deq4tXAmKX4`, `DeeBrOrmHw7`, `DenwVJloExf`), and the account `erafone.run` has posts in it. Add the organizer posts above (their captions are kept; the curators' are cleared) as a labelled stratum "series", blind, with the new `post_kind` column.

## Re-checking later (stable keys: the event id and the post id)

The race is on 2026-10-31, after which the events leave the list. The ids still resolve:
- Public API, no login: `event(id: "<event id>")` or `eventBySlug(slug: "<slug>")` at the GraphQL endpoint (stack output `apiGatewayUrl`, path `/graphql`); both return past events, with `sourcePosts { postId platformPostId }`.
- After a merge an event id can become a merged-away row; the **post id** is the stable key, because merged posts move to the winner. Find the current event of a post with `event_posts` (`post_id` → `event_id`) or by the post's platform id in `sourcePosts`.
- The machine-readable copy of this snapshot is `IDEA-111-erafone-snapshot-2026-10-28.json` in this folder.
- Prod SQL needs a role that bypasses row-level security (since migration 0084 the read-only role sees nothing).

## Open questions

1. Is "Erafone Run 2026" a series (Yogyakarta is one chapter, "Chapter Yogyakarta" in the legacy event) or only this one race? Only the Yogyakarta chapter is in the data, so no series can be formed yet; ask the owner or look for other chapters' accounts.
2. Should curator reposts be linked to the organizer's event across accounts (IDEA-103, reposts)? 4 of the 12 events here are exactly that.
3. Do pre-event items (race pack collection) belong to the race's programme group or stay unrelated events?
4. The unclear 2026-10-30 event: open the post and fix its role.

Related: IDEA-106 (event report vs announcement), IDEA-103 (reposts), IDEA-105 (target area), the personalization plan Revisions 10 and 11 (tracks survive a merge; the per-field merge of an event's several posts, prototype `merge-event-insight.ts`), PRD 3.18 and 3.19.
