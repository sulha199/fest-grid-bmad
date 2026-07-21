# 02-post-selection-view

## Overview

This document describes the components used in the "Manual Post Selection" view.

## Components

### Post Card
-   **`PostCard`**: A card that displays a single social media post.
    -   **Props**:
        -   `post: Post`: The post data.
        -   `isSelected: boolean`: If true, the checkbox is checked.
        -   `onSelectionChange: (isSelected: boolean) => void`: Callback for when the checkbox state changes.
    -   **Content**:
        -   A checkbox for selection.
        -   The post's text content.
        -   The post's image (if any).

### Summary Bar
-   **`SummaryBar`**: A bar that displays the summary of selected posts.
    -   **Props**:
        -   `selectedCount: number`: The number of selected posts.
        -   `quota: number`: The user's available quota.

### Data Structures

#### Post Interface
```typescript
/**
 * Represents a social media post to be displayed for selection.
 */
interface Post {
  /**
   * A unique identifier for the post.
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
   * The URL of the post.
   */
  postUrl: string;
}