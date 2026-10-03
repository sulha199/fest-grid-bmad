---
baseline_commit: 4b195a4c
---

# Story 3.6o: Skip face-blur processing for events ending before their source image expires

## Story Details

- Epic: 3
- Story ID: 3.6o
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a platform operator,
I want to skip Story 3.6n's detection/blur/storage pipeline for events whose relevance window ends before their source image URL would have expired anyway,
so that FestDaily doesn't spend compute, storage, and bystander-photo retention on a durable copy that could never actually be needed as a fallback.

## Acceptance Criteria

1. **Given** a post's extraction has produced one or more schedules (the post-truncation `events` array `process-ai-job.ts`'s existing `maxExtractedEventsPerPost` cap already produces, before Story 3.6n's pipeline stage) and `posts.imageUrlExpiresAt` is already populated (Story 3.6e, parsed at scrape time), **when** Story 3.6n's pipeline is about to run — inside the same `if (payload.hasFaceImage === true)` block that stage's call site already guards, before its timeout-guard check — **then** this story reads `posts.imageUrlExpiresAt` with one additional, targeted row read (`process-ai-job.ts` does not load it today) and compares it against the event's latest schedule end: the max, across every schedule of every truncated event, of `schedule.eventEndDate`/`schedule.eventEndTime` (falling back to `schedule.eventStartDate` when no end date is given, and to end-of-day when no end time is given), computed by a new pure function, `computeLatestScheduleEnd` (`packages/domain`).
2. **And** if the event's latest schedule end is at or before `imageUrlExpiresAt`, Story 3.6n's detection/blur/resize/upload pipeline is skipped entirely for that post — no face-api.js invocation, no S3 upload, `durableThumbnailUrl` stays null for that post.
3. **And** if the event's latest schedule end is after `imageUrlExpiresAt`, **or** `imageUrlExpiresAt` is null, **or** `computeLatestScheduleEnd` cannot determine a latest end at all (no event has a schedule with a parseable date), Story 3.6n's pipeline runs exactly as that story implemented it, unchanged — a missing or unparseable fact never proves it is safe to skip (fail open), matching Architecture Spine AD-12 Rule 3's existing convention that a null/unparseable expiry is treated as "already expired," never as "valid indefinitely."
4. **And** this comparison is explicitly documented (code comment, at the call site) as distinct from `Event.isExpiredForCurrentUser`/`computePastEventThreshold` (a runtime, grace-period visibility check evaluated per request for an already-viewing user) — this is a one-time, build-time relevance check, computed once at extraction time, with no grace period and no re-evaluation.
5. **And**, per Architecture Spine AD-29 Rule 3 and the backfill-ownership split confirmed with the user at this story's creation (2026-10-03, `AskUserQuestion` — see Dev Notes): when this gate skips Story 3.6n's pipeline (AC2), this story calls the shared `backfillFaceDetectionAuditResult` helper Story 3.6n creates, targeting the `extraction_audit_logs` row Story 3.6p's (amended) `writeExtractionAuditLog` already wrote earlier in the same extraction attempt, with `faceDetectionSkippedReason: 'event_relevance_gate'` and `actualFaceDetectionCount: null`. This story writes **no other** outcome into that table — the `'no_face_reported'` outcome and the real detected-count outcome (when Story 3.6n's pipeline actually runs, AC3) are Story 3.6n's own, already shipped independently of whether this story exists.
6. **And** a regression test fixture covering a short-lived event (ends same day, well before a multi-day image expiry) confirms the pipeline is skipped and the audit row's `faceDetectionSkippedReason` is `'event_relevance_gate'`; a fixture covering a long-running event (ends after the image's expiry) confirms the pipeline runs unchanged and this story's gate makes no audit-log write of its own; and a fixture with `imageUrlExpiresAt: null` confirms the pipeline runs (fail-open, AC3).

**Note (carried from `epics.md`, added via `bmad-correct-course`, Architecture Spine AD-28 Rule 2):** This is a pure optimization layered on top of Story 3.6n, mirroring how Story 3.6h layered the opt-in consent gate on top of Story 3.6e's already-shipped unconditional re-hosting — Story 3.6n may ship and operate correctly without this gate; this story narrows its footprint afterward. This is also why AC5's audit-log ownership is scoped the way it is: Story 3.6n must remain able to produce a fully correct `extraction_audit_logs` row on its own, with or without this story existing yet (see Dev Notes).

**Amendment (carried from `epics.md`, 2026-10-01, `bmad-correct-course`, `sprint-change-proposal-2026-10-01-multi-event-posts.md`):** The relevance gate takes the latest schedule end across **all events** of the post, because the image belongs to the post and several events may share it.

**Clarification (carried from `epics.md`, 2026-10-03, `bmad-epic-readiness-check`, `batch-cc-023-face-blur-audit-readiness.md`):** "All events" means the events actually kept after `process-ai-job.ts`'s `maxExtractedEventsPerPost` truncation, since only those are ingested. `process-ai-job.ts` does not load `posts.imageUrlExpiresAt` today, so this story adds that one-row read.

## Tasks / Subtasks

- [x] **Task 1 (AC1, AC3, AC4): Add `computeLatestScheduleEnd` to `packages/domain`**
  - [x] New file `packages/domain/src/events/computeLatestScheduleEnd.ts`, exporting:
    ```ts
    import type { GeminiEventPayload } from './types.js';

    /**
     * Story 3.6o / Architecture Spine AD-28 Rule 2 -- computes the latest schedule end across a
     * post's (post-truncation) extracted events, for comparison against posts.imageUrlExpiresAt.
     * Pure, framework-agnostic: operates only on the already-parsed Gemini response shape, no
     * DB/Node dependency -- correctly placed in packages/domain per project-context.md's Code
     * Organization rule.
     *
     * Per schedule: end = eventEndDate ?? eventStartDate (date-only fallback, per AD-28 Rule 2's
     * literal text), combined with eventEndTime if present, else end-of-day ('23:59:59') -- a
     * schedule with no explicit end time is treated as lasting through the end of its last day,
     * the conservative (never-under-counts) choice. The combined string is interpreted as a
     * literal UTC instant (a trailing 'Z' is appended) rather than resolving each schedule's own
     * IANA timezone: this is a one-time, build-time *optimization* gate (AD-28 Rule 2
     * distinguishes it from a user-facing runtime visibility check), so the bounded imprecision
     * this introduces (at most the true timezone's UTC offset) only affects how much compute/
     * storage the gate saves -- it can never cause a privacy leak, since the original hotlinked
     * image (never blurred either way) is what is actually served until imageUrlExpiresAt passes,
     * regardless of this gate's outcome.
     *
     * A malformed/unparseable date-time string is skipped (does not throw, does not count toward
     * the max) rather than failing the whole computation -- Gemini's response is only
     * AJV-validated as `type: 'string'` with no date-format constraint
     * (extracted-event.schema.ts), so defensively tolerating garbage here matches this codebase's
     * established "best-effort, never let a logging/optimization concern break the pipeline"
     * convention (e.g. rehostPostImageSeam's outer try/catch, Story 3.6l's completeness
     * warnings).
     *
     * Returns null when no event has any schedule with a parseable end (including an empty
     * `events` array) -- callers must treat null as "unknown," never as "ends immediately": 3.6o's
     * own comparison fails open on null (an unknown end always means the pipeline runs, never
     * skips -- AC3).
     */
    export function computeLatestScheduleEnd(events: GeminiEventPayload[]): Date | null {
      let latest: Date | null = null;

      for (const event of events) {
        for (const schedule of event.schedules) {
          const endDate = schedule.eventEndDate ?? schedule.eventStartDate;
          const endTime = schedule.eventEndTime ?? '23:59:59';
          const candidate = new Date(`${endDate}T${endTime}Z`);

          if (Number.isNaN(candidate.getTime())) {
            continue;
          }

          if (latest === null || candidate > latest) {
            latest = candidate;
          }
        }
      }

      return latest;
    }
    ```
  - [x] Add `export * from './computeLatestScheduleEnd.js';` to `packages/domain/src/events/index.ts` (alongside the existing `computePastEventThreshold.js` export line), so it is barrel-exported from `@festgrid/domain/events` the same way.
  - [x] **100% unit test coverage required** (`packages/domain`'s own testing rule, `project-context.md`), new `computeLatestScheduleEnd.test.ts`, `node:test` (this package's established runtime, matching `computePastEventThreshold.test.ts`'s own convention — confirm by reading that file's test harness before writing a different one). Required cases, each a distinct branch:
    - Empty `events` array → `null`.
    - A single event whose only schedule has no `eventEndDate`/`eventEndTime` (only `eventStartDate`) → returns that start date at `23:59:59Z`.
    - A schedule with `eventEndDate` but no `eventEndTime` → that end date at `23:59:59Z`.
    - A schedule with both `eventEndDate` and `eventEndTime` → the exact combined instant.
    - Multiple schedules on one event → the later one wins.
    - Multiple events, each with schedules → the true max across all of them wins (proves the "all events of the post" semantics, AD-28/the 2026-10-01 Amendment).
    - An event with an empty `schedules` array → contributes nothing (does not throw, does not become `0`/epoch).
    - A malformed date/time string (e.g. `eventEndDate: 'not-a-date'`) → skipped, does not throw, does not count toward the max (assert the function still returns the correct max from the *other*, valid schedules when one is mixed in, not just that it doesn't crash on an all-malformed input).
  - [x] Confirm `pnpm --filter domain test` reports 100% coverage for this new file specifically (not just "the suite is green") — this package's Testing Rule is a coverage requirement, not merely "has tests."

- [x] **Task 2 (AC1, AC2, AC3, AC4): Wire the relevance gate into Story 3.6n's call site in `process-ai-job.ts`**
  - [x] **Prerequisite check before starting this task:** confirm Story 3.6n has actually shipped with its own AC9 backfill-ownership scope (the `backfillFaceDetectionAuditResult`/`backfillFaceDetectionAuditResultSeam` helper, the `auditLogId` local variable threaded from Story 3.6p's write call site, and the `hasFaceImage === true` / `else` structure) — read `process-ai-job.ts` and `backfill-face-detection-audit-result.ts` directly rather than assuming the story-file text below is what actually shipped. If 3.6n shipped differently than its own story file describes, adapt this task to the real code, not to this description.
  - [x] Insert one additional nested condition into Story 3.6n's existing `if (imageBytes && imageContentType && payload.hasFaceImage === true) { ... }` block, immediately after that `if` and **before** 3.6n's timeout-guard check — do not reorder, duplicate, or remove any of 3.6n's existing logic inside the new `else` branch below:
    ```ts
    // 7.5b (Story 3.6n, AD-28), continued -- Story 3.6o's relevance gate. Distinct from
    // Event.isExpiredForCurrentUser/computePastEventThreshold (a runtime, grace-period
    // visibility check re-evaluated per request for an already-viewing user, packages/domain) --
    // this is a one-time, build-time relevance check computed once here, with no grace period.
    const [postExpiryRow] = await db
      .select({ imageUrlExpiresAt: posts.imageUrlExpiresAt })
      .from(posts)
      .where(eq(posts.id, message.postId))
      .limit(1);
    const imageUrlExpiresAt = postExpiryRow?.imageUrlExpiresAt ?? null;
    const latestScheduleEnd = computeLatestScheduleEnd(events);
    // AD-12 Rule 3's "null is already-expired" convention: a null imageUrlExpiresAt, or an
    // unparseable/absent schedule end, can never prove the event is safe to skip -- fail open.
    const isStillRelevant =
      imageUrlExpiresAt === null || latestScheduleEnd === null || latestScheduleEnd > imageUrlExpiresAt;

    if (!isStillRelevant) {
      await backfillFaceDetectionAuditResultSeam(auditLogId, {
        actualFaceDetectionCount: null,
        faceDetectionSkippedReason: 'event_relevance_gate',
      });
    } else {
      // --- Story 3.6n's existing timeout-guard + detection/upload logic, UNCHANGED below ---
      const remainingMs = getRemainingTimeInMillis ? getRemainingTimeInMillis() : Infinity;
      if (remainingMs < env.faceBlurMinRemainingTimeMs) {
        console.warn(
          `[processAiJob] Skipping face-blur thumbnail for post ${message.postId}: ` +
            `only ${remainingMs}ms remaining (floor ${env.faceBlurMinRemainingTimeMs}ms).`
        );
      } else {
        try {
          const { faceCount } = await detectAndBlurFacesAndUploadSeam(message.postId, imageBytes, imageContentType, env);
          await backfillFaceDetectionAuditResultSeam(auditLogId, {
            actualFaceDetectionCount: faceCount,
            faceDetectionSkippedReason: null,
          });
        } catch (blurError) {
          console.error(`Face-blur thumbnail stage failed for post ${message.postId}:`, blurError);
        }
      }
    }
    ```
  - [x] Import `computeLatestScheduleEnd` from `@festgrid/domain` at the top of `process-ai-job.ts`, alongside the existing `@festgrid/domain` import.
  - [x] Do **not** move the `postExpiryRow` read earlier/unconditionally (e.g. alongside the top-of-function `accountRow` select) — it is deliberately placed inside the already-existing `hasFaceImage === true` branch so a post where detection was never going to run anyway (`hasFaceImage !== true`, handled entirely by Story 3.6n's own `else`) never pays for this extra read. This keeps the footprint minimal, matching this story's own "pure optimization" framing.
  - [x] `events` is the already-truncated `GeminiEventPayload[]` variable `process-ai-job.ts` builds at its existing step 5.6 (`maxExtractedEventsPerPost` cap) — confirmed in scope, unmutated, at this call site by direct read of the current file; do **not** recompute truncation here or use `payload.events` (the raw, pre-truncation array) — see Dev Notes.

- [ ] **Task 3 (AC6): Regression tests**
  - [ ] Extend `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` (or the dedicated audit-log/face-blur integration file Story 3.6n/3.6p establish — dev agent's call, matching whichever file those two stories' own Task 6/Task 4 actually created; do not grow an unrelated large file further) with:
    - **Short-lived event, image not yet expired:** a schedule ending same-day, well before a multi-day `imageUrlExpiresAt`. Assert: no S3 `PutObjectCommand`/no face-api invocation (mock/spy on the seam Story 3.6n exports); `posts.durableThumbnailUrl` stays null; the post's `extraction_audit_logs` row (Story 3.6p) has `faceDetectionSkippedReason: 'event_relevance_gate'`, `actualFaceDetectionCount: null`.
    - **Long-running event, image already expired by the time it ends:** a schedule ending after `imageUrlExpiresAt`. Assert: Story 3.6n's pipeline runs (its own seam is invoked); this story's gate makes no audit-log write of its own (3.6n's own backfill call — real count or `'no_face_reported'` — is what lands, per 3.6n's own tests, not asserted again here).
    - **`imageUrlExpiresAt: null`:** assert the pipeline runs (fail-open, AC3) — not skipped.
    - **No event has a parseable schedule date** (defensive/edge case: `computeLatestScheduleEnd` returns `null`): assert the pipeline runs (fail-open, AC3), proving the "unknown never means safe to skip" contract end-to-end, not just at the pure-function level (Task 1 already covers the function itself; this proves the wiring honors it).
    - **Multi-event post (Story 3.6t fixture shape), one event short-lived and one long-running:** assert the gate uses the **later** of the two ends (the 2026-10-01 Amendment's "all events" semantics) — the pipeline runs because at least one event's schedule extends past the expiry, even though the other alone would have triggered a skip.
  - [ ] Confirm no regression in Story 3.6n's own existing test cases (its opt-in-independence, multi-event-singularity, timeout-guard, and failure-non-propagation cases from its own Task 6) — this story's inserted condition must not change any of their outcomes when `isStillRelevant` is `true` (the common case those tests already exercise).

- [ ] **Task 4: Full verification pass**
  - [ ] `pnpm --filter domain test` — Task 1's new 100%-covered unit tests green, full existing `packages/domain` suite unaffected.
  - [ ] `pnpm --filter backend test` (foreground, `TZ=UTC`) — Task 3's new integration cases green, full existing `apps/backend` suite (including Story 3.6n's and 3.6p's own tests) green.
  - [ ] `pnpm --filter backend lint` / `pnpm --filter backend build` clean for `apps/backend`, `packages/domain`.
  - [ ] Manually confirm (read the diff) that no `.graphql` SDL file, no `resolvers.ts`, no `apps/web`, and no `packages/ui` file is touched anywhere in this story's diff — Gate 2 confirmed zero frontend scope (see Dev Notes).

## Dev Notes

- **This is a small, backend-only optimization layered on top of Story 3.6n's already-defined call site.** Touches `packages/domain/src/events/` (one new pure function + its barrel export) and `apps/backend/src/lib/ai-processor/process-ai-job.ts` (one nested `if`/`else` inserted into Story 3.6n's existing block, plus one new DB read). No migration, no new table, no new env var, no new GraphQL/UI surface.

- **AD-29 backfill-ownership decision — resolved with the user at this story's creation (2026-10-03, `AskUserQuestion`), and the reason this story's scope is narrower than Architecture Spine AD-29/epics.md's original phrasing ("back-filled... by Story 3.6n/3.6o") might suggest:** Before this story was created, neither Story 3.6n's own "Out of Scope" nor Story 3.6p's own "Out of Scope" assigned a real owner for `actualFaceDetectionCount`/`faceDetectionSkippedReason` — 3.6n's text pointed at 3.6p ("this story produces the underlying detection result but does not touch that table"), and 3.6p's text pointed right back at "3.6n/3.6o's scope entirely." Nobody actually wrote it. Three options were weighed:
  1. Push the **entire** backfill (all three outcomes: `'no_face_reported'`, `'event_relevance_gate'`, and the real-count-on-success case) into this story, since it is the one that wraps 3.6n's call site with its own condition anyway. Rejected: this would make Story 3.6n — which `epics.md`'s own Note says "may ship and operate correctly without this gate" — silently *incorrect* (a permanently null/null audit row) whenever it ships before this story, which the project's own build order (3.6p → 0.46 → 3.6n → 3.6o) explicitly allows.
  2. Leave the gap entirely unresolved/undocumented for a later pass. Rejected: AD-29's whole purpose (evaluating extraction accuracy over time) would stay two-thirds unmet with no tracked owner.
  3. **Each story writes only the outcome it itself produces — chosen.** Story 3.6n (amended the same session this story was created) now owns `'no_face_reported'` and the real detected count, shipping correctly whether or not this story exists yet. This story owns only `'event_relevance_gate'`, the one outcome its own gate produces, by reusing a helper (`backfillFaceDetectionAuditResult`) Story 3.6n creates rather than duplicating the update logic (Gate 3 reuse discipline).
  - **Two small, non-breaking amendments were made to the already-authored-but-not-yet-built Story 3.6n and Story 3.6p story files (and their `epics.md` sections) as part of resolving this, in the same session as this story's creation — not part of this story's own diff, but a hard prerequisite for this story's Task 2 to compile against:**
    - **Story 3.6p:** `writeExtractionAuditLog` (Task 2 of that story) now returns `Promise<{ id: string }>` (via `.returning({ id: extractionAuditLogs.id })`) instead of `Promise<void>`, and its success-path call site in `process-ai-job.ts` captures that `id` into a `let auditLogId: string | null = null;` declared above the call, in scope through the rest of the function body (including this story's and Story 3.6n's call sites further down).
    - **Story 3.6n:** gained a new AC9, a new Task (the `backfillFaceDetectionAuditResult`/`backfillFaceDetectionAuditResultSeam` helper, in `apps/backend/src/lib/ai-processor/backfill-face-detection-audit-result.ts`), and a `detectAndBlurFaces` signature change (`Promise<Buffer>` → `Promise<{ buffer: Buffer; faceCount: number }>`) so the real detected count is available to backfill. Its own `Depends on` gained Story 3.6p.
  - **This story's Task 2 depends on both of those amendments actually being present in the real, as-shipped `process-ai-job.ts` by the time this story is implemented** — Task 2's own "Prerequisite check" bullet exists specifically to catch the case where 3.6n shipped before those amendments were fully carried through (e.g. if the dev agent implementing 3.6n worked from a stale cached copy of its story file). If the real code does not match, fix the mismatch as part of this story's own diff (adding the missing helper/variable) rather than silently working around it — this story has no reason to exist if 3.6n's own backfill is broken.
  - **Documented residual gap, not addressed by this story either** (carried from Story 3.6n's own amendment): the timeout-guard-skip path and an unexpected top-level failure inside `detectAndBlurFaces` still leave `extraction_audit_logs`'s two columns `null`/`null` with no reason recorded — `faceDetectionSkippedReason`'s two-value enum (3.6p) has no value for either case. Not this story's gate (both paths are inside this story's own `else` branch, i.e. only reached when this story's gate already decided the event *is* still relevant), so not expanded here either. Revisit only if either path proves non-rare in practice.

- **Files read in full before finalizing this design:** `apps/backend/src/lib/ai-processor/process-ai-job.ts` (current, post-3.6t — confirmed the exact step numbering, the truncated `events` variable's scope and lifetime, and that `imageUrlExpiresAt` is not read anywhere in this file today); `packages/database/schema.ts` lines ~310-320 (`posts.durableImageUrl`/`imageUrlExpiresAt` column shape — confirmed `imageUrlExpiresAt` is a nullable `timestamp('image_url_expires_at', { withTimezone: true })`, already populated at scrape time by `persist-scraped-post.ts`, no migration needed here); `packages/domain/src/events/resolveServedImageUrl.ts` (confirmed the established `imageUrlExpiresAt != null && now < imageUrlExpiresAt` pattern for treating a null expiry as not-valid, the precedent this story's `isStillRelevant` fail-open logic mirrors); `packages/domain/src/events/computePastEventThreshold.ts` and `packages/domain/src/events/validate-correction-consistency.ts` (confirmed this codebase's existing precedent for comparing `eventStartDate`/`eventEndDate`/`eventEndTime` strings via `new Date(...)`, and that no shared date-combining helper already exists for this story to reuse — `computeLatestScheduleEnd` is new, not a duplicate); `packages/domain/src/events/types.ts` (confirmed `GeminiSchedulePayload`'s exact field set — `eventStartDate: string` required, `eventEndDate`/`eventStartTime`/`eventEndTime` all optional strings — and `GeminiEventPayload.schedules: GeminiSchedulePayload[]`); `apps/backend/src/lib/ai-processor/build-gemini-request.ts` (confirmed the prompt instructs Gemini to produce `eventStartDate`/`eventEndDate` as `YYYY-MM-DD` and `eventStartTime`/`eventEndTime` as `HH:MM:SS`, informing `computeLatestScheduleEnd`'s date-combining format); `apps/backend/src/validation/extracted-event.schema.ts` (confirmed the AJV schema places no format constraint on these fields beyond `type: 'string'`, i.e. a malformed value is a real possibility this story's function must tolerate, not an impossible input); Architecture Spine AD-28 (full text, Rule 2 is this story's primary binding rule), AD-29 (full text, Rules 2/3, the backfill-ownership split), AD-12 Rule 3 (the "null is already-expired" convention this story's fail-open comparison mirrors); `_bmad-output/implementation-artifacts/3-6n-...md` and `_bmad-output/implementation-artifacts/3-6p-...md` (both, in full, including this same session's own amendments to each — the call site this story modifies, and the `auditLogId`/helper contract this story's Task 2 depends on); `_bmad-output/planning-artifacts/epic-readiness/batch-cc-023-face-blur-audit-readiness.md` (full file — Gate 1/3 verdicts for this story, cited not re-run).

### Architecture & UX Gate Findings

- **Gate 1 and Gate 3 — cited from the batch readiness sweep, not re-run.** Per `epic-readiness/batch-cc-023-face-blur-audit-readiness.md` (`swept: true`, dated 2026-10-03, `stories_covered: [3.6m, 3.6n, 3.6o, 3.6p]`, `gates: [1, 3]`): the per-story verdict table records **"3.6o (relevance gate) | READY (clarification applied) | Gate uses the events kept after truncation; adds a one-row read of `imageUrlExpiresAt`. Needs 3.6n."** Gate 1's own prose confirms "3.6o is a pure comparison inside the same Lambda" — no missing backend/infra layer, no external service call from the frontend, no new API surface. Gate 3's reuse/ownership checks found no unowned shared dependency implicating this story specifically (the one Gate 3 finding in this batch, `resolveServedImageUrl`'s served-URL precedence, is Story 3.6n2's concern, not this story's).
  - **Lightweight guard (`story-split-gate.md`'s "Epic-Level Sweep Mode") — does this story's actual, now-finalized scope contain anything the sweep plausibly didn't anticipate?** The sweep's own text already named this story's exact mechanism (a comparison, a one-row read) and its dependency on 3.6n. The one thing genuinely found during this story's own creation, beyond the sweep's text, is the AD-29 backfill-ownership gap (above) — but that is a *correctness/ownership* finding about two already-authored sibling stories' own text contradicting each other, not a new external service, new data entity, or new infra dependency. It does not rise to a fresh Gate 1/3 run; it was resolved directly with the user via `AskUserQuestion` instead, and recorded as amendments to those two stories' own files.
- **Gate 2 — run fresh (per-story; Gate 2 always runs per-story regardless of the sweep).** One-shot Freya-persona analytical pass against this story's exact, finalized scope — a pure TypeScript comparison function in `packages/domain`, a one-row DB read and conditional skip inside an existing Lambda-internal function, and one audit-log backfill call into a table AD-29 Rule 5 bars from any client-facing resolver. **Verdict: No gap found.** No component, hook, route, page, PostHog event, or i18n string exists anywhere in this story's scope; nothing here is reused by or visible to `apps/web`/`packages/ui`. This matches the identical zero-frontend-surface reasoning already reached independently by 3.6m, 3.6p, 3.6r, 3.6s, and 3.6t for their own backend-only scopes, and by Story 3.6n for its own post-split, pipeline-only scope.
- **No new prerequisite stories or `sprint-status.yaml`/`epics.md` entries were added by this story beyond the amendments to Story 3.6n's and 3.6p's own sections** (the AD-29 backfill-ownership split, recorded in both of their `epics.md` sections and story files, same session as this story's creation).

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. This story reads two already-existing, already-correctly-typed fields (`posts.imageUrlExpiresAt`, a nullable `timestamp` column populated since Story 3.6e; `GeminiEventPayload.schedules[].eventEndDate`/`eventEndTime`, already-optional `string` fields on an existing type) and introduces one new, additive, pure TypeScript function. No existing column's type changes, no existing TypeScript interface's shape changes.
- **Impacted fields/contracts:** `packages/domain/src/events/index.ts` gains one new barrel-exported function, `computeLatestScheduleEnd`. `apps/backend/src/lib/ai-processor/process-ai-job.ts` gains one new local `db.select(...)` read (no new table, no new column) and consumes Story 3.6n's amended `backfillFaceDetectionAuditResultSeam`/`auditLogId` (not this story's own contract to define — see Dev Notes).
- **Required DB migration changes:** None. No new column, no new table, no new enum — this story only reads `posts.imageUrlExpiresAt` (already exists, Story 3.6e) and writes to `extraction_audit_logs` (already exists as of Story 3.6p, via the helper Story 3.6n creates).
- **Required TypeScript type changes:** None beyond the new, additive `computeLatestScheduleEnd` export. This story adds no field to `GeminiEventPayload`/`GeminiSchedulePayload`/`ExtractedEventMessage` or any DB-facing type.
- **Backward compatibility and rollout notes:** Purely additive and narrowly scoped — a new `if`/`else` nested inside an existing conditional that did not previously have any branching. Every existing behavior inside the new `else` branch (Story 3.6n's timeout guard, detection, upload, and its own two backfill outcomes) is preserved byte-for-byte; this story only adds a new path reached exclusively when `isStillRelevant` is `false`, a case that cannot occur before this story ships (there is no code path to reach it). No existing test of Story 3.6n's own behavior should need to change.
- **Verification checks:** Task 1's 100%-covered unit tests for `computeLatestScheduleEnd`; Task 3's five integration cases (short-lived/skip, long-running/run, null-expiry/run, unparseable/run, multi-event-latest-wins); Task 4's full lint/build/test pass confirming no regression in Story 3.6n's own existing test cases.

### Project Structure Notes

- New files: `packages/domain/src/events/computeLatestScheduleEnd.ts` (+ its `*.test.ts`, 100% coverage required).
- Modified files: `packages/domain/src/events/index.ts` (one new barrel-export line); `apps/backend/src/lib/ai-processor/process-ai-job.ts` (one new nested `if`/`else` inside Story 3.6n's existing block, one new import); `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` or the dedicated face-blur/audit-log integration file Story 3.6n/3.6p actually created (Task 3's new cases).
- **Package boundary check:** `computeLatestScheduleEnd` is a plain, pure function with no DB/ORM/Node-runtime dependency (only reads a plain TypeScript interface, `GeminiEventPayload`) — correctly placed in `packages/domain`, alongside `computePastEventThreshold.ts`'s identical precedent for date-comparison logic. The one-row DB read and the conditional wiring are DB/Lambda-coupled — correctly stay in `apps/backend`, never `packages/domain`. No `packages/ui` component, no `SETUP_WALKTHROUGH.md` update (no new cloud/external service — reuses the already-provisioned Postgres instance and Story 3.6n's own S3/CloudFront mechanism, untouched), no PostHog event, no new i18n locale key — confirmed by the Gate 2 finding above.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md`#Story 3.6o] — authoritative ACs this story is drafted from, including the 2026-10-01 Amendment ("all events of the post"), the 2026-10-03 Clarification (truncated-events semantics, the one-row read), and this same-day Amendment (the AD-29 backfill-ownership split, added by this story's own creation).
- [Source: `_bmad-output/planning-artifacts/epic-readiness/batch-cc-023-face-blur-audit-readiness.md`] — `swept: true`, Gate 1/3 verdicts cited directly: "3.6o (relevance gate) | READY (clarification applied)."
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`#AD-28 Rule 2] — this story's primary binding rule (the relevance-gate comparison itself).
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`#AD-29 Rules 2/3] — the backfill-ownership rules this story's AC5 and the Dev Notes decision implement.
- [Source: `_bmad-output/planning-artifacts/festgrid-architecture-spine.md`#AD-12 Rule 3] — the "null is already-expired" convention this story's fail-open comparison (AC3) mirrors.
- [Source: `_bmad-output/implementation-artifacts/3-6n-...md`, full file including this session's own amendments] — the call site this story modifies, the `backfillFaceDetectionAuditResult`/`backfillFaceDetectionAuditResultSeam` helper this story reuses, and the `auditLogId` variable's scope/origin.
- [Source: `_bmad-output/implementation-artifacts/3-6p-...md`, full file including this session's own amendments] — confirmed `writeExtractionAuditLog`'s amended id-returning signature and exactly where `auditLogId` is captured in `process-ai-job.ts`.
- [Source: `apps/backend/src/lib/ai-processor/process-ai-job.ts`] — file this story edits; current (post-3.6t) step numbering, the truncated `events` variable's scope, confirmed `imageUrlExpiresAt` is not read anywhere in this file today — confirmed by direct read, not by any story text.
- [Source: `packages/domain/src/events/resolveServedImageUrl.ts`, `computePastEventThreshold.ts`, `validate-correction-consistency.ts`] — the established date-comparison and null-handling precedents `computeLatestScheduleEnd` follows.
- [Source: `packages/domain/src/events/types.ts`, `apps/backend/src/lib/ai-processor/build-gemini-request.ts`, `apps/backend/src/validation/extracted-event.schema.ts`] — confirmed `GeminiSchedulePayload`'s field set, the `YYYY-MM-DD`/`HH:MM:SS` format Gemini is prompted to produce, and the absence of any AJV format constraint (informing the malformed-input-tolerance requirement).
- [Source: `packages/database/schema.ts`, lines ~310-320] — confirmed `posts.imageUrlExpiresAt`'s existing nullable `timestamp` shape; no migration needed.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Technology Stack (Backend: Serverless on AWS, Lambda); Code Organization (`packages/domain` restriction — this story's pure, dependency-free comparison function correctly stays there, see Project Structure Notes); Testing Rules (`packages/domain`'s 100%-unit-test-coverage requirement, applied to the new `computeLatestScheduleEnd`).
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — canonical section order and status vocabulary followed.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-28 Rule 2 (this story's primary binding rule), AD-29 Rules 2/3 (the backfill-ownership split this story's AC5 implements), AD-12 Rule 3 (the null-expiry convention this story's fail-open logic mirrors).
- [x] `_bmad-output/planning-artifacts/story-split-gate.md` — Gate 1/3 cited from the batch sweep (`batch-cc-023-face-blur-audit-readiness.md`, `swept: true`); Gate 2 run fresh this session (no gap, see Architecture & UX Gate Findings).
- [x] `docs/infrastructure/index.md` / `docs/infrastructure/2-backend.md` — Lambda/SQS pipeline architecture; this story adds no new queue, Lambda, or infra resource — only a conditional branch and a read inside the already-provisioned `AIProcessorLambda`.

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - `packages/domain/src/events/computeLatestScheduleEnd.ts` (new) + its `*.test.ts` (new, 100% coverage)
  - `packages/domain/src/events/index.ts` (modify — one new barrel-export line)
  - `apps/backend/src/lib/ai-processor/process-ai-job.ts` (modify — one new nested `if`/`else` inside Story 3.6n's existing call site, one new import, one new `db.select` read)
  - `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` or Story 3.6n/3.6p's own dedicated integration file (modify — Task 3's five new cases)
  - **Explicitly unchanged:** `events.graphql`, `resolvers.ts`, `apps/web/**`, `packages/ui/**`, any migration file, `packages/database/schema.ts`.
- **Rule Mapping:**
  - AC1-AC3 (the comparison and its fail-open semantics) → Architecture Spine AD-28 Rule 2 and AD-12 Rule 3, this story's primary binding rules.
  - AC4 (distinct-from-runtime-check documentation) → AD-28 Rule 2's own explicit framing, carried into a code comment.
  - AC5 (audit-log ownership) → Architecture Spine AD-29 Rules 2/3, resolved via `AskUserQuestion` at this story's creation (2026-10-03): each story backfills only the outcome it produces; this story owns `'event_relevance_gate'` only.
  - `story-split-gate.md` Gate 1/2/3 discipline (Gate 1/3 cited from the batch sweep; Gate 2 run fresh, confirmed no gap) → Dev Notes "Architecture & UX Gate Findings."
  - Data-type-compatibility persistent fact (mismatch/no-mismatch section always included) → Dev Notes "Data Type Compatibility & Migration Requirements."
  - `AskUserQuestion`-before-drafting persistent fact (one real, non-mechanical tradeoff surfaced at this create-story session: the AD-29 backfill-ownership split across this story and Story 3.6n) → Dev Notes, recorded in full with the options considered and why.
  - `packages/domain`'s 100%-unit-test-coverage rule (`project-context.md`) → Task 1's explicit per-branch test list and its own verification step.
- **Verification Plan:**
  - `pnpm --filter domain test` — `computeLatestScheduleEnd`'s new tests green, 100% coverage confirmed for the new file.
  - `pnpm --filter backend test` (`TZ=UTC`, foreground) — Task 3's five new integration cases, plus Story 3.6n's own existing cases (unaffected), all green.
  - `pnpm --filter backend lint` / `tsc` build clean for `apps/backend`, `packages/domain`.
  - Manual diff review confirming no `.graphql`/`resolvers.ts`/`apps/web`/`packages/ui`/migration file changed anywhere in this story's diff.

## Pre-Coding Approval Gate

- [ ] Scope confirmation — a pure comparison function (`packages/domain`) plus one nested `if`/`else` and one DB read inserted into Story 3.6n's existing call site in `process-ai-job.ts`; this story owns only the `'event_relevance_gate'` audit-log outcome, not the `'no_face_reported'`/real-count outcomes (Story 3.6n's own, shipped independently).
- [ ] Architecture and boundary confirmation — `computeLatestScheduleEnd` correctly stays pure/DB-free in `packages/domain`; the DB read and conditional wiring correctly stay in `apps/backend`; no `.graphql`/`resolvers.ts`/`apps/web`/`packages/ui` change anywhere.
- [ ] Testing plan confirmation — `packages/domain`'s 100%-coverage rule satisfied for the new function (8 explicit branch cases, Task 1); five new backend integration cases (Task 3) plus confirmed no regression in Story 3.6n's own existing cases.
- [ ] Explicit human approval state (Default: pending approval).
- [ ] Gate 1/2/3 prerequisites confirmed done or gap accepted — Gate 1/3 cited from the swept `batch-cc-023-face-blur-audit-readiness.md` report ("3.6o | READY"); Gate 2 run fresh this session (no gap, Freya-persona one-shot pass). **Hard prerequisite Story 3.6n is `ready-for-dev`, not yet `done`** (and 3.6n itself depends on Story 3.6p and the new Epic 0 Story 0.46, neither `done` either) — this story's Task 2 cannot be finalized until 3.6n's real, as-shipped call site (including its AC9 backfill-ownership amendment) exists; the dev agent must read 3.6n's actual File List/code before finalizing Task 2's specifics, not just at this story-creation time (mirroring Story 3.6n's own Pre-Coding Gate language about its own prerequisite, Story 0.46).
- [ ] **AD-29 backfill-ownership split** (Dev Notes) explicitly acknowledged: this story's Task 2 depends on Story 3.6p's `writeExtractionAuditLog` id-return amendment and Story 3.6n's `backfillFaceDetectionAuditResult` helper/AC9 amendment both actually being present in the real, as-shipped code — not assumed from story-file text alone.

## Testing Requirements

- [ ] Unit tests (`packages/domain`, `node:test`): `computeLatestScheduleEnd.test.ts` — 8 explicit branch cases (Task 1), 100% coverage required for the new file.
- [ ] Integration tests (`apps/backend`, real DB, extending `process-ai-job.test.ts` or Story 3.6n/3.6p's own dedicated file): short-lived/skip, long-running/run, null-expiry/run, unparseable-dates/run, multi-event-latest-wins (Task 3, five cases).
- [ ] Regression: Story 3.6n's own existing test cases (opt-in-independence, multi-event-singularity, timeout-guard, failure-non-propagation) all still pass unchanged.
- [ ] No E2E/integration test beyond the above applies — this story has no API/GraphQL/UI surface.

## Deliverables Checklist

- [ ] `computeLatestScheduleEnd` exists in `packages/domain`, barrel-exported, 100% unit-test coverage.
- [ ] The relevance gate is wired into Story 3.6n's existing call site in `process-ai-job.ts` as one nested `if`/`else`, with the `else` branch running 3.6n's existing logic byte-for-byte unchanged.
- [ ] A skipped event (AC2) produces no face-api.js invocation, no S3 upload, `durableThumbnailUrl` stays null, and the post's `extraction_audit_logs` row gets `faceDetectionSkippedReason: 'event_relevance_gate'`.
- [ ] A non-skipped event (AC3, including null/unparseable fail-open cases) runs Story 3.6n's pipeline exactly as before, with no additional audit-log write from this story.
- [ ] Five new integration test cases (Task 3) and eight new unit test cases (Task 1) passing; full existing `apps/backend`/`packages/domain` suites green, including Story 3.6n's and 3.6p's own tests.

## Out of Scope

- The `'no_face_reported'` and real-detected-count `extraction_audit_logs` outcomes — **Story 3.6n**'s own scope (its AC9, added the same session as this story's creation), shipped independently of whether this story exists.
- Inserting the initial `extraction_audit_logs` row, or `writeExtractionAuditLog`'s id-returning signature itself — **Story 3.6p**'s own write path; this story only calls the already-shared backfill helper Story 3.6n creates.
- Any change to Story 3.6n's own detection/blur/resize/upload mechanism, timeout guard, or `posts.durableThumbnailUrl` write — this story only adds one condition that decides whether that existing logic runs at all; the logic itself is untouched.
- `Event.isExpiredForCurrentUser`/`computePastEventThreshold` — an unrelated, runtime/grace-period visibility check; this story's comparison is a distinct, one-time, build-time check (AC4) and must never be merged with or substituted for that one.
- Any change to `resolveServedImageUrl`'s served-URL precedence or `EventListView.tsx`'s `prominentPoster` trigger — **Story 3.6n2**'s scope entirely; this story runs long before any read-path concern and touches none of those files.
- The timeout-guard-skip and unexpected-detection-failure residual gap in the AD-29 backfill (documented in Dev Notes, carried from Story 3.6n's own amendment) — a known, accepted limitation, not built here or in 3.6n.
- Any change to `posts.imageUrlExpiresAt`'s existing parsing/population logic (Story 3.6e) — this story only reads the column, never writes it.

## Definition of Done

- [ ] AC1-AC6 satisfied.
- [ ] Task 1's 8 unit test cases (100% coverage) and Task 3's 5 integration test cases passing; full existing `apps/backend`/`packages/domain` suites green, including Story 3.6n's and 3.6p's own tests unaffected.
- [ ] Lint and type checks passing for `apps/backend`, `packages/domain`.
- [ ] No regression in Story 3.6n's own behavior when `isStillRelevant` is `true` (the pre-existing common case).
- [ ] Dev Notes record which of Story 3.6n's/3.6p's amendments (the `auditLogId` capture, the `backfillFaceDetectionAuditResult` helper, the id-returning `writeExtractionAuditLog`) were already present in the real as-shipped code at implementation time versus needed finishing as part of this story's own diff.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
