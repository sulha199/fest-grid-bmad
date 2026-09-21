---
backlog_id: IDEA-047
title: "AI-assisted correction should support re-scraping a post when its images/caption no longer exist"
captured: 2026-09-21
---

# IDEA-047 — Re-extract/re-scrape on missing source post media

## Capture

User-requested, while reviewing the event correction flow: the AI-assisted correction trigger
(`apps/web/src/features/events/correction-dialog.tsx` → `AiAssistedCorrectionTrigger` →
`extractEventDataFromUrl`) re-runs extraction against the post's *already-stored*
URL/content. If the source post's image(s) have since expired/been deleted, or the caption was
edited/removed on the origin platform, re-extraction has nothing fresh to work from and either
fails or extracts against stale data. There's no mechanism to re-scrape the post itself before
re-attempting extraction.

## Curator/guide carve-out (added 2026-09-21, user direction)

Follow-up direction, after BUG-039/the CURATOR_GUIDE investigation in this same session: for
`CURATOR_GUIDE`-sourced events specifically, **allow re-extraction and/or re-scraping when the
post's caption or images are missing** — narrowing, not reverting, Story 3.4o's decision to hide
`AiAssistedCorrectionTrigger` unconditionally for every `CURATOR_GUIDE` event
(`correction-dialog.tsx:354`, `event.sourceSocialMediaAccountProfile?.accountType !==
'CURATOR_GUIDE'`).

Context for why 3.4o hid it at all: `CURATOR_GUIDE` posts have their `content` (caption) cleared
at the two `markPostExtractedSeam` terminal points, and their images are only durably re-hosted
if the account opted in (`isImageStorageOptedIn`) — both deliberate data-minimization choices
(3.4o AC2/AC3). The trigger's backend path
(`extractEventDataFromUrl`, `resolvers.ts:1322-1344`) does a dual lookup that reads
`post.content` to re-run extraction for an already-existing post — which is exactly what 3.4o's
AC3 (cleared caption) makes meaningless/unsafe to expose blindly for every `CURATOR_GUIDE`
event, hence the blanket hide.

This idea asks for a **narrower gate**: instead of hiding unconditionally, detect the
missing-data case specifically (cleared caption and/or expired/missing image on a
`CURATOR_GUIDE`-sourced post) and offer re-extraction there, presumably backed by a **re-scrape
of that single post** (not the general re-extract-from-stored-content path, since the stored
content is exactly what's missing) rather than a blanket unhide of the existing trigger.

## Open questions for design/story work

1. Is a **single-post re-scrape** mechanism needed, or does the existing account-level trigger
   (`triggerAccountScrapeMutation`, Story 5.6) already cover this if scoped to one post's URL?
   5.6's trigger is account-level, not post-level, on first read.
2. For `CURATOR_GUIDE`, is "missing caption" detectable directly (column is nulled at
   extraction-terminal time per 3.4o), or does re-scrape need to hit the source platform first to
   know if it's still recoverable?
3. Should this reuse `AiAssistedCorrectionTrigger`'s existing UI with a conditional
   "missing data" mode, or is a distinct control warranted given 3.4o's explicit intent to keep
   `CURATOR_GUIDE` captions off-screen?
4. Interacts with BUG-039 (no automatic extraction trigger at all) — if BUG-039's PRD/
   architecture pass changes how/when extraction is triggered generally, this idea's design
   should follow from that outcome rather than be decided independently.

Not scoped into a story yet — needs a `bmad-architecture` or `bmad-correct-course` pass per the
open questions above, consistent with BUG-039's own note.
