# Story 6.5: Configure and generate a widget embed

## Story Details

- Epic: 6
- Story ID: 6.5
- Status: ready-for-dev (AC8 amendment; AC1-AC7 already delivered)
- baseline_commit: b28001b

## Story

As a registered user,
I want to create and edit a widget by filters, display mode, and theme, and get a ready-to-use embed snippet,
So that I can embed FestDaily's event discovery on another site and update it later without re-embedding anywhere.

## Acceptance Criteria

1. **Given** I am on the embed generator screen,
2. **When** I choose any combination of filters (social media account, event type, category, keyword, location/coordinates + radius — Sections 3.1/3.5/3.7 filters), a display mode (card or calendar), and a theme (dark or light), and save,
3. **Then** a `Widget` is created via `createWidget` (Story 6.5a) and I see a live preview of the resulting widget.
4. **And** I can return later and edit any of my widgets (`myWidgets`/`updateWidget`, Story 6.5a) — the change takes effect on every existing embed of it without me having to re-paste anything anywhere.
5. **And** I receive two embed forms for a saved widget: (1) a **script + placeholder snippet** — `<div data-festdaily-widget-id="{id}"></div>` plus one shared `<script async src=".../embed.js"></script>` — presented as the recommended option; and (2) a **raw iframe URL** (`.../widget/{id}`) as a fallback for embedding contexts that strip `<script>` tags but allow iframes.
6. **And** `embed.js` (served as a static asset) waits for the DOM to be ready, then finds every element on the page carrying `data-festdaily-widget-id` (`querySelectorAll`, not a single lookup — supporting multiple different widgets embedded on one page from a single script include) and inserts an iframe pointing at `.../widget/{id}` into each, wiring up the `postMessage` height-reporting handshake (Story 6.7) so the iframe auto-resizes without the embedder writing any listener code themselves.
7. **And** generating a widget and its snippet does not require me to have already registered an embedding domain pattern (Story 6.6) for it — domain registration is enforced at render time (Story 6.7a), not at generation time, so I can build and preview a widget before deciding where to allow it.
8. **AC8 — Adopt `PageContainer(fullWidth=false)`/`PageHeader` (added 2026-08-24 via `bmad-correct-course`):** And this page's root `<div className="max-w-4xl mx-auto py-10 px-4 space-y-8">` is replaced with `<PageContainer fullWidth={false}>` (`@festgrid/ui`, Story 0.30) — note this page's existing padding/spacing classes (`py-10 px-4`) differ from every other settings page's `p-4 sm:p-8`; `PageContainer`'s own `p-4 sm:p-8 space-y-8` becomes authoritative here, a deliberate unification, not preserved as a `className` override. And its `<div className="flex items-center justify-between"><div><h1 className="text-3xl font-extrabold tracking-tight text-foreground">Embeddable Widgets</h1><p className="text-muted-foreground mt-1">...</p></div><button>Create Widget</button></div>` row is replaced with `<PageHeader title={t("title")} description={t("description")} action={{ label: t("createButtonLabel"), icon: <Plus className="h-4 w-4" />, onClick: handleOpenCreate }} />` (Story 0.32) — this fixes the divergent `font-extrabold tracking-tight` heading style (standardized to `text-3xl font-bold`, matching every other page) and adds the icon + mobile-label-hiding this page's button never had. The title/description/button-label strings are currently hardcoded English (`"Embeddable Widgets"`, `"Configure, manage..."`, `"Create Widget"`) — **this AC also requires sourcing them through next-intl** (a pre-existing i18n gap on this page, surfaced while touching this header; add to a `WidgetsSettingsPage` locale namespace in both `en`/`id`, matching every other settings page's convention). **Depends on Story 0.30 (AC7) and Story 0.32.**

## Tasks / Subtasks

- [x] Task 1 (AC: 1, 2, 3, 4): Implement Widget Generator Form and Preview page
  - [x] Create route page at `apps/web/src/app/[locale]/settings/widgets/page.tsx` listing existing user widgets (`myWidgets` query)
  - [x] Create create/edit widget forms configuring filters, display mode, and theme
  - [x] Trigger `createWidget` or `updateWidget` mutation on form submission
  - [x] Provide live widget preview rendering in configured mode and theme
- [x] Task 2 (AC: 5, 7): Generate Embed Snippets and fallbacks
  - [x] Add display area showing (1) recommended Script inclusion code + placeholder `div` with `data-festdaily-widget-id`
  - [x] Add fallback Raw Iframe URL `.../widget/{id}` for stripped script environments
  - [x] Verify that no embedding domain checks are enforced during generation/preview stage
- [x] Task 3 (AC: 6): Create static `embed.js` script helper
  - [x] Create static file `apps/web/public/embed.js` serving the static loader
  - [x] Set up DOM listener in `embed.js` querying all elements with `data-festdaily-widget-id`
  - [x] Dynamically construct and append responsive iframe overlays pointing to `.../widget/{id}`
  - [x] Implement `postMessage` listener to auto-resize iframe height dynamically

## Dev Notes

- Reuses existing UI filters and layouts
- Reuses map-picker/location selector context if needed
- Reuses `createWidget` / `updateWidget` mutations designed in Story 6.5a

### Architecture & UX Gate Findings

- No gap found. Sourced from swept epic-wide report `_bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md`.

### Data Type Compatibility & Migration Requirements

- Compatibility finding: Reuses `Widget` shape and enums.
- Required DB migration changes: No changes required (handled in 6.5a).
- Required TypeScript type changes: No changes required (handled in 6.5a).

### Project Structure Notes

- New page route: `apps/web/src/app/[locale]/settings/widgets/`
- Helper components: `apps/web/src/components/widgets/`
- Loader script: `apps/web/public/embed.js`

### References

- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-6-readiness.md]
- [Source: _bmad-output/planning-artifacts/epics.md#Story 6.5]

## Global Rules References

- [ ] project-context.md
- [ ] story-content-structure.md
- [ ] architecture spine
- [ ] infrastructure docs

## Implementation Plan (Rule-Compliant)

- File Change Plan:
  - `apps/web/src/app/[locale]/settings/widgets/page.tsx` (new)
  - `apps/web/public/embed.js` (new)
- Rule Mapping:
  - Theme: DARK/LIGHT enum mapped to Tailwind theme classes
  - Message: `postMessage` listener for height updates
- Verification Plan:
  - Integration tests verifying widget creation, updates, and snippet generation outputs.

## Pre-Coding Approval Gate

- [x] Scope confirmation
- [x] Architecture and boundary confirmation
- [x] Testing plan confirmation
- [x] Explicit human approval state (Approved)
- [x] Gate 1/2/3 prerequisites confirmed done or gap accepted

## Testing Requirements

- [x] Integration tests verifying live preview rendering changes on settings updates.
- [x] End-to-end tests verifying script-driven dynamic iframe injection and auto-resize.

## Deliverables Checklist

- [x] Widget configurations list and management page
- [x] Static `embed.js` serving responsive iframe wrappers

## Out of Scope

- Setting dynamic frame ancestors CSP policy (handled in Story 6.7a)

## Definition of Done

- [x] AC satisfaction
- [x] Required tests passing
- [x] Lint and type checks passing for touched packages

## Completion Status

- [x] Complete (AC1-AC7, original)

**2026-08-24 (`bmad-correct-course`):** Reopened for AC8 only (adopt `PageContainer`/`PageHeader`; also surfaced a pre-existing i18n gap — this page's header strings were hardcoded English, now must move to a locale namespace. Blocked on Stories 0.30/0.32). AC1-AC7 unaffected.

## Dev Agent Record

### Agent Model Used

Gemini 1.5 Pro

### Debug Log References

### Completion Notes List

### File List
