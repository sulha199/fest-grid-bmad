---
backlog_id: BUG-090
title: "Discovery's default order has no tie-breaker, so paging repeats one event and skips another"
captured: 2026-10-30
---

# BUG-090 — `Query.events` pages over a key that is not unique

## Capture

Found 2026-10-30 while recounting duplicate events through the public API (`events(limit, offset)`, no filter, no login). Every pass returned `totalCount` rows (664), but not 664 different events: one pass at page size 25 held 614 distinct ids, and the union of twelve passes at other page sizes still held only 652, while a read of the production database the same day counted 663 upcoming events: about 11 events never appeared in any pass.

So a user scrolling Discovery can see one card twice and never see another.

## Cause

The default branch of `Query.events` in `apps/backend/src/schema/resolvers.ts` orders by one expression: the event's next schedule start date. Hundreds of events share a date, so the order of the ties is the planner's choice, and with `LIMIT`/`OFFSET` Postgres may choose a different one for each page. The calendar and pinned-date branches already end in a schedule id; the default branch did not.

## Fix (same PR as this row)

`events.id ASC` as the last `ORDER BY` key of the default branch, and a test (`events-default-order-tiebreak.test.ts`): twelve events sharing a date come back in ascending id order, and paging at sizes 1, 4, 5 and 7 walks the same sequence as one full fetch. The test fails on the old code at page size 1 and passes on the new.

## What else this touches

- A duplicate count taken from the public list before this fix is inflated by repeated rows. The 2026-10-29 figures in IDEA-085 (41 groups, 90 events) and IDEA-112 (46 groups, 100 events) were very probably taken that way. A read of the production database on 2026-10-30 (distinct upcoming events, same posting account, same strict name, same start date) found 16 groups holding 37 events among 663 upcoming events, which is about 6%, not 13%.
- Any count from the public list must dedupe by event id and say so when the set is incomplete.
- Not changed here: the ordering is still by date only, so within a date the order is by id, not by start time. A better within-day order is a product decision for the ranked list.
