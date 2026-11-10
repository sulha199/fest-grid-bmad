---
title: 'Cursor extraction slice 6: the resume pass and the re-scrape before giving up'
type: 'feature'
created: '2026-11-10'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A stepped extraction whose step message was lost, whose step failed after taking the lease, or whose Lambda timed out leaves a cursor that nothing moves again (slice 5 drops such a step on purpose).

**Approach:** Slice 6 of `_bmad-output/specs/spec-cursor-extraction/build-slices.md` (AD-47 Rules 5-6, AD-51 Rule 4): on every 5-minute tick, after the ledger's resume pass, `resumeStalledChains` finds chains whose last cursor commit (every write refreshes `queued_for_extraction_at`) is older than the claim TTL times (attempts + 1), and re-enqueues the next step from the persisted cursor without a human. Expired image links get at most 2 re-scrapes, 10 minutes apart, through the scrape gate, the per-URL lease and the adapter's guarded call; only the cursor's unread links change. A chain that cannot be finished ends partial.

## Boundaries & Constraints

**Always:** Takes the lease by swapping the nonce, never the step count; resume attempts (max 6) never reset, each waits longer; a refused or failed re-scrape ends the chain partial and is never retried in a loop; the fresh list must have the same count, the same unread files in the same order and live links, else the chain ends partial; the pass reads the kill switch first; ships dark with the flag.

**Ask First:** Changing the attempt or re-scrape limits.

**Never:** Writing the caption anywhere, rewriting the post row, moderator guards or UI (slice 7).

## Tasks & Acceptance

- [x] `resume-stalled-chains.ts`, the claim-time refresh on every cursor write, the tick wiring, 19 tests against a real database.

**Acceptance Criteria:**
- Given a stalled chain, then the next step is re-enqueued with a new lease nonce and the same step count and progress; a chain that committed recently, or is still inside its growing wait, is left alone.
- Given expired links, then one re-scrape replaces only the cursor's unread links and the chain resumes; a failed, refused, count-changing, order-changing or still-expired re-scrape ends it partial.
- Given spent attempts or the switch off, then the chain ends partial.

## Spec Change Log

## Design Notes

Review fixes: a chain with no claim time is resumed too; the growing wait is applied in SQL so waiting chains cannot fill the page; an enqueue failure gives the counted attempt back; a re-scrape blocked by another scrape counts as a visit so a never-released lease cannot keep a chain alive forever; the unreadable-cursor clear is a guarded write. Known gaps: the chain's re-scrape cooldown is kept in the cursor and is not read by the moderator preview's own cooldown (AD-51 asks for one ledger; a later change can share it); the curator-caption null after a resume-ended chain is a separate write.
