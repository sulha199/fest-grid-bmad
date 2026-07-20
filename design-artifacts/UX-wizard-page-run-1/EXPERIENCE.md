---
status: final

---

# EXPERIENCE.md

## Foundation

- **Platform:** Web (Desktop)

## Information Architecture

### Pages

#### `/wizard`

A dynamic, global page that handles multi-step flows. This page is configured via URL query parameters.

##### Query Parameters

-   `steps`: A URL-encoded JSON array of step objects. Each object has the following properties:
    -   `path`: The path of the page for this step.
    -   `title`: The title of the step, displayed in the wizard's step summary.
    -   `description`: A short description of the step.
-   `exitPath`: The path to redirect to when the user clicks the `Complete` button on the final step.
-   `currentStep` (optional): The index of the current step. Defaults to `0`.

### State Management

-   **Hook:** `useWizardStep()`
-   **Description:** A React hook that provides the state of the current step.
-   **Returns:**
    -   `isStepCompleted`: A boolean indicating whether the current step is completed.
    -   `setStepCompleted`: A function to update the `isStepCompleted` state.
-   **Usage:** The page embedded within the wizard for a particular step will use this hook to manage the `isStepCompleted` state, which in turn controls the enabled/disabled state of the `Next Step` / `Complete` button.

### Components

#### Wizard Step Summary

-   **Description:** A visual representation of the steps in the wizard, displayed at the top of the page.
-   **States:**
    -   **Completed:** The step is marked as complete.
    -   **Current:** The current active step.
    -   **Upcoming:** A step that has not yet been reached.

#### Wizard Navigation

-   **Description:** Navigation buttons at the bottom of the page.
-   **Buttons:**
    -   `Previous Step`: Navigates to the previous step. Disabled on the first step.
    -   `Next Step`: Navigates to the next step. Disabled if the `isStepCompleted` state is `false`.
    -   `Complete`: Displayed on the final step. Navigates to the `exitPath`.

## Key Flows

### API Key Gate

This flow describes how a user is guided to add an API key before they can manage subscriptions.

1.  **Trigger:** User clicks "Manage Subscriptions" but does not have an API key.
2.  **Action:** The application redirects the user to the `/wizard` page with the following configuration:
    -   **`steps`:**
        -   `path`: `/settings/api-keys`
        -   `title`: "Add API Key"
        -   `description`: "You need to add an API key before you can subscribe to new accounts."
    -   **`exitPath`:** `/settings/subscriptions`
3.  **User Interaction:**
    -   The user is shown the `/settings/api-keys` page within the wizard chrome.
    -   The user adds an API key.
    -   The page uses the `useWizardStep` hook to set `isStepCompleted` to `true`.
    -   The `Next Step` button becomes `Complete` (since this is a single-step wizard for this flow).
    -   The user clicks `Complete`.
4.  **Result:** The user is redirected to the `/settings/subscriptions` page.


