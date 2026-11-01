# Background vendor jobs: evidence, decisions and open questions

**Status:** input to Epic 10, 2026-11-02. Not a PRD and not an architecture decision; the PRD amendment
(`bmad-prd`) and the new AD (written in Story 10.1a) supersede this where they differ.
**Backlog rows:** BUG-099 (re-extract drops carousel slides), IDEA-115 (profile lookup background phase),
IDEA-047 (re-scrape in AI correction), IDEA-008 (max 5 subscribed accounts), IDEA-009 (auto-extract on first
subscribe), BUG-014 (payload reprocessing unbuilt), IDEA-116..119 (created with the epic).
**Why this file exists:** the investigation that produced the epic ran in a chat. This is what the stories need
from it, with the queries and numbers that back each claim.

## 1. The incident that started it (BUG-099 follow-up)

A moderator opened Re-extract on event `20602ac39613` ("Kalender Event Lari di Jogja - September 2026") and the
preview said "Only 0 of 1 images were read". Read-only prod evidence:

| Fact | Evidence |
|---|---|
| The event has one post, `39f9168a-7390-4481-8f56-d1ab2b9bfc45` (`/p/DcntzF0mB7z/`), account `infoeventjogja` (CURATOR_GUIDE, CONFIRMED) | `events`, `event_posts`, `social_media_account_profiles` |
| The post was stored 2026-08-30 18:13Z, before slide capture existed (Apify slides shipped 2026-09-12 in Story 3.3e, Bright Data slides 2026-09-18 in FIND-024; the first stored slide anywhere is 2026-09-19 03:15Z), so `additional_image_urls` is NULL | `posts`; 0 of 71 August Instagram posts have slides; 410 posts predate 2026-09-19 |
| The stored cover link expired 2026-09-04 01:53:45Z (`oe`), so `postImagesNeedRefresh` returned true and a rescrape was attempted | `posts.image_url`, `image_url_expires_at`; cover returns 403 |
| The rescrape threw `No scraper adapter registered for platform "instagram"` in the API Lambda at 2026-10-31 14:32:26Z, was recorded as a FAILED job (starting the 10-minute cooldown) and fell back silently to the expired links | API Lambda log; `manual_extraction_jobs` row `f14d807c`; `lambdas/api.ts` never imports `lib/scraper/register-adapters.js` (only `index.ts` and `lambdas/scraper.ts` do) |
| Both previews then read 0 of 1 images (`imagesAvailable=1`, `imagesSent=0`): `Failed to fetch image: Status 403` on the cover | AI-processor log; jobs `6e64a903` (14:32:27, 0 events) and `6b7d2757` (14:32:47, 5 events, hit the cooldown) |
| The post is a 5-image carousel | The 2026-11-02 spike: both vendors return 5 images and the same 798-character caption |

A durable CloudFront copy of the cover exists and is alive (200, `image/jpeg`, 226 KB), but re-extract never uses it.
All 37 posts with a `durable_image_url` belong to accounts with `is_image_storage_opted_in = false`, which AD-12 Rule 1
says should hold none (logged in the tracker, not decided here).

## 2. What the spike measured (2026-11-02, one single-post scrape per vendor, run directly against the vendor APIs)

| | Apify (`apify~instagram-post-scraper`, `detailedData`, run-sync) | Bright Data (posts dataset `gd_lk5ns7kz21pck8jpis`, `POST /datasets/v3/scrape`, `[{url}]`) |
|---|---|---|
| Accepts one post URL | yes | **yes** (collect by URL; the existing client only did profile discovery) |
| Result | `type: Sidecar`, `childPosts` = 5 | `content_type: Carousel`, `photos` = 5 |
| Time (one sample) | 8.7 s | 27.6 s, answered synchronously (HTTP 200) |
| Image resolution | no size token (`stp=dst-jpg_e35_tt6`) | **640x640** (`stp=dst-jpg_e35_s640x640_tt6`) |
| Slide list vs cover | `childPosts[0]` **is the cover**, so the adapter's `additionalImageUrls` repeats it (354 of 354 stored Apify carousels; Bright Data 0 of 629); `build-gemini-request.ts` does not de-duplicate | `photos[0]` is the cover; the adapter slices it off correctly |

Signed image links live about 4.5 days. All 1,371 stored Bright Data covers are `s640x640`. One sample each: do not quote
the times as typical.

Vendor run durations over the previous 14 days (`scraper_actor_runs`, profile runs, so only a proxy for single posts):

| Vendor (async) | Runs | p50 | p90 | Tail |
|---|---|---|---|---|
| Apify | 21 | 31 s | 53 s | p99 120 s, max 134 s |
| Bright Data, succeeded | 268 | 79 s | 235 s | max about 39 h (late deliveries and replays); 21 snapshots arrived 5 to 6 h late on 2026-10-29 |

Apify `SYNC` rows record 0 s, so there is no timing for single-post calls beyond the spike sample.

## 3. Where code can run

| Lambda | Limit | Vendor tokens | Notes |
|---|---|---|---|
| API | hard 28 s | Apify and Bright Data tokens, but no `BRIGHTDATA_DATASET_ID` | registers no scraper adapters (BUG-100) |
| AI processor | 300 s | none | bundles sharp and the face-api models |
| Scraper | 300 s | both, plus `BRIGHTDATA_DATASET_ID` | SQS-driven; the natural worker host (AD-41) |

## 4. Decisions taken (with the product owner, 2026-11-01 and 2026-11-02)

1. Long vendor-backed work becomes a **job**: the request returns a job id at once, a worker finishes it, a **Jobs page**
   and an inline progress component show it. It must never freeze the screen.
2. One engine for every long process, starting with the re-extract rescrape and subscribe plus profile lookup, then the
   other candidates (all in Epic 10, so they are tracked in one place).
3. A job that fails on a vendor failure or vendor quota **switches to the next adapter** in a chain.
4. The chain supports **both Apify and Bright Data**; default order `apify,brightdata` (faster, full-size images).
5. Rescrape trigger: the cover link has expired, **or** the cover is low resolution (`s640x640` or smaller in `stp`),
   **or** slides are missing or unknown (null post type and null slide list).
6. A rescrape that yields fresh links **saves them to `posts`** (cover link, slides, expiry, post type). Never the caption,
   never an empty slide list over a non-empty one, never a 640 px cover over a full-size one. This amends AD-12
   (`posts.imageUrl` is never overwritten) and AD-40 (preview is write-free).
7. When the rescrape cannot finish in its budget (about 150 s inside the scraper Lambda's 300 s) the job continues on the
   stored images with a banner naming what is missing and a Retry button.
8. A vendor run that finishes after the deadline is still collected; for a rescrape its links are saved to `posts`.
9. Starting the same work twice **re-attaches** to the running job; the same input from different users shares one vendor
   call; a subscribe job **reserves a slot** against the subscription cap atomically; a per-user cap limits concurrent jobs.
10. The 10-minute rescrape cooldown starts only when a vendor call actually ran.
11. The new tables stay thin: a user-facing job record that references `apify_pending_jobs`, `brightdata_pending_jobs`,
    `scraper_actor_runs` and `vendor_call_locks` (recommended; the alternative is generalising `manual_extraction_jobs`,
    decided in Story 10.9).
12. The profile chain (`ProfileScraperAdapter`, `runProfileScraperChain`, `PROFILE_SCRAPER_PROVIDER_ORDER`, the `minBudgetMs`
    contract) is the model for the post chain.

## 5. Open questions (tracked in `epic-formation/epic-10-outside-the-epic-2026-11-02.md`)

- FIND-103: Apify is on the free plan ($5/month, cycle resets 2026-11-23). Upgrade, or Bright Data primary? This decides the
  default chain order and interacts with decision 5 (Bright Data images are 640 px).
- IDEA-115 D1 to D4 (`planning-artifacts/profile-lookup-fallback-and-ux-2026-10-31.md` section 6).
- Whether and how users are notified when a job finishes (IDEA-119): a PRD question for subscribers; moderators go through
  Epic 0.i1's helper.
- Story 3-4b (BYOK pooled scraper vendor keys): legally gated; its AC6 means chain credentials must depend on the job type.
- CC-032: the cost model (platform-paid or user-paid).
