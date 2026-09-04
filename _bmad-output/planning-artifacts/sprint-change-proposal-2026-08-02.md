---
backlog_id: CC-003
date: 2026-08-02
trigger_story: epic-3-new-story
scope: Moderate
status: approved
---

# Sprint Change Proposal — Public Social Media Account Event Page

## 1. Issue Summary

The user requested a new Epic 3 story: a public page for viewing events belonging to a single social media account, at a URL like `/{platform-slug}/{accountId}` (e.g. an Instagram account at `/ig/{accountId}`), reusing the discovery page's card/calendar/filter behavior, with the event detail view's account attribution (name + platform icon) linking to it.

Checking this against the PRD surfaced a gap: §3.7 "Display Subscribed Events" only describes the logged-in user's own personalized feed across *all* their subscriptions — there is no requirement anywhere for a public, single-account page reachable by URL. This is new scope, not a restatement of existing scope. The architecture, however, already anticipates it: AD-1 (Unified Query DSL) explicitly names "subscribed account page" as a bound use case and already defines a `socialMediaAccountProfileId` queryable ID field — so no architecture change is needed, only a PRD/epics addition that uses what AD-1 already provides.

Three related gaps surfaced during analysis, all addressed in this proposal:
- `SocialMediaAccountProfile.platform` (PRD §4.5) is a free-text string (e.g. `'Instagram'`), but the URL needs a short, stable slug (`ig`) — this mapping doesn't exist anywhere yet.
- Story 1.6a's reusable event detail component currently only links to the *source post* (original-platform/proxy URLs), not the *account* — showing the account name/icon as a link to the new page is an additive change to that story's AC.
- Per user direction, the URL's account identifier is `SocialMediaAccountProfile.accountId` (the platform-native ID, e.g. a Twitter User ID or Instagram account ID — PRD §4.5's own doc comment), not the internal `id` (uuid). Story 3.1a's table AC never actually adds an `account_id` column, and its lookup-or-create match key is currently `platform + username` — both need amending, since `accountId` is the stable platform identifier this story (and the public URL) depends on, while `username` can be renamed.

## 2. Impact Analysis

- **Epic Impact:** Epic 3 (Social Media Event Integration) gains one new story. Epic 1's Story 1.6a (reusable event detail component, `ready-for-dev`, not started) gets an additive AC. No epic is invalidated, resequenced, or redefined.
- **Story Impact:**
  - New Story 3.11 ("View events for a social media account") — public, unauthenticated page; depends on Story 3.1a (account profiles table), Story 1.3a (events resolver + AD-1 DSL), and the discovery-page component set (1.3b `EventCard`, 1.3c infinite scroll, 1.5a `MultiSelect`, 2.6 calendar view pattern) — reused, not rebuilt.
  - Story 3.1a (`backlog`, not started, no rollback cost) — amended to add an `account_id` (text, platform-native identifier) column, unique per platform, and to switch its lookup-or-create match key from `platform + username` to `platform + accountId`.
  - Story 1.6a (`ready-for-dev`, not started, no rollback cost) — new AC for the account name/platform-icon link, additive alongside its existing source-post attribution link (they link to different destinations: account page vs. original post).
- **Artifact Conflicts:** PRD (§3.4 event-management attribution, §3.7 social media account subscription, §4.5 `SocialMediaAccountProfile` interface note, FR Coverage Map), `epics.md` (Epic 3 story list, Story 3.1a AC, Story 1.6a AC), `sprint-status.yaml` (new backlog entry).
- **Technical Impact:** None to the backend query mechanism — reuses AD-1's existing `socialMediaAccountProfileId` condition, no new endpoint. One new frontend route (`apps/web/src/app/[locale]/[platformSlug]/[accountId]/page.tsx`) and one new small platform→slug mapping table (co-located with the platform-specific scraper adapters per the Adapter Pattern, PRD §3.7). One database migration, but against Story 3.1a which is still `backlog` (unimplemented) — adding `account_id` to a table that doesn't exist yet is a plan amendment, not a schema change against live data.

## 3. Recommended Approach

**Option 1 — Direct Adjustment**, selected. This is purely additive: a new story slotted into Epic 3's existing structure, plus one AC amendment to an unstarted story. No rollback, no MVP scope change, no architecture change (AD-1 already covers the query need). Effort: Low-Medium (mostly frontend route + reused components + one slug-mapping utility). Risk: Low.

## 4. Detailed Change Proposals

### PRD (`prd.md`)

**§3.4 Event Management** — new bullet after 3.3.3 (Source Attribution):

> **3.3.4. Account Attribution:** The event details view will also display the source account's name and platform icon (from `SocialMediaAccountProfile`, Section 4.5). Clicking it navigates to that account's public event page (Section 3.7). This is separate from the source-post attribution links (3.3.3), which point to the original post rather than the account.

**§3.7 Social Media Account Subscription** — new bullet after "Search and Filter":

> **Public Account Page:** Each social media account has its own public, unauthenticated page at `/{platform-slug}/{accountId}` (e.g. an Instagram account at `/ig/{accountId}`), showing every event sourced from that account. This page offers the same card view, calendar view, search, and filtering behavior as the main event discovery page (Section 3.1), reusing its components. Unlike "Display Subscribed Events" above, this page requires no subscription or login — it is a shareable, public view scoped to a single account. `{platform-slug}` is a short, stable slug derived from `SocialMediaAccountProfile.platform` (e.g. `ig` for Instagram); `{accountId}` is `SocialMediaAccountProfile.accountId` (Section 4.5) — the account's platform-native identifier — not the application's internal database id.

**§4.5 SocialMediaAccountProfile Interface** — append a clarifying line to the `accountId` doc comment:

> Persisted as `social_media_account_profiles.account_id` (Story 3.1a) — unique per `platform` — and used as the public identifier in account page URLs (Section 3.7). Distinct from the table's internal `id` (uuid primary key), which is never exposed in a URL.

**FR Coverage Map** — add:
```
- FR68: Epic 3 - Social Media Event Integration
```

### `epics.md`

**FR Coverage Map** (mirrors PRD change above) — add `FR68: Epic 3 - Social Media Event Integration` after the existing `FR67` line.

**Story 3.1a AC** — amended (still `backlog`, not yet built):

> *   `social_media_account_profiles` gets a new `account_id` (text, not null) column — the platform-native identifier (PRD §4.5's `accountId`, e.g. a Twitter User ID or Instagram account ID) — with a unique constraint on (`platform`, `account_id`).
> *   The lookup-or-create match key (previously `platform + username`) is changed to `platform + account_id`, since `account_id` is the platform's stable identifier while `username`/handle can be renamed.
> *   A new, unauthenticated `socialMediaAccountProfileByAccountId(platform, accountId)` query is exposed, returning the profile (including its internal `id`) — this is the lookup Story 3.11's public account page uses to resolve a URL's `platform`+`accountId` to the profile row, and it is deliberately not behind `requireAuth` (Story 0.17), since the account page itself is public.

**Story 1.6a AC** — new bullet appended:

> *   **And** when the event's source account data is available (Story 3.1a's `SocialMediaAccountProfile`, surfaced via the source post's account relation), it displays the account's platform icon and display name; clicking it navigates to that account's public event page (`/{platformSlug}/{accountId}`, Story 3.11, using `SocialMediaAccountProfile.accountId` — not the internal `id`). This is additive to — and independent of — the existing source-post attribution link above, which points to the original post rather than the account.

Plus an **Amendment (2026-08-02, added via bmad-correct-course)** note on both Story 3.1a and Story 1.6a explaining the addition and cross-referencing Story 3.11/FR68.

**New Story 3.11**, appended after Story 3.10 (end of Epic 3 — it has no dependency on the scraping/quota pipeline stories 3.4-3.10, so it doesn't need to sit before them):

> ### Story 3.11: View events for a social media account
>
> **As a** visitor,
> **I want** a dedicated page showing all events sourced from a single social media account,
> **So that** I can browse an account's events directly — e.g. via a shared link — without needing to log in or be subscribed to it.
>
> **Acceptance Criteria:**
>
> *   **Given** a `social_media_account_profiles` row exists (Story 3.1a) with at least one associated event,
> *   **When** I navigate to `/{locale}/{platformSlug}/{accountId}` (e.g. `/en/ig/17841400000000000`), where `platformSlug` is a short, stable slug derived from `SocialMediaAccountProfile.platform` and `accountId` is `SocialMediaAccountProfile.accountId` (Story 3.1a's platform-native identifier — not the internal database `id`),
> *   **Then** I see that account's events rendered with the same card view, calendar view, search, and filter behavior as the main discovery page (Stories 1.3, 1.3b, 1.3c, 1.5, 1.5a, 2.6) — reusing those components rather than re-implementing them.
> *   **And** the page first resolves `platformSlug`+`accountId` to the account profile via Story 3.1a's `socialMediaAccountProfileByAccountId(platform, accountId)` query, then fetches events via the events GraphQL API (Story 1.3a) using the Unified Query DSL's existing `socialMediaAccountProfileId equals <profile.id>` condition (AD-1) — the profile's internal `id`, not its public `accountId`, is what the DSL condition takes; no new query mechanism is introduced for events themselves.
> *   **And** this page requires no authentication and no subscription to the account — both the profile lookup and the events query are publicly accessible given a valid `platformSlug`/`accountId`.
> *   **And** if `platformSlug` matches no known platform, or `socialMediaAccountProfileByAccountId` finds no matching profile, a not-found state is shown rather than an error.
> *   **And** the page sets its title/meta description via `generateMetadata`, per the Dynamic Page Title invariant (project-context.md), using the account's `displayName`.
> *   **And** the platform-to-slug mapping (e.g. Instagram -> `ig`) is defined once in a shared location alongside the platform-specific scraper adapters (PRD §3.7) and reused for routing — not hardcoded per-component.
>
> **Note:** This story exists because of new user-driven scope (`bmad-correct-course`, 2026-08-02) — the PRD previously only described a logged-in user's personalized feed across their subscriptions (§3.7 "Display Subscribed Events"), not a public per-account page. Architecturally unblocked: AD-1 already names "subscribed account page" as a bound use case and already defines the `socialMediaAccountProfileId` DSL field this story's events query needs; the new `socialMediaAccountProfileByAccountId` query (Story 3.1a amendment) is the only new read path, needed because the DSL field takes the profile's internal `id`, not the public-facing `accountId` this story's URL exposes. Cross-referenced by an amendment to Story 1.6a, which links the event detail view's account attribution to this page. New FR68 covers this capability.
>
> **Depends on:** Story 3.1a, Story 1.3a, Story 1.3b, Story 1.3c, Story 1.5a, Story 2.6.

### `sprint-status.yaml`

- Add `3-11-view-events-for-a-social-media-account: backlog` under `epic-3`.

## 5. Implementation Handoff

**Scope: Moderate** — backlog reorganization (a new story slotted into Epic 3, AC amendments to two unstarted stories), no fundamental replan.

- **PRD, `epics.md`, `sprint-status.yaml`:** applied directly by this workflow run, once approved below.
- **Story 3.1a:** patched directly (still `backlog`, not started — no reviewer/rollback impact).
- **Story 1.6a:** patched directly (still `ready-for-dev`, not started — no reviewer/rollback impact).
- **Story 3.11:** left at `backlog` in `sprint-status.yaml` per this project's story lifecycle (`backlog` → story file created via `bmad-create-story` → `ready-for-dev`). Recommend running `bmad-create-story` for Story 3.11 next, once this proposal is approved, to produce its full implementation-ready story file.

## Success Criteria

- PRD, `epics.md`, and `sprint-status.yaml` consistently describe one new capability: a public, per-account event page reachable at `/{platform-slug}/{accountId}` (using `SocialMediaAccountProfile.accountId`), reusing discovery-page components and AD-1's existing account-filter condition via a new lookup query.
- Story 3.1a's story file (once created) includes the `account_id` column, its uniqueness constraint, the revised lookup-or-create match key, and the new `socialMediaAccountProfileByAccountId` query.
- Story 1.6a's story file (once created) reflects the account name/icon link alongside its existing source-post attribution link.
- Story 3.11 is ready for `bmad-create-story` to produce its implementation-ready story file.
