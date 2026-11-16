---
title: 'Gemini client reports truncation and usage; an unparseable response is logged with its cause'
type: 'bugfix'
created: '2026-11-09'
status: 'done'
baseline_commit: 'ef7a4cc67b361e2f0c790f37767c181bcd5ca349'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `callGeminiGenerateContent` returns only `text`, so a response cut off at the token limit (or blocked) looks the same as any other. `processAiJob` then logs `Failed to parse Gemini response` with the raw text and returns without a trace of why: prod logs show it twice in a month (one empty response, one cut-off JSON), and a live replay on 2026-11-09 returned an unterminated string. Slice 1 of cursor extraction (AD-49 Rules 1-2, `_bmad-output/specs/spec-cursor-extraction/build-slices.md`) needs these signals before anything can split a window.

**Approach:** Return `finishReason` and token usage from the client (additive), compute the at-risk signals in one small pure helper, and log them: one greppable line per extraction request, and a structured warning when the response cannot be parsed. Behavior stays the same: the post is not marked extracted, so it shows EXTRACTING and, once the claim TTL passes, PENDING with `extraction_started_at` still set, which is the existing marker of an attempt that did not finish. It becomes claimable again, but only when something enqueues it (a moderator selecting it, or the auto-enqueue); nothing retries it by itself today.

## Boundaries & Constraints

**Always:** New result fields are optional, so every existing caller and test mock that returns only `{ text }` keeps working; at-risk means `finishReason` is `MAX_TOKENS`, or output tokens are at least 90% of `maxOutputTokens`; no raw response text or caption in logs beyond its length and a short head (the raw text can be 8,000 tokens).

**Ask First:** Writing an `extraction_audit_logs` row for a failed attempt (the table requires `isEvent`, `actualEventCount` and `eventsCompleteness`, and its readers assume one successful row per attempt); adding a new column or status for "failed" (the existing `extraction_started_at`, `queued_for_extraction_at` and `is_extracted` already mark an unfinished attempt, `post-extraction-status.ts`); throwing on parse failure (SQS would re-run Gemini 3 times then dead-letter); an automatic retry of a failed single-request post (the resume pass of a later slice covers stepped posts only).

**Never:** A Gemini response-schema change, a new env var, a DB migration, a retry or split loop (later slice), cursor or stepped extraction, face-blur or time-budget changes, prod writes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Normal | `finishReason` STOP, usage present | Result carries both; one info line with tokens, no at-risk flag | N/A |
| Truncated | `finishReason` MAX_TOKENS | Line flags `atRisk=max_tokens`; parse follows as today | N/A |
| Near limit | output tokens 7,400 of 8,192 | Line flags `atRisk=output_near_limit` | N/A |
| No metadata | SDK returns no `usageMetadata` or no candidates | Fields undefined, no flag, no throw | N/A |
| Unparseable | `JSON.parse` throws | One warning with `finishReason`, tokens, length, short head, error message; function returns; post not marked extracted | No throw |
| Empty text | `text` is `''` | Same warning (finishReason shows SAFETY or similar) | No throw |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/ai-gateway/gemini-client.ts` -- `GeminiCallResult`, `generateContentSeam` return type, the `return { text }` at the end of `callGeminiGenerateContent`; the adapters (`adapter.ts`, `system-key-adapter.ts`) return the result unchanged.
- `apps/backend/src/lib/ai-gateway/gemini-client.test.ts` -- seam-based tests for the client.
- `apps/backend/src/lib/ai-processor/process-ai-job.ts` -- `callGeminiSeam` at ~L144, the parse failure at ~L151-158; `env.geminiMaxOutputTokens`.
- `apps/backend/src/lib/ai-processor/process-ai-job.test.ts` -- `callGeminiSeam` mocks (they return `{ text }`).

## Tasks & Acceptance

**Execution:**
- [x] `apps/backend/src/lib/ai-gateway/gemini-output-signals.ts` (new) -- pure `classifyGeminiOutput({ finishReason, outputTokens, maxOutputTokens })` returning the at-risk reasons, with its own unit test -- one definition of "at risk" for this slice and the later split loop.
- [x] `gemini-client.ts` -- add optional `finishReason` and `usage { promptTokens, outputTokens }` to `GeminiCallResult`, widen the seam type, read `candidates[0].finishReason` and `usageMetadata` defensively -- AD-49 Rule 1.
- [x] `gemini-client.test.ts` -- cases: MAX_TOKENS, STOP, missing usageMetadata, existing `{ text }` shape still returned.
- [x] `process-ai-job.ts` -- after the call log one `[gemini-extraction]` line (postId, finishReason, tokens, atRisk); in the parse-failure branch replace the raw-text dump with a `[gemini-response-unparseable]` warning carrying the same fields plus length, a 200-character head and the error; behavior otherwise unchanged.
- [x] `process-ai-job.test.ts` -- a mocked unparseable and an empty response: no throw, post not marked extracted, the warning contains `finishReason`; a normal response logs the info line.

**Acceptance Criteria:**
- Given a Gemini response with `finishReason` MAX_TOKENS and `usageMetadata`, when the client returns, then the result carries both and the existing `text` is unchanged.
- Given an unparseable response, when `processAiJob` runs, then it does not throw or mark the post extracted, and the log shows `finishReason`, token counts and the response length instead of the full raw text.
- Given every existing test, when the suite runs, then it passes without edits to mocks that return only `{ text }`.

## Spec Change Log

## Design Notes

Failure is derived, not stored: not extracted, `extraction_started_at` set, claim expired. The new log line is what tells an operator why. If the moderator screen should show "attempt failed" for those posts, that is a derived status in `derivePostExtractionStatus`, a separate small change.

## Verification

**Commands:**
- `pnpm --filter backend exec tsx --test src/lib/ai-gateway/gemini-client.test.ts src/lib/ai-gateway/gemini-output-signals.test.ts src/lib/ai-processor/process-ai-job.test.ts` -- expected: all pass
- `pnpm lint` and `pnpm build` (repo root) -- expected: clean (the untracked `scripts/reextract-posts-oneoff.ts` has type errors; move it out of the tree for the build)

## Suggested Review Order

**Signals from the client**

- Client reads finishReason, usage, thinking tokens and the prompt block reason, all optional.
  [`gemini-client.ts:99`](../../apps/backend/src/lib/ai-gateway/gemini-client.ts#L99)

- One definition of "at risk": MAX_TOKENS, or output plus thinking at 90% of the cap.
  [`gemini-output-signals.ts:18`](../../apps/backend/src/lib/ai-gateway/gemini-output-signals.ts#L18)

**Logging in the job**

- Per-request line, then a bounded warning (length, head, tail, flattened error) on parse failure.
  [`process-ai-job.ts:165`](../../apps/backend/src/lib/ai-processor/process-ai-job.ts#L165)

**Tests**

- Client cases: MAX_TOKENS, STOP, no metadata, partial usage, block reason.
  [`gemini-client.test.ts:144`](../../apps/backend/src/lib/ai-gateway/gemini-client.test.ts#L144)

- Job cases D2 to D5: cut-off, blocked, non-string text, normal response.
  [`process-ai-job.test.ts:394`](../../apps/backend/src/lib/ai-processor/process-ai-job.test.ts#L394)
