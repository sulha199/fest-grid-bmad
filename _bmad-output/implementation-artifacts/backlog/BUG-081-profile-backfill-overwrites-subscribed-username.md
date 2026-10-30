---
backlog_id: BUG-086
title: "Profile backfill overwrites a subscribed profile's username and display name with a non-owner post's, so the batch scrapes the wrong account"
captured: 2026-10-26
---

# BUG-081 — The profile backfill relabels subscribed profiles from posts their account did not publish

## Capture

Found 2026-10-26 from read-only PROD queries and the scraper Lambda's CloudWatch logs (`/aws/lambda/FestgridBackendStack-prod-ScraperLambdaprodF94C650-iMFmm3gJwPEO`). Urgent: it grows every batch, and the next batch is 2026-10-27 03:13 UTC.

`backfillAccountProfileAndInferDefaultLocation` (`apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.ts`) took the FIRST scraped post carrying an `ownerUsername` or `ownerDisplayName` and passed it to `computeProfileBackfillPatch`, which set the profile's `username` and `displayName` to that owner's whenever they differed. Nothing checked that the post's owner was the profile's own account. A scrape of a curator or collab account returns reposts and collabs of other accounts, so the first post often belongs to someone else.

The scrape URL is built from `profile.username` (`https://www.instagram.com/${username}/` in the Apify and Bright Data triggers, `username: [account.username]` for the Apify actor), so after the rewrite the next batch scraped the wrong account, and its posts were stored against the subscribed profile.

## Evidence (PROD, 2026-10-26)

13 of 30 handle-keyed subscribed Instagram rows have a `username` different from `account_id`, all with `updated_at` 2026-10-26 03:18-03:44 UTC (the moment of their scrape):

| account_id | username now |
|---|---|
| laridijogja, visitingjogja, visitkulonprogo | kulonprogohalfmarathon |
| wisatasleman | popcircle.pro |
| jogjaexpocenter | kemenhaj.diy |
| masjidjogokariyan | fui.diy |
| info_turnamen_fc | elrumifc |
| jogjacoffeeweek.id | mors.roastery |
| jogjarun.id | generun2026 |
| jogjakpopermedia.id | hrtzon.yk |
| lari_jogja | kepikir.run |
| lintaslari.id | laridijateng |
| turnamenbulutangkis | sayapputihmanagement |

Scraper Lambda logs: the 10-24 batch scraped no swapped names; 10-25 scraped 9 of them (elrumifc, fui.diy, generun2026, hrtzon.yk, kemenhaj.diy, kepikir.run, laridijateng, mors.roastery, sayapputihmanagement); 10-26 scraped those plus `kulonprogohalfmarathon` three times (rows `laridijogja`, `visitingjogja`, `visitkulonprogo`).

### Probable numeric-keyed victim: profile `0587b45b-cdb1-4ffd-b0f5-c86542bb8c2b`

`account_id` 4842911995, `username` masjidmuhajirinnitikan, `display_name` "Masjid Muhajirin Nitikan". Apify's raw output pairs 4842911995 with username `jogjakajian` ("Info Kajian Jogja .JogjaKajian", the local kajian curator) as `ownerId` of https://www.instagram.com/p/DeeAONmFE4r/ and as a collab co-author of https://www.instagram.com/p/Deiw9h4xcsi/ (published by `pojokdakwah_mbm`, co-authors `kolaborasijogja` and `jogjakajian`). The row's feed holds posts of 12+ owners (reposts and collabs), including the mosque's own. So the row is most likely `jogjakajian`'s account, relabelled by this backfill; the mosque's real row is probably `37757e54-6105-4879-a306-6e625e463e33` (`account_id` 8490230452, created 10-23, no subscription). **Inferred, not proven**; the creation history of the row is unknown. It is not auto-fixed anywhere: the repair lists it for a human decision.

An earlier reading, "the mosque's feed with `jogjakajian`'s ID", was wrong for the same reason: the numeric ID is the stable part and the label is what the bug rewrote.

## Relationship to BUG-059

Related, but a different defect. BUG-059 is the twin split (a subscribed handle-keyed row and a discovered numeric-keyed row for one account). This is the username overwrite: it hits handle-keyed rows that have no twin, and it also relabels a numeric-keyed row. Both stem from `account_id` holding two kinds of value, but fixing one does not fix the other. The numeric `account_id` identity unification (`specs/spec-profile-identity-unification/DESIGN.md`) stays a separate item; this fix does not depend on it.

## Why now (inference, checked against code)

The backfill is called from exactly two places: `processScrapeJob` (the synchronous scrape: the SQS fallback, a new subscription's first scrape, and the local inline fallback) and `processAiJob` (once per extracted post, only while the profile has no default location). The asynchronous result processors (`process-brightdata-result.ts`, `process-apify-async-result.ts`) persist posts but never call it. So while Bright Data served Instagram through the async path, the sync entry point was rarely reached. Bright Data has returned 0 records since 2026-10-21, so scrapes fell to Apify and, when the async trigger failed, to the sync queue path; PR #98 lets more of those finish. That chain is consistent with the 10-24 batch being clean and 10-25/26 not, but **I could not check PROD logs or timing from the cloud session**, and the `processAiJob` entry point is vendor-independent, so it may have contributed. The same fix covers both.

## Fix (this change)

- **Match the owner to the profile** (`isPostOwnedByProfile`, `selectOwnPostForBackfill` in `packages/domain/src/scraper/account-enrichment.ts`): a handle-keyed profile matches a post whose `ownerUsername` equals `account_id` (case-insensitive, `@` stripped); a numeric-keyed profile matches a post whose `ownerId` equals `account_id`, and when the post also names an owner handle that disagrees with the row's real username that is an identity conflict and does not count. The first MATCHING post is used, not the first post with an owner. A profile's own (possibly relabelled) `username` never proves ownership.
- **`username` is not overwritten once set.** `computeProfileBackfillPatch` fills an empty `username` (or, on a numeric-keyed row, the numeric placeholder `resolveDiscoveredIdentityNames` writes) and fixes a case-only difference. A different handle never replaces a set one, because the scraper builds its target from it. `displayName` still follows the owner's current name, from a matching post only. Cost: a numeric-keyed account that renames itself on Instagram is no longer relabelled automatically.
- **Guard the scrape target** (`resolveScrapeHandle`): a handle-keyed profile is scraped by `account_id`, the handle the subscriber typed and the row's identity, not by the mutable `username`. Applied where every `ScrapeTarget` is built (`getBatchScrapeTargets`, `triggerAccountScrape`, the subscribe-time cascade, the moderator-resolution first scrape, the fallback enqueue). **This is what protects the next batch even before the repair runs**: the 13 rewritten rows are scraped by their real handle as soon as the fix deploys. The Bright Data and Apify trigger code is unchanged.
- **Repair, not executed**: `apps/backend/scripts/repair-rewritten-profile-usernames.ts` and `.github/workflows/repair-rewritten-profile-usernames.yml` (migration 0083 adds the `account_profile_repairs` audit table).

## Runbook

1. Merge, let CI/CD deploy (this applies migration 0083).
2. Run workflow **Repair Rewritten Profile Usernames** with `apply` unchecked. Read the log: `PLAN` lines are the handle-keyed rows that would be restored (expected: the 13 above); `REVIEW` lines are subscribed numeric-keyed rows whose label is not confirmed by the vendor (expected to include `0587b45b`).
3. Re-run with `apply` checked (needs the `production` environment approval and writer credentials). Each row is one transaction with an `account_profile_repairs` row holding the old and new values.
4. A restored row whose log line says `display_name ... UNCHANGED` had no post of its own on file; set its name by hand.
5. Decide the `REVIEW` rows by hand (is `0587b45b` `jogjakajian`? then relabel it and give the mosque its own subscription row). Not automated on purpose.

## Not changed here (follow-ups)

- Posts the 10-25/10-26 batches scraped from the wrong accounts were stored: the publisher's posts under the publisher's profile, with a `SCRAPING_SOURCE` association to the subscribed row. They are real posts of real accounts, so not harmful on their own, but they show up in the subscribed account's listings. No cleanup is attempted.
- The location-inference half of the same function still uses the first post with a usable signal, whoever published it, so a curator's reposted post can still propose a default location for the curator's profile (the existing confidence gating of `applyDefaultLocationChange` still applies).
- The `processAiJob` entry point passes no `ownerId`, so a numeric-keyed profile is never name-backfilled from there; its names come from discovery.
