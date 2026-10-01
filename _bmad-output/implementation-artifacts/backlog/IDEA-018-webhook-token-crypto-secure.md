---
backlog_id: IDEA-018
title: "Apify's webhook token uses Math.random() instead of a crypto-secure generator like Bright Data's"
captured: 2026-09-11
fixed: 2026-09-20
---

# IDEA-018 — Apify webhook token not crypto-secure

## Capture

Reported by user via `bmad-help`, found while fixing the webhook-token-mismatch bug (see git
history 2026-09-11: `apify-pending-jobs-store.ts`/`brightdata-pending-jobs-store.ts`'s
`createPendingJob` now requires the caller's `webhookToken` instead of generating its own).

`trigger-apify-for-target.ts:26-28` builds its webhook token via
`Array.from({ length: 24 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')`
— a non-cryptographic PRNG — while `trigger-brightdata-for-target.ts`'s
`generateWebhookToken()` uses `crypto.randomBytes(24).toString('hex')`. Since this token is the
sole secret gating which caller can complete a pending scrape job via the public,
unauthenticated `/webhooks/apify` endpoint (see `festgrid-backend-stack.ts:536`, no
authorizer), `Math.random()`'s predictability is a real (if low-severity, low-value-target)
weakness, not just a style inconsistency.

Proposed fix: extract a single shared token generator
(`crypto.randomBytes(24).toString('hex')`) used by both `trigger-apify-for-target.ts` and
`trigger-brightdata-for-target.ts`, removing the duplicated inline generator in
`trigger-brightdata-for-target.ts`'s `generateWebhookToken()` too. Low priority/xs effort — not
exploited, not blocking anything, but a one-line-call-site fix once picked up.

## Fixed, 2026-09-20 (bmad-quick-dev, commit 8f5e819)

Extracted a single shared crypto-secure token generator at
`apps/backend/src/lib/scraper/generate-webhook-token.ts` (`generateWebhookToken()` returning
`crypto.randomBytes(24).toString('hex')`) and switched both call sites to it —
`trigger-apify-for-target.ts` now uses the shared function instead of the inline
`Math.random()` hex builder, and `trigger-brightdata-for-target.ts` removed its local async
`generateWebhookToken()` (`await import('crypto')` + `randomBytes(24)`) in favour of the shared
one, so both providers use the same crypto-secure generator.

No behavior/format change (still a 48-hex-char token); verified via `tsc --noEmit`, eslint on
the three files (only the pre-existing `pendingJob` unused warning), and the
`trigger-apify-for-target` integration test (4 pass / 0 fail).
