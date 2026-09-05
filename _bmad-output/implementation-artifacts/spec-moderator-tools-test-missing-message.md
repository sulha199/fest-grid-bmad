---
title: 'Fix MISSING_MESSAGE console error in moderator-tools-content test'
type: 'bugfix'
created: '2026-09-05'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

# Fix MISSING_MESSAGE console error in moderator-tools-content test

## Intent

**Problem:** `pnpm test` passed (305/305 web tests, 615/615 backend, 0 lint/build errors), but `moderator-tools-content.test.tsx` logged a `next-intl` `MISSING_MESSAGE` error for `ModeratorToolsPage.accountsTabLabel` — the test's hand-rolled mock message object was missing a key the component actually looks up, and had drifted from the real `en.json` shape it was meant to mirror.

**Approach:** Add the missing key so the immediate error is silenced, then remove the drift risk at its root by having the test's message override spread the real `ModeratorToolsPage` messages from `en.json` instead of hand-duplicating them, keeping only the one field (`pageDescription`) the test deliberately overrides.

## Suggested Review Order

- The mock now spreads real `en.json` messages instead of hand-duplicating them, so a future added/renamed key can't silently drift out of sync again.
  [`moderator-tools-content.test.tsx:43`](../../apps/web/src/app/[locale]/moderator/tools/moderator-tools-content.test.tsx#L43)
