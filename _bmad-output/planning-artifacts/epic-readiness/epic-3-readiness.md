---
epic: 3
swept: true
date: 2026-08-01
stories_covered:
  - 3.1a
  - 3.1
  - 3.2
  - 3.3
  - 3.3a
  - 3.3b
  - 3.4
  - 3.5
  - 3.6
  - 3.6b
  - 3.7
  - 3.8
  - 3.9
  - 3.10
---

# Epic 3 Readiness Report — Social Media Event Integration

## Re-sweep Trigger

Re-run at the user's request following commit `cf52ce5` (2026-08-01), which added FR66/FR67, Story 3.3b, and — via the amended PRD (§4.5, §4.7, §4.9) — a new `SocialMediaAccountProfile` entity and `Post.accountId`/`Subscription.accountId` fields. The prior sweep (2026-07-31, see history below) predates all of this and did not evaluate it.

## Gate 1 — Architecture / Infrastructure Completeness

**No new gap found.** Story 3.3b's mutation (`requireAuth`, Story 0.17) and Story 4.7's extension (`requireModerator` per Architecture Spine AD-7 rule 5) both route through already-established layers; Story 3.3b's moderator email reuses Story 3.10's existing outbound-email pattern (Story 0.15 adapter). No bypassed backend/API layer, no direct external-service call, no un-IaC'd infra introduced by the new stories.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**Gap found: `SocialMediaAccountProfile` has no owning story.**

The amended PRD (§4.5, as of 2026-08-01) defines `SocialMediaAccountProfile` as an entity shared across every subscriber of an account — introduced specifically so `defaultLocation` (FR66/FR67) has exactly one value per account instead of being ambiguous across subscribers. But the only table that currently exists for account data is `subscriptions` (Story 1.1, **done**, live in `packages/database/schema.ts:41-52`), which duplicates `platform`/`displayName`/`username`/`profileImageUrl`/`description`/`lastPostDate` on every subscriber's row — precisely the per-subscriber ambiguity the PRD amendment says it's moving away from. No story anywhere in `epics.md` creates a `social_media_account_profiles` table or migrates these fields off `subscriptions`.

This is corroborated by the architecture spine: AD-1's Unified Query DSL already lists `socialMediaAccountProfileId` as a queryable ID field (predates this commit), meaning the entity was architecturally anticipated but never given an owning story.

**Cross-epic reuse (clears the promotion bar):** needed to write by Epic 3 (Stories 3.1-3.3b) and read by Epic 4 (Story 4.7's `DefaultLocationChangeRequest.accountId`, `pendingDefaultLocationChanges` query).

**Classification:** Shared data-ownership gap (not Epic 0 — this is domain data Epic 3 originates, following the Story 1.1 precedent) → new **Story 3.1a**, positioned before Story 3.1 (the first story that subscribes to/creates an account).

**Cascading corrections** (same underlying gap, not independent findings):
- **Story 3.3a:** `posts` table's AC was FK'd to `subscription_id` (matching the pre-amendment PRD). The amended PRD §4.7 defines `Post.accountId` → `SocialMediaAccountProfile`, not `Subscription` (a post belongs to the account, not to any one subscriber's row). Corrected in `epics.md`.
- **Story 1.2a is deliberately left unchanged** (still creates `posts.subscription_id`). It is `ready-for-dev`, not yet coded, in **Epic 1** — making it depend forward on an Epic 3 table (`social_media_account_profiles`) would re-introduce the exact cross-epic dependency 1.2a was split off from Story 3.3a to avoid. Instead, **Story 3.1a's own AC** was extended to migrate `posts.subscription_id` → `posts.account_id` once Epic 3 runs (Epic 3 depending on Epic 1's already-built table is the natural direction, not the reverse). No change needed to the 1.2a story file.
- **Story 5.1a:** `postsBySubscription(subscriptionId, ...)` renamed to `postsByAccount(accountId, ...)` (posts belong to the shared account, not a subscription); `removeSubscription` corrected from an implied hard delete to a soft delete, since AD-8 (this commit) newly binds `Subscription`.

**Not promoted to a new story:** `DefaultLocationChangeRequest` (PRD §4.14) — already correctly scoped to Story 3.3b (which creates rows) with Story 4.7 already declaring `Depends on: ... Story 3.3b`. No gap here; already handled correctly in the 2026-08-01 planning commit.

## Other findings (FR/AC-completeness gaps, not architecture gaps — flagged for PM awareness, no prerequisite story proposed)

- **Story 3.6 has no AC for the `defaultLocation` fallback.** PRD §3.7 requires: "If the AI agent does not find an explicit location in a post, it will use this default location for the event" — Story 3.6 (the extraction Lambda) is where this belongs, but its AC list (1-8) never mentions reading `SocialMediaAccountProfile.defaultLocation` via the post's `accountId` as a fallback when Gemini extraction yields no explicit location. Pre-dates this commit, but the commit's account-level `defaultLocation` clarification gives this a well-defined source now. This is a requirements-completeness gap, not an architecture gap — flagged for the PM (John) to add as a new AC on Story 3.6, not fixed here.

## New Prerequisite Stories Added

- **Story 3.1a — Create social media account profiles table.** Full section written into `epics.md` before Story 3.1. Classification: shared data-ownership gap. `sprint-status.yaml` updated with `3-1a-create-social-media-account-profiles-table: backlog`, positioned before `3-1-...`.

## AC Corrections Applied Directly to `epics.md`

- **Story 3.1:** added `Depends on: Story 3.1a`; noted subscription persistence now uses Story 3.1a's account-profile lookup-or-create logic.
- **Story 3.2:** added `Depends on: Story 3.1a`.
- **Story 3.3a:** AC corrected `subscription_id` → `account_id` (FK to `social_media_account_profiles`, migrated in by Story 3.1a); added `Depends on: Story 3.1a`; added Amendment 2 explaining the correction and why Story 1.2a itself is untouched.
- **Story 3.1a:** AC extended with the `posts.subscription_id` → `posts.account_id` migration (backfill + index swap), so Epic 1's Story 1.2a does not need to depend forward on this Epic 3 story; added `Depends on: Story 1.2a` (for the `posts` table it migrates).
- **Story 5.1a:** `postsBySubscription(subscriptionId, ...)` → `postsByAccount(accountId, ...)`; `removeSubscription` corrected to soft-delete (AD-8); `mySubscriptions` corrected to filter `deletedAt IS NULL`; added `Depends on: Story 3.1a`; added Amendment explaining both corrections.

## Follow-up required outside this sweep (not epics.md)

- **Story 1.2a's story file is intentionally NOT touched.** Confirmed unchanged by design — see the Story 3.1a/3.3a corrections above. `_bmad-output/implementation-artifacts/1-2a-...md` still correctly describes `posts.subscription_id`; no re-sync needed.
- **Story 3.6** needs a new AC for the `defaultLocation` fallback (see "Other findings" above) — PM-owned, not an architecture gap.

## Prior Sweep History (2026-07-31, superseded by this re-sweep)

Epic 3 already carried significant retroactive gate work from earlier sweeps: Stories 0.13 (AI Gateway adapter), 0.14 (AWS IaC), 0.15 (outbound email adapter), 0.16 (Geolocation adapter), and 0.17 (GraphQL authenticated-context layer) were all promoted into Epic 0 because Epic 3's stories needed them. Story 3.3a (posts table) and Story 3.6b (Ingestor Lambda) were split off Story 3.6 by a prior per-story gate pass.

**Gate 1 gaps found and resolved (AC corrections, no new story):**
1. Missing "via backend GraphQL API" language in Stories 3.1, 3.2, 3.3, 3.7 — corrected.
2. No story stated BYOK API keys are encrypted via KMS on write — corrected (Story 3.1 AC).
3. Story 3.7's Feed needed a query dimension Story 1.3a didn't expose (filter by `sourceSocialMediaAccountId`) — corrected (Story 1.3a, Story 3.7 ACs).

**Gate 3:** No new cross-cutting gap found at the time (everything needed was already homed in 0.13-0.17).

**Call-out verdicts:** 3.7 (AC correction, not a new story), 3.8 (added `Depends on: 0.12, 2.9`), 3.9 (narrowed to avoid duplicating 0.13's quota algorithm), 3.10 (added `Depends on: 0.15`).

**FR-coverage gaps flagged for PM at the time (still open, not re-evaluated in this re-sweep):** FR30/FR31 partial coverage, FR23 (queue-status display) unowned, FR34/FR35/FR36/FR37 largely uncovered, `/settings/api-keys` has no dedicated story.
