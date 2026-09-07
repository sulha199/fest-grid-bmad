---
backlog_id: FIND-022
title: "Post co-author / collaborator identities are collapsed into the triggering account"
captured: 2026-09-07
---

# FestDaily backlog note: FIND-022

## Finding

Instagram post payloads can contain a publishing account plus coauthor/collaborator
identities. The current ingestion path assigns `posts.accountId` from the triggering
subscription job, which conflates content ownership with the account that paid for or
requested the scrape. Display traits, attribution, and account filtering can therefore
be wrong. BYOK key selection is a separate concern and remains keyed to the job/user
that triggered the scrape.

The Bright Data fixture at `D:\Downloads\sd_mtnt676r2fb2ouphzs.success.json` shows
`user_posted`/`user_posted_id` separately from `coauthor_producers`. This is evidence,
not yet a cross-vendor contract: Apify's representation and role semantics still need
to be inspected and normalized before implementation claims which identity is the
canonical publisher.

## Forged outcome

### Account identity and creation

- Normalize each vendor payload into distinct axes: scraping/subscription source,
  publishing/canonical account, and coauthors.
- Create a deduplicated `SocialMediaAccountProfile` for every valid discovered identity,
  including verified coauthors, with `(platform, stable platform account ID)` as the
  identity key. New profiles are unsubscribed by default.
- A text-only or incomplete producer may be retained as an internal provisional
  identity for attribution/filtering, but is not publicly searchable or subscribable.
  It must be backfillable and mergeable into the stable profile once the platform ID is
  known. Raw text alone must never create a public subscription target.
- A verified profile with a stable account ID is immediately subscribable from event
  detail or direct account-ID lookup; prior direct scraping is not a prerequisite.
  The existing subscription contract still requires display name and username, and
  may trigger the existing initial scrape/classification flow.
- Verified scrape-discovered profiles do not enter broad account autocomplete/ranked
  discovery until there is intentional demand (subscribe or vote). This limits
  directory pollution without blocking contextual subscription.
- Deduplicate by platform identity, retain discovery provenance/first-seen and
  last-seen information, and make malformed/ambiguous payloads observable.

### Data model and migration

- Add a normalized post-account association table with one row per post/account pair,
  explicit role (publisher/canonical, coauthor, scraping source, or publisher unknown),
  provenance, and a uniqueness constraint.
- Preserve `posts.accountId` during the transition for compatibility. For new posts it
  should be populated from the normalized canonical publisher only after vendor roles
  are verified; it must not be inferred from producer array order.
- Migrate existing rows losslessly: preserve their current `posts.accountId` and add
  an association marked scraping source/publisher unknown. Do not rewrite historical
  ownership without raw vendor evidence.
- User-facing account filtering matches the union of active associations, preserving
  subscribed-feed behavior while adding publisher/coauthor matches. Role data remains
  available for moderation and analytics.

### Event detail and shared account UI

- Show the post's posted-at timestamp with the existing short-date formatter.
- Render coauthors below the view-original-post link area using the existing
  `shared-account-info` pattern. Verified profiles expose the subscribe state/toggle;
  provisional identities remain display-only until they have a stable account ID.
- Replace the subscribed text label with an accessible subscribed/unsubscribed icon
  toggle. Confirm both subscribe and unsubscribe before mutating; do not optimistically
  change state. Refetch/invalidate the authoritative subscription state after success
  and restore the prior state on failure.
- Capture `subscription_toggle_succeeded` and `subscription_toggle_failed` with
  `action`, `platform`, `source`, and a sanitized backend `errorCode` on failure. Do not
  send raw handles, account IDs, captions, or post content.

## Explicit boundaries

- IDEA-008 owns the subscription-cap policy, numeric value, server-side guard, and
  upgrade CTA. FIND-022 must be cap-agnostic but handle a typed future cap error so
  IDEA-008 does not require another shared-component redesign.
- The active PRD is inconsistent with the backlog: monetization says a free-user cap
  of "e.g., 2", while IDEA-008 says 5; PRD section 8.2 is actually premium custom
  slugs. Reconcile that separately rather than inventing a limit here.
- Vendor-specific Apify/Bright Data schema verification and normalization is a
  prerequisite to implementation. No producer-order heuristic is accepted.
- Spam/moderation policy for unrequested public account creation beyond the
  demand-gated discovery/provenance rules is not expanded into a new moderation
  system in this item.
- BYOK quota/key selection, platform scraping capacity, account classification, and
  initial-scrape behavior remain existing concerns unless a typed integration point is
  required by the toggle.

## Handoff

This is now a cross-layer, multi-story finding (backend schema/ingestion/migration,
GraphQL filtering, event detail, shared UI, analytics). It is ready for `bmad-spec`
to define the normalized vendor contract and story boundaries. Do not use
`bmad-create-story` directly; `bmad-create-epics-and-stories` should follow the spec
if the project requires epic decomposition.
