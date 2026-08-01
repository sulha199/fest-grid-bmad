
---

title: "Product Requirements Document: FestDaily"

status: "draft"

created: "2026-07-10T20:50:17Z"

updated: "2026-08-01T07:15:00Z"

---

# Product Requirements Document: FestDaily

## 1. Introduction

This document outlines the product requirements for FestDaily, a platform designed to help city residents and families discover, schedule, and enjoy local cultural, entertainment, and hobby events. It aims to solve the problem of missed opportunities due to disorganized information and forgotten plans.

## 2. Goals

*   **User Acquisition:** Attract and retain a significant user base of city residents and families.
*   **Engagement:** Increase user interaction with the platform, measured by event discovery, calendar integrations, and social sharing.
*   **Comprehensive Event Coverage:** Provide a diverse and up-to-date listing of cultural, entertainment, and hobby events.
*   **Seamless Event Management:** Offer intuitive tools for scheduling and planning event attendance.

## 3. Features

### 3.1 Event Discovery

*   **Curated Listings:** Display a curated selection of local events.
*   **Search and Filter:** A free-text search bar will allow users to search by event-name, performers, and location name, using partial matching for performance. Users can also filter events by type and category.
*   **Default View:** By default, the event discovery page will only display ongoing and upcoming events.

### 3.2 Personalization Features

*   **3.2.1. Favorite Events:** Users can "favorite" events they are interested in.
*   **3.2.2. Dedicated Favorite Events Page:** A dedicated page will show all favorited events.
*   **3.2.3. Dedicated Added Events Page:** A dedicated page will show all events the user has added to their calendar.

### 3.3 Saved Location Preferences
*   Users can save multiple named locations (e.g., "Home", "Work").
*   A location can be set by using the user's current location or by picking a point on a map.
*   These saved locations can be used to find "nearby events" within a user-defined radius (stored in meters for processing, e.g., 1000m to 50000m, but displayed in kilometers in the UI).

### 3.4 Event Management

*   **3.3.1. Calendar Integration:**
    *   When adding an event to a calendar, users can select which specific schedules to add.
    *   For MVP, this is a one-way integration (app to calendar).
*   **3.3.2. Event Details Centralization:** Consolidate all relevant event information in one place.
*   **3.3.3. Source Attribution:** The event details view will display attribution for, and links back to, the social media post the event was extracted from: the original-platform post (`Post.originalPostUrl`, when the scraper adapter was able to derive it) and/or the source post actually scraped (`Post.postUrl`, which may be a proxy/mirror site — see Section 3.7). Whichever of the two is unavailable for a given post is simply omitted, not shown broken. These are read-only informational links, not editable/correctable fields (see Section 3.9 for corrections).
*   **3.3.4. Account Attribution:** The event details view will also display the source account's name and platform icon (from `SocialMediaAccountProfile`, Section 4.5). Clicking it navigates to that account's public event page (Section 3.7). This is separate from the source-post attribution links (3.3.3), which point to the original post rather than the account.

### 3.5 Global View Rules

*   **3.4.1. Default View:** All event discovery pages (main discovery, subscribed events) will by default only show ongoing and upcoming events.
*   **3.4.2. Personalized Views Past Event Rule:** Events in a user's personal lists ('favorited' or 'added to calendar') will be hidden `N` days after they have passed. `N` is configurable via an environment variable with a default value of 7.

### 3.6 Calendar View Enhancements

*   **3.5.1. Visual Distinction:** "Favorited" and "Added to Calendar" events will have a distinct visual treatment on the calendar.
*   **3.5.2. View Toggles:** The calendar will have toggles to show/hide all "favorited" events and all "added" events.

### 3.7 Social Media Account Subscription

This feature allows users to curate their event feed by subscribing to specific social media accounts.

*   **Scraping Approach (Adapter-Specific):** Posts are scraped via a platform-specific scraper adapter (see Architecture Spine's Adapter Pattern rule). Where a platform blocks direct scraping (e.g. Instagram), the adapter scrapes through a proxy/mirror site instead (e.g. `imginn.com`) and persists the URL it actually fetched (`Post.postUrl`). When the adapter can also determine the canonical original-platform URL for that post (e.g. `imginn.com` preserves Instagram's own post ID, letting the original URL be deterministically derived), it persists that too (`Post.originalPostUrl`). This derivation rule is adapter-specific — a future adapter for a different platform/proxy may need to capture the original URL separately rather than derive it, or may not be able to supply one at all.
*   **Account Subscription:** Users can subscribe to desired social media accounts by providing their own Gemini API Key (BYOK). Event data from these subscribed accounts will be processed by an AI agent to extract event details. For accounts subscribed to by multiple users, the system will intelligently utilize any valid API key from contributing users to optimize data extraction and distribute quota usage.
    *   **Default Location for Subscriptions:** To handle cases where an event's location is implicit (e.g., an event at a mall posted on the mall's social media), users can optionally set a "Default Location" when subscribing to an account. If the AI agent does not find an explicit location in a post, it will use this default location for the event.
        *   **Shared, Account-Level Setting:** A "Default Location" belongs to the social media account, not to an individual subscriber — because AI extraction runs once per post for accounts with multiple subscribers, a per-subscriber default would be ambiguous about which value applies to the resulting event. Any subscriber may set it if unset.
        *   **Immediate Apply with Moderator Oversight:** Editing a "Default Location" takes effect immediately, with no pre-approval gate — extraction is not blocked waiting on review. When a change is made, moderators are notified by email and can, from Moderator Tools (Section 3.9.3), accept the change or revert the account to its previous default location.
*   **Quota Management & Notifications:**
*   **Email Notifications:** Users will receive email notifications if `X` of their subscribed posts have been queued for `Y` days due to Gemini API quota exhaustion. These notifications will suggest contributing an additional API key.
*   **In-App Queue Status:** A dedicated section within the user menu will display the real-time queue status of posts pending extraction for each user, providing transparency on API key performance and quota impact.

> **Note:** The thresholds for notifications and event cancellation are configurable via environment variables. The default values are: `X=3` (posts) and `Y=3` (days) for queue notifications; `N=5` (attempts) for invalid API key notifications; and 3 users reporting within 7 days for event cancellation.

*   **Quota Management Algorithm:** To maximize the number of processed requests and ensure fairness, the following algorithm will be implemented:
    *   **Internal Quota Tracking:** The system will internally track the usage of each API key to inform the fairness algorithm. This tracking will be reset at the beginning of each billing cycle.
    *   **Tier 1: User-Specific Subscriptions:** Requests for social media accounts subscribed to by only one user will be processed first, using that user's API key(s).
    *   **Tier 2: Shared Subscriptions (Round-Robin with Fairness):** For social-media accounts subscribed to by multiple users, a round-robin approach will be used to cycle through the API keys of the subscribing users. To ensure fairness, the algorithm will prioritize keys from users who have contributed fewer API calls in the current billing cycle.
    *   **Multiple API Keys:** If a user provides multiple API keys, the system will treat them as a pool of resources for that user, cycling through them as needed.
    *   **Key Failure:** If a user's key fails or is rate-limited, it will be temporarily skipped, and the next user's key in the round-robin will be used.
*   **Display Subscribed Events:** Events extracted from a user's social media accounts will be displayed to the user.
    *   **View Options:** Users can view these events in a calendar-view (default) or a card-view.
        *   **Calendar View Behavior:**
            *   Each schedule within an `EventInfo` object will be displayed as a separate, clickable item in the calendar.
            *   The title of the calendar item will be formatted as follows:
                *   If `isMainSchedule` is `true`, the title will be the `eventName`.
                *   If `isMainSchedule` is `false`, the title will be a combination of the event name and the schedule title, in the format: `eventName - schedule.title`.
            *   Clicking on any schedule item in the calendar will open a detail view for the entire event, with all its schedules listed. The selected schedule may be highlighted for context.
*   **Search and Filter:** A free-text search bar will allow users to search events from their subscribed accounts by event name, performers, and location name. Users can also filter events by type, category, and the specific social media account source.
*   **Public Account Page:** Each social media account has its own public, unauthenticated page at `/{platform-slug}/{accountId}` (e.g. an Instagram account at `/ig/{accountId}`), showing every event sourced from that account. This page offers the same card view, calendar view, search, and filtering behavior as the main event discovery page (Section 3.1), reusing its components. Unlike "Display Subscribed Events" above, this page requires no subscription or login — it is a shareable, public view scoped to a single account. `{platform-slug}` is a short, stable slug derived from `SocialMediaAccountProfile.platform` (e.g. `ig` for Instagram); `{accountId}` is `SocialMediaAccountProfile.accountId` (Section 4.5) — the account's platform-native identifier — not the application's internal database id.
*   **Personalized Reminders:** Event data processed from subscribed accounts will be used to generate personalized event reminders.
*   **Timezone Inference:** When an event's timezone is not explicitly provided, the system will infer it using the following strategies, in order of preference:
    *   **Location-based Inference:** The event's location will be used to determine the timezone via a standard geolocation service. To manage API costs and limits, results from the geolocation service will be cached.
    *   **User's Timezone:** If the location is unavailable or ambiguous, the timezone of the user who subscribed to the event source will be used as a fallback.
    *   **Manual Clarification:** If the timezone cannot be determined with high confidence, the event will be flagged for the user to provide clarification.
*   **API Key Validity & Notifications (Reactive):**
    *   **Reactive Validation:** API keys are validated reactively. If an API key encounters an "invalid API key" error during data extraction, the system records this attempt.
    *   **Invalid Key Attempts:** The system tracks consecutive invalid API key attempts. Once a configurable limit (`N`) is reached, an email notification is sent to the user explaining the issue and its impact.
    *   **Key Rollover:** For accounts subscribed to by multiple users, if one user's API key becomes invalid, the system will attempt to use a valid API key from another subscribing user to continue data extraction for that shared account.
    *   **Attempt Reset:** The count of invalid key attempts is reset upon successful data extraction.
    *   **Feature Impact:** Users with an invalid API key will cease to receive push notifications for events from accounts relying on their specific key. However, they will still see available data and data fetched by other users' valid keys for shared subscriptions.

### 3.8 Gemini API Management and Capacity

To ensure reliable and stable operation while adhering to Google Gemini API usage policies, FestDaily will implement comprehensive API management and capacity planning strategies:

*   **Proactive Throttling and Queuing:** All requests to external AI services (like the Gemini API) will be routed through a dedicated **AI Gateway** layer. This layer implements dynamic throttling and intelligent queuing using a decoupled, multi-queue architecture (`ScrapingQueue`, `AIProcessingQueue`, `DataIngestionQueue`). This approach allows for resilience and independent scaling. The gateway will manage the rate of outgoing requests based on rules defined within an **Adapter** for each AI service, preventing rate limit violations and mitigating suspicious activity flags.
*   **Suspicious Activity Mitigation:** The system is designed to proactively mitigate risks associated with "suspicious activity" flags from Google. This includes intelligently distributing API calls across available valid keys, introducing strategic delays, and implementing back-off algorithms to gracefully handle temporary API issues without triggering broader service disruptions.
*   **MVP Capacity Limitations:** For the Minimum Viable Product (MVP), operating with a single backend server instance, there will be a finite capacity for the total number of social media accounts that can be actively subscribed and processed. This limit is dictated by factors such as the available Gemini API quotas (QPM/QPD), the average processing time required per subscribed account, and the overall server resources.
*   **User Notification for Capacity Limits:** When the MVP's capacity limit for new social media account subscriptions is reached, users attempting to add further subscriptions will be gracefully informed via an in-app message that they cannot add more accounts at this time. The message will explain that this is due to current server capacity and that new subscriptions will be enabled once additional backend servers are provisioned or horizontal scaling is implemented.
*   **Capacity Calculation Formula:** A key architectural requirement is the definition and implementation of a clear, verifiable formula or methodology to calculate the maximum sustainable number of subscribed social media accounts per backend server instance. This formula will be defined in detail during the architectural planning phase. It will quantify the relationship between Gemini API quotas, average data extraction frequency, processing load, and system throughput. It will serve as the basis for capacity planning, informing decisions on when and how to scale the backend infrastructure horizontally.

### 3.9 Manual Event Data Correction and User Reporting

To ensure data quality, allow for human intervention, and empower users to contribute to content accuracy, FestDaily incorporates a comprehensive manual event data correction and user reporting system. This system aims to address cases where automated extraction falls short or where event details change or become invalid.

#### 3.9.1 Manual Correction with Typed Inputs

To ensure data accuracy and streamline the correction process, users can submit corrections through a structured form with typed inputs for each field of the `EventInfo` and `Schedule` interfaces. This approach minimizes ambiguity and reduces the need for complex NLP.

*   **Correction Interface:** A dedicated correction interface will present users with a form that mirrors the structure of the event data. Each field will have the appropriate input type (e.g., text input for `eventName`, date picker for `eventStartDate`, etc.).

*   **Data Inconsistency Checks:** Before submitting a correction, the system will perform the following inconsistency checks:
    *   **Date and Time Logic:** `eventEndDate` must not be earlier than `eventStartDate`. `eventEndTime` must be later than `eventStartTime` if the dates are the same.
    *   **Schedule Consistency:** If a `Schedule` has a specific `location`, it should be verified against the main `location` of the event if provided.

*   **AI-Assisted Correction (Optional):** For users with a BYOK key, an optional feature will allow them to provide a URL to a social media post. The AI agent will then attempt to extract the correct information and pre-fill the correction form, which the user can then review and approve.

*   **Context for Corrections:** This feature is particularly valuable in the following scenarios:
    *   **Cron Job Failure / Empty Event Data:** An event, initially processed by an automated cron job, returns with empty event data, and a user subsequently provides a correction that successfully returns event data.
    *   **Inaccurate Event Data from Cron:** An event, initially processed by an automated cron job, returns with event data, but a user identifies it as inaccurate and provides specific correction details.

#### 3.9.2 User Reporting and Event Moderation

A 'Report' button will be available for all events (whether from Social Media Account Subscription or the main event discovery page, in list-view or detailed view). Unauthenticated users will need to log in to access the reporting functionality. Upon clicking, a popup will offer the following options:

*   **Request Event Deletion (Soft Delete):** Users can request the removal of an event by selecting a reason.
    *   **Reason: Event Cancelled:**
        *   The reporting user will immediately no longer see the event.
        *   If at least a configurable number of unique users (default: 3) report the same event as cancelled within a configurable number of days (default: 7), it will be soft-deleted and removed from public view by default.
        *   A moderator is required to explicitly mark the event as *not cancelled* to restore it to public view.
    *   **Reason: Dangerous, Illegal, or Similar Extreme Situation Event:**
        *   The reporting user will immediately no longer see the event.
        *   An admin/moderator will be notified immediately to verify the event's nature.
        *   If the moderator marks the event as safe, subsequent similar reports from the *same* requesting user for that specific event will be ignored, though the event will remain hidden for that user.
    *   **Reason: Personal:**
        *   The reporting user will immediately no longer see the event. This action only affects the individual user's view and does not impact the event's visibility for other users.

#### 3.9.3 User and Moderator Interfaces

*   **User Reports Page:** Authenticated users will have access to a dedicated 'Reports' page under their user menu, displaying the status and history of their submitted reports.
*   **Moderator Tools:** For users with a 'moderator' access level, a 'Moderator Items' page will be available under the user menu. For the MVP, moderator access levels will be assigned manually via the database. In addition to user reports, this page surfaces pending "Default Location" changes (Section 3.7) for a moderator to accept or revert.

### 3.10 Manual Post Selection for Event Extraction

To provide users with greater control over their API quota usage and improve the relevance of extracted events, FestDaily will offer a manual post selection feature. This allows users to choose which specific social media posts should be processed by the AI agent.

*   **User Interface:** A new screen will be introduced, featuring a tab-based layout where each tab corresponds to one of the user's subscribed social media accounts.
    *   **Tab Content:** Each tab, when selected, will display a list of the 20 most recent posts from that account, presented in a card-based view.
    *   **Lazy Loading:** The posts within the tabs can be loaded lazily to improve initial page load performance.
*   **Post Selection:**
    *   Users can select multiple posts by clicking a checkbox on each post card.
    *   The selection state is preserved as the user navigates between different tabs.
    *   Posts that have already been processed and resulted in an event will be visually disabled and cannot be selected for re-extraction.
*   **Quota Management:**
    *   A summary bar will display the number of selected posts against the user's remaining API quota (e.g., "Selected Posts: 5 / 50").
    *   The system will prevent users from extracting more posts than their quota allows.
*   **Inactive Account Handling:**
    *   If a subscribed account has not published any posts within a configurable period (e.g., 30 days), a warning icon will be displayed on its tab.
    *   The tab's content will show a warning message and a button allowing the user to remove the inactive subscription.
*   **Wizard Integration:**
    *   The manual post selection screen is integrated as a new step in the getting started wizard, appearing after the user adds their subscriptions.
    *   When a user adds a new subscription, it will be marked as `isNewlyAdded`, and the corresponding tab will be automatically activated in the selection screen.
*   **Menu Access:**
    *   Users can also access this feature via an "Extract event from post(s)" item in the user menu. If the user has not yet provided an API key or subscribed to any accounts, they will be guided through the necessary steps of the wizard first.

### 3.11 Getting Started and Onboarding

FestDaily will be accessible as a web application from any browser. Users can sign up for free to immediately begin exploring events. For enhanced features, such as subscribing to social media accounts for event extraction, users have the option to integrate their own Isolated Bring Your Own Key (BYOK) Gemini API key. Users are responsible for the validity and quota management of their BYOK Gemini API keys. We will provide clear, step-by-step guides and direct links to assist users with the setup process, ensuring they can unlock FestDaily's full potential if they choose.

### 3.12 Global UI & Navigation Patterns

To ensure a high-quality, app-like experience, the following global UI patterns apply across the platform:

*   **Loaders:**
    *   **Blocking:** Critical asynchronous actions (e.g., submitting forms, data extraction, reporting) will use a full-screen semi-transparent overlay with a spinner to prevent user interaction until the process completes.
    *   **Non-Blocking:** Initial page data fetching will utilize Skeleton screens that mirror the expected content layout. Fetching subsequent data (e.g., infinite scroll) will use a localized spinner at the bottom of the list.
*   **Infinite Scroll (Autoscroll):** All long lists (e.g., Main Discovery Feed, Favorites, Manual Post Selection, My Calendar) must implement infinite scrolling to seamlessly append data as the user scrolls, rather than requiring traditional pagination clicks.
*   **Context-Aware Detail Views:** 
    *   When a user clicks on an item in a list to view its details, the detail view must provide "Next" and "Previous" navigation controls.
    *   This navigation operates within the exact context of the list the user originated from, respecting active search queries, filters, and sort orders.
    *   If a user clicks "Next" and reaches the end of the currently fetched page of data, the system will automatically fetch the next page of results in the background, ensuring uninterrupted navigation.
    *   *Exception:* This context-aware navigation is not required if the detail view is accessed via a direct deep-link URL (i.e., without prior list context).

## 4. Event Data Schema

This section defines the data structure for events extracted and managed by FestDaily.

### 4.1. EventInfo Interface

```typescript
enum EventType {
  EXHIBITION,         // Art shows, trade shows
  COMPETITION,        // Tournaments, contests
  FESTIVAL,           // Multi-day cultural or music festivals
  PERFORMANCE,        // Concerts, plays, stand-up
  WORKSHOP,           // Classes, hands-on activities
  SEMINAR,            // Talks, lectures, conferences
  MARKET,             // Farmers' markets, bazaars
  GATHERING,          // Community meetups, parties
  PROMOTION,          // Product launches, sales events
  FUNDRAISER,         // Charity events, galas, auctions (New)
  CIVIC,              // Town halls, public forums (New)
  OTHER
}

enum EventCategory {
  MUSIC,
  ARTS_AND_CULTURE,
  FOOD_AND_DRINK,
  SPORTS_AND_FITNESS,
  FAMILY_AND_KIDS,
  HOBBIES_AND_INTERESTS,
  BUSINESS_AND_NETWORKING,
  HEALTH_AND_WELLNESS,
  HOLIDAY,
  CHARITY_AND_CAUSES,     // Fundraisers, non-profit events (New)
  CIVIC_AND_COMMUNITY,    // Town halls, local government, volunteering (New)
  RELIGION_AND_SPIRITUALITY, // Worship services, retreats, interfaith gatherings (New)
  OTHER
}

/**
 * Represents the information extracted from an event poster.
 */
interface EventInfo {
  /**
   * True if the image is an event poster.
   */
  isEvent: boolean;
  /**
   * The name of the event.
   */
  eventName: string;
  /**
   * A list of types for the event.
   */
  types: EventType[];
  /**
   * A list of categories for the event.
   */
  categories: EventCategory[];
  /**
   * A list of schedules for the event.
   */
  schedules: Schedule[];
  /**
   * The general location of the event.
   */
  location: string;
  /**
   * The organizer of the event.
   */
  organizerName?: string;
  /**
   * Contact information for the event.
   */
  contactInfo?: string;
  /**
   * A description of the event.
   */
  description?: string;
  /**
   * A unique identifier for the event, generated automatically as a UUID by the PostgreSQL database.
   */
  id: string;
  /**
   * A unique, URL-friendly slug initially generated using Nano ID, with support for manual custom modification post-MVP.
   */
  slug: string;
  /**
   * A score from 0.0 to 1.0 indicating the AI's confidence in the accuracy of the extracted data.
   */
  confidenceScore?: number;
  /**
   * The ID of the SocialMediaAccountProfile that was the source of this event.
   */
  sourceSocialMediaAccountId?: string;
  /**
   * The ID of the `Post` (see the `Post` interface, Section 4.7) this event was extracted from, if any.
   * EventInfo intentionally has no image field of its own — an event's image is resolved via this
   * relation, from the source post's `imageUrl`. The event details view also uses this relation to
   * surface attribution and links back to the source post's `postUrl`/`originalPostUrl` (Section 3.3.3).
   */
  postId?: string;
  /**
   * Indicates if the event has been favorited by the current user.
   * This is a user-contextual field added at runtime.
   */
  isFavorited?: boolean;
  /**
   * Indicates if the event has been added to the current user's calendar.
   * This is a user-contextual field added at runtime.
   */
  isAddedToCalendar?: boolean;
  /**
   * Timestamp of a soft-delete (e.g., an upheld cancellation report, Section 3.9.2).
   * Absent/undefined means the event is active. Soft-deleted events are excluded
   * from all discovery/list views by default.
   */
  deletedAt?: string;
}
```

### 4.2. Coordinates Interface

```typescript
/**
 * Represents geographical coordinates.
 */
interface Coordinates {
  latitude: number;
  longitude: number;
}
```

### 4.3. LocationDetails Interface

```typescript
/**
 * Represents detailed information about a location from a geolocation service.
 */
interface LocationDetails {
  /**
   * The geographical coordinates of the location.
   */
  coordinates: Coordinates;
  /**
   * The name of the place (e.g., "The Grand Mall").
   */
  placeName?: string;
  /**
   * The unique identifier for the place from the geolocation provider (e.g., Google Place ID).
   */
  placeId?: string;
  /**
   * The full, formatted address of the location.
   */
  formattedAddress?: string;
  /**
   * The IANA time zone name for this location (e.g., "Europe/Paris").
   */
  timezone?: string;
}
```

### 4.4. Schedule Interface

```typescript
/**
 * Represents a single schedule for an event.
 */
interface Schedule {
  /**
   * Indicates if this is the main schedule for the event.
   */
  isMainSchedule: boolean;
  /**
   * The start date of the event in YYYY-MM-DD format.
   */
  eventStartDate: string;
  /**
   * The title of the schedule.
   */
  title?: string;
  /**
   * The end date of the event in YYYY-MM-DD format.
   */
  eventEndDate?: string;
  /**
   * The start time of the event in HH:MM format.
   */
  eventStartTime?: string;
  /**
   * The end time of the event in HH:MM format.
   */
  eventEndTime?: string;
  /**
   * A list of performers or artists at the event.
   */
  performers?: string[];
  /**
   * The location of the event for this specific schedule.
   */
  location?: string;
  /**
   * The ticket price for this schedule.
   */
  ticketPrice?: string;
  /**
   * Detailed information about the event's location.
   */
  locationDetails?: LocationDetails;
  /**
   * A unique identifier for the schedule within the event, generated automatically as a UUID by the PostgreSQL database.
   */
   id: string;
  /**
   * A unique, URL-friendly slug initially generated using Nano ID, with support for manual custom modification post-MVP.
   */
   slug: string;
  /**
   * The ID of the parent `EventInfo` this schedule belongs to.
   */
   eventId: string;
  }
  ```

### 4.5. SocialMediaAccountProfile Interface

```typescript
/**
 * Represents a normalized profile for a subscribed social media account.
 * This data is stored to allow users to select from existing shared accounts,
 * particularly for the 'free_user' tier feature.
 */
interface SocialMediaAccountProfile {
  /**
   * Unique identifier for the account on its platform (e.g., Twitter User ID, Facebook Page ID).
   * Persisted as `social_media_account_profiles.account_id` (Story 3.1a) — unique per `platform` —
   * and used as the public identifier in account page URLs (Section 3.7). Distinct from the
   * table's internal `id` (uuid primary key), which is never exposed in a URL.
   */
  accountId: string;
  /**
   * The social media platform (e.g., 'Twitter', 'Facebook', 'Instagram').
   */
  platform: string;
  /**
   * The user-friendly display name (e.g., 'The Music Hall').
   */
  displayName: string;
  /**
   * The account's handle or username (e.g., '@musichall').
   */
  username: string;
  /**
   * URL for the profile picture.
   */
  profileImageUrl?: string;
  /**
   * A brief description or bio of the account.
   */
  description?: string;
  /**
   * A flag to indicate if the subscription was just added. Used to auto-activate the tab in the post selection screen.
   * This is a client-side state property.
   */
  isNewlyAdded?: boolean;
  /**
   * The date of the last post from this account. Used to identify inactive accounts.
   */
  lastPostDate?: string;
  /**
   * The default location used to backfill an event's location when a post's
   * location is implicit (Section 3.7). Account-level and shared across every
   * subscriber of this account — not per-user — because AI extraction runs once
   * per post for shared accounts, so a per-subscriber value would be ambiguous
   * about which one applies. Changing it applies immediately; see Section 3.7
   * for the moderator notify/accept/revert flow, and `DefaultLocationChangeRequest`
   * (Section 4.14) for the audit trail.
   */
  defaultLocation?: LocationDetails;
}
```

### 4.6. UserLocationPreference Interface

```typescript
/**
 * Represents a user's saved location preference.
 */
interface UserLocationPreference {
  /**
   * A unique identifier for the location preference, generated automatically as a UUID by the PostgreSQL database.
   */
  id: string;
  /**
   * The ID of the user who owns this preference.
   */
  userId: string;
  /**
   * A human-readable name for the location (e.g., "Home", "Work").
   */
  name: string;
  /**
   * The geographical coordinates of the location.
   */
  coordinates: Coordinates;
  /**
   * The search radius, Stored in meters for processing, displayed in kilometers (e.g., between 1 and 50).
   */
   radius: number; // 

}
```

### 4.7. Post Interface

```typescript
/**
 * Represents a social media post to be displayed for selection, and — when it yields an
 * extracted event — the source an `EventInfo` links back to via `EventInfo.postId` (Section 4.1),
 * which is how an event's image (`imageUrl`) and source attribution links (`postUrl`/
 * `originalPostUrl`, Section 3.3.3) are resolved.
 */
interface Post {
  /**
   * A unique identifier for the post, generated automatically as a UUID by the PostgreSQL database.
   */
  id: string;
  /**
   * The content (text) of the post.
   */
  content: string;
  /**
   * The URL of the image in the post, if any.
   */
  imageUrl?: string;
  /**
   * The URL the scraper adapter actually fetched this post from. For platforms scraped via a
   * proxy/mirror (e.g. Instagram via `imginn.com`), this is the proxy URL, not the original
   * platform's URL (Section 3.7).
   */
  postUrl: string;
  /**
   * The canonical original-platform URL for this post, when the scraper adapter is able to
   * determine it (e.g. derived from a post ID/shortcode shared with the proxy site). Nullable —
   * not every adapter can supply this for every post (Section 3.7).
   */
  originalPostUrl?: string;
  /**
   * True if the post has already been processed and an event has been extracted.
   */
  isExtracted?: boolean;
  /**
   * The ID of the `SocialMediaAccountProfile` (Section 4.5) that published this post.
   */
  accountId: string;
}
```

### 4.8. User Interface

```typescript
enum UserTier {
  CONTRIBUTING_USER,  // BYOK, Phase 1 (Section 6)
  FREE_USER,          // managed key pool, Phase 2 (Section 6)
}

enum UserRole {
  USER,
  MODERATOR,          // assigned manually via the database for MVP (Section 3.9.3)
}

/**
 * Represents a platform user. `id` mirrors the Supabase Auth user ID (1:1) —
 * this interface holds the app-domain profile data that Auth itself doesn't own.
 */
interface User {
  id: string;
  email: string;
  displayName?: string;
  tier: UserTier;
  role: UserRole;
  /**
   * Fallback timezone used for event timezone inference when location-based
   * lookup is unavailable or ambiguous (Section 3.7, "User's Timezone").
   */
  timezone?: string;
  /**
   * The user's preferred locale.
   */
  locale?: string; // 'en' | 'id' (Section 5, Internationalization)
  createdAt: string;
}
```

### 4.9. Subscription Interface

```typescript
/**
 * Join entity representing a user's subscription to a `SocialMediaAccountProfile`
 * (Section 4.5). A single account can have many subscribing users (Section 3.7).
 */
interface Subscription {
  id: string;
  /**
   * The ID of the subscribing `User` (Section 4.8).
   */
  userId: string;
  /**
   * The ID of the `SocialMediaAccountProfile` (Section 4.5) being subscribed to.
   */
  accountId: string;
  createdAt: string;
  /**
   * Timestamp of a soft-delete. Unsubscribing sets this instead of removing the row,
   * preserving history for quota/fairness accounting (Section 3.7).
   */
  deletedAt?: string;
}
```

### 4.10. Favorite Interface

```typescript
/**
 * Join entity representing a user's favorited event (Section 3.2.1). Unique per
 * (userId, eventId).
 */
interface Favorite {
  id: string;
  /**
   * The ID of the `User` (Section 4.8) who favorited the event.
   */
  userId: string;
  /**
   * The ID of the favorited `EventInfo` (Section 4.1).
   */
  eventId: string;
  createdAt: string;
  /**
   * Timestamp of a soft-delete. Un-favoriting sets this instead of removing the
   * row; re-favoriting clears it rather than inserting a new row.
   */
  deletedAt?: string;
}
```

### 4.11. CalendarEntry Interface

```typescript
/**
 * Join entity representing a single schedule a user has added to their calendar
 * (Section 3.3.1). One row per schedule, not per event, because users select
 * which specific schedules to add and the calendar view treats each `Schedule`
 * as its own clickable item (Section 3.7). Unique per (userId, scheduleId).
 */
interface CalendarEntry {
  id: string;
  /**
   * The ID of the `User` (Section 4.8) who added the schedule.
   */
  userId: string;
  /**
   * The ID of the parent `EventInfo` (Section 4.1). Denormalized from `scheduleId`
   * to support querying "all added schedules for this event" directly.
   */
  eventId: string;
  /**
   * The ID of the added `Schedule` (Section 4.4).
   */
  scheduleId: string;
  createdAt: string;
  /**
   * Timestamp of a soft-delete. Removing an event from the calendar sets this
   * instead of removing the row.
   */
  deletedAt?: string;
}
```

### 4.12. Report Interface

```typescript
enum ReportReason {
  CANCELLED,
  DANGEROUS,
  PERSONAL,
}

enum ReportStatus {
  PENDING,    // awaiting threshold (cancelled) or moderator action (dangerous)
  UPHELD,     // event soft-deleted / kept hidden
  DISMISSED,  // moderator restored the event / marked it safe
}

/**
 * Represents a user report against an event (Section 3.9.2), and its
 * moderation outcome.
 */
interface Report {
  id: string;
  /**
   * The ID of the reported `EventInfo` (Section 4.1).
   */
  eventId: string;
  /**
   * The ID of the `User` (Section 4.8) who filed the report.
   */
  reportingUserId: string;
  reason: ReportReason;
  status: ReportStatus;
  createdAt: string;
  /**
   * The ID of the moderator `User` (role = MODERATOR) who resolved the report, if any.
   */
  resolvedByModeratorId?: string;
  resolvedAt?: string;
}
```

### 4.13. ApiKey Interface

```typescript
enum ApiKeyStatus {
  VALID,
  INVALID,
}

/**
 * Represents a user-contributed BYOK API key (Section 3.7, 3.11). `encryptedKey`
 * is KMS ciphertext only — decrypted in memory at call time, never logged or
 * stored in plaintext (see Section 5, Security).
 */
interface ApiKey {
  id: string;
  /**
   * The ID of the owning `User` (Section 4.8).
   */
  userId: string;
  /**
   * The external AI service this key belongs to (e.g. "gemini"). A string rather
   * than an enum so the Adapter pattern (Section 5) can add providers without a
   * schema migration.
   */
  provider: string;
  encryptedKey: string;
  status: ApiKeyStatus;
  /**
   * Consecutive invalid-key attempts. Reset to 0 on successful extraction;
   * triggers a notification at the configurable threshold `N` (default 5, Section 3.7).
   */
  consecutiveInvalidAttempts: number;
  /**
   * Internal usage count for the current billing cycle, feeding the Tier 2
   * round-robin fairness algorithm (Section 3.7).
   */
  usageCountCurrentCycle: number;
  billingCycleResetAt: string;
  createdAt: string;
}
```

### 4.14. DefaultLocationChangeRequest Interface

```typescript
enum DefaultLocationChangeStatus {
  PENDING_REVIEW,
  ACCEPTED,
  REVERTED,
}

/**
 * Audit and moderation-queue record for edits to
 * `SocialMediaAccountProfile.defaultLocation` (Section 4.5). The change applies
 * immediately on write; this record is what a moderator reviews and acts on —
 * accepting keeps `newLocation`, reverting restores `previousLocation`
 * (Section 3.7, Section 3.9.3).
 */
interface DefaultLocationChangeRequest {
  id: string;
  /**
   * The ID of the affected `SocialMediaAccountProfile` (Section 4.5).
   */
  accountId: string;
  /**
   * The ID of the `User` (Section 4.8) who made the change.
   */
  changedByUserId: string;
  previousLocation?: LocationDetails;
  newLocation: LocationDetails;
  status: DefaultLocationChangeStatus;
  /**
   * The ID of the moderator `User` (role = MODERATOR) who reviewed the change, if any.
   */
  reviewedByModeratorId?: string;
  reviewedAt?: string;
  createdAt: string;
}
```

## 5. Non-Functional Requirements

### Performance
*   **Page Load Time (PLT):** Event discovery page should load in under 2 seconds on a standard 4G connection.
*   **Time to Interactive (TTI):** Key interactive elements, like the search bar and filters, should be interactive within 1.5 seconds.
*   **API Response Time:** 95% of API calls should complete in under 500ms.

### Scalability (MVP)
*   The system should be able to handle 100 concurrent users with a response time degradation of no more than 15%.
*   The event ingestion pipeline should be able to process 100 events per hour.
*   The architecture should be designed to be horizontally scalable to accommodate future growth.

### Reliability
*   **Uptime:** The service should have 99.9% uptime (max ~43 minutes of downtime per month).
*   **Error Rate:** Server-side error rate should be below 0.5%.

### Usability
*   **Task Completion Rate:** At least 90% of users should be able to add an event to their calendar in their first session without assistance.
*   **System Usability Scale (SUS):** Target a SUS score of 75 or higher.

### External API Management
*   The application relies on external APIs (e.g., Google Gemini, Google Geolocation) and must manage them responsibly. An Adapter pattern will be used for AI services to allow for future flexibility in swapping models.
    *   **API Key Security:** All API keys must be stored securely in environment variables and must not be committed to the source code repository, especially since the project is open source. Documentation for self-hosting should instruct users to provide their own keys.
    *   **API Key Restriction:** To minimize the impact of a potential key leak, all API keys should be restricted in the Google Cloud Console. This includes applying API restrictions (e.g., only allowing the Geolocation API) and Application restrictions (e.g., by HTTP referrer or IP address).
    *   **Quota Management:** To stay within the free tier limits of external APIs like Google Geolocation, a caching mechanism will be implemented. Lookups for the same location will be served from the cache to minimize redundant API calls.

### AI Extraction Quality
*   All AI-driven event extractions must produce a `confidenceScore` along with the `EventInfo` data. Events with a score below a defined threshold will be automatically flagged for human review to ensure data quality.

### Security
*   User data and privacy must be protected with industry-standard security measures. When BYOK Gemini API keys are used server-side for event data extraction, they will be securely stored and managed with robust encryption and access controls. Your personal data and event preferences are used solely to personalize your experience within the app; we do not spam your calendar, sell your data to third parties. Crucially, our 'add to calendar' feature works one-way, simply adding selected events to your calendar without accessing its existing content. We absolutely do not read your personal calendar content.

### Analytics
*   The platform will use **PostHog** to collect product analytics, track user interaction events, and optionally record session replays. This provides a modern alternative to Google Analytics, tailored for deep product usage insights, while allowing anonymization of user data to measure key performance indicators and improve the service.

### User Experience (Capacity Limits)
*   The system must gracefully inform users when they encounter temporary limitations, such as reaching the maximum number of social media account subscriptions due to current backend server capacity. Clear, actionable in-app messages will guide users and manage expectations regarding future scaling.

### Event Status Updates
*   Users are advised to independently verify event status (e.g., cancellations, rescheduling) with official organizers, as real-time tracking from diverse sources presents inherent challenges.

### Internationalization
*   For the MVP, the platform will support Indonesian and English. The layout must be designed to support both Left-to-Right (LTR) and Right-to-Left (RTL) languages to facilitate future expansion.

## 6. Monetization Strategy

FestDaily will launch with a two-phase rollout to manage costs and build a valuable data foundation before scaling. This model defines two primary user roles: `Contributing User` and `Free User`.

*   **Phase 1: Invitation-Only Beta (`contributing_user` Tier):** The initial release will be for `contributing_user`s who operate on a Bring-Your-Own-Key (BYOK) model. These early adopters provide their own API key to subscribe to any public social media account. This strategy allows us to test the core technology while these users help seed the platform with a diverse range of `Shared Public Accounts` at no AI-processing cost to the platform.

*   **Phase 2: Public Launch (`free_user` Tier):** Once a critical mass of shared accounts is established, a `free_user` tier will be introduced. These users can subscribe to a limited number (e.g., 2) of popular `Shared Public Accounts`. The platform will use a managed pool of API keys to handle processing for these shared accounts, ensuring reliability.

*   **Core Feature Access:** The core event discovery (for non-subscription events) and management features will remain free for all users.

*   **Future Premium Features (for Event Organizers - Post-MVP):** Implement features allowing event organizers to promote their events, such as appearing at the top of event discovery pages. This will function similarly to an advertising schema, enabling organizers to target users based on their interest in event type, category, and user geolocation. To facilitate this, as part of the post-MVP monetization strategy, we will collect user data related to their event interest (type, category) and geolocation. This data collection will be strictly anonymized and aggregated where possible, and users will be provided with clear opt-out mechanisms and transparency regarding data usage, fully adhering to our stated privacy principles. This feature is planned for a phase beyond the Minimum Viable Product (MVP) and will not affect the free core experience for end-users.
*   **Localized Advertising:** Non-intrusive, highly relevant advertising based on location and event type.
*   **Partnerships:** Collaborate with city tourism boards and local businesses.

## 7. Key Performance Indicators (KPIs)

*   **User Acquisition:** New sign-ups, weekly active users (WAU), monthly active users (MAU).
*   **Engagement:** Average session duration, events added to calendars, social sharing.
*   **Content Growth:** New events added daily/weekly, diversity of events. While aiming for high accuracy, it is important to note that a 100% real-time guarantee against all changes is challenging due to the crowd-sourced and social media-derived nature of the data.
*   **Retention:** User retention rates (7, 30, 90 days).
*   **Operational Efficiency:** System uptime, API response times, bug reports,
    *   **Social Media Image/Caption retrieval Success Rate:** Measures the success rate of obtaining image URLs and captions from social media posts.
    *   **AI Agent Call Success Rate:** Monitors the successful invocation of the AI agent, tracking failures due to issues like exhausted quotas or incorrect API keys.
    *   **Average Queue Time for Scraped Posts (Quota Related):** Measures the average time posts remain in the queue due to Gemini API quota limitations.
    *   **Cron-triggered Event Data Extraction Accuracy (vs. Manual Correction):** Measures the accuracy of event data initially extracted by automated cron jobs by comparing it against data obtained through subsequent user-triggered manual extractions (e.g., if a cron job yielded empty data that was later successfully extracted manually, or if a user marked cron-extracted data as inaccurate).
    *   **User-Initiated Report Volume:** Number of reports submitted by users, broken down by type (correction, cancelled, dangerous, personal).
    *   **Correction Application Rate:** The percentage of user-suggested corrections successfully processed and applied to event data by the AI agent or moderators.
    *   **Moderation Response Time (Dangerous Events):** Average time taken for moderators to review and act on reports of dangerous events.
    *   **Deletion Effectiveness (Cancelled Events):** Percentage of events soft-deleted after receiving 3 unique user reports for cancellation.
*   **Moderator Override Rate:** Frequency with which moderators override automated decisions or user reports (e.g., restoring a soft-deleted event, marking a dangerous event as safe).

## 8. Post-MVP Features

### 8.1 Map View

A map view for event discovery will be implemented after the MVP. This will include performance optimizations such as server-side clustering and a zoom-aware API to handle a large number of events.

### 8.2 Premium UI for Custom Slug

Provide premium users with a user interface to view and modify their autogenerated slug on EventInfo and Schedule resources.

### 8.3 Hexagon-Based Spatial Indexing for Nearby Events

Improve nearby event discovery performance by mapping coordinates into groups of hexagon areas (e.g., using Uber's H3 spatial index system). This avoids heavy runtime trigonometric/spatial coordinate calculations when querying nearby events.
