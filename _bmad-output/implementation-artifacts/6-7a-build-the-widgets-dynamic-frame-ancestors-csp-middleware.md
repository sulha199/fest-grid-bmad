# Story 6.7a: Build the widgets' dynamic frame-ancestors CSP middleware

## Story Details

- Epic: 6
- Story ID: 6.7a
- Status: review
- baseline_commit: 1d5edef

## Story

As a developer,
I want a Next.js middleware or route-level handler for the widget route (`.../widget/{id}`) that dynamically queries `isOriginAllowedForWidget` and sets a strict `Content-Security-Policy: frame-ancestors <origin>` header matching the request's `Sec-Fetch-Site`/`Referer`/`Origin` headers,
So that we prevent clickjacking and unallowed framing on unauthorized third-party sites, while still allowing the widget to be framed on valid whitelisted origins.

## Acceptance Criteria

1. **Given** I request the widget rendering page (Story 6.7) from a web browser,
2. **When** the request is processed,
3. **Then** the server extracts the parent frame's origin (from `Referer` or `Origin` headers, safely fallback-checked) and calls `isOriginAllowedForWidget` (Story 6.6a).
4. **And** if `isOriginAllowedForWidget` returns `true`, the response is served with a strict `Content-Security-Policy` header containing `frame-ancestors <origin>` matching that validated origin (PRD §3.13, NFR31).
5. **And** if the parent origin is not whitelisted, the middleware/handler returns a strict `Content-Security-Policy: frame-ancestors 'none'` header, blocking browser framing (clickjacking defense) and causing the iframe load to fail securely.
6. **And** requests with no origin/referrer headers (e.g. direct visits, cURL, or dev testing) are allowed to load but served with a safe, strict fallback header (or `frame-ancestors 'self'`) so developers can still preview and test the widget route locally.

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3, 5, 6): Implement dynamic CSP check inside widget page server-side render
  - [x] Add server-side origin parsing to the widget page `/widget/[id]/page.tsx` or Next.js middleware
  - [x] Check whitelisted origins via `isOriginAllowedForWidget` query call
  - [x] Set dynamic `Content-Security-Policy: frame-ancestors <origin>` header if whitelisted, or `'none'` otherwise
  - [x] Handle dev/local requests with no headers by serving fallback `'self'` safely

## Dev Notes

- Reuses `isOriginAllowedForWidget` unauthenticated query designed in Story 6.6a
- Since widget rendering is server-rendered, adding `headers()` manipulation inside `/widget/[id]/page.tsx` or dynamic route `route.ts` is highly optimized

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses exact origin string contracts.
- Required DB migration changes: No changes required.
- Required TypeScript type changes: No changes required.

### Project Structure Notes

- Route location: `apps/web/src/app/[locale]/widget/[id]/`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.7a]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `apps/web/src/app/[locale]/widget/[id]/page.tsx` (new)
- Rule Mapping:
  - Header: Strict clickjacking mitigation headers (NFR31)
- Verification Plan:
  - Integration tests verifying CSP headers set correctly for allowed and unallowed origins.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation
- [x] Testing plan confirmation
- [x] Explicit human approval state (Approved)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [x] Integration tests verifying `frame-ancestors` value on varying request header origins.

## Deliverables Checklist

- [x] Dynamic frame-ancestors CSP verification filter

## Out of Scope

- Implementing the frontend widget layout itself (handled by Story 6.7)

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
