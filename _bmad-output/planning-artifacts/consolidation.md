# FestGrid: Consolidated Product, Marketing, and Design Vision

## 1. Introduction

This document consolidates the vision for FestGrid from the Product Requirements Document (PRD), the PRFAQ, and the UX Design specification (`DESIGN.md`). The purpose is to provide a single, unified view of the project, ensuring alignment between product goals, user-facing messaging, and design implementation before development begins.

Overall, the three documents are highly consistent, presenting a cohesive vision from different perspectives. The PRFAQ outlines the high-level market positioning, the PRD details the technical and functional requirements, and `DESIGN.md` provides the visual language and component-based system for implementation.

## 2. Core Vision & Strategy

- **Problem:** City residents miss out on local events due to disorganized information and forgotten plans. (Source: PRFAQ)
- **Solution:** FestGrid provides a single, intuitive platform for discovering, scheduling, and managing local cultural, entertainment, and hobby events. (Source: PRFAQ, PRD)

### Rollout Strategy & Monetization

The launch strategy is designed to build a content base while managing costs:

- **Phase 1: Contributing User (BYOK):** An invitation-only beta where users provide their own Gemini API key to subscribe to any public social media account. This seeds the platform with event data at no AI-processing cost to FestGrid.
- **Phase 2: Free User:** A public tier that allows users to subscribe to a limited number of popular, pre-vetted event sources.
- **Monetization:** The core user experience is free. Future monetization will come from premium features for event organizers (e.g., event promotion), not from end-users. (Source: PRD, PRFAQ)

## 3. Key Feature Breakdown

This section maps detailed product requirements to their user-facing pitch and the design components intended for their implementation.

### 3.1. Event Discovery

- **PRD Requirement:** Display a curated selection of local events with robust search and filtering capabilities (by type, category, location, etc.).
- **User-Facing Pitch (from PRFAQ):** "Browse all discovered events... It's completely free, with no hidden costs."
- **Design System Components (from DESIGN.md):**
  - `grid`: For the main layout of event listings.
  - `card`: To display individual event information.
  - `input_with_label`: For the search bar and filter inputs.

### 3.2. Social Media Account Subscription

- **PRD Requirement:** The core differentiating feature. Allows users to subscribe to social media accounts using their own Gemini API key (BYOK). The system will handle API key pooling for shared accounts, quota management, and fairness algorithms. It includes complex logic for timezone inference and setting default locations.
- **User-Facing Pitch (from PRFAQ):** "Our unique **Social Media Subscription** feature lets you create a personalized event feed from the sources you already trust and follow. It's your city, your feed."
- **Design System Components (from DESIGN.md):**
  - `input_with_label`: For users to input social media account URLs and their API keys.
  - `button`: For submitting subscriptions.
  - `notification`: To inform users about queue status or API key issues.
  - `calendar` and `event_card_compact`: For displaying the events extracted from subscribed accounts.

### 3.3. Event Management & Calendar View

- **PRD Requirement:** Provide one-click calendar integration. The calendar view should display individual schedules from an `EventInfo` object, with specific title formatting based on whether it's a main schedule or a sub-schedule.
- **User-Facing Pitch (from PRFAQ):** "...our intuitive calendar view makes it effortless to see what's happening and when... a simple tap adds it to their personal calendar, ensuring no more missed opportunities."
- **Design System Components (from DESIGN.md):**
  - `calendar`: A detailed component definition including `header`, `date_range`, `nav_button`, `day_cell`, and styles for event rendering.
  - `button`: The 'Add to Calendar' button.

### 3.4. User Reporting & Data Correction

- **PRD Requirement:** A comprehensive system allowing users to report events (e.g., as cancelled, dangerous) or suggest corrections for AI-extracted data. Includes logic for soft-deleting events based on community consensus and notifying moderators.
- **User-Facing Pitch (from PRFAQ):** "If you encounter incorrect details, you can use our built-in 'Report' option. Here, you can suggest specific corrections or select from predefined reasons..."
- **Design System Components (from DESIGN.md):**
  - `modal`: To display the reporting and correction forms.
  - `button`: To trigger the report action and submit the form.
  - `input_with_label`: For free-text correction input.
  - `notification`: To confirm that a report has been submitted.

## 4. Data Model

The PRD defines a clear and detailed data schema using TypeScript interfaces (`EventInfo`, `Schedule`, `LocationDetails`, etc.). This schema is the foundational blueprint for all data extraction, storage, and display, ensuring consistency across the application. `DESIGN.md`'s components are designed to visualize data that conforms to this schema.

## 5. Alignment & Gaps

- **Strong Alignment:** There is excellent alignment between the problem statement (PRFAQ), the technical solution (PRD), and the visual implementation system (DESIGN.md). The features described in the PRD are directly addressed in the PRFAQ's user-facing language and are supported by the components in the design system.
- **No Contradictions:** No significant contradictions or inconsistencies were found across the documents.
- **Gap/Clarification:** `DESIGN.md` functions as a **component library** rather than a set of high-fidelity screen mockups. While it provides all the necessary building blocks (buttons, cards, modals), it does not contain full-page designs for user flows like "Onboarding," the "In-App Queue Status" page, or the "User Reports Page." The development process will involve composing these views from the provided components, following the logic outlined in the PRD.

## 6. Conclusion

The project is well-defined and ready for the next phase. The PRD, PRFAQ, and Design System are in sync, providing a solid foundation for development. The next step is to begin implementation, using the PRD as the technical guide and `DESIGN.md` as the visual and component blueprint.