# HOTFIX TASK: profile backfill overwrites subscribed usernames, so the batch scrapes the wrong accounts (2026-10-26)

Base: latest `master`. Open a PR against `master`. Do NOT merge or deploy. It grows every batch; the next batch is 2026-10-27 03:13 UTC, so get the PR up well before then (CI/CD auto-deploys on merge, about 15-20 min).

Read first: `CLAUDE.md`, `_bmad-output/project-context.md`, the PRD, and `_bmad-output/implementation-artifacts/backlog/BUG-059-subscribed-profile-twin-split.md`. Verify every claim below against master before relying on it; say so in the PR if one is wrong.

## Root cause (code on master + read-only PROD queries + CloudWatch, 2026-10-26)

- `apps/backend/src/lib/accounts/backfill-account-profile-and-infer-location.ts` takes the FIRST scraped post that has an `ownerUsername` or `ownerDisplayName` and calls `computeProfileBackfillPatch` (`packages/domain/src/scraper/account-enrichment.ts`), which sets the profile's `username` and `displayName` to that owner's whenever they differ. Nothing checks that the post's owner IS the profile's account (`ownerId` vs `profile.accountId`, or `ownerUsername` vs the handle). A curator or collab feed whose first post belongs to someone else rewrites the profile. It runs from `processScrapeJob` (`runBackfill`) after every completed sync scrape.
- The scrape URL is built from `profile.username` (`https://www.instagram.com/${username}/` in the Apify and Bright Data triggers), so after the rewrite the next batch scrapes the wrong account.
- It was dormant while Bright Data (async path, which has no backfill) served Instagram. Bright Data has returned 0 records since 2026-10-21, so everything goes through Apify and the sync path. PR #98 also lets more scrapes complete, so more backfills run. (Inference; verify.)
- Evidence: 13 of 30 handle-keyed subscribed Instagram rows have a `username` different from `account_id`, all with `updated_at` 2026-10-26 03:18-03:44 UTC (the moment of their scrape):

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

- Scraper Lambda logs (`/aws/lambda/FestgridBackendStack-prod-ScraperLambdaprodF94C650-iMFmm3gJwPEO`): the 10-24 batch scraped no swapped names; 10-25 scraped 9 of them (elrumifc, fui.diy, generun2026, hrtzon.yk, kemenhaj.diy, kepikir.run, laridijateng, mors.roastery, sayapputihmanagement); 10-26 scraped those plus kulonprogohalfmarathon 3 times.
- Probable second victim, numeric-keyed: profile `0587b45b-cdb1-4ffd-b0f5-c86542bb8c2b` has `account_id` 4842911995, `username` masjidmuhajirinnitikan, `display_name` "Masjid Muhajirin Nitikan". Apify's raw output pairs 4842911995 with username `jogjakajian` ("Info Kajian Jogja .JogjaKajian", the local kajian curator) as `ownerId` of https://www.instagram.com/p/DeeAONmFE4r/ and as a collab co-author of https://www.instagram.com/p/Deiw9h4xcsi/ (published by `pojokdakwah_mbm`, co-authors `kolaborasijogja` and `jogjakajian`). That row's feed holds posts of 12+ owners (reposts and collabs), including the mosque's own. So the row is most likely jogjakajian's, relabelled by this backfill. A separate row `37757e54-6105-4879-a306-6e625e463e33` (`account_id` 8490230452, created 10-23, no subscription) is probably the real mosque. This is inferred, not proven; the creation history of the row is unknown.

## Deliverables

1. **Fix the overwrite.** Apply owner data only from a post whose owner is this profile's own account: match `post.ownerId` to `profile.accountId` when numeric-keyed; for a handle-keyed profile, match `ownerUsername` to `account_id` case-insensitively. Pick the first MATCHING post, never just the first post with an owner. Never overwrite `username` from a non-matching owner. Decide and state in the PR whether `username` should be overwritten at all once set (preference: only fill an empty one or fix case). Unit-test: collab/repost first post, matching post later, handle-keyed and numeric-keyed rows, empty profile.
2. **Guard the scrape target.** Add a test or assertion so a profile's scrape URL cannot come from an owner-derived username that differs from the profile's identity, or document why item 1 is enough.
3. **Repair, NOT executed.** A dry-run-by-default script plus a `workflow_dispatch` workflow modelled on `scripts/merge-twin-profiles.ts` and `.github/workflows/merge-twin-profiles.yml`, with an audit record. Detection: handle-keyed rows where `lower(username) <> lower(account_id)`; restore `username = account_id` and restore `display_name` from the newest `posts.owner_display_name` whose `owner_username` matches. Numeric-keyed rows (like 0587b45b) need the vendor `ownerId` evidence (`scraper_actor_runs.raw_output` has `ownerId` / `ownerUsername`, sometimes as a JSON string), so list them in the dry run for a human decision instead of auto-fixing. The owner will run it with writer credentials; the cloud session has no prod access.
4. **Backlog.** Read `_bmad-output/implementation-artifacts/backlog/backlog-spec.md` and use the next free IDs (there are rows from PR #98 on master). Add a BUG row for this overwrite. Append the evidence above (jogjakajian / masjidmuhajirinnitikan / the 13 rows) to BUG-059's note and its detail file, saying the twin split and the username overwrite are related but distinct. The bigger numeric `account_id` identity unification stays a separate item and is out of scope.
5. **Keep it a hotfix.** Small diff, no unrelated refactors, do not touch the Bright Data or Apify trigger logic from PR #98.

## Constraints

No live vendor calls, no prod writes. End the PR body with: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. End every commit message with: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. In the final message give the PR URL, what changed, anything above found wrong, and the exact command or workflow inputs for the repair dry run.
