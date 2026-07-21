# 03-tab-view

## Overview

This document describes a generic Tab View component.

## Components

### TabView
-   **`TabView`**: A container for tabs that displays content for the active tab.
    -   **Props**:
        -   `tabs: Tab[]`: An array of tab objects to be displayed.
        -   `activeTabId: string`: The ID of the currently active tab.
        -   `onTabChange: (tabId: string) => void`: A callback function that is invoked when the active tab is changed by the user.
        -   `lazyLoad: boolean` (optional, default: `false`): If true, the content of inactive tabs is not rendered until the tab is selected.

### Tab
-   **`Tab`**: Represents a single tab item within the `TabView`.
    -   **Props**:
        -   `id: string`: A unique identifier for the tab.
        -   `title: string`: The text to be displayed in the tab.
        -   `hasWarning: boolean` (optional, default: `false`): If true, a warning icon is displayed next to the tab title.