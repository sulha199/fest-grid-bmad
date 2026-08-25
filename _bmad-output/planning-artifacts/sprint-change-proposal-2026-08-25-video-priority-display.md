# Sprint Change Proposal — 2026-08-25: Video/Reel Storage & Priority Display

**Trigger:** [`apps/ux-rework2.md`](../../apps/ux-rework2.md) item #1 — "store post's reel/video, and prioritize video in event detail rather than the image. The image will still be the skeleton loader." Items #2–#4 in the same file (aspect-ratio fix, avatar rounding, remove login button on discovery) are mechanical UI fixes, routed directly to `bmad-create-story`, out of scope here.
**Mode:** Batch
**Prepared by:** Amelia (Dev), via `bmad-correct-course`
**Scope classification:** **Moderate** — a real PRD data-model amendment is needed (unlike a pure UI tweak), but no epic restructuring, no new epic, and no Architect/system-level decision — this proposal itself resolves the PRD amendment and the open playback/fallback UX questions, then routes straight to `bmad-create-story`.

---

## Section 1: Issue Summary

**Problem type:** New requirement emerged from stakeholder review of the post-MVP UX punch list (`apps/ux-rework2.md`), following the same "raw punch list → triage → proposal" pattern as the 2026-08-24 UX batch (`sprint-change-proposal-2026-08-24-ux-rework-batch.md`).

**Core problem:** Instagram Reels/clips scraped as source posts carry a video, but the app currently only ever displays the poster/thumbnail image in the event detail view. The user wants the video to be the primary media shown in the detail view when one exists, with the image demoted to (a) the skeleton-loader placeholder shown while the video loads, and (b) the fallback shown if the video fails to play.

**Evidence gathered by direct codebase verification** (per the trigger's instruction not to assume):

| Question | Finding |
|---|---|
| Does Apify's raw scrape payload contain a video URL today? | **Yes.** Confirmed in saved sample runs: `_bmad-output/implementation-artifacts/apify-runs/run-fKvCBvXjZ7w9R9nFN.wanitatamajogja.md:146,154` and `run-fscXrfrVPXTSgv922.pakuwonmall.jogja.md:1139,1147` both show `"videoUrl": "https://instagram...mp4?..."` paired with `"productType": "clips"`. |
| Is it currently discarded, like `locationName`/`ownerFullName` were before Story 3.4m? | **Yes, same pattern exactly.** `apps/backend/src/lib/scraper/instagram-adapter.ts`: the `ApifyPostItem` interface (lines 38–57) doesn't declare `videoUrl`/`productType` at all, and `mapApifyItemToScrapedPost` (lines 212–228) never reads `item.videoUrl` — it's silently dropped after the Apify call, same file/function Story 3.4m touched for `locationName`/`ownerFullName`. |
| Does `Post`/`EventInfo`'s schema or GraphQL layer have any video field? | **No, at any layer.** `packages/database/schema.ts:173-193` (`posts` table) has no `videoUrl`/`mediaType`/`isVideo` column; `apps/backend/src/schema/events.graphql:84` exposes only `imageUrl: String`; the PRD's `Post` interface (§4.7, lines 564–597) has only `imageUrl?: string`. |
| Does `EventDetailView` have any video playback capability? | **No.** `packages/ui/src/features/events/EventDetailView.tsx:254` renders only `<EventImage imageUrl={imageUrl} .../>`. `EventImage.tsx` is a plain `<img>` wrapper with an `onError` fallback icon — no `<video>` element, no player library, anywhere in `@festgrid/ui`. `EventDetailViewProps` (types file) has no video-related prop. |

**Conclusion:** this is not a pure display-priority tweak on already-captured data. It requires real work at every layer — scraper adapter, DB schema/migration, GraphQL, and a new video-capable UI component — but each piece follows an existing, established pattern in this codebase (detailed in Section 2), so it does **not** rise to the "Major" strategic-replan bar the 2026-08-24 batch's system-key/IA items hit.

**Decisions made during this workflow run** (resolved via `AskUserQuestion` before drafting, since neither had an existing UX spec to reference):

| Question | Decision |
|---|---|
| Playback behavior | Autoplay, muted, looped — feed-style, matching how the content was originally consumed on Instagram. No controls needed for v1. |
| Fallback behavior on video load/playback failure | Fall back to the poster image (same `onError`-based graceful-degradation pattern `EventImage` already uses for broken image URLs), **plus** surface a link to view the video on the original post — reusing the existing `originalPostUrl`/`sourcePostUrl` source-attribution links already rendered in `EventDetailView.tsx:396-405` (PRD §3.3.3), not new plumbing. |

### Mandatory references used
- [`_bmad-output/project-context.md`](../project-context.md)
- [`prd.md`](prds/festgrid-prd-2026-07-10-2047/prd.md) — §4.1 (`EventInfo`), §4.7 (`Post`), §3.3.3 (Source Attribution)
- [`festgrid-architecture-spine.md`](festgrid-architecture-spine.md) — reviewed for a matching AD; none exists or is needed (see Section 2)
- Codebase verification: `apps/backend/src/lib/scraper/instagram-adapter.ts`, `packages/database/schema.ts`, `apps/backend/src/schema/events.graphql`, `packages/ui/src/features/events/EventDetailView.tsx`, `EventDetailView.types.ts`, `EventImage.tsx`, `_bmad-output/implementation-artifacts/apify-runs/*.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sprint-change-proposal-2026-08-24-ux-rework-batch.md` — used as the format/precedent reference per the trigger's instruction (its Item #14/Story 3.4m is the closest prior art for "field discarded from scrape payload, wired in later")

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 3** (Subscriptions/Scraping): Story 3.3c (scraper adapter interface, currently `review`, already reopened once for 3.4m's `locationName`/`ownerFullName` fields) gains one more optional normalized field: `videoUrl`.
- **Epic 1** (Discovery/Event Detail): Story 1.6a (`EventDetailView` component, `done`) and Story 1.6 (`View Event Details`, `review`) are reopened to add video playback.
- No epic is added, removed, or resequenced. No new epic needed.

### Story Impact

| Story | Current status | Change |
|---|---|---|
| **3.3c** — Scraper adapter interface & platform registry | review | Reopened again: normalized `ScrapedPost` shape gains optional `videoUrl?: string`, sourced from Apify's `videoUrl` field on the raw item. Same fix shape as the `locationName`/`ownerFullName` addition — `ApifyPostItem` interface, `mapApifyItemToScrapedPost`, and `scraped-post.schema.js` AJV schema all need the new field added. |
| *(new)* — DB migration: `posts.video_url` column | — | New story or folded into 3.3c's consumer story — nullable `text` column on `posts` (`packages/database/schema.ts`), Drizzle migration. Mirrors `image_url`'s existing shape exactly. |
| *(new)* — GraphQL: expose `videoUrl` on the Event type | — | `apps/backend/src/schema/events.graphql` gains `videoUrl: String` alongside the existing `imageUrl: String`; resolver/mapper updated to flatten `Post.videoUrl` the same way it already flattens `Post.imageUrl`. |
| **1.6a** — Build the reusable EventDetailView component | done | Reopened: new `videoUrl`/`videoAlt` (or similar) props on `EventDetailViewProps`; `EventImage` gains a video-capable sibling/variant (`<video autoPlay muted loop playsInline>`) that renders in place of the image when `videoUrl` is present, with the existing `EventImage` remaining the skeleton/loading and on-error fallback. On video failure, a fallback affordance appears reusing the existing `originalPostUrl`/`sourcePostUrl` attribution links (no new URL plumbing — those props already exist on `EventDetailViewProps`, lines 73-74). |
| **1.6** — View event details | review | Reopened: wires the new `videoUrl` field through from the GraphQL query into `EventDetailView`. |

### Artifact Conflicts

**PRD** — real changes needed (Section 4 below has exact text):
- §4.7 (`Post` interface): add `videoUrl?: string`, with a doc comment cross-referencing the new priority-display rule.
- §4.1 (`EventInfo` interface, `postId` doc comment, lines 329–331): currently states "EventInfo intentionally has no image field of its own... resolved via this relation, from the source post's `imageUrl`" — needs to say "image or video field" / "`imageUrl`/`videoUrl`".
- §3.4 (Event Management): add a new bullet (3.3.5) stating the video-priority display rule, autoplay/muted/loop behavior, and the image's dual role (skeleton loader + failure fallback).

**Architecture Spine** — **no new AD needed.** Checked explicitly (per the trigger's instruction) against the existing 11 ADs — none cover media/scraper field handling. The relevant precedent isn't a formal AD at all but an established convention already visible in code: `EventImage.tsx` hotlinks `imageUrl` directly from its external (Instagram/CDN) source with no re-hosting/proxy layer, degrading gracefully via `onError`. This proposal deliberately extends that same convention to video rather than introducing re-hosting/CDN-proxying, which would be new architecture. Worth stating explicitly here since it's a real design choice, not a default: Instagram's video CDN URLs are typically shorter-lived than image URLs, so video going stale sooner than the image is an accepted, known tradeoff — covered by the fallback-to-image + link-to-original-post decision above, not by re-hosting the video.

**UX Design docs** — minor addition: `DESIGN.md` gets a short token/note for the video variant (autoplay/muted/loop, no controls) alongside the existing `EventImage` token. No `EXPERIENCE.md` IA change — this doesn't add or move a route/nav entry.

**Technical Impact:** New DB column + migration (additive, nullable, no backfill needed — historical posts simply have `videoUrl: null`). New GraphQL field (additive). No destructive changes. No new external dependency needed for playback — a native `<video>` element covers autoplay/muted/loop/fallback; no player library (react-player, hls.js, etc.) required since these are direct MP4 URLs, not HLS streams.

---

## Section 3: Recommended Approach

**Selected: Option 1 — Direct Adjustment.** Effort: **Medium** (touches 4 layers, but each follows an existing pattern almost exactly — adapter field mapping mirrors 3.4m, DB column mirrors `imageUrl`, GraphQL field mirrors `imageUrl`, UI fallback mirrors `EventImage`'s own `onError` handling). Risk: **Low-Medium** — the one real open risk is video-URL staleness (Instagram CDN links expiring faster than image links), which is accepted and mitigated by the fallback-to-image-plus-original-post-link decision above, not by new infrastructure.

Rollback (Option 2) doesn't apply — no working code reverts. MVP review (Option 3) doesn't apply — this is additive, doesn't change or reduce the PRD's MVP goals.

This is lighter than the 2026-08-24 batch's Track A items (system key, IA restructuring): those needed PM+Architect sessions *before* story drafting because of genuine open strategic questions (a schema field with no natural value, a nested-tabs UX question with no precedent). Here, the PRD amendment is small and mechanical, and both open UX questions were resolved within this workflow run via direct questions to the user. No separate PM/Architect handoff is needed — this proposal's Section 4 amendments are the PRD update.

---

## Section 4: Detailed Change Proposals

### 4.1 PRD §4.7 — `Post` Interface

```
OLD:
  /**
   * The URL of the image in the post, if any.
   */
  imageUrl?: string;

NEW:
  /**
   * The URL of the image in the post, if any. Also used as the skeleton-loader placeholder
   * and playback-failure fallback when `videoUrl` is present (Section 3.3.5).
   */
  imageUrl?: string;
  /**
   * The URL of the video in the post, if any (e.g. an Instagram Reel/clip). When present, the
   * event details view prioritizes video playback over the poster image (Section 3.3.5).
   */
  videoUrl?: string;
```

Rationale: mirrors `imageUrl`'s existing shape exactly — a plain optional URL string, no separate `isVideo`/`mediaType` discriminator needed since presence of `videoUrl` itself is the signal, consistent with how `imageUrl`'s own presence is already used as its signal.

### 4.2 PRD §4.1 — `EventInfo` Interface (`postId` doc comment)

```
OLD:
  /**
   * The ID of the `Post` (see the `Post` interface, Section 4.7) this event was extracted from, if any.
   * EventInfo intentionally has no image field of its own — an event's image is resolved via this
   * relation, from the source post's `imageUrl`. The event details view also uses this relation to
   * surface attribution and links back to the source post's `postUrl`/`originalPostUrl` (Section 3.3.3).
   */
  postId?: string;

NEW:
  /**
   * The ID of the `Post` (see the `Post` interface, Section 4.7) this event was extracted from, if any.
   * EventInfo intentionally has no image or video field of its own — an event's image and video are
   * resolved via this relation, from the source post's `imageUrl`/`videoUrl`. The event details view
   * also uses this relation to surface attribution and links back to the source post's `postUrl`/
   * `originalPostUrl` (Section 3.3.3).
   */
  postId?: string;
```

### 4.3 PRD §3.4 (Event Management) — New Requirement Bullet

```
NEW (added after 3.3.4 Account Attribution):
*   **3.3.5. Video Prioritization:** When the source post has an associated video (`Post.videoUrl`,
    e.g. an Instagram Reel/clip), the event details view plays the video in place of the static
    poster image, autoplaying muted and looped (no manual controls for v1). The poster image
    (`Post.imageUrl`) remains the skeleton-loader placeholder shown while the video loads, and is
    also the fallback shown if video playback fails — in that case the view additionally surfaces
    the existing source-attribution link (Section 3.3.3) so the user can view the video on the
    original post.
```

### 4.4 Architecture Spine

No amendment. Explicitly confirmed no new AD is warranted (Section 2) — this extends the existing hotlink-with-graceful-degradation convention already demonstrated by `imageUrl`/`EventImage.tsx`, rather than introducing a new pattern.

### 4.5 Story Amendments (for `bmad-create-story` to pick up directly)

- **3.3c amendment:** `ScrapedPost` gains `videoUrl?: string`, mapped from Apify's raw `videoUrl` field in `instagram-adapter.ts` (`ApifyPostItem` interface + `mapApifyItemToScrapedPost`), plus the corresponding `scraped-post.schema.js` AJV schema update.
- **New DB/GraphQL work** (fold into 3.3c's consumer or a small new story, PO's call at story-creation time): `posts.video_url` nullable text column + migration; `videoUrl: String` added to the Event GraphQL type and its resolver/mapper.
- **1.6a amendment:** `EventDetailViewProps` gains `videoUrl`/`videoAlt`; `EventImage`'s sibling/variant renders `<video autoPlay muted loop playsInline>` when `videoUrl` is present; failure path falls back to `EventImage` and surfaces the existing attribution link.
- **1.6 amendment:** wire `videoUrl` from the GraphQL query through to `EventDetailView`.

---

## Section 5: Implementation Handoff

**Scope:** Moderate. This proposal's own PRD amendments (Section 4.1–4.3) constitute the required PRD update — no separate `bmad-prd` session needed. No Architecture Spine change. No `bmad-ux` pass needed — both open UX questions (playback behavior, failure fallback) were resolved directly in this workflow run.

**Route to:** Product Owner / Developer, via `bmad-create-story` for each story listed in Section 4.5 (3.3c amendment, the new DB/GraphQL work, 1.6a amendment, 1.6 amendment), same as this project's Track B precedent from the 2026-08-24 batch.

**Deliverables:**
- PRD amended in place: §4.7, §4.1 (`postId` doc comment), §3.4 (new bullet 3.3.5) — text finalized in Section 4, ready to apply.
- `sprint-status.yaml`: reopen 3.3c, 1.6a, 1.6 with amendment notes (per checklist item 6.4, done below).
- Stories drafted via `bmad-create-story` referencing this proposal.

**Success criteria:** Reels/clips scraped going forward have `videoUrl` populated on `Post`; the event detail view autoplays the video muted/looped when present, shows the image as skeleton loader and as fallback on playback failure, with a link to the original post surfaced on failure. No regression to the existing image-only path for non-video posts.
