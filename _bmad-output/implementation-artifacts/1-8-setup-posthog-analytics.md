---
baseline_commit: 7d4b335be302c0af7fab07e8d4ef371734b013ad
---

# Story 1.8: Setup PostHog Analytics

## Story Details
- **Epic:** 1 - Core App and Event Discovery
- **Story ID:** 1.8
- **Status:** review

## User Story
**As a** developer/system administrator,
**I want** to integrate PostHog into the application,
**So that** we can start tracking user interactions, page views, and core events across the whole app.

## Acceptance Criteria
*   **Given** I have a PostHog account and project API key,
*   **When** I configure the Next.js application,
*   **Then** a `PostHogProvider` is added to the root layout to initialize PostHog globally.
*   **And** the required environment variables (`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`) are documented in the setup guide.
*   **And** PostHog automatically captures basic page views and interactions.
*   **And** when PostHog environment variables are missing in local development, the app remains functional and analytics calls safely no-op without runtime crashes.
*   **And** event names and event payload properties follow a documented naming convention used consistently across stories.

## Developer Context

### Architecture & Technical Requirements
- **PostHog Integration:** Follow the official PostHog Next.js documentation for App Router to integrate `posthog-js/react`.
- **Environment Variables:**
  - Update `packages/database/.env` and `apps/web/.env` (or whatever the central env file is) with placeholder values for `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`.
  - Update `SETUP_WALKTHROUGH.md` to instruct the developer/user on where to get these keys and how to set them up.
- **Provider Wrapper:** The `PostHogProvider` must be added in a way that respects Next.js 15+ Server Components (it requires a client component wrapper in `layout.tsx`).

### Analytics and Tracking Map (Whole App)
The following events are identified across the epics to be tracked. The provider setup in this story lays the groundwork for these actions:

**Epic 1: Core App & Event Discovery**
- **Main Page Viewed** (Story 1.3)
- **Search Performed** (Story 1.4) - Track the search query.
- **Filter Applied** (Story 1.5) - Track `types` and `categories` selected.
- **Event Details Viewed** (Story 1.6) - Track `eventId` and `eventName`.
- **User Signup / User Login** (Story 1.7) - Trigger `posthog.identify()` with the user's UUID.

**Epic 2: User Personalization**
- **Event Favorited / Event Unfavorited** (Story 2.1)
- **Favorites Page Viewed** (Story 2.2)
- **Location Saved / Location Deleted** (Story 2.3)
- **Nearby Events Searched** (Story 2.5) - Track location name and radius.
- **Calendar Viewed** (Story 2.6)

**Epic 3: Social Media Event Integration**
- **Subscription Added** (Story 3.2) - Track the social media platform and account.
- **Push Notification Toggled** (Story 2.9)

**Epic 4 & 5: Data Quality & Onboarding**
- **Event Manually Corrected** (Story 4.1)
- **Event Reported** (Story 4.3) - Track the reason.
- **Manual Posts Selected for Extraction** (Story 5.2)

### Dev Notes (Custom Rules)
- **State Management:** Because this story requires state management, explicitly categorize the state into No specific state management tier required, but the analytics provider acts as an external side-effect..
- **Cloud/External Service:** Because this story requires a cloud or external service to be setup (PostHog), explicitly include updating steps in `SETUP_WALKTHROUGH.md`.
- **Analytics Foundation:** Ensure the initialization is robust, prevents tracking on server environments incorrectly, and safely skips tracking if the env variables are missing (to not break local dev without keys).

### Project Context Reference
- **Strict TypeScript:** Code must comply with `@festgrid/typescript-config`.
- **App Router:** Ensure compatibility with Next.js 15+ App Router patterns.

## Testing Requirements
- Validate app boot and route navigation with missing PostHog env vars (no crash behavior).
- Validate provider initialization when env vars are present.
- Validate one representative tracked event uses naming convention and expected payload keys.

## Deliverables Checklist
- `PostHogProvider` integration at app root.
- Env var documentation and `.env.example` updates.
- Safe no-op behavior when analytics keys are absent.
- Analytics event naming convention documented and applied.

## Out of Scope
- Full analytics taxonomy governance for all future epics.
- Dashboard/report creation inside PostHog.

## Definition of Done
- Provider is integrated and functional.
- Missing-env local development does not break the app.
- Naming convention exists and is used by implemented analytics events.
- Lint and type checks pass for touched packages.

## Tasks/Subtasks
- [x] Create a new `packages/analytics` workspace package.
- [x] Install `posthog-js` inside `packages/analytics`.
- [x] Implement `PostHogProvider` client component in `packages/analytics` and export it.
- [x] Add `@festgrid/analytics` dependency to `apps/web`.
- [x] Add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` to `apps/web/.env.example` and `packages/database/.env.example`.
- [x] Wrap the children in `apps/web/src/app/layout.tsx` with the `PostHogProvider` from `@festgrid/analytics`.
- [x] Update `SETUP_WALKTHROUGH.md` with instructions on how to set up PostHog keys.

## Dev Agent Record
### Implementation Plan
- Extract PostHog implementation into a dedicated `@festgrid/analytics` package for better isolation in the monorepo.
- Add `PostHogProvider` with a safe initialization check to prevent errors when environment variables are missing during local development.
- Expose `usePostHog` and `PostHogProvider` from `@festgrid/analytics`.
- Integrate `@festgrid/analytics` in `apps/web` root layout.

### Debug Log
- Handled pnpm virtual-store-dir-max-length diff by clearing `node_modules` and doing a fresh install.

### Completion Notes
- The package `@festgrid/analytics` is set up properly with `posthog-js`.
- Root layout in `apps/web` is wrapped with `PostHogProvider`.
- Environment variable placeholders added and instructions updated in `SETUP_WALKTHROUGH.md`.

## File List
- `packages/analytics/package.json`
- `packages/analytics/tsconfig.json`
- `packages/analytics/src/index.ts`
- `packages/analytics/src/posthog-provider.tsx`
- `apps/web/package.json`
- `apps/web/.env`
- `apps/web/.env.example`
- `packages/database/.env`
- `packages/database/.env.example`
- `apps/web/src/app/layout.tsx`
- `SETUP_WALKTHROUGH.md`

## Change Log
- **feat:** Added `@festgrid/analytics` workspace package.
- **feat:** Configured PostHog initialization in `PostHogProvider`.
- **feat:** Wrapped Next.js app layout with `PostHogProvider`.
- **docs:** Updated `SETUP_WALKTHROUGH.md` for analytics setup.

## Completion Status
*   Ultimate context engine analysis completed - comprehensive developer guide created.
