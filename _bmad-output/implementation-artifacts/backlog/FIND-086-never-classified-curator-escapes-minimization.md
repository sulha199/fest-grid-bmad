---
backlog_id: FIND-086
title: "A curator account that was never classified is treated as a normal organizer: its captions are not cleared after extraction"
captured: 2026-10-18
---

# FIND-086 — curator minimization keys off the classification, and old accounts have none

**Captured:** 2026-10-18 · **Status:** not reproduced — found by reading code while answering "what does a never-classified account mean". **Whether any such account exists is unknown**; the SQL below answers it.

## Evidence (code reading)

* `process-ai-job.ts`: `const isCuratorGuide = accountRow?.accountType === 'CURATOR_GUIDE';` — it reads `accountType` only. The curator behaviours hang off this flag: the post caption is set to `null` once extraction completes (PRD §3.16, Story 3.4o), and the curator branches in `build-gemini-request.ts` and `is-organizer-authored-post.ts` use the same type.
* `isScrapableAccountType(null, null)` is `true` and `getBatchScrapeTargets` selects `account_type_status IS NULL` — Story 3.4n AC5 grandfathered every pre-existing account on purpose ("a deliberate, user-accepted gap").
* So a curator that existed before 3.4n and was never classified is scraped like an organizer and, because its `accountType` is null, **escapes the minimization that exists for curators**.

## A second consequence (also by reading)

`is-organizer-authored-post.ts` says so in its own header: "A NULL accountType is NOT curator-typed". So a never-classified curator's post counts as organizer-authored: `process-ingestion-job.ts` does not make its events `stub` (`isCuratorSourced` is false), trusts its `organizerHandle` for matching, and the post can become an event's primary post and trigger the first-organizer notification. That is the opposite of what the curator design intends ("a misread curator must not become a primary or fire a notification").

## Resolution for part of the group

The product owner states that the never-classified accounts with **no location** are all Indonesian curators; setting them to `CURATOR_GUIDE`/`CONFIRMED` by one bulk update (SQL in IDEA-075) fixes both consequences for them going forward. Captions already stored stay until a separate, explicit deletion. Never-classified accounts *with* a location are not covered by that statement.

## Why it is registered separately from BUG-065

BUG-065 is about a wrong *location*. This is about an unmet *minimization* obligation for the same accounts, which has a different owner and a different fix (classify them — IDEA-075 — or treat null as curator-until-proven-otherwise for minimization). `impact: compliance`, because the failure has no user symptom.

## To verify first (read-only)

```sql
-- never-classified accounts that still hold stored captions
SELECT p.username, count(po.id) AS posts_with_caption
FROM social_media_account_profiles p JOIN posts po ON po.account_id = p.id
WHERE p.account_type_status IS NULL AND po.content IS NOT NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 50;
```

Then look at the top rows by hand: an aggregator among them confirms the finding. (Column names and the join key — `posts.account_id` is the profile's uuid `id` — were read from `packages/database/schema.ts`; the query was not run.)

Related: BUG-065, IDEA-075.
