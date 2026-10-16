---
backlog_id: BUG-059
title: "A subscribed account and its scrape-discovered numeric-ID profile are two rows; posts land on the one nobody subscribed to"
captured: 2026-10-15
---

# BUG-059 — Subscribed profile and discovered profile are twin rows for one platform account

## Capture

Reported 2026-10-15 as "the posts of 74d8c8d5-… are scraped in prod but not on the manual extract page". Read-only PROD queries showed:

- Subscribing keys `social_media_account_profiles.account_id` by **username** (`laridijogja`). Publisher resolution (Story 3.14, `getOrCreateDiscoveredAccountProfile`) keys by the vendor's **numeric owner ID** (`68892898447`) and upserts on `(platform, account_id)`, so it never matches the username-keyed row. Same username, two rows.
- Story 3.15 AC3 stores each new post under the resolved publisher profile (`posts.account_id`), i.e. the twin. The subscribed profile had 0 posts; its twin had 7. All 29 posts the scrape returned had the subscribed profile as `SCRAPING_SOURCE`.
- Not isolated: of 11 subscribed Instagram profiles in PROD, `jogjacitymall` (23 posts on its twin), `jogjacoffeeweek.id` (1) and `jogjaexpocenter` (1) are affected; 8 have no twin. All 79 numeric-keyed profiles are unsubscribed discovered rows.

## Impact beyond the manual extract page

- `autoEnqueueNewPostForExtraction` and `getActiveSubscriberUserIds` key on `post.accountId`, so a twin-owned post has no subscribers and no usable key and is **not auto-extracted** for the user who subscribed.
- `postsByAccount`, the account page and any other reader keyed on `posts.account_id` miss these posts the same way.

## Mitigation shipped (commit 15c0eb97, 2026-10-15)

`postsByAccount` and `selectPostsForExtraction` now also accept a post whose `SCRAPING_SOURCE` association is the subscribed account (`apps/backend/src/lib/posts/posts-scraped-under-account.ts`). This makes the posts visible and extractable by hand. It does not fix auto-extraction, and the twin rows remain.

## Shipped since capture (2026-10-16)

- `c76385b4` stopgap: subscribe, `castVote` and discovered-profile upsert reuse an existing profile with the same username, so no new twins. A twin recreates only if a post carries no owner username.
- `d3123f5b` merge tool: `mergeAccountProfiles` plus `scripts/merge-twin-profiles.ts` (dry run by default, `--apply`, `--allow-without-evidence=a,b`), audit table `account_profile_merges` (migration 0077). A read-only PROD dry run plans all 14 current groups: 10 with vendor evidence, 4 needing a human override (`plazaambarrukmo`, `slemancityhall`, `jogjarun.id`, `lintaslari.id`).
- `91c5405b` manual listing and extraction follow every account association; a post's subscribers (keys for manual and automatic extraction) are those of all associated accounts; `posts.extraction_started_at` added (migration 0078).
- Still to do: apply migrations 0077 and 0078 and run the merge script on PROD with writer credentials; then the numeric `account_id` identity model in `specs/spec-profile-identity-unification/DESIGN.md`.

## Proposed fix (one account = one row)

1. **Ingestion reconciliation.** When publisher/coauthor resolution sees an `ownerId` + `ownerUsername` and a non-numeric-keyed profile with the same platform and username (case-insensitive) already exists, attach the numeric ID to that profile instead of creating a twin. Needs a decision on the key: re-key `account_id` to the numeric ID, or add a separate vendor-ID column and match on either. Touches the `(platform, account_id)` unique constraint, the account-page URL (`account_id` is the public identifier, PRD 4.5) and `subscribeToAccount`'s lookup.
2. **Data merge for existing twins.** Move `posts`, `post_account_associations`, subscriptions, votes and other FKs from the twin onto the canonical row, then retire the twin. Needs care with `UNIQUE(post_id, account_id, role)` and the one-publisher / one-scraping-source partial indexes.
3. Once done, the `SCRAPING_SOURCE` clause in `postsScrapedUnderAccount` is redundant for this purpose and can be removed (it also lists collaborator posts a curator's scrape returned, which may or may not be wanted on its own).

## Open question

Which identifier should be canonical: the username (can change on Instagram) or the numeric ID (stable, but not what subscribe knows at subscribe time)? The numeric ID is the safer long-term key, but subscribe-time resolution of it would need a vendor lookup.
