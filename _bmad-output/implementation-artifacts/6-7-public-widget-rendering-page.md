# Story 6.7: Public widget rendering page

## Story Details

- Epic: 6
- Story ID: 6.7
- Status: review
- baseline_commit: 22ec582

## Story

As a registered or anonymous user,
I want to request a widget route (`.../widget/{id}`) and see a fully functional, read-only Discovery panel containing filtered events,
So that visitors on allowed third-party platforms see our extracted events rendering cleanly.

## Acceptance Criteria

1. **Given** a request to a public widget route `/widget/{id}` (or `/[locale]/widget/[id]`),
2. **When** processed,
3. **Then** the page retrieves the widget configuration (`widgetById`, Story 6.5a) and renders a read-only, fully responsive `EventDiscoveryPanel` or `WeeklyCalendarView` (Story 1.3d/1.3e/1.3g) based on the widget's configured `filters` and `displayMode` (Card/Calendar).
4. **And** the widget loads with the configured `theme` (dark or light) classes, displaying appropriate styling matching the theme's design tokens (PRD §3.14).
5. **And** a postMessage listener on the iframe parent is notified of DOM height updates via a debounce-height reporting loop (handshaking with `embed.js`, Story 6.5), preventing double scrollbars and ensuring seamless resizing (NFR32).
6. **And** any interactive details dialogs or lists are rendered cleanly inside the bounded iframe canvas, disabling full-page navigation redirections that would break the framing context.

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3, 4): Implement Public Widget Page
  - [x] Create route page at `apps/web/src/app/[locale]/widget/[id]/page.tsx` fetching the widget config (`widgetById`)
  - [x] Render `EventDiscoveryPanel` (Card view) or `WeeklyCalendarView` (Calendar view) based on widget's configured displayMode, passing `filters` to queries
  - [x] Apply dark/light theme wrapper classes dynamically matching configured widget theme
- [x] Task 2 (AC: 5, 6): Implement Parent PostMessage Height Reporting Handshake
  - [x] Set up a ResizeObserver on the widget DOM wrapper or page container
  - [x] On height change, send debounced height updates to parent window using `window.parent.postMessage({ type: 'festdaily-widget-resize', widgetId: id, height: height }, '*')`
  - [x] Ensure details sheets or modals remain read-only and render beautifully within the bounds of the iframe

## Dev Notes

- Reuses `widgetById` public unauthenticated query designed in Story 6.5a
- Reuses `EventDiscoveryPanel` and `WeeklyCalendarView` components designed in Epic 1

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses `Widget` configuration types.
- Required DB migration changes: No changes required (handled in 6.5a).
- Required TypeScript type changes: No changes required (handled in 6.5a).

### Project Structure Notes

- New page route: `apps/web/src/app/[locale]/widget/[id]/page.tsx`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.7]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `apps/web/src/app/[locale]/widget/[id]/page.tsx` (new)
- Rule Mapping:
  - Height: Debounced ResizeObserver postMessage reporting loop
  - Theme: Theme tokens mapped to top-level containers
- Verification Plan:
  - Integration tests verifying widget fetching, correct card/calendar view selection, and message triggers.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation
- [x] Testing plan confirmation
- [x] Explicit human approval state (Approved)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [x] Integration tests verifying correct view selection based on configuration display mode.
- [x] E2E tests verifying complete height resize events postMessage dispatches.

## Deliverables Checklist

- [x] Responsive public widget page `/widget/[id]/`
- [x] Dynamic postMessage auto-resize reporting handler

## Out of Scope

- Setting dynamic frame ancestors CSP policy (handled in Story 6.7a)

## Definition of Done

- [x] AC satisfaction
- [x] Required tests passing
- [x] Lint and type checks passing for touched packages

## Completion Status

- [x] Complete

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro

### Debug Log References

### Completion Notes List

### File List
