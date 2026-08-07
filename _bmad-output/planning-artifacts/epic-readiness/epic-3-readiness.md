---
epic: 3
swept: true
date: 2026-08-07
stories_covered:
  - 3.1a
  - 3.1
  - 3.1b
  - 3.2
  - 3.3
  - 3.3a
  - 3.3b
  - 3.3c
  - 3.4
  - 3.5
  - 3.6
  - 3.6b
  - 3.7
  - 3.8
  - 3.9
  - 3.10
  - 3.11
---

# Epic 3 Readiness Report — Social Media Event Integration

## Re-sweep Trigger

Re-run at the user's request (`bmad-epic-readiness-check epic 3`, 2026-08-07). The prior sweep (2026-08-01) predates Story 3.11 (added 2026-08-02, public per-account page, FR68), which had never been evaluated against Gate 1/Gate 3. All 15 stories in the epic (including the new ones added by this sweep) remain `backlog` — none have been implemented yet, so this sweep evaluates planned ACs only, per this skill's normal scope.

## Gate 1 — Architecture / Infrastructure Completeness

**Gap found: `docs/infrastructure/high-level-overview.md`'s pipeline diagram contradicted Story 3.5's manual-selection design.**

The committed mermaid diagram drew `L_Scrape -- enqueues --> SQS_AI` as a direct, unconditional edge — i.e. the Scraper Lambda automatically pushes scraped posts onto `AIProcessingQueue`. This contradicts Story 3.5's AC (already corrected by a prior per-story Gate 1 finding): queueing onto `AIProcessingQueue` only happens when a user manually selects a post via Epic 5's `selectPostsForExtraction` mutation (PRD §3.10), never automatically right after scraping. Story 3.4 (the scraper) itself only stores posts "for the next step in the pipeline," consistent with Story 3.5, not the diagram.

**Fix applied directly (doc-only, no epics.md story needed):** `docs/infrastructure/high-level-overview.md` corrected — the scraper's outbound edge now goes to persistent storage (`Supabase`), and `SQS_AI` is now shown fed from the API Lambda's `selectPostsForExtraction` path instead of directly from the scraper.

**Gap found: stale query-name references left in Epic 5 after Epic 3's own Story 3.1a amendment.**

Story 3.1a's 2026-08-01 amendment moved `posts` from `subscription_id` to `account_id`, correctly cascading into Story 5.1a's own AC (`postsBySubscription` → `postsByAccount(accountId, cursor, limit)`), but not into the two Epic 5 stories that *consume* that query: Story 5.1 and Story 5.3 both still referenced the old `postsBySubscription` name.

**Fix applied directly (AC correction, no new story):**
- Story 5.1: `postsBySubscription` → `postsByAccount(accountId, cursor, limit)`.
- Story 5.3: `postsBySubscription` → `postsByAccount`.

**No other Gate 1 gaps.** Every story that touches data or an external service already routes through the mandated layer: 3.1/3.2/3.3/3.3b write via backend GraphQL mutations (0.8/0.17), never a direct DB/domain write from `apps/web`; 3.6 calls Gemini exclusively through the AI Gateway adapter (0.13) and does not write to the DB itself (3.6b, the separate Ingestor Lambda, does); 3.7/3.11 read through the Unified Query DSL (AD-1/1.3a); 3.8/3.10 depend on already-built adapters (FCM, 0.15 email). All infra (Lambdas, queues, KMS, SES) is covered by Story 0.14's IaC.

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**Gap found: `ApiKey` management/revocation surface — named in both UX-DR9 and the Architecture Spine, owned by no story.**

`/settings/api-keys` is an explicitly named route in UX-DR9 (epics.md line 131). Architecture Spine AD-8 explicitly anticipates an `ApiKey` delete mutation ("`ApiKey`/`Subscription` delete mutations (Epic 3/4) once built" must use the rule-4 soft-delete shape). Neither is satisfied anywhere: Story 1.1 only creates the `api_keys` table, Story 3.1 only ever *creates* a key during onboarding. A prior sweep (2026-07-31/08-01) had flagged the missing `/settings/api-keys` page as an FR-completeness note for the PM rather than an architecture gap; this re-sweep upgrades it because the Architecture Spine, not just the PRD/UX-DR, now names the specific missing mutation shape.

**Cross-epic reuse:** none found — this stays a single-epic, user-facing feature (unlike the Gemini/email/geolocation adapters, which are consumed by ≥2 epics), so it is scoped inside Epic 3 rather than promoted to Epic 0.

**Classification:** Single-story architecture split (needed by Epic 3's own onboarding/subscription flow, not reused elsewhere) → new **Story 3.1b**, positioned directly after Story 3.1 (the only existing story that writes to `api_keys`).

**Gap found: no story owns the scraper adapter interface or the platform-slug registry both Story 3.4 and Story 3.11 assume exist.**

Story 3.4 requires "a platform-specific scraper adapter... never a hardcoded, single-platform scraping implementation." Story 3.11 requires "the platform-to-slug mapping... defined once in a shared location alongside the platform-specific scraper adapters... reused for routing — not hardcoded per-component." No story built either the adapter interface or the registry; left alone, Story 3.4 would build both ad hoc as a byproduct of its own scraping work — the same failure mode this gate exists to catch (cf. the i18n/app-shell incident `story-split-gate.md` was written after).

**Cross-epic reuse:** none — no other epic currently calls a social-media scraper or consumes the slug registry, so this stays inside Epic 3.

**Classification:** Shared-abstraction gap, needed by two stories within this epic → new **Story 3.3c**, positioned after Story 3.3b and before Story 3.4 (the first consumer).

**Gap found: Story 0.22's `activeOnly(table)` helper (already backlog, unrelated to this sweep) was not cited by any of the AD-8-bound stories Epic 3 originates.**

Story 0.22 already exists as the correct centralized fix for AD-8 rule 2 — no new story needed. But Epic 3 originates/mutates two AD-8-bound resources (`Subscription` via 3.1a/3.2/3.3b; `ApiKey` via the new 3.1b), and none of those stories cited it, risking a repeat of the existing hand-written `isNull(...)` pattern already present in `resolvers.ts` instead of adopting the shared helper once it lands.

**Fix applied directly (AC correction, no new story):** added an `activeOnly(table)` AC line and a `Depends on: Story 0.22` to Stories 3.1a, 3.2, 3.3b; the new Story 3.1b was authored with this dependency built in from the start.

**No gap — cross-epic table dependencies are correctly sequenced.** Epic 4's Stories 4.7/4.8 and Epic 5's Stories 5.1a/5.5 all correctly declare `Depends on:` back to the specific Epic 3 stories that originate the tables/flags they read (3.1a, 3.2, 3.3a, 3.3b, 3.5). No action needed.

## New Prerequisite Stories Added

- **Story 3.1b — Manage and revoke API keys.** Full section written into `epics.md`, positioned after Story 3.1. Classification: single-story architecture split. `sprint-status.yaml` updated with `3-1b-manage-and-revoke-api-keys: backlog`, positioned between `3-1-...` and `3-2-...`.
- **Story 3.3c — Define the scraper adapter interface and platform-slug registry.** Full section written into `epics.md`, positioned after Story 3.3b and before Story 3.4. Classification: shared-abstraction gap (within-epic reuse, not cross-epic). `sprint-status.yaml` updated with `3-3c-define-the-scraper-adapter-interface-and-platform-slug-registry: backlog`, positioned between `3-3b-...` and `3-4-...`.

## AC Corrections Applied Directly to `epics.md`

- **Story 5.1, Story 5.3 (Epic 5):** `postsBySubscription` → `postsByAccount` (Gate 1 — stale reference left over from Story 3.1a's 2026-08-01 rename).
- **Story 3.1a:** added an `activeOnly(table)` AC line for the lookup-or-create logic's active-subscription check; added `Depends on: Story 0.22`.
- **Story 3.2:** added an `activeOnly(table)` AC line for the already-subscribed check; added `Depends on: Story 0.22`.
- **Story 3.3b:** added an `activeOnly(table)` AC line for the active-subscriber authorization check; added `Depends on: Story 0.22`.
- **Story 3.4:** added `Depends on: Story 3.3c` (previously had no `Depends on:` line).
- **Story 3.11:** appended `Story 3.3c` to its existing `Depends on:` list.

## Doc-only Fix (outside `epics.md`)

- **`docs/infrastructure/high-level-overview.md`:** corrected the pipeline diagram — removed the direct `L_Scrape → SQS_AI` edge (contradicted Story 3.5's manual-selection design) and rerouted `SQS_AI` to originate from the API Lambda's `selectPostsForExtraction` path instead.

## Not promoted (considered, rejected)

- **`buildOptimizedDrizzleSelect` traceability on 3.1a/3.3a/3.7/3.11:** Winston (architect pass) flagged this as worth citing explicitly for traceability, but confirmed it is *not* a blocking gap — Story 0.8 already exists and Story 1.3a already establishes the reuse precedent Stories 3.7/3.11 inherit. Not applied; left as a low-priority polish item for whoever runs `bmad-create-story` on those stories, not a prerequisite.

## Follow-up required outside this sweep (not epics.md)

- **Story 3.6** still needs a new AC for the `defaultLocation` fallback per PRD §3.7 — actually, this was already added by the 2026-08-01 sweep's Amendment; confirmed present in the current Story 3.6 AC list (the `defaultLocation` fallback bullet). No longer open.
- **FR-coverage gaps flagged for PM at the 2026-07-31 sweep (not re-evaluated in depth here, still open):** FR30/FR31 partial coverage, FR23 (queue-status display) unowned.

## Prior Sweep History (2026-08-01, superseded by this re-sweep)

The 2026-08-01 re-sweep found and resolved: `SocialMediaAccountProfile` had no owning story (→ Story 3.1a added), corrected Story 3.3a's FK from `subscription_id` to `account_id`, renamed Story 5.1a's `postsBySubscription` → `postsByAccount` and corrected `removeSubscription` to a soft delete. Full detail preserved in git history of this file.

The 2026-07-31 sweep found and resolved (all still valid, unaffected by this re-sweep): Stories 0.13 (AI Gateway adapter), 0.14 (AWS IaC), 0.15 (outbound email adapter), 0.16 (Geolocation adapter), 0.17 (auth context layer) promoted to Epic 0; Story 3.3a and Story 3.6b split off Story 3.6; AC corrections adding "via backend GraphQL API" language, KMS encryption note, and a `sourceSocialMediaAccountId` filter dimension.
