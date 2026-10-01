---
backlog_id: FIND-030
title: "useGetMySubscriptionsQuery fires unconditionally on session presence on the event-detail page, with no shell-level warm cache unlike useMeQuery"
captured: 2026-09-15
---

# FIND-030 — Unconditional subscriptions query on event-detail

## Capture

Found via `bmad-agent-architect` audit (2026-09-15).

`EventDetailWrapper.tsx:58-64` calls `useGetMySubscriptionsQuery` gated only on
`enabled: !!session`, regardless of whether the event even has a linked source account — it's
consumed solely to compute `isSubscribedToAccount` for the "subscribe to source account"
button (`EventDetailWrapper.tsx:259-270`).

Unlike `useMeQuery` (confirmed a genuine cache-hit — `AppShellWrapper.tsx:31-33` fires the
identical `['me']`-keyed query in the root layout on every route, so `EventDetailWrapper`'s
copy is deduped by the shared `QueryClient`'s 30s `staleTime`), no `['getMySubscriptions']`
fetch exists at the shell level — only in `feed-content.tsx:54`,
`onboarding-subscribe-step.tsx:21`, and `subscriptions-content.tsx:39`.

A direct entry to event detail (share link, search result, Discover card) triggers a real,
otherwise-unneeded network call for events with no linked account at all.

## Fix direction (not yet scoped into a story)

Either gate the query on the event actually having a `sourceSocialMediaAccountProfile`, or
lift it to shell-level like `useMeQuery` if it's cheap and commonly needed.
