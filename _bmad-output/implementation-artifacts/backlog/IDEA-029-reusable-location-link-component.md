---
backlog_id: IDEA-029
title: "Reusable location link component (pin icon + name, opens map in new tab)"
captured: 2026-09-15
---

# IDEA-029 — Reusable location link component

## Capture

User request via `bmad-help` (2026-09-15). Build a reusable location-link
component:

- **Props:** takes a `locationDetailObject`.
- **Rendering:** displays a `pin-location-icon` + the location name as text.
- **Action:** the whole thing is clickable and **always opens the map in a new
  tab**.
- **Two icon states, chosen by location confidence:**
  - If the location is **confirmed** / has an acceptable confidence score →
    show an **open-in-new-tab** icon (links straight to the resolved map
    location).
  - Otherwise → show a **search** icon that opens the map with a query built
    from the location name.

## Consumers

Intended to be reused on the event-detail page and its schedule (see IDEA-033),
and by the reusable account element (see IDEA-032, replacing the raw accountId
line with this component's semantics when confidence is good).
