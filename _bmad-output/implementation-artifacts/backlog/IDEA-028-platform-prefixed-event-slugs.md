---
backlog_id: IDEA-028
title: "Platform-prefixed event slugs (Architecture Spine AD-16) — DB-free, truly-parallel Instagram oEmbed resolution for the event-detail page, superseding IDEA-022's sequential split"
captured: 2026-09-15
---

# IDEA-028 — Platform-prefixed event slugs (AD-16)

## Capture

Coached via `bmad-architecture` (2026-09-15), user-initiated: the event-detail page was
flagged as the #2-traffic endpoint (now a standing rule in `project-context.md`, alongside
`getEvents`/BUG-030's #1 entry) and every element/endpoint on it must be optimized. Produced
Architecture Spine AD-16 (Platform-Prefixed Event Slugs & Parallel oEmbed Resolution) — full
design in `festgrid-architecture-spine.md`, decision trail in `planning-artifacts/.memlog.md`.

## Supersedes IDEA-022's mechanism, not just extends it

IDEA-022 proposed a second client-side query fired only AFTER `getEventBySlug` resolves and
`sourcePostUrl`/`originalPostUrl` are known from its result — sequential, not parallel, just
decoupled from the render-blocking nested-resolver shape. AD-16 removes that dependency
entirely: `events.slug` becomes `{platformSlug}_{postType}_{platformPostId}` (e.g.
`ig_p_Cx9uWttkSN`, `platformSlug` from the existing
`packages/domain/src/scraper/platform-registry.ts` — never a new mapping), so the Instagram
permalink is reconstructable from the URL the browser already has before ANY query starts. Both
React Query hooks (`useGetEventBySlugQuery` with `instagramEmbed` stripped out, and a new hook
for the DB-free oEmbed query) fire in `EventDetailWrapper.tsx` on mount, genuinely in parallel —
React Query dispatches independent hooks concurrently on its own.

## Scope

1. `posts` gains `platformPostId`/`platformPostType` columns, parsed once in
   `persistScrapedPost()` (`apps/backend/src/lib/posts/persist-scraped-post.ts`) alongside the
   existing `parseImageUrlExpiry()` call — captures the real `/p/` vs `/reel/` permalink type
   rather than assuming one, verified unconfirmed-interchangeable against Meta's own oEmbed
   docs.
2. `events.slug` generation moves out of `schema.ts`'s `$defaultFn` (no join access to `posts`)
   into `buildEventInsertValues()`, which reads the already-populated columns.
3. Fix-going-forward only, no backfill of existing hex slugs (AD-12 rule 5 precedent) — events
   with no resolvable post keep the legacy `randomBytes(6).toString('hex')` generator unchanged,
   already unambiguous by shape.
4. New DB-free backend resolver/query reconstructs the Instagram permalink straight from the
   slug (no `posts` join) before calling the existing
   `resolveInstagramOEmbed()`/`instagramOembedCache` unchanged — `apps/backend` stays the sole
   owner of the Meta call, cache, and credentials, never `apps/web`.
5. `prd.md`'s stale "Nano ID" slug description (Sections 4.1/4.4/8.2) corrected to match
   reality — it was never Nano ID, always `randomBytes` hex.

## Status

Ready for `bmad-create-story` (architecture pass complete, no open design questions) but likely
splits into multiple stories given its breadth (schema migration, ingestion parser, resolver,
GraphQL schema change, frontend query split) — similar to how 3-7d/3-7e split apart a comparably
sized oEmbed change.

## Amendment (2026-10-01, CC-024 / `sprint-change-proposal-2026-10-01-multi-event-posts.md`)

Event<->Post becomes many-to-many (AD-30), so this slug design gains three rules:

1. **Invariant: the slug names the primary post.** `{platformSlug}_{postType}_{platformPostId}` is built from `events.post_id` (the primary pointer); this is what keeps Rule 6's DB-free oEmbed correct.
2. **Ordinal suffix:** `-{extraction_ordinal}` when the event's ordinal is greater than 0 (`ig_p_Ddi9wU6RCRQ`, `ig_p_Ddi9wU6RCRQ-2`) so several events from one post get distinct slugs.
3. **Primary change re-slugs:** when cross-post matching (Story 3.6v) promotes a new primary post, the event takes the new post's slug and the old one is recorded in `event_slug_aliases`; `eventBySlug` resolves aliases only on a slug miss and returns a permanent redirect.

**Sequencing:** this idea's stories are a hard prerequisite of Stories 3.6t (multi-event ingestion) and 3.6v (matching/enrichment), hence `blocks: [CC-024]` on the board.
