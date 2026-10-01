---
id: SPEC-post-coauthor-attribution
companions: [vendor-role-mapping.md, ../../project-context.md]
sources: [../../implementation-artifacts/backlog/FIND-022-coauthor-content-issues.md, ../../forge/find-022-coauthor-content-issues/.memlog.md, ../../forge/find-022-coauthor-content-issues/forged-idea.md]
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete,
> preservation-validated contract for what to build, test, and validate. Source documents
> listed in frontmatter are for traceability only.

# Post Co-Author & Publisher Attribution

## Why

**A pain to solve.** Instagram (and other platforms) can attribute a single post to more
than one account — a native "Collab" coauthor, or a publisher distinct from whoever
FestDaily happens to be scraping. Today `posts.accountId` is always set to the
*scraping-source* account (the one whose subscription triggered the fetch), so a
repost/collab post gets silently misattributed: display, filtering, and subscription all
point at the wrong account, and the actual coauthor is invisible and unsubscribable unless
someone separately discovers and scrapes them directly. This is a confirmed live gap, not
a hypothetical: `apps/backend/src/lib/scraper/instagram-adapter.ts` never reads the
`coauthorProducers` field that the production Apify actor already returns on every post
(see `vendor-role-mapping.md`). It affects any user relying on account-based filtering or
subscription and is captured as backlog row **FIND-022** (triaged, effort `l`).

## Capabilities

- **CAP-1 — Vendor role normalization**
  - **intent:** The ingestion pipeline classifies each post's vendor payload identities
    into three distinct axes — scraping/subscription-source account, canonical publisher
    account, and coauthor accounts — per vendor, never inferring publisher/coauthor status
    from producer-array order or position.
  - **success:** Given a real scrape payload with `coauthorProducers` (Apify) or
    `coauthor_producers` (Bright Data) populated, the persisted result records a
    role-tagged identity for the publisher distinct from every coauthor and from the
    triggering subscription account — verified against the real `apify/instagram-post-scraper`
    evidence in `vendor-role-mapping.md`.

- **CAP-2 — Deduplicated subscribable profiles**
  - **intent:** Every publisher/coauthor identity with a stable platform account ID gets or
    reuses one `SocialMediaAccountProfile` row (unique on platform + accountId), created
    unsubscribed by default, retaining discovery provenance (which vendor/run first
    surfaced it) plus first-seen/last-seen timestamps. An identity with no stable accountId
    is retained only as an internal, non-public, non-subscribable, non-searchable
    provisional record, backfillable into the stable profile once a platform ID is known. A
    malformed/ambiguous coauthor payload (e.g. missing id) is captured observably — reusing
    the existing `persistUnprocessedPayload` mechanism already used for AJV validation
    failures — rather than silently dropped.
  - **success:** Re-scraping the same coauthor across multiple posts produces exactly one
    profile row, with `lastSeen` advancing and `firstSeen` unchanged. A caption-only or
    accountId-less mention never creates a public `socialMediaAccountProfiles` row. A
    malformed coauthor entry lands in the unprocessed-payload record, not silently discarded.

- **CAP-3 — Normalized post-account associations + lossless migration**
  - **intent:** A new association table records one row per (post, account) pair with an
    explicit role (`PUBLISHER`, `COAUTHOR`, `SCRAPING_SOURCE`, or `PUBLISHER_UNKNOWN`) and
    provenance, queryable for moderation and analytics, not just for CAP-6's filtering path.
    `posts.accountId` is preserved unchanged for compatibility; for new posts it is
    populated from the verified canonical publisher only after vendor-role normalization,
    never from producer-array order.
  - **success:** A migration over existing production posts adds exactly one
    `SCRAPING_SOURCE`/`PUBLISHER_UNKNOWN` association per row with zero data loss or
    ownership rewriting. A newly ingested post gets one publisher association plus N
    coauthor associations matching its vendor payload, all queryable by role.

- **CAP-4 — Immediate coauthor subscribability**
  - **intent:** A coauthor or publisher profile with a stable accountId is subscribable
    from event/post detail or direct account-ID lookup through the existing subscription
    contract, without requiring prior direct scraping of that account, and may trigger the
    existing initial-scrape/classification flow.
  - **success:** Subscribing to a coauthor discovered only via another account's post
    (never itself directly scraped) succeeds, and that coauthor's own feed begins
    populating through the existing initial-scrape path.

- **CAP-5 — Demand-gated discovery**
  - **intent:** Verified scrape-discovered profiles, even with a stable accountId, are
    excluded from broad account autocomplete/ranked discovery surfaces until a subscribe or
    vote signals intentional demand — limiting directory pollution without blocking
    contextual subscription.
  - **success:** A freshly created coauthor profile does not appear in
    autocomplete/ranked-discovery results until at least one subscribe or vote event exists
    for it, while remaining immediately subscribable from the originating event/post detail.

- **CAP-6 — Union-of-associations account filtering**
  - **intent:** User-facing account filtering matches the union of a post's active
    publisher, coauthor, and scraping-source associations, not just the legacy
    `posts.accountId` column — preserving existing subscribed-feed behavior while adding
    coauthor/publisher matches.
  - **success:** A user subscribed only to a coauthor (never the scraping-source account)
    sees that coauthor's co-authored posts in their filtered feed.

- **CAP-7 — Event/post detail attribution UI**
  - **intent:** Event/post detail shows the post's posted-at timestamp via the existing
    locale-aware date formatter, and renders coauthors below the original-post link using
    the existing shared-account-info pattern (`SubscribedAccountCard`, already reused in
    `EventDetailView.tsx`). Verified profiles expose a confirmed (not optimistic)
    accessible subscribe/unsubscribe icon toggle: confirm the mutation, refetch/invalidate
    authoritative state on success, restore prior state on failure. Provisional identities
    remain display-only.
  - **success:** Opening an event with 2+ coauthor associations shows each as a
    `SubscribedAccountCard` row, with a working confirm-then-refetch toggle for verified
    profiles and no toggle for provisional ones.

- **CAP-8 — Sanitized subscription-toggle analytics**
  - **intent:** The toggle emits PostHog `subscription_toggle_succeeded` /
    `subscription_toggle_failed` events carrying `action`, `platform`, `source`, and (on
    failure) a sanitized backend `errorCode` — never raw handles, account IDs, captions, or
    post content.
  - **success:** A captured event payload for either event name contains only the four
    allowed fields, verified by a schema/allowlist check in tests.

## Constraints

- Never infer publisher vs. coauthor role from producer-array position — always use each
  vendor's explicit role-bearing fields (Bright Data: `user_posted`/`user_posted_id` vs.
  `coauthor_producers`; Apify `apify/instagram-post-scraper`: `ownerId`/`ownerUsername`/
  `ownerFullName` vs. `coauthorProducers[]`).
- Legacy `posts.accountId` rows must not be reinterpreted or have historical ownership
  rewritten without raw vendor evidence — migrate them only as `SCRAPING_SOURCE`/
  `PUBLISHER_UNKNOWN`.
- `socialMediaAccountProfiles.displayName` is `NOT NULL`. Creating a profile from Apify's
  `coauthorProducers` (accountId + username, no full name — see `vendor-role-mapping.md`)
  must supply a non-null `displayName` via fallback, never attempt a null insert.
- IDEA-008 owns the subscription cap's value, server-side guard, and upgrade CTA — this
  spec's toggle (CAP-4/CAP-7) must stay cap-agnostic while surfacing a typed future cap
  error, so IDEA-008 never needs another shared-component redesign.
- The event-detail subscribe/unsubscribe toggle (CAP-7) must be confirm-then-refetch, not
  optimistic — a deliberate deviation from this app's existing default optimistic-mutation
  convention (e.g. `toggleFavorite`'s ±1 pattern), scoped to this new toggle only. See the
  still-open house-convention question below.
- Post-account association writes (CAP-3) must be idempotent under re-ingestion of the
  same post, matching `persistScrapedPost`'s existing dedupe-by-`postUrl` behavior — the
  association table needs an equivalent uniqueness constraint so re-processing never
  appends duplicate role rows.

## Non-goals

- Subscription-cap policy: its numeric value, server-side enforcement guard, and
  upgrade-CTA UX (IDEA-008's scope).
- Reconciling the PRD's free-user cap of "e.g., 2" against IDEA-008's resolved value of 5.
- Expanding spam/moderation policy for unrequested public account creation beyond the
  demand-gated discovery/provenance rules in CAP-5 — no new moderation system.
- BYOK quota/key selection, platform scraping capacity, account classification, and
  initial-scrape behavior — unchanged except where CAP-4 requires a typed integration
  point for the new subscribe flow.
- Verifying or re-deriving Bright Data's exact `coauthor_producers` field shape — its
  source fixture is unrecoverable; Bright Data-side adapter work waits on a fresh real
  payload capture (see Open Questions).
- Epic/story decomposition itself — this spec is the input contract for
  `bmad-create-epics-and-stories` (or `bmad-form-epics`), not a replacement for it.

## Success signal

A post scraped via the production Apify actor with populated `coauthorProducers` (real
evidence: a Pakuwon Mall Jogja post tagging Crunchmate.id, `vendor-role-mapping.md`)
round-trips through ingestion into one publisher association plus one-or-more coauthor
associations. Opening that event shows the coauthor via `SubscribedAccountCard` with a
working confirm-then-refetch toggle. Subscribing to that coauthor — never itself directly
scraped — succeeds, and its posts subsequently appear in the subscriber's filtered feed
(CAP-6).

## Assumptions

- Coauthor profile creation falls back to `username` as `displayName` when Apify's
  `coauthorProducers` supplies no full name, mirroring the existing
  `AccountProfileLookupResult` fallback chain (`item.fullName || item.displayName ||
  item.name || item.username`, `instagram-adapter.ts`'s `lookupAccountProfile`) — required
  by `displayName`'s `NOT NULL` constraint but not stated explicitly in the forged
  decision.
- "Existing short-date formatter" (CAP-7) refers to the locale-aware
  `Intl.DateTimeFormat` pattern already mandated project-wide (project-context.md's
  Locale-Sensitive Data Rendering rule, `EventCard.tsx`'s `formattedDate`), not a new
  formatter.
- Story `0-i6a` (status: `review`) generalizing `SubscribedAccountCard`/`AccountAvatar`
  toward a context/variant prop (list swipe-to-delete vs. detail subscribe-toggle) is
  assumed to land before or alongside this spec's CAP-7 UI work, per `epics.md`'s own note
  tying the two together; a `review`-status prerequisite is accepted as safe to build
  against per this project's standing convention.

## Open Questions

- The house-convention conflict flagged in `epics.md` is unadjudicated: BUG-008/Story
  2.i1a preserves an existing optimistic ±1 favorite-count pattern elsewhere, while this
  spec's CAP-7 mandates confirm-then-refetch for its own new toggle. Whichever ships first
  sets precedent for the other — should downstream epic/story work adjudicate this now, or
  keep both patterns scoped to their own mutations?
- Bright Data's `coauthor_producers` exact field shape (property names, whether a
  full-name-equivalent is present) is unverified — its cited fixture is no longer on disk.
  Should a fresh Bright Data run against a real coauthored post be captured before
  Bright Data-side adapter work begins?
- The new post-account association table's exact uniqueness-constraint shape (e.g. unique
  on `post_id+account_id+role` vs. `post_id+account_id`) is left to architecture/epic
  decomposition — only idempotency under re-ingestion is required here, not the precise
  DDL.
