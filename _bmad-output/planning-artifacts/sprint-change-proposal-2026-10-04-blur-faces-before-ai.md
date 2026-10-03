---
backlog_id: CC-028
status: approved
---

# Sprint Change Proposal — 2026-10-04

**Trigger:** A question during Wave 4C work: *is an image sent to Gemini used for training?* The answer in Google's Gemini API Additional Terms (page last updated 2026-04-28) depends on the billing tier of the key that makes the call. Content submitted through **unpaid** keys, including images, may be used "to provide, improve, and develop Google products", with possible human review; content submitted through **paid** keys is not used to improve products. FestDaily's extraction keys are subscribers' own bring-your-own keys (round-robin) plus an optional system key, and nothing in the code verifies a key's tier. Today the vendor receives the **original, unblurred** image.

**Mode:** Incremental (each artifact edit was reviewed and approved individually with the user before this document was written).

---

## 1. Issue Summary

AD-28 (CC-023) blurs faces in the durable thumbnail FestDaily *stores and shows*. It does nothing about the image FestDaily *sends out*: `build-gemini-request.ts` fetches the cover image and every carousel slide (up to `MAX_CAROUSEL_IMAGES`) and sends their original bytes inline, and the face-blur stage runs only afterwards (`process-ai-job.ts` step 7.5b). An identifiable bystander's face can therefore reach a vendor that may use free-tier content for product improvement. Three details of the current code shape the fix:

1. Only the **cover** image's bytes are kept after the call; carousel slides are discarded once sent, so a blur-before-AI mode must detect and blur **every** image before it goes out.
2. The post-extraction blur is gated by Gemini's own `hasFaceImage` answer (AD-28 Rule 1) and by Story 3.6o's relevance gate, which needs extracted dates (Rule 2). **Neither signal exists before the AI call.**
3. The code already has a text-only extraction fallback for when an image cannot be fetched, which gives a natural fail-closed path.

## 2. Impact Analysis

**Epic impact:** Epic 3 (Social Media Event Integration), `in-progress` — extended with two stories (3.20, 3.21). No other epic changes. The 3.6 letter series is exhausted (3.6z is the last), so the next free Epic 3 numbers are used.

**Built stories affected:** 3.6n (face-blur pipeline) and 3.6o (relevance gate), both at `review`. They keep working unchanged when the new mode is off or the owner opted in; 3.21 reworks how they cooperate when it is on.

**Artifact conflicts found and resolved:**
- **Architecture Spine:** AD-28 gains Rule 10 (blur-before-AI) and amendments to Rules 1 and 2; AD-29 gains Rule 7 (record what the AI saw).
- **PRD:** §3.16 gains a bullet (FR115); the §4.5 `isImageStorageOptedIn` description widens to include the permission to send originals to the AI vendor; Security gains an "AI Vendor Data Use" bullet.
- **epics.md:** FR115 added to the requirements inventory and Epic 3's coverage; new Stories 3.20 and 3.21; one-line notes on 3.6n and 3.6o.
- **sprint-status.yaml:** two `backlog` keys.
- **backlog.yaml:** this proposal as CC-028 and five carved-out child rows.

**Technical impact:** a new backend env var (`BLUR_FACES_BEFORE_AI`) in `env.ts` and the AI Lambda's IaC environment block; the request builder runs the existing WASM detect-and-blur before building the inline image parts; one small migration (an `ai_image_input` column on `extraction_audit_logs`). No new Lambda, queue or model asset. Measured by Story 0.46: ~1.1 s and ~903 MB peak per worst-case image, so even five slides processed one at a time stay far inside the 300 s limit and the 2 GB Lambda.

## 3. Recommended Approach

**Option 1: Direct Adjustment** — two new stories in Epic 3, no rollback, no MVP scope change. Effort `m`. Risk: low-medium (the pipeline code path changes, but the mode is configurable and the off path is byte-for-byte today's behavior).

**Decisions confirmed with the user during this session:**
- **On by default, with an owner opt-in exception.** `BLUR_FACES_BEFORE_AI` defaults to on. If the post's **owner** — the account with role `PUBLISHER` on the post (`posts.accountId`, AD-31), never a co-author — has `isImageStorageOptedIn = true`, the original is sent unchanged. **Any opt-in source counts** (moderator-set or owner-set). The opt-in's meaning widens to include this permission. A post whose publisher is unverified (`PUBLISHER_UNKNOWN`) counts as not opted in.
- **Fail closed.** If detection or blur fails, times out, or the remaining-time budget (`FACE_BLUR_MIN_REMAINING_TIME_MS`) is too low for an image, that image is not sent: a slide is dropped, a failed cover means caption-text-only extraction. The original is never the fallback.
- **Inline now; a queued blur stage is deferred.** A separate queue and Lambda for blurring was weighed (cleaner isolation and retries, but a new queue, Lambda, dead-letter queue, a temporary S3 copy and rework of Story 3.6z's claim logic; effort `l`). It is recorded as IDEA-057.
- **Whole-face blur, with a measured parity check.** To address the concern that blurring faces could degrade extraction, Story 3.20 includes an acceptance check that runs six real posts through extraction with and without the blur and records any difference: the four CC-024 reference posts plus two the user supplied on 2026-10-04 (https://www.instagram.com/suzurunberiman/p/Dd6SHRZzxI8/ and https://www.instagram.com/merapiperformance/p/DdVwNyFATse/). Eyes-only redaction (landmark model) was considered and deferred as IDEA-058: it is a much weaker de-identification, and the degradation is unmeasured.
- **Two stories:** 3.20 (the mechanism) and 3.21 (reuse for the thumbnail, relevance-gate interplay and the audit field).

## 4. Detailed Change Proposals

### Architecture Spine (`festgrid-architecture-spine.md`)
- **AD-28 Rule 10 (new): blur-before-AI.** The setting, the blur of every image before the call at original resolution (sequential, so peak memory stays one image), the owner opt-in exception, fail-closed behavior, and reuse of the one detection pass for the Rule 5 thumbnail. When off, Rules 1–9 are unchanged.
- **AD-28 Rule 1 (amended):** the `hasFaceImage` pre-filter applies only when the mode is off. When on, our own detection runs first, `hasFaceImage` is still requested and logged but describes an already-blurred image and must not be read as a false-negative signal (IDEA-051).
- **AD-28 Rule 2 (amended):** with the mode on, the relevance gate cannot skip detection (dates do not exist before extraction); it still skips thumbnail resize, upload and storage.
- **AD-29 Rule 7 (new):** the audit row records what the AI saw as `aiImageInput` (`blurred`, `original_owner_opted_in`, `original_mode_off`, `text_only_fail_closed`); with the mode on, `actualFaceDetectionCount` is known at insert, so no backfill. *Correction made during drafting:* no new `faceDetectionSkippedReason` is added for opted-in owners, because their pipeline is identical to the mode-off pipeline.

### PRD (`prds/festgrid-prd-2026-07-10-2047/prd.md`)
- **§3.16:** new bullet "Faces are blurred before an image is sent to the AI vendor, unless the post's owner opted in" (FR115).
- **§4.5:** `isImageStorageOptedIn` description widened: it gates re-hosting, which image source is served, **and** whether the account's originals may be sent unblurred to the AI vendor; it applies only to posts the account owns as publisher, never to co-authored posts.
- **Security:** new bullet "AI Vendor Data Use", recording the free-tier/paid-tier difference and pointing to FIND-066.

### Epics (`epics.md`)
- **FR115** added to the requirements inventory and to Epic 3's FRs covered.
- **Story 3.20: Blur faces before images are sent to the AI, behind `BLUR_FACES_BEFORE_AI`.** The env var (parsed in `env.ts`, set explicitly per stage in the IaC with an infra test); sequential detect-and-blur of the cover and every slide using Story 3.6n's module; the publisher-only owner opt-in exception; fail-closed behavior; unchanged requests when off or opted in (regression test); the blurred cover bytes and face count returned for 3.21; a re-measure of peak memory and time with five slides; and the **extraction parity check** on six posts (the four CC-024 reference posts plus `suzurunberiman/Dd6SHRZzxI8` and `merapiperformance/DdVwNyFATse`), where a material difference stops the dev and goes to the user. The two new posts have no recorded expected result, so their baseline is the extraction of the **original** image, which the user reviews and confirms as correct before it is used for comparison. The signed image links expire (the four existing posts' links expire about 2026-10-06), so each run **re-scrapes the posts fresh** (`poc-ingestion-preview.ts --url <post-url> --force`). **No post image is committed to the repository** — they show real people's faces, the very exposure this change reduces — so only the extraction outputs and the compared differences are recorded, in a new `cc-028-blur-parity-posts/` folder beside `cc-024-reference-posts/`. Depends on 3.6n, 3.6m, 3.6l, 3.6s, 3.15, 0.46.
- **Story 3.21: Reuse the pre-AI blur for the thumbnail and record what the AI saw.** With the mode on, the thumbnail stage resizes the already-blurred cover instead of detecting again; 3.6o's gate skips only resize/upload/storage; a migration adds `extraction_audit_logs.ai_image_input` (existing rows set to `original_mode_off`) and the writer records it. Depends on 3.20, 3.6n, 3.6o, 3.6p.
- One-line amendments under 3.6n and 3.6o pointing to 3.20 and 3.21.

### Sprint Status (`sprint-status.yaml`)
- `3-20-blur-faces-before-images-are-sent-to-the-ai-behind-blur-faces-before-ai` and `3-21-reuse-the-pre-ai-blur-for-the-thumbnail-and-record-what-the-ai-saw` added as `backlog` under `epic-3`.

### Backlog (`backlog.yaml`)
- **CC-028** (this proposal, `triaged`, impact `compliance`, effort `m`).
- Child rows (`parent: CC-028`, `backlog`): **FIND-066** (Gemini key billing tier never verified), **FIND-067** (moderator-set opt-ins now also authorize sending images to the AI vendor; consent scope widened after the fact), **IDEA-057** (queued blur stage), **IDEA-058** (eyes-only redaction via the landmark model), **IDEA-059** (evaluate Vertex AI's own data terms).

## 5. Implementation Handoff

**Scope classification: Moderate** — new backend and infrastructure stories within an existing epic, an architecture and PRD amendment completed in this session, and a backlog reorganization.

- **Developer agent (`bmad-dev-story`):** after `bmad-create-story` for 3.20 then 3.21. Both touch `process-ai-job.ts` and `build-gemini-request.ts`, so build them in order and not alongside other stories that edit those files. Code review for the Wave 4C stories (3.6n, 3.6o) should land first or alongside, since 3.21 reworks their interplay.
- **Product Owner / user:** decide at FIND-067 whether moderator-set opt-ins should keep counting once the owner self-service claim flow exists, and whether to re-confirm existing opt-ins under the wider wording; decide at FIND-066 whether to verify or require paid keys.
- **Not in this proposal:** the queued blur stage (IDEA-057), eyes-only redaction (IDEA-058), Vertex AI (IDEA-059).

## 6. Success Criteria

- With `BLUR_FACES_BEFORE_AI` on (the default) and a non-opted-in owner, no image part sent to Gemini contains an unblurred detected face; every carousel slide is covered.
- An opted-in owner's post is sent unchanged; a co-author's opt-in never counts; an unverified publisher is blurred.
- A detection failure, timeout or budget shortfall never results in an original being sent: the request degrades to caption text only (slide dropped, or cover text-only).
- With the mode off, the Gemini request is byte-for-byte what it is today.
- The extraction parity check on six posts (the four CC-024 reference posts plus the two user-supplied posts) is recorded, no post image is committed, and any material difference is raised to the user before the story is closed.
- One detection pass serves both the AI input and the stored thumbnail; the audit row records what the AI saw.
- Architecture Spine, PRD, epics.md and sprint-status reflect the same design with no undocumented conflict.
