---
backlog_id: CC-015
---

# Sprint Change Proposal — 2026-08-25: Video/Reel Storage & Priority Display

**Trigger:** [`apps/ux-rework2.md`](../../apps/ux-rework2.md) item #1 — "store post's reel/video, and prioritize video in event detail rather than the image. The image will still be the skeleton loader." Items #2–#4 in the same file (aspect-ratio fix, avatar rounding, remove login button on discovery) are mechanical UI fixes, routed directly to `bmad-create-story`, out of scope here.
**Mode:** Batch
**Prepared by:** Amelia (Dev), via `bmad-correct-course`
**Scope classification:** **Major**, split into two tracks — investigating the video feature surfaced a pre-existing, more serious bug: the app's `imageUrl` is a raw, time-limited Instagram CDN URL that already goes dead ~4 days after scraping, independent of this feature. Fixing that (Track A) needs new AWS infrastructure and an Architecture Spine decision. The video-display feature itself (Track B) stays additive/Moderate and does not depend on Track A.

**Note on this document's history:** a parallel session on this same repo applied an earlier draft (Track B only, before this investigation found the image-expiry issue) directly to `prd.md`/`sprint-status.yaml` and committed it (`90e5152b`) mid-conversation, including committing this file itself at that earlier state — which then got overwritten back to that earlier state on disk, losing everything from Track A onward until this rewrite restored it. `prd.md`/`festgrid-architecture-spine.md` have since been reconciled to match this final version (see Section 5).

---

## Section 1: Issue Summary

**Problem type:** New requirement (video priority display), which surfaced a technical limitation discovered during this workflow's own verification pass (image URL expiry) — two distinct issues, one trigger.

### 1.1 — What was asked for

Instagram Reels/clips scraped as source posts carry a video, but the event detail view only ever displays the poster/thumbnail image. The user wants the video to be the primary media in the detail view when one exists, with the image demoted to (a) the skeleton-loader placeholder shown while the video loads, and (b) the fallback shown if the video fails.

**Evidence gathered by direct codebase verification** (per the trigger's instruction not to assume):

| Question | Finding |
|---|---|
| Does Apify's raw scrape payload contain a video URL today? | **Yes.** `_bmad-output/implementation-artifacts/apify-runs/run-fKvCBvXjZ7w9R9nFN.wanitatamajogja.md:146,154` and `run-fscXrfrVPXTSgv922.pakuwonmall.jogja.md:1139,1147` both show `"videoUrl"` paired with `"productType": "clips"`. |
| Is it currently discarded, like `locationName`/`ownerFullName` were before Story 3.4m? | **Yes, same pattern exactly.** `apps/backend/src/lib/scraper/instagram-adapter.ts`: `ApifyPostItem` (lines 38–57) doesn't declare `videoUrl`/`productType`; `mapApifyItemToScrapedPost` (lines 212–228) never reads `item.videoUrl` — dropped after the Apify call, same file/function 3.4m touched for `locationName`/`ownerFullName`. |
| Does `Post`/`EventInfo`'s schema or GraphQL layer have any video field? | **No, at any layer.** `packages/database/schema.ts:173-193` (`posts` table), `apps/backend/src/schema/events.graphql:84`, and the PRD's `Post` interface (§4.7) all expose only `imageUrl`. |
| Does `EventDetailView` have any video playback capability? | **No.** `packages/ui/src/features/events/EventDetailView.tsx:254` renders only `<EventImage imageUrl={imageUrl} .../>` — a plain `<img>` wrapper with an `onError` fallback icon (`EventImage.tsx`). No `<video>` element or player library anywhere in `@festgrid/ui`. |

### 1.2 — What the investigation surfaced: image URLs already expire in ~4 days

While confirming the video field's shape, the raw Apify sample data was checked for how long these CDN URLs actually live — both `imageUrl` (mapped from Apify's `displayUrl`) and `videoUrl` embed a signed expiry (`oe=` hex Unix timestamp) in the query string. Decoded directly from the saved samples:

| Field | Sample scraped at | URL expires at | Lifetime |
|---|---|---|---|
| `imageUrl` (`displayUrl`) | 2026-08-21 00:13 | ~2026-08-24/25 | **~4 days** |
| `videoUrl` | 2026-08-20 19:02 | 2026-08-21 20:13 | **~25 hours** |

`persistScrapedPost` (`apps/backend/src/lib/posts/persist-scraped-post.ts:59`) writes this raw ephemeral URL straight into `posts.imageUrl` — there is no re-hosting today. Since `EventInfo` always resolves its image via `Post.imageUrl` (PRD §4.1) and has no image field of its own, **any event viewed more than ~4 days after it was scraped already has a dead image link**, silently caught only by `EventImage`'s existing `onError`→icon fallback. This is a pre-existing production bug this proposal surfaces, not something new to the video feature — and it matters more than the video expiring, because (the user's words) "the image itself is important to show the post to user," where video was always accepted as a best-effort addition.

A useful discovery while tracing this: the AI-extraction step already downloads the image's bytes for Gemini's vision call (`apps/backend/src/lib/ai-processor/build-gemini-request.ts:69-77`, `fetch(message.imageUrl)` → `arrayBuffer()`). That fetch is a natural, no-extra-request hook point for re-hosting — detailed in Section 2.

### 1.3 — Decisions made during this workflow run

Resolved via `AskUserQuestion` before drafting, since none had an existing UX or architecture spec to reference:

| Question | Decision |
|---|---|
| Video playback behavior | Autoplay, muted, looped — feed-style, matching how the content was originally consumed. No controls for v1. |
| Video failure fallback | Fall back to the poster image (same `onError` pattern `EventImage` already uses), plus surface a note/link to view the video on the original post — reusing the existing `originalPostUrl`/`sourcePostUrl` attribution props already on `EventDetailViewProps` (`EventDetailView.tsx:396-405`, PRD §3.3.3). No new URL plumbing. |
| Should images be re-hosted to durable storage? | **Yes** — see Section 1.4 for the cost analysis that grounds this. |
| Re-hosting scope | Only posts that become extracted events — piggyback the existing Gemini-fetch step, not a new fetch at scrape time. Manual Post Selection and moderator triage screens stay on the raw ephemeral URL (acceptable — short-lived triage window, well inside the ~4-day expiry). |
| Backfill of already-broken existing images | **No** — fix going forward only. Most existing images are already at or past their ~4-day expiry and unrecoverable without a fresh re-scrape; out of scope for this pass. |
| Which URL to serve, original vs. durable | **Prefer the original Instagram URL while it's still valid, fall back to the durable CloudFront copy once it expires** — computed server-side per request (Section 4.4). Saves CloudFront traffic by offloading the freshest, highest-traffic window of an event's life onto Instagram's own CDN, at essentially no engineering cost beyond storing one extra timestamp. |
| Client-side persistent caching of the original (cross-origin) image, e.g. via a Service Worker | **Rejected.** Explored in depth (see AD-12's "Considered and rejected" note): would require a Service Worker to reliably replay Instagram's opaque (no-CORS) responses, real ongoing complexity (registration, versioning, no auto-eviction, hard-to-debug staleness bugs), for a benefit capped at faster repeat visits on the *same device* — it doesn't reduce aggregate CloudFront traffic the way the original-vs-durable switch above does, and CloudFront isn't remotely near its limit at MVP scale regardless (Section 1.4). |

### 1.4 — Cost analysis: does S3 re-hosting threaten the AWS free tier?

The user specifically asked this — the project optimizes for the free tier, so it was checked directly rather than assumed. Verified against current AWS documentation (2026):

- **CloudFront has a permanent, account-age-independent Always-Free tier: 1 TB data transfer out + 10M HTTP/HTTPS requests/month, indefinitely** — this has had no 12-month expiration since a Dec 2021 pricing change, and applies the same way to every account regardless of when it was created.
- **S3's own "12-months free" allowance (5 GB storage, 20,000 GET, 2,000 PUT/month) is time- and account-status-limited.** AWS restructured its Free Tier on 2025-07-15: accounts created before that date keep the legacy 12-month S3 offer (only for their first 12 months); accounts created after get a $100–200 credit model with no S3-specific offer at all. *This project's exact AWS account creation date isn't recorded anywhere in the codebase/docs — worth confirming in the Billing console if a precise "still covered" answer matters, but the design below doesn't depend on the answer.*
- **Separately, all AWS accounts also get 100 GB/month of Always-Free data transfer out directly from any region (e.g. raw S3), permanently** — a different, non-expiring allowance from the CloudFront one above.

**Design choice: front the bucket with CloudFront (private bucket, Origin Access Control, no public S3 access) rather than serving S3 URLs directly.** This pins actual serving cost/limits to the *permanent* CloudFront Always-Free tier, sidestepping the account-age-dependent S3-specific allowance entirely — the one lever that actually matters for the user's stated goal.

**Estimated cost at this project's scale** (using the observed image sizes from sample data, ~100–400 KB each, and a generous 5,000 newly-extracted events/month): ~0.75–3 GB new storage/month (≈$0.02–0.07/month at standard $0.023/GB-month pricing), ~5,000 PUT requests/month (≈$0.025/month), and all serving/GET traffic absorbed by CloudFront's 1 TB/10M-request free tier at any realistic MVP traffic level. **Conclusion: negligible cost — well under $1/month — regardless of the account's free-tier status**, because volume at this stage is orders of magnitude below every relevant threshold. The design choice (CloudFront in front) is what makes that conclusion durable as traffic grows, not just true today.

At ~100–400 KB/image, CloudFront's 1 TB/month free allowance alone covers roughly **2.5–5 million image loads/month** before any cost — for an MVP-stage app that's enormous headroom regardless of whether images are ever deleted (deletion doesn't move this number; it's traffic-bound, not storage-bound — see AD-12 Rule 6).

### Mandatory references used
- [`_bmad-output/project-context.md`](../project-context.md)
- [`prd.md`](prds/festgrid-prd-2026-07-10-2047/prd.md) — §4.1 (`EventInfo`), §4.7 (`Post`), §3.3.3 (Source Attribution)
- [`festgrid-architecture-spine.md`](festgrid-architecture-spine.md) — reviewed for a matching AD; none existed for media re-hosting (new AD-12 added, Section 4.4)
- Codebase verification: `apps/backend/src/lib/scraper/instagram-adapter.ts`, `packages/database/schema.ts`, `apps/backend/src/schema/events.graphql`, `packages/ui/src/features/events/EventDetailView.tsx` (+ `.types.ts`, `EventImage.tsx`), `apps/backend/src/lib/posts/persist-scraped-post.ts`, `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, `apps/infrastructure/cdk.json` (confirmed no existing S3/object-storage stack), `_bmad-output/implementation-artifacts/apify-runs/*.md`, `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `sprint-change-proposal-2026-08-24-ux-rework-batch.md` — format/precedent reference (its Item #14/Story 3.4m/AD-10 is the closest prior art for both "field discarded from scrape payload" and "new AD added via correct-course")
- AWS Free Tier / CloudFront pricing — verified via web search against current (2026) AWS documentation, not recalled from training data, given this materially affects an infrastructure decision (sources: AWS's Dec 2021 data-transfer-expansion announcement; AWS's July 2025 Free Tier restructuring coverage)
- `packages/database/schema.ts:243` (`events.postId` unique constraint) — verified directly when the user asked about expiry-triggered deletion (Section 1.3, AD-12 Rule 6)

---

## Section 2: Impact Analysis

### Epic Impact
- **Epic 3** (Subscriptions/Scraping): Story 3.3c (scraper adapter interface, `review`, already reopened once for 3.4m's fields) gains `videoUrl`. The AI-extraction pipeline (Story 3.6's territory) gains the image re-hosting step.
- **Epic 1** (Discovery/Event Detail): Story 1.6a (`EventDetailView`, `done`) and Story 1.6 (`review`) are reopened for video playback.
- **Infrastructure** (`apps/infrastructure`, CDK): new S3 bucket + CloudFront distribution construct — no existing epic owns infra-only stories; filed as a new Epic 0 (Foundation) story, matching how Story 0.25 (Geoapify key/Secrets Manager wiring) was the precedent for infra-provisioning stories in this project.
- No epic is added/removed/resequenced; no epic is invalidated.

### Story Impact

| Story | Current status | Change |
|---|---|---|
| **3.3c** — Scraper adapter interface & platform registry | review | Reopened again: `ScrapedPost` gains optional `videoUrl?: string`, sourced from Apify's raw `videoUrl`. Same fix shape as the `locationName`/`ownerFullName` addition — `ApifyPostItem` interface, `mapApifyItemToScrapedPost`, and `scraped-post.schema.js` AJV schema. |
| *(new)* — DB migration: `posts.video_url` column | — | Nullable `text` column on `posts` (`packages/database/schema.ts`), mirroring `image_url`'s shape. Folded into 3.3c's consumer story or a small new one, PO's call at story-creation time. |
| *(new)* — GraphQL: expose `videoUrl` on the Event type | — | `events.graphql` gains `videoUrl: String` alongside `imageUrl: String`; resolver/mapper flattens `Post.videoUrl` the same way it already flattens `Post.imageUrl`. |
| **1.6a** — Build the reusable EventDetailView component | done | Reopened: `videoUrl`/`videoAlt` props on `EventDetailViewProps`; a video-capable sibling/variant of `EventImage` (`<video autoPlay muted loop playsInline>`) renders when `videoUrl` is present; `EventImage` remains the skeleton/loading state and the failure fallback. On video failure, surfaces the existing `originalPostUrl`/`sourcePostUrl` attribution link with copy explaining the user can view the video there. |
| **1.6** — View event details | review | Reopened: wires `videoUrl` from the GraphQL query through to `EventDetailView`. |
| *(new)* — Infra: S3 bucket + CloudFront distribution for post media | — | New Epic 0 story: CDK construct for a private S3 bucket (Origin Access Control, no public access) + a CloudFront distribution in front of it (`Cache-Control: immutable` on served objects). First object-storage/CDN resource in the project — no existing construct to extend. |
| *(new)* — Re-host extracted-event images to durable storage | — | Extends the AI-extraction step (`build-gemini-request.ts`'s image-fetch, or its caller in the Story 3.6 pipeline): after a successful extraction, upload the already-fetched image bytes to the new bucket and populate a new `posts.durableImageUrl` column (`posts.imageUrl` is left untouched — it keeps meaning "the raw scraper-source URL"). Applies only to posts that yield an `EventInfo` (Section 1.3's scope decision) — Manual Post Selection / moderator screens are unaffected. |
| *(new)* — Serve original-vs-durable image per request | — | New `posts.imageUrlExpiresAt` column, parsed once at scrape time from the raw URL's embedded expiry (adapter-specific; degrades to "treat as already expired" if a platform's URL has no parseable expiry). The Event GraphQL resolver computes the served `imageUrl` per request: original while `now < imageUrlExpiresAt`, else `durableImageUrl` (falling back to the original anyway if extraction/re-hosting hasn't completed yet). `durableImageUrl` is also exposed as a secondary field so the frontend's existing `onError` pattern can retry it if the served choice fails unexpectedly early. |

### Artifact Conflicts

**PRD** — changes needed (exact text in Section 4):
- §4.7 (`Post` interface): add `videoUrl?: string`.
- §4.1 (`EventInfo`, `postId` doc comment): mention video alongside image.
- §3.4 (Event Management): new bullet 3.3.5 for the video-priority display rule.
- No PRD text change for the image re-hosting fix — that's an implementation/storage detail (*how* `imageUrl` is served), not a change to *what* the field represents; stays an Architecture Spine concern.

**Architecture Spine** — one new AD needed (drafted in full in Section 4.4): **AD-12, Durable Media Re-hosting for Scraped Post Images.** This is genuinely new infrastructure (first S3 bucket + CDN in the project) with real security (bucket privacy, OAC), cost, and scope-boundary decisions worth recording — not a story-level detail to bury in a dev-story, consistent with why AD-10 (system Gemini key) got its own entry rather than being left implicit.

**UX Design docs** — minor: `DESIGN.md` gets a short token for the video variant (autoplay/muted/loop, no controls) alongside the existing `EventImage` token, and a note for the failure-state copy (link to original post). No `EXPERIENCE.md` IA change — no route/nav entry added or moved.

**Technical Impact:**
- New AWS infrastructure: S3 bucket + CloudFront distribution (CDK), new IAM permissions for the Lambda that performs the upload.
- New DB columns, all additive/nullable: `posts.video_url`, `posts.durable_image_url` (populated post-extraction), `posts.image_url_expires_at` (parsed once at scrape time). `posts.image_url` itself is never overwritten — it keeps its original raw-URL meaning; the resolver picks which URL to serve.
- New GraphQL fields (`videoUrl`, `durableImageUrl`, additive).
- No destructive changes anywhere. No new player library needed — direct MP4 URLs, a native `<video>` element covers autoplay/muted/loop/fallback.

---

## Section 3: Recommended Approach

**Selected: Option 1 — Direct Adjustment**, split into two independently-shippable tracks:

1. **Track A — Image durability (Major).** New infrastructure (S3 + CloudFront) and a new Architecture Spine decision (AD-12). Effort: **Medium-High** (new CDK constructs, IAM, a new pipeline step) — but bounded and well-precedented in shape (Story 0.25 already wired one Secrets-Manager-backed external credential; this follows the same "provision → wire into Lambda → done" arc, just for storage instead of a key). Risk: **Low** — cost is negligible at current scale (Section 1.4) and the design (CloudFront-fronted, piggybacked on an existing fetch) avoids inventing a new fetch/processing step. This is classified Major not because it's risky, but because it's a genuine new architectural component that deserves the AD-12 record before implementation, matching this project's own bar (AD-10's precedent).
2. **Track B — Video priority display (Moderate).** Additive UI/data-plumbing work across the scraper adapter, DB, GraphQL, and `EventDetailView`, each step mirroring an existing pattern almost exactly (adapter mapping mirrors 3.4m; DB column mirrors `imageUrl`; GraphQL field mirrors `imageUrl`; UI fallback mirrors `EventImage`'s own `onError`). Effort: **Medium**. Risk: **Low** — the one real open risk (video URL staleness) is explicitly accepted, not engineered around.

**Track A does not block Track B** — they touch different fields (`imageUrl` vs `videoUrl`) and different pipeline stages. Both can be drafted into stories immediately once this proposal is approved; no separate `bmad-prd`/`bmad-architecture` session is needed since both the PRD amendments (Track B) and the AD-12 draft (Track A) are already fully specified in Section 4, resolved within this workflow run rather than deferred.

Rollback (Option 2) doesn't apply. MVP review (Option 3) doesn't apply — both tracks are additive and don't change the PRD's MVP goals; Track A specifically *fixes* an existing gap in already-shipped MVP functionality rather than adding new scope.

---

## Section 4: Detailed Change Proposals

### 4.1 PRD §4.7 — `Post` Interface (applied)

```
OLD:
  /**
   * The URL of the image in the post, if any.
   */
  imageUrl?: string;

NEW:
  /**
   * The URL of the image in the post, if any. Also used as the skeleton-loader placeholder
   * and playback-failure fallback when `videoUrl` is present (Section 3.3.5). For posts that
   * yield an extracted event, the image actually served to clients may transparently switch to
   * a durably-hosted copy once this URL's own lifetime elapses — this field's meaning doesn't
   * change, only what's served over time (Architecture Spine AD-12).
   */
  imageUrl?: string;
  /**
   * The URL of the video in the post, if any (e.g. an Instagram Reel/clip). When present, the
   * event details view prioritizes video playback over the poster image (Section 3.3.5). Not
   * re-hosted — accepted as ephemeral (Architecture Spine AD-12).
   */
  videoUrl?: string;
```

### 4.2 PRD §4.1 — `EventInfo` Interface (`postId` doc comment) (applied)

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

### 4.3 PRD §3.4 (Event Management) — New Requirement Bullet (applied)

```
NEW (added after 3.3.4 Account Attribution):
*   **3.3.5. Video Prioritization:** When the source post has an associated video (`Post.videoUrl`,
    e.g. an Instagram Reel/clip), the event details view plays the video in place of the static
    poster image, autoplaying muted and looped (no manual controls for v1). The poster image
    (`Post.imageUrl`) remains the skeleton-loader placeholder shown while the video loads, and is
    also the fallback shown if video playback fails — in that case the view additionally surfaces
    the existing source-attribution link (Section 3.3.3) with copy explaining that the video can
    be viewed on the original post.
```

### 4.4 Architecture Spine — AD-12 (applied, appended after AD-11)

```
### AD-12: Durable Media Re-hosting for Scraped Post Images

*   **Binds:** `posts.durableImageUrl`/`posts.imageUrlExpiresAt` (new columns) and how the Event
    GraphQL resolver computes the `imageUrl` it serves, for posts that yield a
    successfully-extracted `EventInfo` (PRD §4.1/§4.7, amended 2026-08-25). `posts.imageUrl`
    itself is unaffected — it keeps meaning "the raw scraper-source URL," never overwritten. Does
    not bind `posts.videoUrl` — video is explicitly accepted as ephemeral (see Rule 3).
*   **Prevents:** Building a new/duplicate media-download step — this reuses the byte fetch the
    AI-extraction path already performs for Gemini's vision call; serving media directly from a
    public S3 bucket, which would tie this project's media-serving cost/limits to S3's own
    account-age-dependent free-tier allowance instead of CloudFront's permanent one (Rule 2);
    scope creep into re-hosting non-extracted posts (Manual Post Selection, moderator triage) or
    backfilling already-broken existing images — both explicitly deferred, not silently expanded
    later without a fresh decision.
*   **Rule:**
    1.  **Trigger & source of bytes:** on successful AI extraction (Story 3.6's pipeline,
        `build-gemini-request.ts`'s existing `fetch(message.imageUrl)` call), the same
        already-fetched image bytes are uploaded to the new media bucket and written to
        `posts.durableImageUrl`. No second fetch of the source image is performed, and
        `posts.imageUrl` is left untouched.
    2.  **Storage & serving:** a new, private S3 bucket (Origin Access Control, no public bucket
        access) fronted by a CloudFront distribution; only the CloudFront URL is ever written to
        `durableImageUrl`. Objects are served with `Cache-Control: public, max-age=31536000,
        immutable` — each is a unique file, never mutated once uploaded, so this is safe and lets
        the browser's normal HTTP cache do the rest with no custom code. This is a deliberate
        choice over serving S3 URLs directly: CloudFront's Always-Free tier (1 TB data transfer
        out + 10M requests/month) is permanent and account-age-independent, unlike S3's own free
        allowances, which per AWS's 2025-07-15 Free Tier restructuring only apply to legacy
        accounts within their first 12 months. Verified negligible cost at current project scale
        regardless of tier status (`sprint-change-proposal-2026-08-25-video-priority-display.md`
        Section 1.4).
    3.  **Original-preferred serving, computed per request:** `posts.imageUrlExpiresAt` is parsed
        once at scrape time from the raw URL's own embedded expiry (e.g. Instagram's `oe=` query
        param) and stored — parsed at write time, not read time, so a future change to a
        platform's URL format fails loudly once at ingestion rather than silently on every read.
        Adapters whose URL format has no parseable expiry leave this null, treated as
        "already expired" (never assumed valid indefinitely). The Event resolver then serves
        `posts.imageUrl` while `now < imageUrlExpiresAt`, else `durableImageUrl` (falling back to
        `imageUrl` regardless of expiry if `durableImageUrl` isn't populated yet — a maybe-stale
        link beats no link, and `EventImage`'s existing `onError` fallback already covers total
        failure). `durableImageUrl` is additionally exposed as a secondary field so the frontend
        can retry it via the same `onError` pattern if the served choice fails earlier than its
        nominal expiry. This offloads an event's freshest, highest-traffic window onto Instagram's
        own CDN at the cost of one extra stored timestamp — a real reduction in CloudFront usage,
        unlike the client-side approach considered and rejected below.
    4.  **Scope boundary (explicit MVP decision):** only posts that reach a successful extraction
        are re-hosted. Posts that never extract (rejected, or awaiting triage in Manual Post
        Selection) keep their raw, time-limited scraper-source `imageUrl` — acceptable given
        their short, near-real-time usage window, well inside the source URL's ~4-day lifetime.
        `posts.videoUrl` is never re-hosted — accepted as ephemeral; on playback failure the
        product falls back to the (durable, once extracted) image and links to the original post
        (PRD §3.3.5).
    5.  **No backfill:** already-persisted posts/events with a raw (likely already-expired)
        `imageUrl` are not retroactively re-hosted in this pass — fix-going-forward only, an
        explicit decision, not an oversight.
    6.  **No expiry-triggered deletion:** hosted images are never deleted when their event
        "expires" (its schedules pass). Checked directly, not assumed: `events.postId` is a
        strict 1:1 unique constraint (`packages/database/schema.ts:243`, no shared-image risk
        either way), but "expired" is not "deleted" anywhere in this product — PRD §3.4.2 only
        hides expired events from personalized *list* views, `Post` is explicitly excluded from
        the soft-delete convention (AD-8), and Story 4.8 (Archived/Hidden Personal Events, done)
        plus any direct slug deep-link keep an expired event's detail page — and therefore its
        image — reachable indefinitely. Deleting on expiry would reintroduce this exact AD's
        problem on a delay. The cost case is also nil: even accumulating every extracted event's
        image with zero deletion for a full year is single-digit GB (Section 1.4) — there is no
        storage-cost problem to solve. If storage hygiene is ever wanted, the right tool is a
        no-code **S3 Lifecycle rule** keyed to object age (e.g. transition/delete after 2+ years),
        not application logic keyed to event-expiry semantics.
*   **Considered and rejected:** a Service Worker persisting the *original* (cross-origin,
    Instagram-hosted) image client-side past its own expiry, using the Cache Storage API to
    intercept the browser's request and replay a stored copy. Rejected because (a) Instagram's
    CDN won't grant CORS, so a page-script `fetch` only yields an opaque response whose body JS
    cannot read/reconstruct into a usable `Blob` — reliably replaying it requires a Service
    Worker's `fetch`-event `respondWith`, not a simple client-side cache check; (b) once Rule 3's
    original-vs-durable switch exists, the benefit shrinks to avoiding one already-fast,
    already-free CloudFront request, and only for a repeat visitor on the *same device* — a new
    device or cleared cache gets no benefit either way; (c) real ongoing complexity independent of
    this decision — SW registration/scope, cache versioning so deploys don't serve stale content,
    no automatic eviction, and SW bugs are notoriously hard to debug once stuck on a client. The
    complexity-to-benefit ratio doesn't clear the bar this project's other infra decisions do.
*   **Open for future discussion (not decided, not built):** whether push-notification delivery
    (FCM, Story 2.9) should trigger proactive cache-warming of a post's image/video, so the media
    is already loaded by the time a subscriber taps the notification — e.g. a push-event-triggered
    Service Worker warm, and/or ensuring server-side re-hosting has completed before the push is
    sent. This is a narrower, more targeted trigger than the general "cache every image for repeat
    visits" case rejected above (Push API's `push` event handler is the standard place for
    background work triggered by a notification, not by browsing), and could also bear on whether
    `videoUrl` re-hosting is worth revisiting for the push-triggered case specifically, since a
    push fired soon after extraction would land well inside video's ~25-hour window. Deliberately
    left open, not designed here — see Section 6.
```

### 4.5 Story Amendments (for `bmad-create-story` to pick up directly)

**Track A:**
- **New infra story** (Epic 0): CDK construct for the private S3 bucket (OAC, no public access) + CloudFront distribution (with `Cache-Control: immutable` on served objects) + IAM permissions for the extraction Lambda to write to it.
- **New pipeline story** (Epic 3, extends Story 3.6's territory): `posts.durableImageUrl`/`posts.imageUrlExpiresAt` columns + migration; on successful extraction, upload the already-fetched image bytes to `durableImageUrl`; on scrape, parse and store `imageUrlExpiresAt` from the raw URL. `posts.imageUrl` itself is never modified.
- **New resolver story** (Epic 3 or wherever the Event GraphQL resolver lives): compute the served `imageUrl` per AD-12 Rule 3 (original while valid, else `durableImageUrl`, else original as last resort); expose `durableImageUrl` as a secondary GraphQL field; `EventDetailView`/`EventImage` gain an optional fallback-URL prop so the existing `onError` handler can retry it.

**Track B:**
- **3.3c amendment:** `ScrapedPost` gains `videoUrl?: string`, mapped from Apify's raw `videoUrl` in `instagram-adapter.ts`, plus the `scraped-post.schema.js` AJV update.
- **New DB/GraphQL story:** `posts.video_url` nullable column + migration; `videoUrl: String` on the Event GraphQL type + resolver/mapper.
- **1.6a amendment:** `videoUrl`/`videoAlt` props on `EventDetailViewProps`; video-capable variant of `EventImage`; failure path falls back to the image and surfaces the attribution link with explanatory copy.
- **1.6 amendment:** wire `videoUrl` from the GraphQL query through to `EventDetailView`.

---

## Section 5: Implementation Handoff

**Scope:** Major overall (Track A), Moderate (Track B) — both resolved within this workflow run, no separate `bmad-prd`/`bmad-architecture` session required.

**Applied 2026-08-25:** PRD amended in place — §4.7, §4.1 (`postId` doc comment), §3.4 (new bullet 3.3.5), all matching Section 4's final text (the `imageUrl` doc comment was corrected after a parallel session had applied an earlier draft's wording — see the note at the top of this document). Architecture Spine amended in place — AD-12 appended after AD-11, matching Section 4.4. `sprint-status.yaml` reopened for 3.3c/1.6a/1.6 (Track B); Track A's three new stories (infra, pipeline, resolver) added as `backlog` entries.

**Route to:** Product Owner / Developer, via `bmad-create-story`, for each story in Section 4.5. Track A and Track B can be drafted and built in parallel — no dependency between them.

**Success criteria:**
- Track A: extracted events' images remain viewable indefinitely, independent of Instagram's CDN expiry — served from the original URL while it's still valid, transparently switching to the durable CloudFront-fronted copy once it isn't; cost stays negligible as verified in Section 1.4.
- Track B: reels/clips scraped going forward have `videoUrl` populated; the event detail view autoplays the video muted/looped when present, shows the image as skeleton loader and as fallback on playback failure, with an explanatory link to the original post on failure. No regression to the existing image-only path for non-video posts.

---

## Section 6: Deferred Ideas / Future Discussion

Not decided, not scoped into any story — recorded here (and mirrored in Architecture Spine AD-12) so they surface next time this area comes up rather than needing to be rediscovered.

- **Push-notification-triggered cache warming:** when a subscriber receives a push notification (FCM, Story 2.9) about a new post/event, should the app proactively warm the cache for that specific post's image/video — e.g. a push-event-triggered Service Worker fetch, and/or ensuring server-side re-hosting (Track A) has completed before the push is sent — so the media is already loaded by the time the subscriber taps the notification? This is a narrower, more targeted trigger than the general "cache every image for repeat browsing" idea considered and rejected in AD-12 (Push API's `push` event handler is the standard place for notification-triggered background work, not for browsing-triggered caching), and could also reopen whether `videoUrl` re-hosting is worth it specifically for the push-triggered case, since a push fired soon after extraction would land well inside video's ~25-hour window rather than needing to survive days like the general case.

---

## Section 7: Implementation Wave Plan

Sequenced by actual dependency, not by track — Track A and Track B are independent of each other (Section 3), so their waves run in parallel lanes and only merge where a real dependency exists. Each story is drafted via `bmad-create-story` before dev work starts (everything below is currently a `backlog`/reopened `sprint-status.yaml` entry, not yet a fully-specified story file). Per this project's established convention (session memory: "delegate coding to gemini-cli"), implementation itself is dispatched to `cline-cli`/`gemini-cli` in an isolated git worktree, one dispatch at a time, with independent verification (diff, tests, build, lint) before merge — not written directly in-session, even for small fixes.

| Wave | Track A (image durability) | Track B (video storage/display) |
|---|---|---|
| **1** (parallel, no dependencies) | **0-33** — S3 bucket + CloudFront distribution (CDK infra: private bucket/OAC, distribution, `Cache-Control: immutable`, IAM for the extraction Lambda) | **3.3c amendment** — `videoUrl` added to `ScrapedPost`/`instagram-adapter.ts` + AJV schema  •  **New DB/GraphQL story** — `posts.video_url` column + migration + `videoUrl` on the Event GraphQL type  •  **1.6a amendment** — video-capable `EventDetailView`/`EventImage` variant (presentation-only, built against the `videoUrl` prop contract — doesn't need real backend data to build/test) |
| **2** | **3-6e** — re-host images to durable storage: `durableImageUrl`/`imageUrlExpiresAt` columns + migration, upload the already-fetched extraction bytes to the Wave 1 bucket, parse expiry at scrape time *(depends on 0-33)* | **1.6 amendment** — wire the real `videoUrl` GraphQL field through to `EventDetailView` *(depends on the Wave 1 DB/GraphQL story and 1.6a)* |
| **3** | **3-6f** — Event resolver's original-vs-durable serving logic (AD-12 Rule 3) + `durableImageUrl` as a secondary field + the `onError` retry prop on `EventDetailView`/`EventImage` *(depends on 3-6e)* | — (Track B complete after Wave 2) |

Track A finishes one wave later than Track B (three waves vs. two) since it has a strict infra → data → serving-logic chain; Track B's only real join point is Wave 2, where the schema/GraphQL work and the component both feed into wiring them together.
