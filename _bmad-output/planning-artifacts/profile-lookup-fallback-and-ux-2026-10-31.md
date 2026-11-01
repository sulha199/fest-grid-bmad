# Profile lookup: timeout fallback and the UX flow it needs

**Status:** proposal, 2026-10-31. Not built. Needs the four decisions in section 6, then `bmad-architecture` (extend AD-41) and `bmad-ux` (the flow and copy in section 4).
**Backlog:** IDEA-115.

## 1. The problem, with measurements

A profile lookup (turning a handle into an account) runs in the **28 s API Lambda** with a **25 s budget**. That budget is not safe, and no value would be:

| Fact | Evidence |
|---|---|
| Apify profile lookup times out at 25 s about **15-21%** of the time | 5 timeouts in 24-34 attempts, 2026-10-15 to 10-19 (classification review rows + API Lambda logs). Small sample: 95% range roughly 9-40% (10-19 window), so 30% is neither confirmed nor ruled out. |
| Bright Data takes about **80 s** | Live probe 2026-10-31: sync call answered 202 at 61 s, snapshot ready ~80 s. It cannot finish in the API Lambda at all, so the profile scraper chain (PR #121) skips it there. |
| The API Lambda cannot wait longer | 28 s hard limit. A lookup that runs into it is killed mid-write (the `infokonsermusik` incident, AD-41). |

So both vendors can exceed the interactive budget, and the fallback to a second vendor needs more time than the request has. The chain exists (PR #121) but only a caller with a long budget can use it. **The fix is not a longer wait; it is a second phase that runs off the request path.**

Two interactive callers use the lookup today:

1. **Vote for an account by handle or URL** (`castVote` -> `lookupAccountProfile`). The UI (`CastVoteForm.tsx`) shows a blocking "Voting..." loader for up to 25 s, then **one generic toast, "Failed to cast vote", for every error**, a timeout included (the backend does return a distinct `SCRAPE_TIMEOUT` code; the form ignores it). The strings are hard-coded English.
2. **Subscribe -> classify** (`subscribeToAccount` -> `classifyAccountType`). AD-41 already plans to move this off the request path (a 300 s worker, `isClassificationInProgress`, "Classifying..." with bounded polling). **Not built.**

## 2. Proposal: a two-phase lookup

**Phase 1, interactive, short.** Try the first adapter only, with a budget that leaves room to write (about 18-20 s of the 28 s). Found or definitively not found: answer now, exactly as today.

**Phase 2, background, long.** If phase 1 times out, fails, or finds that no adapter fits, **do not fail the request.** Record a durable *lookup request* and hand it to the worker AD-41 already specifies (async Lambda invoke of the scraper Lambda, 300 s). The worker runs the **whole chain with a long budget**: Apify again, then Bright Data (about 80 s). The user is told it is in progress, and told the outcome when it ends.

Why this shape:
- It reuses AD-41's pattern (a stamp is the durable intent, an async invoke, a sweep as the backstop, a bounded-time invariant) instead of inventing a second one.
- It is the only place Bright Data can run for an interactive feature, which is what makes "Bright Data covers Apify" real for lookups.
- Nothing is silently dropped: **every request reaches FOUND, NOT_FOUND, or FAILED in bounded time** (the AD-41 invariant), and FAILED is shown to the user with a retry.

New pieces (sketch, for `bmad-architecture`):
- A `profile_lookup_requests` table: id, user id, platform, handle, purpose, status (`PENDING | FOUND | NOT_FOUND | FAILED`), `attempts`, optional result profile id, and **the vote intent** when the request came from a vote (see decision D4). RLS on, no policy.
- A `lookup-profile` branch on the scraper Lambda (like AD-41's `classify-account`), claim and attempt counter like AD-41 Rule 3, a sweep on the existing 5-minute tick.
- GraphQL: a `profileLookupRequest(id)` query (poll) and a `myProfileLookupRequests` list; `castVote` returns either the vote or a pending request.
- The chain, adapters and `profile_lookup_attempts` audit table stay as built. The audit rows (this PR) measure phase 1's real timeout rate per adapter, so its budget can be set from data (for example the p90 of successful lookups) instead of guessed.

## 3. What the user can and cannot know

During phase 2 the app has **no profile yet** (no numeric `account_id`, BUG-059), so it cannot show the account's name or picture. It knows only the handle the user typed. The UX must be honest about that: it shows the handle, a state, and what happens next.

## 4. UX flow and states (draft, for `bmad-ux`)

Replace the single blocking loader and generic toast with explicit states:

| # | State | What the user sees | Notes |
|---|---|---|---|
| 1 | Looking up (0-8 s) | Inline "Looking up @handle..." on the form, not a full-screen block | Keep the form visible; Cancel allowed. |
| 2 | Slow (8-20 s) | "Instagram is slow to answer. Still trying..." | Reassures instead of looking frozen. Replaces today's silent wait. |
| 3 | Found | Today's success ("Voted for <name>") | Unchanged. |
| 4 | Not found | "We couldn't find @handle on Instagram. Check the spelling." Input kept, focus returned | A definitive answer, not an error toast. |
| 5 | Handed off | "We're still looking up @handle. You can leave this page. We'll tell you when it's done." A **Pending** row appears in the user's list ("Looking up @handle...") | The key new state. Replaces "Failed to cast vote" for a timeout, which is not the user's fault. |
| 6 | Resolved later | In-app notification and the pending row updates: "@handle added" (and "your vote was counted" if D4 = auto-apply) | Polling while the page is open, with a bound; notification if they left. |
| 7 | Failed after retries | "We couldn't reach Instagram for @handle. Try again" with a button | Terminal and visible, never a silent drop. |
| 8 | Provider down | Same as 5 (the user is not told which vendor) | Vendor names never appear in user copy. |

Cross-cutting: every string through the i18n files (en and id) instead of hard-coded English; a screen-reader announcement for each state change; the pending list reachable on mobile; no full-screen blocking loader for a wait that can reach 2 minutes.

The subscribe flow gets the same states through AD-41's `isClassificationInProgress` ("Classifying..."), so there is one vocabulary for "we're working on it" across both features.

## 5. What it costs and what it does not fix

- New: one table, one worker branch, one sweep, two GraphQL operations, the pending-list UI and copy. Roughly a feature epic's worth (effort `m`); AD-41 is its prerequisite for the worker and sweep.
- It does not make the first attempt faster; it makes the slow case honest and recoverable.
- It does not remove the Apify plan question (FIND-103): phase 2 still needs a working Apify or Bright Data budget.

## 6. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Persist lookup requests durably (new table) or poll only on the open page? | **Durable.** Polling alone loses the request when the user leaves, which is exactly the silent drop AD-41 was written to prevent. |
| D2 | Tell the user when it finishes: in-app list and polling only, or also a push notification? | In-app first (no new infrastructure); push (`fcm_tokens` exists) as a follow-up. |
| D3 | Phase 1 budget and shape: one adapter for about 18-20 s, or race two? | One adapter, budget from the audit data after a week of measurements; do not race (it doubles the paid calls). |
| D4 | For a vote: apply it automatically when the lookup resolves, or ask the user to confirm? | **Auto-apply**, with a clear notification and an undo, since the user already expressed the intent. Confirm only if the resolved account's name differs a lot from the handle (guards a wrong handle). |

## 7. Order of work

1. Merge the audit rows (this PR) and let them collect a week of data.
2. `bmad-architecture`: extend AD-41 to cover lookup requests (or add an AD that points to it).
3. `bmad-ux`: states, copy (en and id), the pending list.
4. Build AD-41's worker and sweep first, then the lookup request on top of it.
