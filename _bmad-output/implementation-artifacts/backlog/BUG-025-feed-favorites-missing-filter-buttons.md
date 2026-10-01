---
backlog_id: BUG-025
title: "Feed and Favorites hardcode isAuthenticated=false and drop the location/AI-filter buttons Discovery has"
captured: 2026-09-11
---

# BUG-025 — Feed/Favorites missing location and AI-filter buttons

## Capture

Reported by user via `bmad-help` ("feed, discovery, favorite has same set of buttons including
location, ai-filter buttons").

Verified by comparing all 3 callers of `EventDiscoveryPanel`:

- `home-content.tsx` (Discovery) passes real `isAuthenticated`/`savedLocations`/
  `onSelectLocation` from `nearbyFilter` plus
  `showAITrigger={aiFilter.filterHubProps.showAITrigger}` — Type, Category, Location and
  AI-filter buttons all render (`FilterHub.tsx` only renders the Nearby-location popover when
  `isAuthenticated`, and the AI sparkle button only when `showAITrigger`).
- `feed/feed-content.tsx` hardcodes `isAuthenticated={false}`, `savedLocations={[]}`,
  `onSelectLocation={() => {}}` (line ~242-250) so the Location button never renders, but does
  pass `showAITrigger` — AI button present, Location button missing.
- `favorites/favorites-content.tsx` hardcodes the same `isAuthenticated={false}`/
  `savedLocations={[]}` (line ~314-322) AND never passes `showAITrigger` at all — both Location
  and AI-filter buttons missing, leaving only Type/Category.

## Fix

Wire Feed and Favorites to real auth/saved-location state and an `aiFilter` instance the same
way Discovery does, so Type/Category/Location/AI-filter render identically on all three
surfaces. Not yet scoped into a story at capture time.
