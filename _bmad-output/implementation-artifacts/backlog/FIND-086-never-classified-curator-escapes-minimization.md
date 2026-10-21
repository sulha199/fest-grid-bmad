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

## Resolution for part of the group (decision 2026-10-18)

The product owner states that the never-classified accounts with **no location** are all Indonesian curators. The bulk update in `IDEA-075-legacy-bulk-update/` sets them to `CURATOR_GUIDE`/`CONFIRMED` (tested on a scratch Postgres 16 with the real migrations; not run on production), which fixes both consequences for them going forward. Captions already stored stay until a separate, explicit deletion.

**Not resolved — by decision:** never-classified accounts that *already have a location* are not changed. If one of them is a curator it still escapes the minimization and the stub/notification handling. `04-after.sql` lists such accounts whose events are scattered over five or more cities (a curator's shape); that is a lead to read, not a finding.

## Decision (2026-10-19)

Captions already stored for the bulk-updated accounts: accept "cleared at next re-extraction"; no purge. Posts that are never re-extracted keep their caption until they are.

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

Then look at the top rows by hand: an aggregator among them confirms the finding. (The join key is `posts.account_id` = the profile's uuid `id`. The query was run, rolled back, against a scratch PostgreSQL 16 built from the repository's 80 migrations: it parses and every column resolves. It was not run against production data.)

Related: BUG-065, IDEA-075.
