---
epic: 5
swept: true
date: 2026-07-31
stories_covered:
  - 5.1
  - 5.2
  - 5.3
  - 5.4
  - 5.5
---

# Epic 5 Readiness Sweep — Onboarding and Manual Event Extraction

**Owner persona:** Winston (`bmad-agent-architect`)
**Gates run:** Gate 1 (Architecture/Infrastructure Completeness) and Gate 3 (Foundational/Cross-Cutting Dependency Completeness), per `story-split-gate.md`'s Epic-Level Sweep Mode. Gate 2 (UI Complexity & Reusability) is intentionally NOT run here — it stays per-story in `bmad-create-story`.

## Gate 1 — Architecture / Infrastructure Completeness

**Finding 1 — No backend GraphQL API layer exists for any of Epic 5's data needs.** Stories 5.1-5.5 all read as pure frontend screens: listing a user's subscriptions and their posts, submitting a post selection, reading remaining quota, and removing a subscription. Unlike Epic 3/4's equivalent gaps (where the underlying tables/adapters already existed and only AC wording was missing), here the resolvers/mutations genuinely don't exist anywhere:
- No query returns a user's subscriptions with the per-tab metadata (`isNewlyAdded`, inactivity status) Stories 5.1/5.4/5.5 assume.
- No query lists a subscription's posts (Story 3.3a's `posts` table has persistence functions for the scraping pipeline's writer side, but no read/list resolver for the frontend).
- No query exposes a user's remaining extraction quota, even though Story 0.13's AI Gateway adapter already tracks per-key usage internally.
- No mutation lets a user submit a post selection for extraction — i.e. no entry point into Story 3.5's queue from the frontend at all.
- No mutation anywhere removes/unsubscribes an account (Story 3.2 only creates subscriptions); Story 5.4's "button to remove the inactive subscription" has nothing to call.

Affects Stories 5.1, 5.2, 5.3, 5.4, and 5.5 collectively — one architectural gap, not five.

**Finding 2 — Story 3.5 ("Add new posts to a processing queue") conflicts with PRD §3.10's manual-selection model.** Story 3.5's original draft implied posts are queued automatically right after being scraped ("When the post is ready to be processed..."). PRD §3.10 states manual post selection is what "allows users to choose which specific... posts should be processed by the AI agent," and Story 5.3 requires server-side quota enforcement at the point of queueing. If posts were queued automatically at scrape time, Epic 5's entire selection/quota UI would have nothing left to gate. **Corrected directly in `epics.md`** — Story 3.5 now explicitly states queueing is triggered by a user's selection (Story 5.1a's mutation), not automatically.

**Finding 3 — Story 5.5's "tab automatically activated" requires a schema field and lifecycle no story owned.** PRD §3.10 names an `isNewlyAdded` flag on subscriptions but no story sets it (at creation) or clears it (after the tab is viewed). **Corrected directly in `epics.md`** — Story 3.2 now creates subscriptions with `isNewlyAdded: true`; the new Story 5.1a exposes it via `mySubscriptions` and clears it via `markSubscriptionViewed`.

**Not a gap:** Story 3.3a (posts table) already anticipated Epic 5 explicitly in its own Note ("read by Epic 5, Stories 5.1-5.4") — the table and its persistence functions are reused directly, not rebuilt. Story 0.13 (AI Gateway adapter) already owns Tier 1/Tier 2 quota tracking — Story 5.1a's quota query reads it rather than reimplementing it. Story 0.8 (GraphQL scaffold) and Story 0.17 (auth context) are reused as-is.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**No new cross-cutting gap found.** Every foundational dependency Epic 5 touches is already homed and does not need promotion to Epic 0:
- AI Gateway adapter / quota tracking — Story 0.13 (Epic 0), already anticipates Epic 3 and Epic 4; Epic 5 only reads its usage data via a new query, it doesn't need its own foundation.
- GraphQL scaffold/codegen/auth context — Stories 0.8/0.17 (Epic 0), reused directly.
- `posts` table — Story 3.3a (Epic 3), already explicitly scoped for cross-epic reuse by Epic 5.

Everything new this sweep found (subscriptions-listing query, posts-listing query, quota query, extraction-trigger mutation, unsubscribe mutation) is consumed only within Epic 5 itself — none of it is needed by another epic, so per Gate 3's promotion bar (≥2 independent epics needing the same unbuilt thing) it stays an Epic 5 concern rather than moving to Epic 0. This mirrors Epic 3's readiness sweep, where the equivalent subscription/onboarding wording gaps also stayed in-epic.

## New Prerequisite Stories Added

| Story key | Title | Classification | Position in `epics.md` | Gate |
|---|---|---|---|---|
| `5.1a` | Build the manual post selection & extraction GraphQL API layer | Shared data-ownership (within Epic 5; consumed by 5.1, 5.2, 5.3, 5.4, 5.5) | Immediately before Story 5.1 | Gate 1 |

`5.1a` was written as a full section (As a/I want/So that + Acceptance Criteria + Note) directly into `epics.md`, and a corresponding `backlog` entry was appended to `sprint-status.yaml` immediately before `5-1-manual-post-selection-screen`. No Epic 0 stories were needed — see Gate 3 above.

## AC Corrections Applied to Existing Stories

- **Story 3.2** (Epic 3): added a bullet — new subscriptions are created with `isNewlyAdded: true`, consumed by Story 5.1a/5.5.
- **Story 3.5** (Epic 3): AC corrected — queueing is now explicitly triggered by a user's manual selection via Story 5.1a's `selectPostsForExtraction` mutation, not automatically after scraping; added a `Note:` explaining the Gate 1 finding and a `Depends on: Story 3.3a` line.
- **Story 5.1:** added bullets routing subscription/post listing through `mySubscriptions`/`postsBySubscription` (Story 5.1a); added `Depends on: Story 5.1a`.
- **Story 5.2:** added a bullet routing selection submission through `selectPostsForExtraction` (Story 5.1a); added `Depends on: Story 5.1a`.
- **Story 5.3:** added bullets routing quota display and server-side quota enforcement through `myExtractionQuota`/`selectPostsForExtraction`, and the processed-post disabled state through `postsBySubscription`'s `isExtracted` field (all Story 5.1a); added `Depends on: Story 5.1a`.
- **Story 5.4:** added bullets routing inactivity detection and subscription removal through `mySubscriptions`'s `isInactive` field and the `removeSubscription` mutation (Story 5.1a); added `Depends on: Story 5.1a`.
- **Story 5.5:** added a bullet routing new-subscription tab auto-activation through the `isNewlyAdded` field and `markSubscriptionViewed` mutation (Story 5.1a); added `Depends on: Story 3.2, Story 5.1a`.

## Other Findings (FR-coverage gaps, not architecture gaps — flagged for PM awareness, no prerequisite story proposed)

- FR62 ("Users can access the manual post selection from the user menu") and PRD §3.10's "Extract event from post(s)" menu item are only implicit in Story 5.1's "Given I am on any page... When I navigate... from the user menu" — no story explicitly owns adding this entry to the user-menu component (Story 2.8, Epic 2). Not an architecture gap; a cross-story wiring detail for whoever implements 5.1/2.8.
- General "My Subscriptions" management (viewing/editing/removing any subscription, not just an inactive one) has no dedicated story anywhere — Story 5.1a's `removeSubscription` mutation only covers the inactive-account case Story 5.4 needs. If broader subscription management is in scope for MVP, it's an FR-coverage gap for `bmad-create-epics-and-stories`/PM follow-up, not a Gate 1/3 violation.

These are epic-breakdown/FR-coverage concerns, not architecture-completeness violations — no prerequisite story is proposed for them here.
