---
backlog_id: IDEA-119
title: "Tell a user or moderator when a long job finishes"
captured: 2026-11-02
---

# IDEA-119: Tell a user or moderator when a long job finishes

## Capture

A job that outlasts the page (a late Bright Data result, a first-subscribe scrape) is only useful if its owner learns it finished.
Moderators go through Epic 0.i1's templated, throttled helper (`notifyAllModerators`, Story 0.i1a, not yet built). Notifying
subscribing users (push or email, throttling, consent) is a PRD question to settle through `bmad-prd` before building.

## Where it lives

Epic 10, Story 10.13 (depends on 10.1a and Story 0.i1a).
