---
backlog_id: IDEA-066
title: "Primary-post ordering: organizer beats venue"
captured: 2026-10-12
---

# IDEA-066 — Primary-post ordering: organizer beats venue

## Capture

AD-30 Rule 7 orders primary posts: organizer-authored over curator, then schedule completeness, then earlier post, then lower id. `isOrganizerAuthoredPost` excludes only `CURATOR_GUIDE`, and `account_type` has a single `ORGANIZER_VENUE_EVENT` bucket, so a venue's post and an organizer's post tie at step 1.

## Options

- **(a) Split the account type:** migration, classification prompt, review flow and backfill. Cannot express an account that is the venue for one event and the organizer for another.
- **(b) Per-event handles (preferred):** persist `organizerHandle` and an optional `venueHandle` on the event (two new columns, prompt change), used only as a step-1 tie-breaker and never as a score weight. Corroborate against the post's own associations, because caption claims are spoofable.

## Order

After BUG-058 (done), IDEA-068 (done) and IDEA-067. Needs an AD-30 Rule 7 / AD-31 Rule 3 amendment.
