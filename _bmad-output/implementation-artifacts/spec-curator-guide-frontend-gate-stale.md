---
title: 'Remove stale CURATOR_GUIDE frontend gate on Manual Post Selection'
type: 'bugfix'
created: '2026-09-19'
status: 'done'
route: 'one-shot'
review_loop_iteration: 0
context: []
---

## Intent

**Problem:** `posts-select-content.tsx` hard-gates any confirmed `CURATOR_GUIDE` account behind a "Tracking for this account type is coming soon... held back until a minimization pipeline exists" banner. That gate was added by Story 3.4n (commit `fd349bc`) explicitly *pending* Story 3.4o's minimization pipeline. Story 3.4o has since shipped (`review`, Completion Status: Complete) — it built caption-nulling/image-non-rehosting for `CURATOR_GUIDE` posts and already flipped the backend scrape-gate (`get-scrape-targets.ts`) to allow confirmed `CURATOR_GUIDE` accounts through — but nobody removed the frontend block afterward, so users still hit the stale "coming soon" message even though the account can now legitimately be tracked/extracted.

**Approach:** Remove both `CURATOR_GUIDE`-gating code paths in `posts-select-content.tsx` (the tab-row `Ban` icon and the content-area blocking banner), leaving the `PERSONAL` (permanent) and `AWAITING_APPROVAL` (pending moderation) gates untouched since those remain genuinely blocked. Delete the now-dead `gatedCurator*` locale keys from both `en.json`/`id.json` (confirmed unreferenced elsewhere), and update the corresponding test to assert the account renders normally instead of gated.

## Suggested Review Order

1. [apps/web/src/app/[locale]/posts/select/posts-select-content.tsx](../../apps/web/src/app/[locale]/posts/select/posts-select-content.tsx) — the actual gate removal (tab icon + content-area banner), two sites.
2. [apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx](../../apps/web/src/app/[locale]/posts/select/posts-select-content.test.tsx) — updated assertions proving the account now renders normally (post grid, no `Ban` icon, no gated banner text).
3. [apps/web/locales/en.json](../../apps/web/locales/en.json) / [apps/web/locales/id.json](../../apps/web/locales/id.json) — dead `gatedCurator*` key removal.
