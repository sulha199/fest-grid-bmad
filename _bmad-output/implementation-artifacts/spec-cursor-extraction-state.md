---
title: 'Cursor extraction slice 3: persisted cursor, compare-and-set writer, claim and status rules'
type: 'feature'
created: '2026-11-10'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A stepped extraction (AD-46..AD-51) needs somewhere to keep its progress that survives a lost message, a duplicate delivery and a Lambda timeout, and the rest of the system must treat a post with a live chain as claimed.

**Approach:** Slice 3 of `_bmad-output/specs/spec-cursor-extraction/build-slices.md`, dark (nothing writes a cursor yet): migration 0094 (`posts.extraction_cursor` jsonb, `posts.extraction_partial`), a validated cursor parser, a store whose every write is a compare-and-set on (step count, lease nonce), and the claim and status rules of AD-47 Rule 5a.

## Boundaries & Constraints

**Always:** The cursor is validated on read and never holds a caption or leaves the backend (not in GraphQL); written through `::text::jsonb` so it is a real object; a non-null cursor makes the post EXTRACTING (domain rule and SQL twin agree), refuses `enqueuePostForProcessing` whatever the claim age, and is skipped by the AD-52 resume pass; only the lease holder advances or ends a chain.

**Ask First:** Any change to the cursor fields (AD-47 Rule 1) or the lease semantics.

**Never:** The step handler, prompt or response-schema changes, the resume pass for cursors (slice 6), UI, prod writes.

## Code Map

- `packages/database/schema.ts`, migration `0094_posts_extraction_cursor_and_partial.sql` -- the two columns.
- `packages/domain/src/posts/extraction-cursor-schema.ts` -- the zod parser; `extraction-status.ts` -- `hasExtractionCursor` fact.
- `apps/backend/src/lib/posts/extraction-cursor-store.ts` -- read, start, advance, take lease, finish; `post-extraction-status.ts` (SQL twin), `enqueue-post-for-processing.ts`, `resume-due-extractions.ts`.

## Tasks & Acceptance

- [x] Migration and schema; parser and status fact; store; claim and status rules; tests for each (store tests run against a real database).

**Acceptance Criteria:**
- Given a stale or duplicate writer, when it advances, takes the lease or ends the chain with an old (step count, nonce), then nothing changes.
- Given a post with a cursor and a claim of any age, when it is enqueued or its status is derived, then it is refused and EXTRACTING, in the SQL filter and the domain rule alike.
- Given a stored cursor, when it is read back, then it is a JSON object (no double encoding) and equals what was written.

## Spec Change Log

## Design Notes

- `markPostExtracted` leaves a cursor alone: a chain ends only through `finishExtractionChain` by its lease holder.
- NUL characters in strings derived from model output are stripped before storing (Postgres rejects them in jsonb).
- Not in this slice: reclaiming a chain whose queue message was lost (slice 6), and showing the partial flag (slice 7).
