---
title: "Profile identity unification: one platform account, one profile row"
status: draft
created: 2026-10-15
revised: 2026-10-16
backlog: BUG-059
audience: product owner + implementers (input to bmad-architecture, bmad-form-epics, bmad-create-story)
---

# Profile identity unification

One Instagram account can currently be stored as **two** `social_media_account_profiles` rows ("twins"). This document lists everything that breaks because of it (verified against code and PROD), and designs (1) how new twins are prevented, (2) how twins are detected and merged safely, and (3) how the twins already in PROD are cleaned up.

Evidence comes from read-only PROD queries on 2026-10-15/16 and from the code at commit `60e2f8f9`. Nothing in this document has been applied.

> **Revision 2026-10-16.** The owner decided to use the **single field** `account_id` for the platform's numeric ID (no extra `platform_user_id` column) and to treat `username` as the changeable handle. Sections 3 to 8 are rewritten around that. Merging twins becomes a one-off migration tool instead of a permanent product feature (section 4).

## 1. Root cause

`social_media_account_profiles.account_id` holds **two different kinds of value**, and the unique key `(platform, account_id)` cannot tell they are the same account.

| Who writes the row | What it puts in `account_id` | Code |
|---|---|---|
| Subscribe dialog / onboarding (user typed a handle) | the **handle** (`laridijogja`) | `subscribe-account-dialog.tsx:57`, `onboarding-subscribe-step.tsx`, then `subscribeToAccount` |
| Scrape ingestion (publisher or coauthor of a post) | the vendor's **numeric owner ID** (`68892898447`) | `getOrCreateDiscoveredAccountProfile`, `persist-scraped-post.ts` |
| `castVote` with a handle or URL | the vendor lookup's `item.id` (numeric) | `resolvers.ts` `castVote`, `instagram-adapter.ts` `lookupAccountProfile` |

Ingestion only passes a numeric owner ID for **Apify** scrapes (`instagram-adapter.ts:372`). Bright Data records do carry one (`user_posted_id`, e.g. `7436284187` for `slemancityhall` in the sample data), but `brightdata-record-mapper.ts` reads only `user_posted` and `process-brightdata-result.ts` passes no owner ID. So an account only grows a twin when an Apify scrape stores one of its own posts. That is the likely reason 8 of the 11 subscribed accounts have none yet; I did not verify which vendor scraped each of them.

Story 3.15 AC3 then stores each new post under the resolved **publisher** profile (`posts.account_id`), which is the twin, while the subscriber is attached to the handle-keyed row.

### PROD census (2026-10-15)

- 90 profile rows. 4 duplicate groups (8 rows), each one handle-keyed row plus one numeric-keyed row. 79 numeric rows exist in total; the other 75 are separate accounts, not twins.
- `jogjacitymall` (23 posts on the twin), `jogjacoffeeweek.id` (1), `jogjaexpocenter` (1), `laridijogja` (7).
- All 4 are trivially mergeable (section 6): no subscriptions, votes, runs, jobs, reviews or location requests on any twin; no association, vote or publisher-slot conflicts; opt-in flags equal (false); no event carries a twin's numeric ID yet.

## 2. Impact inventory (verified)

Severity: **C** = compliance, **H** = a user-visible feature fails, **M** = degraded or inconsistent.

| # | Feature | What goes wrong with a twin | Where | Sev |
|---|---|---|---|---|
| 1 | Manual extract page | Posts invisible; extraction refused (FORBIDDEN) | `postsByAccount`, `selectPostsForExtraction` | H. Mitigated in `15c0eb97` |
| 2 | Auto-extraction after a scrape | `getActiveSubscriberUserIds(post.accountId)` and `hasAvailableApiKeyForAccount(post.accountId)` look at the twin, which has no subscribers, so no key, so the post is never auto-extracted for the real subscriber | `process-ai-job.ts:78`, `auto-enqueue-new-post.ts:28` | H |
| 3 | **Curator data minimization (Story 3.4o)** | `isCuratorGuide` is read from `message.accountId` = `posts.accountId` = the twin, whose `accountType` is NULL, so a curator's own post is processed as a normal one: caption not cleared after extraction, no `isImageStorageOptedIn` gating | `process-ai-job.ts:83-91,159,191,552` | **C** |
| 4 | Image opt-in (Story 3.20, 3.6h) | The moderator opts in the subscribed row; the post's PUBLISHER is the twin (opt-in false), so durable storage and the unblurred-AI exception never apply to the account's own posts | `resolve-post-publisher-opt-in.ts` | C/M |
| 5 | New-event push notifications | `getSubscribersForNotification(sourceAccountId)` matches subscriptions by the profile's **text** `account_id`; the event's source is the twin's numeric ID, the subscribed row has the handle, so zero subscribers match | `get-subscribers-for-notification.ts`, `send-event-notifications.ts:40` | H |
| 6 | Default location backfill | `resolveAccountAndLocations` reads `defaultLocation` from `message.accountId` (twin, none), so events miss the account's default location | `resolve-account-and-locations.ts:26-39` | H |
| 7 | Organizer-authored predicate (AD-31 Rule 3) | A curator's own posts attribute to a NULL-typed twin, which counts as "not curator-typed", so the post is treated as organizer-authored: eligible as event primary, and fires the first-organizer-post notification | `is-organizer-authored-post.ts` | H |
| 8 | Event to account matching | Organizer-signal compares account ids; the same organizer appears under two ids | `match-event-to-existing.ts`, `event-account-match.ts` | M |
| 9 | Account page and events by source account | `events.source_social_media_account_id` is a **text copy** of the profile's `account_id` (no FK). Events from twin posts carry the numeric ID; events from the subscribed row carry the handle, so one account's events split across two URLs | `events.graphql`, `resolve-account-and-locations.ts:38` | H |
| 10 | Classification and scrape gate | The twin is never classified (`NULL` status = "legacy, scrapable"), and nothing scopes classification to the account | `get-scrape-targets.ts`, `classify-account-type.ts` | M |
| 11 | Discovery and votes | Twin has `isVerifiedForDiscovery = false` so it is hidden from autocomplete today; if a user subscribes or votes it flips and the account shows twice | `verify-account-profile-for-discovery.ts` | M |
| 12 | "Inactive account" alert | `isInactive` counts posts by `posts.account_id = profile.id`; a subscribed row whose posts sit on the twin has none, so a live account is flagged "no posts in 30 days, consider removing this subscription" (it is true today for `laridijogja`) | `resolvers.ts:249` `isInactive` | H |

Not affected (checked): `AIEventFilter` resolution prefers the user's subscribed set before any global username match (`resolve-filter-account-id.ts`), and the global fallback only considers `isVerifiedForDiscovery = true`; scrape result processing keys on the `profileId` carried by the job.

> **Urgent, caused by my own earlier fix.** `15c0eb97` makes `laridijogja`'s 7 own posts visible and selectable on the manual extract page. Extracting them **before** the merge runs through item 3: the curator caption would not be cleared. Either merge the four groups first (section 6, small), or do not extract those 7 posts manually until then.

## 3. Design: `account_id` is the platform's ID, `username` is the current name

### 3.1 Data model

- **`account_id`** holds the platform's stable numeric account ID, always. Never a handle. No new column.
- **`username`** holds the current handle, normalized (lower-case, no `@`), and may change. It is already what both scrapers address (`username: [account.username]` for Apify, `https://www.instagram.com/${target.username}/` for Bright Data), so scraping triggers exactly as today.
- The existing unique key `(platform, account_id)` now suffices to guarantee one row per Instagram account.
- **Database guard:** `CHECK (platform <> 'instagram' OR account_id ~ '^[0-9]+$')`, added `NOT VALID` first and validated once the migration (section 6) has run. A handle-keyed row then cannot exist. Instagram allows all-digit usernames, so "digits means ID" cannot be inferred from the value; the invariant holds because every creation path resolves the ID first (3.3).
- Index on `(platform, lower(username))` for lookups. Not unique yet: see "ID wins" in 3.4.

*Considered and rejected:*
- **Username as the key.** It is mutable and gets reassigned, and nothing in the data would reveal either event.
- **A separate `platform_user_id` column** (my earlier proposal). Works, but needs a two-step resolver and leaves two identity fields; the owner prefers one.
- **A database trigger that merges.** Hides an audited multi-table operation inside a write path.

### 3.2 URLs and links stop using `account_id`

The account page route is `/[platformSlug]/[accountId]`. Today the segment is `social_media_account_profiles.account_id`. It becomes the **username**:

- The page lookup resolves the segment by `lower(username)` first, then by `account_id`, so any existing `/instagram/<numeric>` link keeps working. The backend query `socialMediaAccountProfileByAccountId` accepts either.
- Links are built from `username`: `apps/web/src/features/events/mapper.ts` (lines 107, 130, 139, 187) and `subscriptions-content.tsx:103`.
- Existing handle URLs keep working because, for today's rows, handle equals username. After a rename the old URL stops working, as it does on Instagram.
- Everywhere else the web app uses `accountId` only to compare identities (`EventDetailWrapper.tsx`, `mapper.ts` subscription checks); those stay correct with a numeric value. The one display use is the onboarding label fallback `subscription.accountId` (`onboarding-subscribe-step.tsx:86`), which should prefer `username`.

**This ships before any row is re-keyed.**

### 3.3 One resolver for every creation path

`subscribeToAccount`, `castVote`'s profile creation and `getOrCreateDiscoveredAccountProfile` all call one function, `resolveAccountProfile`:

- **With an ID** (ingestion owner or coauthor, vote lookup, subscribing from an event's coauthor chip): upsert on `(platform, account_id)` with `ON CONFLICT DO UPDATE`. The unique key makes this race-free, so no advisory lock is needed. If the existing row's `username` differs from the vendor-supplied one, apply the rename rule (3.4).
- **With a typed handle** (subscribe dialog, onboarding): normalize it, then look for a row by `lower(username)` (the current owner of the name). Found: reuse it, no vendor call. Not found: run the vendor profile lookup (`lookupAccountProfile`, already used by `castVote`) to get the ID, then take the ID path.
- A source-scan ratchet test fails if any other file inserts into `social_media_account_profiles`.
- Bright Data's `user_posted_id` is read by the record mapper and passed as `ownerId`, so Bright Data scrapes also carry IDs (needed for the checks in 3.4).

### 3.4 Username changes and reuse

Compare what a scrape returns with what is stored. Only posts whose `ownerUsername` equals the target's username count; a profile scrape also returns collaborator posts whose owners legitimately differ.

| Returned ID vs stored `account_id` | Returned username vs stored `username` | Meaning | Action |
|---|---|---|---|
| same | different | **Rename** | Update `username` |
| different | same | **Reuse**: someone else now owns the name | Reject the batch, flag the account, stop scraping it |
| different | different | Unrelated account (collaborator) | Ignore for this check |
| same | same | Normal | Nothing |

Rules:

1. **Compare before persisting.** The first scrape after a reuse already fetches the stranger's posts, because scraping is by username. The check runs before `persistScrapedPost`; on a mismatch the whole batch is discarded and an alert is raised. The vendor fetched the data, we never store it.
2. **Passive rename learning.** Any scrape that returns (ID N, username Y) for a row whose `username` is X updates it to Y. Collaborator lists and other accounts' posts already carry such pairs.
3. **Re-subscribing under the new name.** The typed handle Y finds no row by username, the lookup returns ID N, the ID path matches the existing row and only `username` changes. No duplicate.
4. **Scrape of the old name finds nothing.** Today that looks like an inactive account. After N consecutive not-found results, flag the account for a moderator. Counting needs somewhere to live: derive it from `scraper_actor_runs` if that table records outcomes (not verified), otherwise one small column. I have **not** verified that any available actor can find a new username from an ID, so automatic follow-up is not assumed.
5. **Manual "update username".** A moderator enters the new handle; a lookup returns the ID; the change is accepted only if it equals `account_id`.
6. **ID wins.** When an ID is confirmed as the owner of name X, any other row still claiming X is marked stale and ignored by name lookups. Once that exists, a unique index on `(platform, lower(username))` becomes possible and the database enforces "one current owner per name". `username` is `NOT NULL`, so the stale marker needs a choice (a flag, or moving the row to a tombstoned name). Deferred until after the main change; reuse is rare.

### 3.5 Subscribing to a brand-new handle (open decision)

A new handle needs an Apify lookup before the row can be created, which conflicts with Story 3.16 AC1 ("subscribing always succeeds"). Options:

- **A. Make the lookup mandatory for unknown handles** (recommended). A failed or timed-out lookup returns a retryable error. This keeps the CHECK constraint enforceable. AC1 is already not absolute: `subscribeToAccount` aborts with `ScraperCapacityExceededError` when no scraper capacity is available (`subscribe-to-account.ts`, in the classification branch).
- **B. Allow a temporary handle-keyed row** until a scrape returns the ID. Subscribing never fails, but the mixed key namespace and the transitional state come back, and the CHECK constraint cannot be enforced.

Known handles (any existing row) never trigger a lookup.

## 4. Merging twins is a one-off migration tool

After the CHECK constraint is validated a twin cannot be created: one account has one ID and `(platform, account_id)` is unique. The permanent detector, the daily sweep and the moderator "possible duplicate accounts" screen from the earlier draft are no longer needed. What remains:

- **Steady state:** only a **username collision** (two rows claiming one current name) can occur. That is the reuse / missed-rename case in 3.4, handled by the alert and the "ID wins" rule.
- **Migration:** merge the four existing twin groups, using the function below. It is a tested script with a dry-run default, not a product feature.

### 4.1 Evidence rule E1 (when the script may merge without asking)

At least one post exists where the numeric row is `PUBLISHER`, the other row is `SCRAPING_SOURCE`, and `posts.owner_username` equals the username (case-insensitive): the vendor itself returned "owner ID X, username U" while scraping the account named U. **Verified on all four PROD groups** (23 / 1 / 1 / 7 posts). Without E1, or with a blocker, the script stops and reports.

**Blockers:** both rows have a confirmed `account_type` and they differ; `is_image_storage_opted_in` differs (consent must not be inferred); more than two rows in a group.

### 4.2 Choosing the survivor

Score, highest wins: active subscriptions, then confirmed `account_type`, then a set `default_location`, then `is_image_storage_opted_in`, then older `created_at`. The survivor keeps its `id`. In every PROD group this is the handle-keyed, subscribed row; its `account_id` is then **set to the twin's numeric ID** (4.3).

### 4.3 `mergeAccountProfiles(survivorId, twinId, { performedBy })`

One transaction. Lock both rows with `SELECT … FOR UPDATE` in `id` order, re-verify both still exist, then:

| Table / column | Action | Conflict handling |
|---|---|---|
| `posts.account_id` | repoint twin to survivor | none |
| `post_account_associations.account_id` | repoint | delete twin rows that would duplicate `(post_id, role)` first; on the one-publisher-slot index keep a real `PUBLISHER` over `PUBLISHER_UNKNOWN` |
| `subscriptions.account_id` | repoint | if one user ends up with two active rows, keep the earlier and soft-delete the other (AD-8) |
| `account_votes.account_id` | repoint | unique `(user_id, account_id)`: drop the twin's vote when the user already voted the survivor |
| `default_location_change_requests.account_id` | repoint | none |
| `account_type_classification_reviews.account_id` | repoint; resolve a pending twin review as superseded | |
| `scraper_actor_runs.profile_id`, `apify_pending_jobs.profile_id`, `brightdata_pending_jobs.profile_id` | repoint **before** deleting the twin | **These three cascade on delete**; deleting first silently destroys run history and in-flight jobs. Test it explicitly |
| Profile fields | keep the survivor's value, fill blanks from the twin (`description`, `default_location`, `first_seen` earliest, `last_seen` latest, `discovery_source`, `is_verified_for_discovery` OR) | opt-in and account type are never taken from the twin |
| Twin row | `DELETE` | |
| The survivor's `account_id` | set to the twin's numeric ID | **after** the twin is deleted, because of the `(platform, account_id)` unique key |
| `events.source_social_media_account_id` (text, no FK) | rewrite the survivor's old handle to its new numeric ID | same transaction, so notification matching (`getSubscribersForNotification` compares this text with the profile's `account_id`) is never inconsistent; scope to `platform = 'instagram'` |

Audit and undo follow the `event_merges` precedent: an `account_profile_merges` table records the survivor, the full twin snapshot, the IDs repointed per table, the operator, and the evidence. Undo in v1 is a documented script that re-inserts the snapshot and repoints the recorded IDs.

After the merge, re-evaluate primary posts for events touched (AD-30 rule 6), because organizer-authored status can change (impact 7). Nothing needs to refresh `last_post_date`: no backend code writes it.

## 5. Idempotence and failure behaviour

- Re-running the script on an already-merged group is a no-op (twin gone, survivor already numeric).
- A failed merge rolls back entirely; the group stays pending and the script reports it.
- Every re-key of a handle-keyed row (the last two rows of 4.3) is its own transaction together with its events rewrite.

## 6. Fixing the data already in PROD

Dry-run results (read-only SQL, 2026-10-15). For the four twin groups only posts and associations move:

| Survivor (handle) | Twin (numeric ID, becomes the survivor's `account_id`) | Posts moved | E1 evidence | Events to rewrite | Conflicts |
|---|---|---|---|---|---|
| `jogjacitymall` | `1491307877` | 23 | 23 posts | 15 | none |
| `jogjacoffeeweek.id` | `16908000379` | 1 | 1 post | 0 | none |
| `jogjaexpocenter` | `3004202148` | 1 | 1 post | 31 | none |
| `laridijogja` | `68892898447` | 7 | 7 posts | 0 | none |

The other seven subscribed rows are handle-keyed with no twin and need their numeric ID: `pakuwonmall.jogja`, `aftereo.ofc`, `plazaambarrukmo`, `lippoplazajogja_official`, `galeriajogja`, `slemancityhall`, `infoeventjogja`. In total 866 events across 9 distinct handles carry a handle in `events.source_social_media_account_id`. Data checked: all 79 numeric rows have a real username, none has uppercase, `@` or spaces, and no two numeric rows share a username.

Order matters; each phase is independently deployable:

1. **URLs by username** (3.2): backend query and web links. No data change. Must be first.
2. **Resolver and Bright Data ID capture** (3.3): new rows are numeric from now on. Subscribe behaviour per the decision in 3.5.
3. **Merge tool** (section 4) with its audit table.
4. **Merge the four twin groups** (dry-run first; snapshot of the affected rows with `pg_dump`; the audit row is the in-database undo).
5. **Re-key the seven handle-keyed rows:** a one-time lookup script (about 7 Apify profile lookups, 7 usage units) obtains each ID, then re-keys the row and rewrites its events in one transaction. A row whose lookup fails is left as is and reported; the CHECK is not validated until none remain.
6. **Add the CHECK `NOT VALID`** (it enforces on new writes immediately, so it follows phase 2), then `VALIDATE` after phase 5.

Verify after phases 4 and 5: no `(platform, lower(username))` group has more than one row; the manual extract page lists the posts; `getSubscribersForNotification` returns the subscribers for the survivor; `events` has no handle-valued `source_social_media_account_id` for a re-keyed account; the account page opens for both the handle and the numeric ID. Only writer credentials can apply this; the read-only PROD role used for this analysis cannot.

Expected side effects to watch: once the survivor owns the posts, auto-extraction can start for the user's unextracted posts (impact 2), so check the user's extraction quota before the next scrape; new-event push notifications start reaching the subscriber (impact 5).

## 7. Proposed work breakdown

| # | Story | Notes |
|---|---|---|
| 1 | URL resolution by username | backend query accepts username or ID; web links built from `username`; onboarding label; tests. Prerequisite for everything |
| 2 | Resolver (numeric `account_id`) + Bright Data ID capture | the three creation paths, ratchet on inserts, decision 3.5, lookup on unknown handles |
| 3 | `mergeAccountProfiles` + audit table + one-off script | per-table tests including the cascade-delete trap and each conflict row |
| 4 | PROD cleanup | phases 4 to 6 of section 6, as an ops story; the CHECK validation closes it |
| 5 | Rename and reuse handling | compare-before-persist, passive rename update, not-found flag, manual update username, "ID wins" stale-claimant rule |

Order: 1, 2, 3, 4, then 5. Story 5 is not needed to remove the compliance exposure (impact 3), so it does not block the cleanup. The earlier "moderator possible-duplicates screen" and permanent detection sweep are dropped (section 4).

Documents to update when approved: Architecture Spine (new AD: `account_id` is the platform ID, `username` is the current name, the CHECK, the resolver, the cascade-delete trap), PRD 4.5 (`SocialMediaAccountProfile.accountId` and `username` semantics), `project-context.md` (one-line rule), and BUG-059 (superseded by the epic). `docs/infrastructure/architecture-diagram.md` needs no change.

## 8. Decisions

Decided by the owner (2026-10-16):
1. **Single field:** `account_id` holds the platform's numeric ID; no `platform_user_id` column; `username` is the current handle.

Open:
2. **Subscribing to a new handle (3.5):** A (mandatory lookup, retryable error; recommended) or B (temporary handle-keyed row).
3. **Merge script runs only on vendor-proven evidence (E1)** and stops otherwise (recommended).
4. **Undo as an audited script**, not a moderator UI (recommended).
5. **Do the PROD cleanup (story 4) before story 5**, because it ends the curator-minimization gap for `laridijogja` (recommended).
6. **Curator stopgap:** until the cleanup, should `process-ai-job` also treat a post as curator-typed when its `SCRAPING_SOURCE` account is a curator? It closes impact 3 independent of the merge, at the cost of a second code path that story 2 makes redundant.
7. **Unique index on `lower(username)`** after the "ID wins" rule: later, if wanted.
