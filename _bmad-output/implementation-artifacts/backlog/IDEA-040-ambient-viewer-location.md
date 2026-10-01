---
backlog_id: IDEA-040
title: "Ambient viewer-location capability for the 'else, viewer's current location' branch of AD-22's distance-priority rule"
captured: 2026-09-17
parent: IDEA-026
---

# IDEA-040 — Ambient viewer-location capability

## Capture

Carved out of IDEA-026 via `bmad-create-story` (Story 1.i1f's own Gate 3 finding, 2026-09-17):
Architecture Spine AD-22's distance-priority rule ("active filter location if one is selected,
else the viewer's current location coordinate") never designed how the "else" branch sources a
coordinate passively. Verified: no global/app-shell viewer-location context, provider, or
persisted state exists anywhere in this codebase — the only geolocation capture mechanism,
`useCurrentLocationCapture()` (`packages/ui/src/hooks/useCurrentLocationCapture.ts`), is a bare
imperative `navigator.geolocation.getCurrentPosition` wrapper called exclusively from explicit
user-initiated actions (the nearby-filter's own "current location" mode; two location-picker
forms) — never ambient/passive.

Gate 3's own judgment: this is a real product/consent decision (permission-prompt timing,
caching policy), not a narrow wiring gap, and the capability is legitimately reusable by future
"distance from me" features — split into Epic 0 per the tooling/infrastructure numbering rule
rather than built unilaterally inside Story 1.i1f. Until this ships, Story 1.i1f's nearby badge
implements only the "active filter location" branch and simply omits itself when no filter is
active.

## UX designed, 2026-09-18 (bmad-ux)

See EXPERIENCE.md "Ambient Viewer-Location Consent" + "Ambient Capability Ask: Shared Banner
Slot". One shared app-level viewer-location capability — the 3 existing explicit consumers
migrate onto it (fixes their own `adHocCoords`-resets-on-remount bug as a side effect).
Web-verified: browsers never re-show the native geolocation prompt after a real denial, so our
own ask and the browser's actual permission decision are two independently-tracked layers —
query `navigator.permissions` first (granted: capture silently; denied: never ask again,
distance features self-omit; prompt: our own ask can show).

Also generalized the already-shipped PWA Install Prompt (IDEA-020) into a shared "ambient
capability ask" banner slot, since both share the same placement — only one banner ever renders
at a time, location asks take priority over PWA install, and dismissing one only reveals the
next eligible ask on a later session, not immediately.

## Status

Ready for `bmad-create-story` via Story 0.39. Not yet drafted as a story file — once it is,
fold this history into its Dev Notes.
