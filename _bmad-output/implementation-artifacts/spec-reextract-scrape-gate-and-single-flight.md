---
title: 'Post-URL scrapes: apply the account scrape gate and share an in-flight scrape'
type: 'feature'
created: '2026-10-31'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-reextract-read-all-slide-images.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** (1) The moderator re-extract rescrape and `extractEventDataFromUrl` call `getPostByUrl` without `isScrapableAccountType()`, which project-context and AD-34 require of every code path that starts a scrape, and the PRD (3.16) says personal and awaiting-approval accounts are never scraped. (2) Two previews of the same URL within seconds both pass the cooldown (the check runs before the scrape; the job row is written after) and both scrape, doubling the scraper spend (FIND-110).

**Approach:** Gate every post-URL scrape on the owning account's type (a stored post's own account, or for an unknown URL the account the scrape returns), and put a per-URL in-flight lease around the scrape so a second caller reuses what the first produces instead of scraping again.

## Boundaries & Constraints

**Always:**
- The gate is `isScrapableAccountType()`, never a re-inlined condition. A stored post is gated before any scrape on its owning account (`posts.account_id`); an unknown URL cannot be gated before the scrape, so the scraped `ownerUsername` is looked up afterwards and a known non-scrapable account refuses the result (nothing stored, job not started). Both paths are added to the scrape-gate entry-point list in project-context and AD-34 Rule 4.
- Refused for a stored post with a caption: the preview still runs on the stored data (no scrape, no error). Refused with no caption to preview, or an unknown URL's owner that is non-scrapable: new `ACCOUNT_NOT_SCRAPABLE` error with a message saying the post belongs to an account FestDaily does not scrape (PRD 3.16: the user is told why).
- In-flight sharing uses the existing `vendor_call_locks` table through a new exported function in `guarded-call.ts` (the only writer of that table), key `post-url-scrape:<hash of the URL>`, TTL 60 s. The lease covers cooldown re-check, scrape and job-row insert, so the second caller either sees the lease busy or sees the first one's row.
- A caller that finds the lease busy does not scrape. With a stored caption it previews on the first run's fresh image links when the cooldown lookup has them, else on stored data. With no stored caption (captions are never stored, so it cannot be shared) it gets new `SCRAPE_IN_PROGRESS`, "this post is being fetched right now, try again in a moment". `extractEventDataFromUrl` uses the same lease and the same error.
- The lease is always released (`finally`) and expires by TTL if the Lambda dies.

**Ask First:** Adding a wait/poll for the first scrape; a new table; changing AD-32's `callVendor`.

**Never:** Scrape when the lease is busy; write a caption, fresh image links or a lease anywhere but the job payload and `vendor_call_locks`; gate by re-inlining the type condition.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Stored post, personal account, caption stored | stale images | no scrape, previews on stored data | N/A |
| Stored post, personal account, no caption | needs scrape | nothing scraped | `ACCOUNT_NOT_SCRAPABLE` |
| Unknown URL, owner is a known personal account | scrape returns owner | result refused, no job | `ACCOUNT_NOT_SCRAPABLE` |
| Unknown URL, owner unknown | scrape returns owner | proceeds as today | N/A |
| Second preview while first scrapes | lease busy, caption stored | no scrape; first run's fresh links if any, else stored | N/A |
| Second call while first scrapes | lease busy, no caption / `extractEventDataFromUrl` | no scrape | `SCRAPE_IN_PROGRESS` |
| First finishes | lease released, row written | next call hits the cooldown, not a new scrape | N/A |
| First crashes | lease unreleased | claimable after TTL | N/A |

</frozen-after-approval>

## Code Map

- `apps/backend/src/lib/vendor-gateway/guarded-call.ts` -- export `tryClaimInFlight(key, ttlMs)` over the private `claimLock`/`releaseLock`.
- `apps/backend/src/lib/scraper/post-scrape-gate.ts` (new) -- stored-post and by-owner gate checks via `isScrapableAccountType`.
- `apps/backend/src/lib/extraction/start-post-reextraction-preview.ts` -- gate, lease, in-lease cooldown re-check.
- `apps/backend/src/schema/resolvers.ts` (`extractEventDataFromUrl`), `extraction.graphql` -- gate, lease, new codes.
- Docs: `project-context.md` and AD-34 Rule 4 entry list, AD-40 note, `7-event-dedup.md`, backlog FIND-110.

## Tasks & Acceptance

**Execution:**
- [x] `guarded-call.ts` + test -- `tryClaimInFlight`: claim, busy, release, TTL expiry
- [x] `post-scrape-gate.ts` + test -- every account type x status combination routes through `isScrapableAccountType`
- [x] preview start and `extractEventDataFromUrl` -- gate and lease, new error codes
- [x] Docs and backlog -- close both FIND-110 findings
- [x] Tests: matrix rows, lease released on failure, row-count ratchet clean

**Acceptance Criteria:**
- Given two concurrent previews of one stale URL, when both run, then `getPostByUrl` is called once.
- Given a stored post of a personal account, when a moderator previews it, then no scrape starts.

## Spec Change Log

## Verification

**Commands:**
- `pnpm --filter backend test` -- expected: pass, row-count ratchet clean
- `pnpm lint` and `pnpm build` -- expected: pass
