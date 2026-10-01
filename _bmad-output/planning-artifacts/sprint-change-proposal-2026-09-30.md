---
backlog_id: CC-023
status: approved
---

# Sprint Change Proposal — 2026-09-30

**Trigger:** A `bmad-help` conversation exploring whether post images could be re-hosted as small, face-blurred thumbnails (privacy motivation) and what it would cost in AWS/Gemini terms. The technical exploration (Rekognition vs. face-api.js vs. a Gemini pre-filter, thumbnail sizing against real masonry-column widths, and an extraction-quality audit table) converged into a concrete, user-approved design that extends Architecture Spine AD-12.

**Mode:** Incremental (each edit reviewed and approved individually with the user before the next).

---

## 1. Issue Summary

No story or defect triggered this — it originated from product/cost discovery, not implementation. Three real gaps surfaced once the idea was pressure-tested against the live codebase:

1. **No mechanism exists today to protect bystander privacy in post images.** The PRD already establishes a strict privacy-by-design stance elsewhere (`SocialMediaAccountProfile.profileImageUrl` never displayed regardless of opt-in status; no performer photo ever extracted, PRD §3.16/§4.5) — but nothing addresses an identifiable bystander's face in an event photo itself.
2. **AD-12's consent gate (Rule 7) is scoped to a different concern than this feature needs.** Rule 7 exists to prevent an unconsented *persistent copy* of a scraped account's original content, for copyright/ToS-exposure reasons. A face-blurred thumbnail is a different kind of persistent derivative, motivated by an independent concern (bystander privacy) — conflating the two, or silently gating the new feature on the old rule, would either misrepresent why each exists or block a privacy-protective feature behind a rule built for a different risk.
3. **The masonry card system's `prominentPoster` treatment (`durableImageUrl`, opted-in-only) has no path for non-opted-in accounts**, and the thumbnail-sizing decision needed to be grounded against the grid's real column-width math (`GridContainer`'s `baseCols`/`colsStep`) rather than an assumed device size — an earlier sizing pass (800px) was corrected against realistic device-width data before landing on 480px.

## 2. Impact Analysis

**Epic impact:** Epic 3 (Social Media Event Integration), `in-progress` — not invalidated, extended with 4 new stories (3.6m–3.6p) continuing the existing image-handling arc alongside Stories 3.6e–3.6l (several still `review`, not `done`). No dependency on Epic 8 (self-service account-claim, still a backlog placeholder) — this feature is explicitly consent-independent, so it doesn't need that flow to exist.

**Artifact conflicts found and resolved:**
- **Architecture Spine:** New AD-28 (face-blurred thumbnails, consent-independent, expiry-gated) and AD-29 (extraction quality audit log, separate table, ground-truth-where-available). AD-12 itself is unchanged — `durableImageUrl` keeps its exact existing opted-in-only, unblurred, full-resolution meaning.
- **Epics.md:** 4 new stories (3.6m–3.6p) in Epic 3; a retrofit note added to the already-in-review Story 3.6l (its `minScheduleCount`/`expectedScheduleNames` fields gain persistence via 3.6p, no change to 3.6l's own shipped/in-review behavior).
- **PRD:** §3.16 (Scraping & Display Data Minimization) gains a new bullet documenting `durableThumbnailUrl`'s consent-independent behavior and the widened `prominentPoster` trigger; its existing "felt incentive to opt in" framing is corrected to reflect the new three-tier reality (sharp prominent vs. blurred prominent vs. default, not prominent vs. nothing).
- **sprint-status.yaml:** 4 new stories added as `backlog` under `epic-3`.

**Technical impact:** Two new schema pieces — `posts.durableThumbnailUrl` (a new, separate column from `posts.durableImageUrl`) and a new `extraction_audit_logs` table (never joined into any hot-path resolver, per AD-17's per-row-cost discipline). Two new fields on the Gemini extraction schema (`hasFaceImage`, `faceImageCount`, added the same way Story 3.6l added `minScheduleCount`/`expectedScheduleNames` — both `build-gemini-request.ts` and `extracted-event.schema.ts` change together). One new library dependency (`@vladmandic/face-api`, pure npm, no native binaries) and one new processing stage in the existing AI Processor Lambda (no new Lambda, no second image fetch). One frontend change (`event_card_masonry`'s `prominentPoster` trigger widens to include `durableThumbnailUrl != null`).

## 3. Recommended Approach

**Option 1: Direct Adjustment** — new stories within Epic 3's existing structure, no rollback, no PRD MVP scope change. Effort: Medium (`m` on the backlog scale — 4 stories). Risk: Low — every new story is additive; nothing currently-shipped changes behavior except the `prominentPoster` trigger widening (a strictly additive UI improvement for non-opted-in accounts, not a regression for opted-in ones).

**Key decisions confirmed with the user during this session:**
- **face-api.js over AWS Rekognition** for face detection — zero marginal per-image AWS cost, at the accepted cost of lower recall than Rekognition on small/angled/occluded/low-light faces (the profile of real event crowd photos). A batched-Rekognition alternative (merging multiple thumbnails into one API call) was considered and rejected: it needs a buffering layer foreign to today's per-post SQS-triggered pipeline, and risks silently dropping faces past Rekognition's per-call face-count cap.
- **`durableThumbnailUrl` is consent-independent by design** — populated regardless of `isImageStorageOptedIn`, a deliberate divergence from AD-12 Rule 7 recorded explicitly in AD-28 Rule 6, not a silent reinterpretation of that rule.
- **A relevance gate (AD-28 Rule 2)** skips the entire detection/blur/storage pipeline when an event's schedule ends before its source image would have expired anyway, narrowing the feature's footprint (compute, storage, and bystander-photo retention) for short-lived events specifically.
- **480×480px thumbnail**, sized against real masonry column widths (phone through common ~1920px desktop at 2x retina), with deliberate, accepted softness on wide/ultrawide monitors reasoned from typical desktop viewing distance — not the initially-proposed 800px, which was calibrated against an unrealistic wide-monitor edge case.
- **Detection runs against the original fetched image bytes**, never a pre-resized copy — face-api.js's own `inputSize` parameter already handles internal downsampling for inference, and running on the original avoids an unnecessary coordinate-remapping step before blurring.
- **Extraction-quality signals (`hasFaceImage`/`faceImageCount`, and retroactively `minScheduleCount`/`expectedScheduleNames`) are persisted to a new, separate `extraction_audit_logs` table** — not to `posts`/`EventInfo`, never GraphQL-exposed — specifically so the extraction pipeline's accuracy can be evaluated against ground truth over time. This has a known, explicitly recorded blind spot: rows where `hasFaceImage = false` never get a ground-truth comparison, since the face-detection pipeline never runs on them by design.

## 4. Detailed Change Proposals

All changes were applied incrementally and approved in-session. Summary by artifact:

### Architecture Spine (`_bmad-output/planning-artifacts/festgrid-architecture-spine.md`)
- New **AD-28: Face-Blurred Thumbnails — Consent-Independent, Expiry-Gated** (Gemini pre-filter, relevance gate, face-api.js detection against original bytes, blur-then-resize ordering, 480px spec, consent-independent storage, widened `prominentPoster` trigger, accepted accuracy trade-off).
- New **AD-29: Extraction Quality Audit Log — Separate Table, Ground Truth Where Available** (new table not new columns, ground truth captured alongside self-report, skip reasons recorded, the `hasFaceImage = false` blind spot recorded explicitly, never joined into a hot path).

### Epics (`_bmad-output/planning-artifacts/epics.md`)
- New Story 3.6m (Gemini `hasFaceImage`/`faceImageCount` self-reported fields, written to the audit table only).
- New Story 3.6n (face-api.js detection + blur + `durableThumbnailUrl` storage + `prominentPoster` widening).
- New Story 3.6o (relevance-gate optimization layered on top of 3.6n, mirroring how 3.6h layered onto 3.6e).
- New Story 3.6p (`extraction_audit_logs` table + write path; retrofits Story 3.6l's already-in-review `minScheduleCount`/`expectedScheduleNames` into persistence).
- Cross-reference note added to Story 3.6l recording the 3.6p retrofit.

### PRD (`_bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md`)
- §3.16: new bullet documenting `durableThumbnailUrl`'s consent-independent behavior, the relevance-gate skip condition, and the widened `prominentPoster` trigger; existing prominent-card bullet's "felt incentive to opt in" framing corrected to the new three-tier reality.

### Sprint Status (`_bmad-output/implementation-artifacts/sprint-status.yaml`)
- Stories 3.6m, 3.6n, 3.6o, 3.6p added as `backlog` under `epic-3`.

## 5. Implementation Handoff

**Scope classification: Moderate** — new backend/frontend/schema stories within an existing epic; no PM/Architect-level replan needed (Architecture Spine and PRD updates were completed in this same session).

- **Developer agent (`bmad-dev-story`):** implement Stories 3.6m → 3.6p in dependency order (3.6m before 3.6n; 3.6n before 3.6o; 3.6p can land alongside 3.6m, both need to exist before 3.6m's audit-write AC is satisfiable). Each needs a `bmad-create-story` pass first for full context-engine drafting.
- **Product Owner:** none of this session's decisions are text-light or awaiting external input — no follow-up needed before drafting begins.
- **Future (not this proposal, explicitly recorded as open):** whether to periodically sample `hasFaceImage = false` images through face-api.js to measure the pre-filter's real false-negative rate (AD-29 Rule 4) — a deliberate future decision, not built here.

## 6. Success Criteria

- Every extracted post's image is checked for faces (unless skipped by the relevance gate), and detected faces are blurred in the stored `durableThumbnailUrl`, regardless of the source account's `isImageStorageOptedIn` status.
- `durableImageUrl` (AD-12) behavior is completely unchanged — opted-in-only, unblurred, full resolution.
- `extraction_audit_logs` captures a row for every extraction attempt, with ground-truth comparison columns populated wherever the corresponding pipeline stage ran.
- Architecture Spine, epics.md, and PRD all reflect the same design with no undocumented conflict remaining.
