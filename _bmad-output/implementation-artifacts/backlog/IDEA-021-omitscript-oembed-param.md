---
backlog_id: IDEA-021
title: "Pass omitscript=true when calling Meta's oEmbed endpoint, since the frontend already loads embed.js itself"
captured: 2026-09-11
fixed: 2026-09-14
parent: IDEA-020
---

# IDEA-021 — omitscript=true on the Instagram oEmbed request

## Capture

Split out of IDEA-020 — a small, independently actionable win surfaced by a user-supplied
citation (developers.facebook.com oEmbed docs, cited but not independently fetched by this
session) and verified against this repo's actual code.

`adapter.ts`'s `resolveInstagramOEmbed()` builds its request as
`${INSTAGRAM_OEMBED_ENDPOINT}?url=${encodeURIComponent(postUrl)}`
(`apps/backend/src/lib/instagram-oembed/adapter.ts:26`) — no `omitscript` param, so Meta's
response `html` includes its own inline `<script>` tag alongside the blockquote. That's
redundant: `InstagramEmbed.tsx` already loads `//www.instagram.com/embed.js` itself once per
page via `loadInstagramEmbedScript`, independent of whatever the cached HTML contains.

Fix: add `&omitscript=true` to the oEmbed request URL — smaller cached payload (both in
`cache-store.ts` and over the GraphQL wire), one less inline script tag for the browser to
parse per embed, no behavior change since embed.js is already loaded separately. Low risk, no
architecture decision needed.

## Done, 2026-09-14 (bmad-quick-dev, commit 406147a)

Added `&omitscript=true` to the oEmbed request URL in `resolveInstagramOEmbed`
(`apps/backend/src/lib/instagram-oembed/adapter.ts`) so Meta's response `html` no longer
carries its own inline `<script src="//www.instagram.com/embed.js">` tag — the frontend
(`InstagramEmbed.tsx`'s `loadInstagramEmbedScript`) already loads embed.js once per page. Trims
the cached payload (`cache-store.ts` + GraphQL wire) and removes one inline script tag the
browser would otherwise parse per embed; no behavior change since embed.js is loaded
separately.

Added a regression assertion in `adapter.test.ts` that the request URL includes
`omitscript=true`; adapter suite 9/9 passing, backend `tsc` clean, eslint 0 errors on changed
files.
