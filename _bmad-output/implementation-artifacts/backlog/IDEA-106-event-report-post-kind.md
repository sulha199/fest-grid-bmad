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
- 78 of the 140 events inside the 37 stub-repeat clusters of the PR #102 evaluation come from one account, `badminton.ina`. That account holds 119 active stub events and 1 full event. Names include "Hylo Open 2026", "Hylo Open 2026 - Day 2", "Hylo Open 2026 - Men's Singles", "Yonex French Open 2026" (20 events for one date). It also accounts for 77 of the 103 near-misses the stub scan left apart.
- PR #102's stub-repeat rule merges the same-day copies after the fact. It does not stop a results post from creating an event, and it leaves the per-day and per-category variants (Day 2, Men's Singles) as separate events.
- The POC label sheet already had a related column, `is_event` (recaps and news were `no`). It did not cover the mixed case, and `no` meant the post was dropped.

## Decisions (owner, 2026-10-28)

1. **A three-way value**, not a boolean: `announcement | report | mixed`. `isEvent` stays the outer gate and is widened: true when the post is about a specific event, whether it announces or reports on it; false (and `postKind` is `none`) when it is not about a specific event (a personal vlog, a shop promo, a greeting, general news).
2. **A report is attached to its event when that event exists, and promoted to an event when there is none** (no parent event). It is never dropped and never creates a second event beside the one it reports on.

| `postKind` | behaviour (decided) |
|---|---|
| `announcement` | as today: create or update the event, dedup as in AD-30 Rule 7 |
| `report` | attach the post to the event it reports on (found by name and date with the dedup matcher); if there is no such event, promote the report to an event |
| `mixed` | the upcoming items become events (or update existing ones), and the report part is attached to the same event |

## Applied so far (POC, branch `claude/ecstatic-shannon-e8eh9h`, 2026-10-28)

- Prompt `audience-v3` (not yet run against a model, so extended in place): `isEvent` widened, new `postKind` line, `postKind` required in the v3 schema (`audience-insight.ts`). Prompt v2 is untouched.
- Guard: `postKind` is made consistent with `isEvent` (`none` exactly when not an event); a `report` or `mixed` answer with no results or recap wording in the caption is flagged **log-only**, not changed (`REPORT_CUE`).
- Run record: `postKind`, the model's own value (`postKindRaw`) and `postKindCue`.
- Label sheet: new column `post_kind` after `is_event` (`announcement | report | mixed | none | unclear`); `post_kind` must be `none` exactly when `is_event` is `no`; both labelling guides and `sheet_xlsx.py` updated. `is_event` is redefined: a recap or news of a specific event is now `yes` with `post_kind = report`; `no` is only for a post that is not about a specific event.
- Scorer (v3 runs): accuracy of `post_kind`; **announcements or mixed posts read as a report** (an upcoming event would be attached elsewhere or lost) with a proposed bar of 0; reports or mixed read as announcements (they would still create an event), reported; `report` rows leave the event-field denominators like `no` rows.

## Still open

1. **Production build** (not started; the POC branch changes no production code): add `postKind` to `geminiEventResponseSchema` and the system instruction (`build-gemini-request.ts`, `extracted-event.schema.ts`), and give `processAiJob` / the ingestor a report path (attach) and a promote path.
2. **Matching a report to its event.** A report named "Hylo Open 2026 - Day 2" must find "Hylo Open 2026". The mid-to-high promotion (AD-30 Rule 7) deliberately refuses a pair whose digit tokens differ ("Day 12" vs the plain series), so the report path needs its own matcher: the tournament name as a prefix once a day, round or category suffix is removed, plus an account or link signal. Decide the rule before building.
3. **How an attached report shows:** a news item on the event detail page, or only a link to the post.
4. **Existing data:** 119 active stub events from this one account. A one-off scan (same account, results wording, dates before the post date) can attach each to its tournament event or soft-delete it; run it after the dedup drain.
5. **Production guard:** when every extracted schedule date is before the post's `published_at`, the post is a report whatever the model said. It needs the extracted dates, which the POC call does not return, so it is a production-only check.
6. **Measure before shipping:** the owner labels `post_kind` on the POC sheets, including a sample of results posts (the POC set may hold few; consider adding about 40 posts from a results account as a separate stratum, labelled blind). Proposed bar: 0 announcements or mixed posts read as a report.

Related: IDEA-102 (link a schedule-less post to its event, same matcher), AD-30 Rule 5 (isEvent false is not persisted) and Rule 7 (stub repeat, PR #102), PRD Section 3.18 (Event Reports and News), POC `is_event` and `post_kind` columns (`poc-status.md`, labelling guides).
