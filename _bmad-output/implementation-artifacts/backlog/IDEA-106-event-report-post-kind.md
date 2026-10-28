---
backlog_id: IDEA-106
title: "Tell an event report or news post from an announcement in the AI extraction (post_kind: announcement | report | mixed)"
captured: 2026-10-28
---

# IDEA-106 — Event report or news vs announcement, in the extraction

## What the owner asked (2026-10-28)

While spot-checking PR #102 (event dedup), the Hylo Open 2026 clusters turned out to be posts that combine a schedule with an event report or news. The owner asked whether the AI extraction can return something like `is_event_report` / `is_event_news`, so an event report is easy to detect.

## Evidence (read-only prod, 2026-10-28)

- The production extraction has one gate, the top-level `isEvent`, defined in `build-gemini-request.ts` as "an event poster or event advertisement for at least one event". A results or news post that also lists the next matches passes it, and `processAiJob` then persists one stub event per post.
- 78 of the 140 events inside the 37 stub-repeat clusters of the PR #102 evaluation come from one account, `badminton.ina`. That account holds 119 active stub events and 1 full event. Names include "Hylo Open 2026", "Hylo Open 2026 - Day 2", "Hylo Open 2026 - Men's Singles", "Yonex French Open 2026" (20 events for one date).
- PR #102's stub-repeat rule merges the same-day copies after the fact. It does not stop a results post from creating an event, and it leaves the per-day and per-category variants (Day 2, Men's Singles) as separate events.
- The POC label sheet already has the idea as a column: `is_event = no` means no schedule (recap, repost of a personal vlog, news, shop promo, greeting). It does not cover the mixed case.

## Proposal (to confirm)

A top-level `postKind` enum next to `isEvent`, in the same call (no second call; same reasons as the insight piggy-back):

| value | meaning | behaviour (suggested) |
|---|---|---|
| `announcement` | poster, advertisement, upcoming schedule | as today |
| `report` | results, recap, news, live update about an event that is under way or over, no upcoming schedule | create no event; try to attach the post to the open event of the same name and date (IDEA-102 matcher), otherwise drop it |
| `mixed` | a report that also states an upcoming schedule | extract only the upcoming schedule items; mark the post |

Guards (the model proposes, code verifies, as in the insight design): a `report` or `mixed` needs a past-tense or results cue in the caption (juara, hasil, final, winner, recap, "telah", "berhasil"), and a deterministic cross-check: when every extracted schedule date is before the post's `published_at`, the post is a report whatever the model said.

## Open questions for the owner

1. Boolean (`isEventReport`) or the three-way enum? The enum is needed to keep the upcoming schedule of a `mixed` post.
2. What happens to a report: dropped, or attached to its event as a news item on the detail page?
3. Existing data: 119 stub events from this one account. A one-off scan (same account, results wording, dates before post date) could soft-delete or tag them; the dedup drain should run first.
4. Measure before shipping: label about 40 posts from this account (announcement / report / mixed) blind and score the field like the other POC fields.

Related: IDEA-102 (link a schedule-less post to its event), AD-30 Rule 5 (isEvent false is not persisted), AD-30 Rule 7 (stub repeat, PR #102), POC `is_event` column (`poc-status.md`).
