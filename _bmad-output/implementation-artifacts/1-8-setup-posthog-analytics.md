# Story 1.8: Setup PostHog Analytics

## Story Details
- **Epic:** 1 - Core App and Event Discovery
- **Story ID:** 1.8
- **Status:** ready-for-dev

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
- **Cloud/External Service:** Because this story requires a cloud or external service to be setup (PostHog), explicitly include updating steps in `SETUP_WALKTHROUGH.md`.
- **Analytics Foundation:** Ensure the initialization is robust, prevents tracking on server environments incorrectly, and safely skips tracking if the env variables are missing (to not break local dev without keys).

### Project Context Reference
- **Strict TypeScript:** Code must comply with `@festgrid/typescript-config`.
- **App Router:** Ensure compatibility with Next.js 15+ App Router patterns.

## Completion Status
*   Status: ready-for-dev
*   Ultimate context engine analysis completed - comprehensive developer guide created.
