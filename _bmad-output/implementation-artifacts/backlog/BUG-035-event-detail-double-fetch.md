---
backlog_id: BUG-035
title: "eventBySlug's full resolver fan-out runs twice per page load — generateMetadata's server fetch is discarded, then EventDetailWrapper re-fetches the identical over-fetching query client-side"
captured: 2026-09-15
---

# BUG-035 — Event-detail page fetches getEventBySlug twice

## Capture

Found via `bmad-agent-architect` audit (2026-09-15), following up on AD-16's event-detail
perf-priority rule.

`apps/web/src/app/[locale]/events/[slug]/page.tsx:21` and the modal's
`@modal/(.)events/[slug]/page.tsx:21` both call
`graphqlClient.request(GetEventBySlugDocument, {slug})` server-side inside `generateMetadata`
— but only read `eventName`/`description` from the result (`page.tsx:23-26`) before discarding
it entirely. `EventDetailWrapper.tsx:45-48` then fires the identical `useGetEventBySlugQuery`/
document client-side after hydration. No `React.cache()`/`unstable_cache` anywhere in
`apps/web/src` (verified), `lib/graphql-client.ts` is a bare `graphql-request` client with no
dedup, and no `HydrationBoundary`/`dehydrate` seeds the client cache from the server fetch — so
the entire resolver chain (BUG-033/BUG-034, plus
`sourceSocialMediaAccountProfile`/`isFavorited`/`favoriteCount`/`isHiddenForCurrentUser`) runs
fully twice per pageview, on both the full-page and modal-intercepted routes.

Compounds itself further: `EventDetailWrapper.tsx:317-326`'s `router.prefetch()` for the
adjacent next/prev event (full-page route only) speculatively triggers this same
doubled+over-fetching chain for a page the user may never open, discarded if they don't
navigate.

`generateMetadata` itself also over-fetches independently of the duplication — it needs only 2
scalar fields but requests the full document (schedules, isFavorited, favoriteCount,
instagramEmbed, etc.), so even a standalone fix to the duplication should also narrow
`generateMetadata`'s own query.

## Fix direction (not yet designed at capture time)

Either seed the client React Query cache from `generateMetadata`'s/a shared server fetch via
`HydrationBoundary`+`dehydrate`, or give `generateMetadata` its own minimal query requesting
only `eventName`/`description` so at minimum the wasted server-side fetch is cheap. Not yet
scoped into a story.
