---
backlog_id: FIND-022
title: "Repost/coauthor posts are misattributed to the subscribed (scraping) account instead of the original-owner account"
captured: 2026-09-07
status: backlog # document state; item state lives in backlog.yaml
---

## Original finding (2026-09-07, raised via /bmad-help)

Instagram Posts records can carry a `coauthor_producers` array (co-authored/reposted
content) where `user_posted` is the subscribed account we scrape, but the post was
actually authored by a different (possibly non-subscribed) account listed in
`coauthor_producers`. `persist-scraped-post.ts` / `process-brightdata-result.ts`
currently always set `posts.accountId` to the triggering `pendingJob.profileId` (the
subscribed account), with no `coauthor_producers` handling anywhere in
`instagram-adapter.ts` or `brightdata-record-mapper.ts`.

Two effects need to be disentangled:
1. **Display traits** (`isImageStorageOptedIn`, `durableImageUrl` prominent-card
   treatment, moderation attribution) should follow the ORIGINAL-OWNER account's
   profile, not the subscribed/scraping account's — requires resolving the true
   owner (from `coauthor_producers`, or `user_posted` itself if the post isn't a
   repost) against `social_media_account_profiles`, handling the case where that
   owner account doesn't exist/isn't subscribed.
2. **BYOK API-key consumption** should remain keyed off whichever user/account
   actually triggered and paid for the scrape job (unrelated axis, already correctly
   separated in `ai-gateway/adapter.ts`'s `selectApiKey` — no change needed there).

Open questions from the original finding:
- How to resolve/create a profile row for a non-subscribed original-owner account
  solely for display-trait lookup.
- Whether `coauthor_producers[0]` or another heuristic determines "the" original
  owner when the array has multiple entries.
- Whether `user_posted` itself might already be a coauthor list post's true author
  in some records.

## Expanded scope (2026-09-07, same-day deepening via /bmad-help)

The original finding focused on display-trait attribution. Follow-up discussion
surfaced that account creation and downstream UI also need to handle co-authored
content, not just trait lookup:

### Account creation
- Co-authored/reposted content should create post data attributed to the
  **original creator's account** — meaning the app needs to create a new account
  record for the original creator if one doesn't already exist (not just resolve
  display traits from an existing row; this answers open question 1 above by
  choosing "always create").
- The app should also create account records for **other co-creators** listed in
  `coauthor_producers` beyond just the first/primary one (this touches open
  question 2 — all listed coauthors get accounts, not just a single heuristic pick).

### Event list filtering
- Filtering events by account in the app's list view should match against an
  event's **original creator and any co-creators**, not only the subscribed
  scraping account currently stored on `posts.accountId`.

### Event detail
- Should show the timestamp when the post was posted, using the existing short
  date format (reuse existing formatting utility, do not introduce a new format).
- If the post has co-creators, they should be displayed **below the
  view-original-post link area**, reusing the current `shared-account-info`
  component (same component instance/pattern used elsewhere, not a bespoke list).

### `shared-account-info` component changes
- The "subscribed" text label should be replaced by an icon.
- That icon becomes a **toggle** to subscribe/unsubscribe the account directly
  from wherever `shared-account-info` is rendered (including the new event-detail
  co-creator list).
- Must show a **confirmation prompt** before subscribing/unsubscribing.
- Must **track whether the subscribe/unsubscribe action succeeded or failed** —
  called out because a future subscribed-account limit (see IDEA-008: max 5
  subscribed accounts) will depend on knowing actual subscription state
  reliably, so silent failures need to be observable.

## Open questions still unresolved

- Account auto-creation policy: what minimal profile fields are required to create
  an account record purely from `coauthor_producers` data (no prior scrape of that
  account)? Does it get marked as "not yet subscribed" by default?
- Does creating an account for every listed co-creator (potentially several per
  post) have moderation/spam implications (e.g. co-creator accounts nobody
  intentionally subscribed to accumulating in the system)?
- For list filtering: does an event now need multiple account associations (a
  join/array) instead of the current single `accountId`, and if so what's the
  migration path for existing `posts` rows?
- Toggle-to-subscribe from `shared-account-info` needs a source-of-truth check
  against IDEA-008's future subscribed-account cap — sequencing between FIND-022
  and IDEA-008 needs deciding (does the toggle need to respect the cap now, or can
  cap enforcement land later without changing this component again?).

Not yet forged/spec'd. Recommend `bmad-forge-idea` or a design pass before
`bmad-create-story`, given the data-model implications (account association model,
account auto-creation) span backend + web:events + web:accounts + pkg:ui.
