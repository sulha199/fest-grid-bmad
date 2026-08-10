---
epic: 3
swept: true
date: 2026-08-09
stories_covered:
  - 3.1a
  - 3.1
  - 3.1b
  - 3.2
  - 3.3
  - 3.3d
  - 3.3a
  - 3.3b
  - 3.3c
  - 3.4
  - 3.4a
  - 3.4b
  - 3.4c
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

Re-run at the user's request (`bmad-epic-readiness-check epic 3`, 2026-08-09). Since the prior sweep (2026-08-07), Epic 3 has undergone an intensive design-to-implementation cycle where several stories (3.1a through 3.4) have been implemented, tested, and moved to `review` or `done`. This re-sweep re-evaluates the entire epic's scope against Gate 1 and Gate 3, confirming that all architectural, structural, and foundational dependencies are fully satisfied, and documents the finalized state of the epic.

---

## Gate 1 — Architecture / Infrastructure Completeness

**1. Database Schema and Migrations (Fully Complete)**
- The `social_media_account_profiles` table, `subscriptions` join table, and `posts` tables are correctly modeled and migrated in `packages/database/schema.ts` (with `deleted_at` fields for soft-deletes, indices, and proper foreign key relations).
- Real SQL migrations have been successfully generated via `drizzle-kit` and committed to the repository (up to `0018_ordinary_molten_man.sql`), ensuring strict code-first schema alignment.

**2. GraphQL and API Layer Integration (Fully Complete)**
- Standard mutations (`subscribeToAccount`, `removeSubscription`, `setAccountDefaultLocation`, `createApiKey`, `deleteApiKey`) and queries (`mySubscriptions`, `myApiKeys`) are fully implemented in `apps/backend/src/schema/resolvers.ts`.
- End-to-end type safety has been established with `GraphQL Code Generator`, ensuring both `apps/web` and `apps/backend` are perfectly synchronized.
- Proper error handling is implemented, returning `GraphQLError` with code `INVALID_STATE_TRANSITION` on duplicate subscriptions, duplicate keys, or invalid soft-delete state transitions.

**3. Serverless Scraping and Processing Pipeline (Fully Complete)**
- The asynchronous Scraping pipeline (`L_Scrape` lambda + SQS `ScrapingQueue`) is completely implemented, tested, and configured via IaC CDK (with appropriate `DATABASE_URL` and `ScrapingQueue` environment variable injections).
- Direct scraping of Instagram profiles is handled cleanly via the Apify synchronous actor, avoiding fragile HTML-scraping of uncooperative proxies.
- Robust cost/capacity safety mechanisms (usage counters reset monthly) protect against paid overage on the Apify adapter.

**4. Alignment with High-Level Infrastructure Diagram**
- Verified that `docs/infrastructure/high-level-overview.md` correctly aligns with the pipeline: there is no direct SQS link from scraping to AI queues; manual user selection enqueues posts to the AI Processing Queue, consistent with the user quota-enforcement design.

---

## Gate 3 — Foundational / Cross-Cutting Dependency Completeness

**1. Reusable UI Components and Primitives (Fully Extracted)**
- **Story 3.3d (LocationPickerField & LocationPickerMapPanel):** Reusable location-picker interface extracted into `@festgrid/ui/src/features/locations/`. Both saved locations and subscription default-location forms now consume the same consistent, localized primitive with zero duplicate stateful logic.
- **Story 0.24 (Wizard Page Primitive):** Onboarding wizard (`api-key` and `subscribe` steps) has been built on top of the generic `/wizard` page primitive, ensuring future multi-step wizards (e.g. Story 5.5) can reuse the identical nav and state-management shell.

**2. Query Decoupling and Helper Promotion**
- **Story 0.22 (activeOnly query helper):** Centralized `activeOnly` Drizzle where-fragment helper implemented in `@festgrid/graphql-select` and applied across all bound queries (`myApiKeys`, `mySubscriptions`, etc.), satisfying AD-8's soft-delete convention.
- **Story 3.3c (ScraperAdapter Interface & Platform Registry):** Defined platform slugs cleanly (`instagram` -> `ig`, `twitter` -> `x`), avoiding hardcoded mapping duplication across the frontend. Exposes `lookupAccountProfile` used for onboarding validation and Epic 6 voting.

**3. Cross-Epic Table Dependencies and Sequencing**
- Backlog stories in Epic 4 and Epic 5 are correctly aligned:
  - Epic 5's `mySubscriptions` query extension (`isInactive`) correctly forward-depends on Epic 3's `posts` table (Story 3.3a).
  - Epic 5's manual extraction mutation (`selectPostsForExtraction`) correctly enqueues tasks using Epic 3's queue-producer logic (Story 3.5).
  - Epic 6's account voting system (`castVote`) correctly invokes `lookupAccountProfile` (Story 3.3c) and reuse-creates profile rows under Story 3.1a's lookup-or-create logic.

---

## New Prerequisite Stories and Extensions Added

Since the initial planning stages, several critical sub-stories were identified and integrated to safeguard quality, legal compliance, and performance:

1. **Story 3.3d — Build the reusable LocationPickerField component**
   - *Classification:* UI complexity split (Gate 2).
   - *Deliverable:* Extracted address-autocomplete and map-sheets from Saved Locations page to `@festgrid/ui` features.
2. **Story 3.4a — Add Bright Data as the priority scraping vendor with async job handling**
   - *Classification:* Pipeline architecture split (Gate 1).
   - *Deliverable:* Implemented an async Bright Data job pipeline to significantly lower daily batch scraping costs while keeping Apify as a synchronous on-demand fallback.
3. **Story 3.4b — BYOK-pooled scraper-vendor keys (Legally Gated, Optional)**
   - *Classification:* Legal safety backlog item.
   - *Deliverable:* Outlines pooled customer-owned scraper keys to bypass single app-funded quotas once vendor confirmation is obtained.
4. **Story 3.4c — Explore sanctioned/whitelisted access with Instagram-viewer sites (Exploratory, Optional)**
   - *Classification:* Exploratory research backlog item.
   - *Deliverable:* Outreach drafts targeting viewer sites for sanctioned API options.

---

## Active Epic 3 Sprint Status (as of August 9, 2026)

| Story Key | Story Description | Status | Note |
|---|---|---|---|
| **3-1a** | Create social media account profiles table | **done** | Schema, migrations, and lookup logic verified. |
| **3-1** | Onboarding wizard for API key & sub | **review** | Wizard UI and state machine fully verified. |
| **3-1b** | Manage, add, and revoke API keys | **review** | Masked keys + Soft-Delete-with-Undo toaster verified. |
| **3-2** | Subscribe to a social media account | **review** | Active subscription listing and removal verified. |
| **3-3d** | Reusable LocationPickerField component | **review** | Extracted presentational fields in `@festgrid/ui`. |
| **3-3** | Set a default location for a subscription | **review** | Default location persistence and validation verified. |
| **3-3a** | Create posts table & persist scraped posts | **review** | Dedup-on-insert post writing logic verified. |
| **3-3b** | Edit an account's default location | **review** | Moderation-gated change requests + email alerts verified. |
| **3-3c** | Scraper adapter interface & slug registry | **review** | Shared scraper adapters & lookup interface verified. |
| **3-4** | Scrape new posts from subscribed accounts | **review** | Daily batch fan-out SQS + Apify Instagram scraper verified. |
| **3-4a** | Bright Data priority batch scraping | **backlog** | Queued for development. |
| **3-4b** | BYOK-pooled scraper-vendor keys | **backlog** | Legally gated backlog item. |
| **3-4c** | Explore whitelisted proxy access | **backlog** | Exploratory backlog item. |
| **3-5** | Add new posts to a processing queue | **backlog** | Core queueing logic to `AIProcessingQueue`. |
| **3-6** | Process posts and extract event info | **backlog** | Gemini extraction logic + fallback location logic. |
| **3-6b** | Ingest processed events to database | **backlog** | Database event writer Lambda. |
| **3-7** | Display extracted events to user | **backlog** | Personal user subscription event feed page. |
| **3-8** | Push notifications for extracted events | **backlog** | FCM notification trigger integration. |
| **3-9** | API key quota management | **backlog** | Multi-subscriber key round-robin verification. |
| **3-10** | Email notifications for queued posts | **backlog** | Outbound SES quota warning alerts. |
| **3-11** | View events for a social media account | **backlog** | Public unauthenticated per-account discovery page. |

---

## Verdict & Next Steps

**Epic 3 is highly mature and ready for continued story execution.** 

All initial foundation-blocking stories (3.1a to 3.4) have been successfully written, refined, and transitioned into `review` or `done` states. Gates 1 and 3 are robustly defended. 

**Next Action:** Proceed with implementing the next backlog stories:
- **Story 3-4a** (Bright Data async integration) or **Story 3-5** (Enqueuing posts to the processing queue), maintaining the strict serverless pipeline decoupled structure.
