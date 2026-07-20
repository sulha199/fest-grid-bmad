---
status: final

---

# DESIGN.md

## Brand & Style

The wizard component should align with the existing brand and style of the FestGrid application. It should be clean, modern, and intuitive.

## Colors

-   **Primary:** `#3B82F6` (Blue)
-   **Secondary:** `#6B7280` (Gray)
-   **Background:** `#F9FAFB` (Light Gray)
-   **Text:** `#111827` (Dark Gray)
-   **Success:** `#10B981` (Green)

## Typography

-   **Font Family:** Inter, sans-serif
-   **Headings:** `font-weight: 600`
-   **Body:** `font-weight: 400`

## Components

### Wizard

-   **Step Summary:**
    -   A horizontal list of steps with connecting lines.
    -   Each step should display its title.
    -   **Completed steps:** Should have a checkmark icon and a solid blue background.
    -   **Current step:** Should be highlighted with a blue border.
    -   **Upcoming steps:** Should be displayed in a disabled state (e.g., grayed out).
-   **Navigation Buttons:**
    -   Styled as primary buttons.
    -   The `Previous Step` button should be styled as a secondary button.
    -   The `Next Step` and `Complete` buttons should be styled as primary buttons.
    -   Disabled buttons should have a reduced opacity and `not-allowed` cursor.



