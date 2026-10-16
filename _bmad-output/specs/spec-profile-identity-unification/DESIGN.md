---
title: "Profile identity unification: one platform account, one profile row"
status: draft
created: 2026-10-15
backlog: BUG-059
audience: product owner + implementers (input to bmad-architecture, bmad-form-epics, bmad-create-story)
---

# Profile identity unification

One Instagram account can currently be stored as **two** `social_media_account_profiles` rows ("twins"). This document lists everything that breaks because of it (verified against code and PROD), and designs (1) how new twins are prevented, (2) how twins are detected and merged safely, and (3) how the twins already in PROD are cleaned up.

Evidence comes from read-only PROD queries on 2026-10-15 and from the code at commit `60e2f8f9`. Nothing in this document has been applied.

## 1. Root cause

`social_media_account_profiles.account_id` holds **two different kinds of value**, and the unique key `(platform, account_id)` cannot tell they are the same account.

| Who writes the row | What it puts in `account_id` | Code |
|---|---|---|
| Subscribe dialog / onboarding (user typed a handle) | the **handle** (`laridijogja`) | `subscribe-account-dialog.tsx:57`, `onboarding-subscribe-step.tsx`, then `subscribeToAccount` |
| Scrape ingestion (publisher or coauthor of a post) | the vendor's **numeric owner ID** (`68892898447`) | `getOrCreateDiscoveredAccountProfile`, `persist-scraped-post.ts` |
| `castVote` with a handle or URL | the vendor lookup's `item.id` (numeric) | `resolvers.ts` `castVote`, `instagram-adapter.ts` `lookupAccountProfile` |

Ingestion only produces a numeric owner ID for **Apify** scrapes (`instagram-adapter.ts:372`; `process-brightdata-result.ts` passes none). That is why 8 of the 11 subscribed accounts have no twin yet: they are scraped by Bright Data. Any account that gets an Apify scrape (first scrape, on-demand scrape, manual re-scrape) gets a twin the first time its own post is stored.

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

## 3. Design: one identity, one resolver

### 3.1 Data model

Add `social_media_account_profiles.platform_user_id text NULL` (the vendor's stable account ID) with a **partial unique index** `(platform, platform_user_id) WHERE platform_user_id IS NOT NULL`. Keep `account_id` exactly as it is: it is the public URL identifier (`/[platformSlug]/[accountId]`, PRD 4.5), is copied into `events.source_social_media_account_id`, and appears in saved links and widgets.

Backfill: `platform_user_id = account_id` for rows whose `account_id` is all digits (Instagram only for now; the column and rules are platform-agnostic).

*Considered and rejected:*
- **Re-key the handle row to the numeric ID.** Breaks account URLs and saved links, forces a rewrite of the `events` text copy, and still leaves subscribe unable to know the numeric ID without a vendor call.
- **Unique index on `lower(username)`.** Usernames are mutable and get reassigned on Instagram; the index would block a legitimate new account that takes a freed name, and would wrongly fuse history.
- **A database trigger that merges.** Hides a multi-table, audited operation inside a write path and cannot ask a moderator.

### 3.2 One resolver for every creation path

All three creation paths call one function, `resolveAccountProfile(identity)`, where `identity = { platform, platformUserId?, username, displayName?, accountId? }`. Order:

1. `platform_user_id` exact match.
2. `(platform, account_id)` exact match (legacy and handle-keyed rows).
3. **Username match** (case-insensitive, `@` stripped) among rows whose `platform_user_id` is NULL, or among numeric-keyed discovered rows when the identity is handle-only:
   - If the identity carries a `platformUserId`, **adopt**: set that row's `platform_user_id`. This is what stops the twin from ever being created when ingestion meets an existing handle-keyed row.
   - If the identity is handle-only (user typed a handle), **reuse** the matched row. This is the reverse order (numeric row first, subscribe second).
4. Create the row.

Rules that keep it safe:
- A row that **already has** a different `platform_user_id` is never matched by username (that is the "old name reassigned to a new person" case: a new account B that takes A's old handle is created fresh).
- The whole resolve runs inside a transaction holding `pg_advisory_xact_lock(hashtext(platform || ':' || lower(username)))`, so two concurrent scrape results or a scrape and a subscribe cannot both create a row.
- If step 1 and step 3 hit **two different rows**, twins already exist: hand them to the merge path (section 4) instead of picking one silently.

Call sites to change: `subscribeToAccount`, `castVote`'s profile creation, `getOrCreateDiscoveredAccountProfile`. A source-scan ratchet (backend test) fails if any other file inserts into `social_media_account_profiles`, so a fourth path cannot reintroduce the problem.

## 4. Detection and merge

### 4.1 Detection (safety net, not the primary defense)

The resolver prevents new twins. Detection exists for anything that slips through (old rows, concurrency bugs, a vendor returning an ID late).

- **Candidate query:** groups of `(platform, lower(username))` with more than one row, plus any pair where one row's `platform_user_id` equals the other's `account_id`.
- **When it runs:** for the affected profiles after each scrape result is processed (cheap, indexed), and once a day in the existing scheduled scraper lambda as a full sweep (90 rows today).
- **Classification of each group:**
  - **AUTO**: evidence rule E1 holds and no blocker applies.
  - **REVIEW**: same username but no vendor evidence, or a non-fatal conflict. Goes to a moderator item ("Possible duplicate accounts"), following the existing Duplicate Events pattern (mid-confidence goes to a human).
  - **BLOCKED**: a conflict that needs a person to decide (below). Never merged automatically.

**Evidence rule E1 (vendor-proven identity):** at least one post exists where the numeric row is `PUBLISHER`, the other row is `SCRAPING_SOURCE`, and `posts.owner_username` equals the username (case-insensitive). Meaning: the vendor itself returned "owner ID X, username U" while scraping the account named U. **Verified on all four PROD groups** (23 / 1 / 1 / 7 posts).

**Blockers (never auto):** both rows have a confirmed `account_type` and they differ; `is_image_storage_opted_in` differs (consent must not be inferred); both rows hold a different `platform_user_id`; more than two rows in a group.

### 4.2 Choosing the survivor

Score, highest wins: active subscriptions, then confirmed `account_type`, then a set `default_location`, then `is_image_storage_opted_in`, then older `created_at`. The survivor keeps its `id` and `account_id` (URLs and the events text copy stay valid) and gains `platform_user_id`.

In every PROD case this picks the handle-keyed, subscribed row.

### 4.3 `mergeAccountProfiles(survivorId, twinId, { performedBy })`

One transaction. Lock both rows with `SELECT … FOR UPDATE` in `id` order (no deadlock between concurrent merges), re-verify both still exist and are unmerged, then:

| Table / column | Action | Conflict handling |
|---|---|---|
| `posts.account_id` | repoint twin to survivor | none (no unique on it) |
| `post_account_associations.account_id` | repoint | delete twin rows that would duplicate `(post_id, role)` on the survivor first; on the one-publisher-slot index, keep a real `PUBLISHER` over a `PUBLISHER_UNKNOWN` |
| `subscriptions.account_id` | repoint | if one user ends up with two active rows, keep the earlier one and soft-delete the other (reuse the soft-delete convention, AD-8) |
| `account_votes.account_id` | repoint | unique `(user_id, account_id)`: drop the twin's vote when the user already voted the survivor |
| `default_location_change_requests.account_id` | repoint | audit trail, no unique |
| `account_type_classification_reviews.account_id` | repoint; auto-resolve a pending twin review as superseded | |
| `scraper_actor_runs.profile_id`, `apify_pending_jobs.profile_id`, `brightdata_pending_jobs.profile_id` | repoint **before** deleting the twin | **These three cascade on delete**: deleting first would silently destroy run history and in-flight jobs. Test for it explicitly |
| `events.source_social_media_account_id` (text, no FK) | rewrite `twin.account_id` to `survivor.account_id` for events whose source post moved | scope through the event's post so a numeric collision with another platform cannot match |
| Profile fields | fold into survivor: keep the survivor's value, fill blanks from the twin (`description`, `default_location`, `first_seen` earliest, `last_seen` and `last_post_date` latest, `discovery_source`, `is_verified_for_discovery` OR) | opt-in and account type are **never** taken from the twin (blocker if they differ) |
| Twin row | `DELETE` after everything above | |

Audit and undo follow the existing `event_merges` precedent: a new `account_profile_merges` table records the survivor, the full twin row snapshot, the IDs repointed per table, who or what performed it (moderator id, or `system:auto`), and the evidence that justified it. Undo in v1 is a documented script that re-inserts the snapshot and repoints the recorded IDs; a moderator UI undo is a later option.

After the merge, re-evaluate primary posts for events touched (AD-30 rule 6), because organizer-authored status can change (impact 7). Nothing needs to refresh `last_post_date`: no backend code writes it.

## 5. Idempotence and failure behaviour

- Merging an already-merged pair is a no-op (twin row gone, survivor already holds `platform_user_id`).
- A failed merge rolls back entirely; the group stays AUTO or REVIEW and is retried by the next sweep, with an alert after N failures rather than an endless loop.
- Merge and resolver both take the same advisory lock key, so a scrape cannot create a fresh twin between "decide" and "merge".

## 6. Fixing the twins already in PROD

Dry-run results (read-only SQL, 2026-10-15). Posts and associations are the only things that move:

| Survivor (handle) | Twin (numeric) | Posts moved | E1 evidence | Conflicts |
|---|---|---|---|---|
| `jogjacitymall` | `1491307877` | 23 | 23 posts | none |
| `jogjacoffeeweek.id` | `16908000379` | 1 | 1 post | none |
| `jogjaexpocenter` | `3004202148` | 1 | 1 post | none |
| `laridijogja` | `68892898447` | 7 | 7 posts | none |

Runbook:

1. Ship the migration (column, partial index, backfill) and `mergeAccountProfiles`. No behaviour change yet.
2. A one-off script `merge-known-twins` runs the detection query, prints the plan, and **defaults to dry-run**. It applies per group in its own transaction, only for AUTO groups.
3. Take a snapshot of the four groups first (a `pg_dump` of the affected rows is enough). The `account_profile_merges` row is the in-database undo.
4. Apply. Expect, per group, that the survivor's post count rises by the number in the table and `posts` with `account_id = twin` becomes 0.
5. Verify with queries: no `(platform, lower(username))` group with more than one row; no association points at a deleted id (FK guarantees it); the manual extract page lists the posts; `getSubscribersForNotification` returns the subscribers for the survivor's `account_id`.
6. Only the writer credentials can apply this. The read-only PROD role used for this analysis cannot, which is intended.

Expected side effect to watch: once the survivor owns the posts, auto-extraction can start for the user's unextracted posts (impact 2). Review the user's extraction quota before the first scrape after the merge.

## 7. Proposed work breakdown

| # | Story | Notes |
|---|---|---|
| 1 | Identity model and resolver | migration, backfill, `resolveAccountProfile`, advisory lock, three call sites, concurrency tests |
| 2 | `mergeAccountProfiles` + audit table | per-table tests including the cascade-delete trap and every conflict row in the table above |
| 3 | Detection sweep and auto-merge | candidate query, E1 evidence, AUTO / REVIEW / BLOCKED, hook after scrape processing and the daily sweep |
| 4 | Moderator "Possible duplicate accounts" item | REVIEW and BLOCKED groups, merge action, badge count (PRD 3.9.3) |
| 5 | PROD cleanup | the runbook in section 6, as an ops story; do it right after story 2 |
| 6 | Ratchet | source-scan test: no insert into `social_media_account_profiles` outside the resolver; no TS file re-implements the username match |

Cleanup (5) does not need to wait for 1, 3 or 4: it needs only 2 and the migration column. That order removes the compliance exposure (impact 3) fastest.

Documents to update when this is approved: Architecture Spine (new AD, section 3 rules and the cascade-delete trap), PRD 4.5 (`SocialMediaAccountProfile` identity), `project-context.md` (one-line rule), and BUG-059 (superseded by the epic). `docs/infrastructure/architecture-diagram.md` needs no change unless the sweep is added as a new scheduled component.

## 8. Decisions for the owner

1. **Add `platform_user_id` and keep `account_id`** (recommended) versus re-keying to the numeric ID. Re-keying changes public URLs.
2. **Auto-merge only on vendor-proven evidence (E1)**; everything else goes to a moderator (recommended). Alternative: merge on matching username alone, which is simpler but unsafe with reassigned handles.
3. **Undo in v1 as an audited script**, not a moderator UI (recommended; the UI follows with story 4 if wanted).
4. **Do the PROD cleanup (story 5) before the rest**, because it ends the curator-minimization gap for `laridijogja` (recommended).
5. **Extra caution for curators:** until the merge, should `process-ai-job` also treat a post as curator-typed when its `SCRAPING_SOURCE` account is a curator? That would close impact 3 independent of the merge, at the cost of a second code path that story 1 makes redundant.
