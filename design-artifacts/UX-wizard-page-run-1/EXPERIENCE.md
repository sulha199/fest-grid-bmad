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
    -   `canSkipStep` (optional): A boolean indicating whether the step can be skipped. This can be determined by a variable, e.g., `!isMvp`. Defaults to `false`.
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
    -   `Skip Step`: Skips the current step. Only visible if `canSkipStep` is `true` for the current step.
    -   `Complete`: Displayed on the final step. Navigates to the `exitPath`.

## Key Flows

### Wizard Flow

This flow describes the generic behavior of the wizard page.

1.  **Trigger:** An action in the application requires a multi-step process.
2.  **Action:** The application constructs a `steps` array, a `exitPath`, and optionally a `currentStep`.
3.  **Redirect:** The user is redirected to the `/wizard` page with the `steps`, `exitPath`, and `currentStep` as query parameters.
4.  **User Interaction:**
    -   The user is presented with the page for the current step, embedded within the wizard chrome.
    -   The user completes the step.
    -   The embedded page uses the `useWizardStep` hook to set `isStepCompleted` to `true`.
    -   The user clicks "Next Step".
    -   This process repeats for all steps.
    -   On the final step, the user clicks "Complete" and is redirected to the `exitPath`.
