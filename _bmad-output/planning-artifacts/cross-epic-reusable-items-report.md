# Architect Report: Cross-Epic Reusable Items

**Author:** Winston (`bmad-agent-architect`)  
**Date:** 2026-08-02  
**Source:** Epic Readiness Sweeps (`_bmad-output/planning-artifacts/epic-readiness/`)

Based on the readiness sweeps across all Epics, here are the critical reusable data layers, API foundations, and UI components that multiple epics depend on. Building these correctly ensures we do not duplicate effort or create data silos.

## 1. Core API & Infrastructure Adapters (Epic 0 Foundations)

These items are the backbone of the backend and are consumed by almost every subsequent epic:

*   **GraphQL Authenticated-Context Layer (Story 0.17):** Establishes identity and role verification (e.g., `requireAuth`, `requireModerator`) at the GraphQL layer.
    *   *Consumed by:* Epic 2 (Favorites/Locations), Epic 3 (Subscriptions), Epic 4 (Reporting/Corrections), Epic 5 (Manual Quota).
*   **AI Gateway Adapter (Story 0.13):** Wraps Gemini API calls to provide key encryption (KMS), rate limiting, tier-based quota tracking, and round-robin key utilization.
    *   *Consumed by:* Epic 3 (Automated Scraping), Epic 4 (AI-Assisted Corrections), Epic 5 (Manual Extraction).
*   **Outbound Email Adapter (Story 0.15):** A single templated interface for all transactional emails.
    *   *Consumed by:* Epic 3 (Quota Exhaustion Alerts), Epic 4 (Dangerous Event Moderator Alerts).
*   **Geolocation Adapter & Caching (Story 0.16):** Wraps Google Places/Geolocation APIs to prevent repeated quota hits.
    *   *Consumed by:* Epic 2 (Map/Current Location Pickers), Epic 3 (Timezone Inference).

## 2. Shared Data Ownership & Backend APIs

These tables and resolvers were specifically created to prevent different epics from inventing parallel storage for the same entities:

*   **User Settings (Story 2.6a):** A single `user_settings` table for per-user preferences. 
    *   *Consumed by:* Epic 2 (Hide past events config, notification toggles) and Epic 3 (Push notification delivery gates).
*   **Social Media Account Profiles (Story 3.1a):** Centralizes account details rather than tying them to individual user subscriptions. 
    *   *Consumed by:* Epic 3 (Subscription flows) and Epic 4 (DefaultLocationChangeRequest moderator review).
*   **Posts Table (Story 3.3a / 1.2a):** A shared table storing the raw extracted social media post. 
    *   *Consumed by:* Epic 1 (Event Card image display), Epic 3 (Processing pipeline), and Epic 5 (Manual post selection UI).
*   **Soft-Delete Pattern (Story 4.4a):** Introduced `status='soft_deleted'` to the core events table. 
    *   *Consumed by:* Epic 4 (Moderator actions) and read by Epic 1, Epic 2, and Epic 3 (all shared resolvers must exclude these by default).

## 3. Reusable UI Components & Hooks

These frontend primitives ensure the UX remains perfectly consistent across disparate feature sets:

*   **Context-Aware List Navigation Hook (Story 1.6b):** A headless hook providing background pagination and "Next/Previous" item tracking.
    *   *Consumed by:* Epic 1 (Discovery feed detail views), Epic 2 (Favorites and Calendar detail views).
*   **Infinite Scroll Hook (Story 1.3c):** A generic `IntersectionObserver` wrapper for long lists.
    *   *Consumed by:* Epic 1 (Main Feed), Epic 2 (Favorites/Locations), Epic 5 (Manual Post Selection tabs).
*   **Blocking Loader (Story 1.7a):** A global, full-screen mutation-blocking overlay.
    *   *Consumed by:* Epic 1 (OAuth login redirect), Epic 2 (Saving a location), Epic 4 (Submitting reports/corrections).
*   **Dynamic Page Title/Metadata Helper (Story 1.9):** Shared layout pattern resolving `generateMetadata` dynamically via `next-intl`.
    *   *Consumed by:* Every distinct route in Epic 1, Epic 2, Epic 4, and Epic 5.

---

### Architect's Note

When implementing any of these cross-epic items, strictly adhere to the domain boundary rules (e.g., keeping pure logic in `packages/domain` without React/DB bloat, and UI components strictly isolated in `packages/ui`). If any future story requires one of these mechanisms, the developer **must** import the established shared item rather than recreating it.