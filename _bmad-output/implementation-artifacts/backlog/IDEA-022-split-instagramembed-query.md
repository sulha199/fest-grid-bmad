---
backlog_id: IDEA-022
title: "Split instagramEmbed out of getEventBySlug into its own query so the Instagram oEmbed round trip stops blocking the whole event-detail page"
captured: 2026-09-11
superseded: 2026-09-15
superseded_by: IDEA-028
---

# IDEA-022 — Split instagramEmbed into its own query (superseded)

## Capture

Split out of IDEA-020 as the confirmed, scoped root cause of the reported slowness —
researched and recommended by Claude 2026-09-11 via `bmad-help`, user agreed to the
parallel-endpoint direction.

Verified: `getEventBySlug` is not server-rendered — `EventDetailWrapper.tsx:45` fetches it
entirely client-side as ONE React Query hook (`useGetEventBySlugQuery`), with
`instagramEmbed { ... }` nested inside that same query (`queries.graphql:56`, resolved
server-side by `resolvers.ts:3586-3597`'s field resolver calling `resolveInstagramOEmbed`).
Because it's a single GraphQL request, `isPending` doesn't clear — so the ENTIRE event-detail
page (title, date, location, everything) sits in a loading state — until the slowest field, the
server-side Meta oEmbed round trip (cache miss = live fetch to `graph.facebook.com`), resolves.
A cache miss today blocks the whole page, not just the embed area.

## Proposed fix

Expose `instagramEmbed` as its own query (e.g. a root
`instagramEmbedForEvent(postUrl: String!, isImageStorageOptedIn: Boolean!, durableImageUrl: String): InstagramEmbed`
field, reusing `resolveInstagramOEmbed`/`resolveInstagramEmbedResult` unchanged — no new domain
logic, just a new entry point + removing the nested field from `Event`), fired as a second
client-side `useQuery` once the main `getEventBySlug` data resolves and
`sourcePostUrl`/`originalPostUrl` are known. Main event content then paints immediately;
`InstagramEmbed.tsx`'s existing loading skeleton (the `!isReady` branch) covers just the embed
area, now driven by the second query's own pending state instead of gating the whole page.

`@defer` was evaluated and rejected as the alternative (would keep one query): graphql-yoga
(this backend, `^5.21.2`) only supports it via a separate `@graphql-yoga/plugin-defer-stream`
plugin, explicitly documented by Yoga itself as experimental/not-yet-stable with the
incremental-delivery spec still in flux, requires clients to send a `multipart/mixed` Accept
header, and this frontend's `graphql-request` client is a plain single-JSON-response client
that doesn't parse multipart responses — would need a client swap or wrapper just for this one
field. The split-query approach needs no new dependencies and directly targets the confirmed
bottleneck (one blocking client-side fetch).

The 24h server-side oEmbed cache (`cache-store.ts`) is unaffected either way — this only
decouples timing of when the slow field resolves from when the rest of the page can render, not
caching behavior. Scoped enough to go straight to `bmad-create-story` without an architecture
pass — unlike IDEA-020's remaining (2)/(3) items (CDN caching, SW/PWA), this one had no open
design questions left.

## Superseded, 2026-09-15, by IDEA-028 (bmad-architecture, Architecture Spine AD-16)

This item's split-query fix still requires `sourcePostUrl`/`originalPostUrl` from
`getEventBySlug`'s own result before the second query can fire — sequential, not truly
parallel. AD-16's platform-prefixed slug scheme makes the Instagram permalink reconstructable
from the URL alone, so both queries fire from mount with no such dependency. Left here for
history; pick up IDEA-028 instead.
