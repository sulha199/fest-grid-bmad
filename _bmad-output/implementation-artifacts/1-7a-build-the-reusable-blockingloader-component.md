---
baseline_commit: bcdbb8671fad00ae936541ab6c20ca7d782a7537
---
# Story 1.7a: Build the reusable BlockingLoader component

## Story Details

- Epic: 1
- Story ID: 1.7a
- Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a developer,
I want a reusable, full-screen blocking loader/overlay component in `packages/ui`,
so that any critical, in-flight async operation (OAuth redirect processing, submitting a report, saving a location, etc. — PRD §3.12 "Global UI & Navigation Patterns") can present a consistent, accessible overlay that prevents further interaction, instead of each feature story building its own one-off spinner.

## Acceptance Criteria

1. **AC1 — Active render:** Given a boolean `active` prop, when it is `true`, then `BlockingLoader` renders a full-screen, semi-transparent overlay (`fixed inset-0`, matching the visual weight of the existing modal overlay token — see Dev Notes) with a centered spinner that visually blocks the rest of the page.
2. **AC2 — Interaction blocking + ARIA busy semantics:** While `active`, the overlay prevents interaction with underlying page content (it is a full-viewport, top-stacked layer sitting above the app's other fixed overlays — see Dev Notes for the z-index convention — so no click/tap can reach content beneath it), and keyboard focus is contained within the overlay: on activation, focus moves into the overlay container and Tab/Shift+Tab cannot move focus back to the underlying page while it remains active; on deactivation, focus is restored to whatever element held focus immediately before activation. The overlay container exposes `aria-busy="true"`, and the label/message region (AC3) uses `role="status"`/`aria-live="polite"` so assistive tech announces the busy state and any label text without the label needing to be re-focused.
3. **AC3 — Optional label/message:** `BlockingLoader` accepts an optional `label` prop (a `React.ReactNode`) for localized status text, resolved by the caller via `next-intl` at the call site — the component itself hardcodes no FestGrid-specific copy and performs no date/number/enum formatting (no need of `useScopedLocale`/`useScopedTimezone`). When `label` is omitted, the live-region still exposes a minimal, English-default accessible name (via an optional `labels.busyLabel` override prop, default `"Loading"`) so screen readers announce *something* is happening even without caller-supplied copy — mirroring the `labels`-override-with-English-defaults pattern established by `MultiSelect` (Story 1.5a) and `EventDetailView` (Story 1.6a).
4. **AC4 — Inactive render:** When `active` is `false` (or omitted), `BlockingLoader` renders nothing — no DOM overlay node, no lingering focus trap/listener, and any focus previously moved by a prior `active` transition has already been restored (AC2).
5. **AC5 — Documented & exported for reuse:** `BlockingLoader` (and its prop types) is exported from `packages/ui`'s public entry point (`packages/ui/src/index.ts`) with prop-level documentation (TSDoc), and has component tests proving the active/inactive, label/no-label, focus-containment, and focus-restoration states, so it is discoverable and reusable across features (first consumer: Story 1.7's Google OAuth redirect processing).

## Tasks / Subtasks

- [ ] 1. Create `packages/ui/src/core/blocking-loader.tsx` implementing the base structure: renders `null` when `active` is falsy, renders the full-screen overlay + centered spinner when `active` is truthy (AC1, AC4).
- [ ] 2. Define a strictly-typed `BlockingLoaderProps` interface, co-located as `packages/ui/src/core/blocking-loader.types.ts` (`active: boolean`, `label?: React.ReactNode`, `labels?: { busyLabel?: string }`) (AC1, AC3).
- [ ] 3. Implement the interaction-blocking overlay: `fixed inset-0` full-viewport container at a z-index above the app's other fixed overlays (see Dev Notes z-index guidance), centered spinner visual (AC1, AC2).
- [ ] 4. Implement focus containment: on `active` transitioning `false → true`, capture `document.activeElement`, move focus into the overlay container (`tabIndex={-1}` + `.focus()`), and attach a `keydown` handler that intercepts `Tab`/`Shift+Tab` to keep focus from leaving the overlay; on `active` transitioning `true → false` (or unmount while active), remove the listener and restore focus to the captured element (AC2, AC4).
- [ ] 5. Implement ARIA semantics: `aria-busy="true"` on the overlay container; wrap the label/message region in `role="status"` + `aria-live="polite"`, falling back to `labels.busyLabel` (default `"Loading"`) as the accessible name when no `label` prop is supplied (AC2, AC3).
- [ ] 6. Export `BlockingLoader`, `BlockingLoaderProps` from `packages/ui/src/core/blocking-loader.tsx` (types re-exported via `export * from './blocking-loader.types'`, matching the `multi-select.tsx` pattern), and add `export * from './core/blocking-loader';` to `packages/ui/src/index.ts` (AC5).
- [ ] 7. Add TSDoc comments to the component and its props documenting purpose, defaults, and reuse guidance (AC5).
- [ ] 8. Write component tests (Vitest + `@testing-library/react`, `packages/ui/src/core/blocking-loader.test.tsx`) covering: renders nothing when `active` is `false`; renders overlay + `aria-busy="true"` when `active` is `true`; renders supplied `label` content; falls back to default `busyLabel` accessible text when `label` is omitted; respects a `labels.busyLabel` override; moves focus into the overlay on activation and restores it to the previously-focused element on deactivation; `Tab` does not move focus outside the overlay while active (use `@festgrid/testing-config/vitest-react` per Testing Requirements) (AC1–AC5).

## Dev Notes

- This is a net-new, presentation-only component story — no existing files needed to be read as "files being modified" beyond `packages/ui`'s barrel export (`packages/ui/src/index.ts`, confirmed by directory listing to currently export `./core/app-shell`, `./core/multi-select`, `./features/events`, and `./hooks`).
- **Placement — `core`, not `features`:** per `project-context.md`'s "Core Primitives" rule ("generic, domain-agnostic components ... in `packages/ui/src/core/`"), `BlockingLoader` is not event/domain-specific — it belongs alongside the existing `packages/ui/src/core/multi-select.tsx`, not under `packages/ui/src/features/events/`. Follow `multi-select.tsx`'s established file-naming convention exactly: lowercase-kebab-case flat files (`blocking-loader.tsx` / `blocking-loader.types.ts` / `blocking-loader.test.tsx`), component file re-exports its types file at the bottom (`export * from './blocking-loader.types';`), PascalCase component/type names.
- **No dedicated design token exists for this pattern.** Gate 2 UX review (below) confirmed `design-artifacts/UX-festgrid-run-1/DESIGN.md` defines no `loader`/`spinner`/`overlay`-specific component token — the only visually-adjacent token is `components.modal.overlay: "fixed inset-0 bg-black bg-opacity-50"` (DESIGN.md line 59), and the codebase's actual implemented dialog overlay (`apps/web/src/components/ui/dialog.tsx`, Radix-based, `apps/web`-only) uses `"fixed inset-0 z-50 bg-black/80 ..."`. Since `packages/ui` cannot depend on Radix or `apps/web`'s `cn()`/`@/lib/utils` (framework-agnostic constraint, same as `AppShell`/`MultiSelect`/`EventCard`), `BlockingLoader` must be a self-built overlay using plain Tailwind classes only — visually consistent with (but not literally sharing code with) the `modal` overlay treatment.
- **Z-index guidance:** the codebase's existing full-screen fixed overlays both use `z-50` (`AppShell`'s mobile nav drawer at `packages/ui/src/core/app-shell/AppShell.tsx:60,66`; `apps/web`'s Dialog overlay/content at `apps/web/src/components/ui/dialog.tsx:24,41`). Because `BlockingLoader` must be able to block interaction even when triggered from *within* an already-open modal (e.g. submitting a report from a modal, a future Epic 4 consumer), it must stack above both — use a higher value (e.g. `z-[60]`) rather than reusing `z-50`, so it is never accidentally rendered beneath an open Dialog.
- **No maps SDK, no `next/image`, no `next-intl` dependency** — same framework-agnostic constraints as every other `packages/ui` component (`AppShell`, `MultiSelect`, `EventCard`, `EventDetailView`). The `label` prop is the caller's fully-resolved, already-localized node (mirrors `EventDetailView`'s `originalPostUrl`/`mapUrl` "caller resolves, component only renders" decoupling pattern) — `packages/ui` itself introduces zero new i18n locale keys in this story; Story 1.7 (the first consumer) is responsible for sourcing its own translated label text via `next-intl` and passing it in.
- **Spinner visual:** no existing spinner primitive exists in `packages/ui` to reuse (confirmed: only `AppShell`, `MultiSelect`, `EventCard`, `EventDetailView`, `EventImage`, `FilterHub`, `SearchBar` exist under `packages/ui/src`, and the `hooks/` folder has no loading-visual utility). Build a simple CSS/Tailwind spinner (e.g. an animated bordered circle via `animate-spin`) directly in this component — `lucide-react` (already a `packages/ui` dependency) also ships a `Loader2` icon usable with `animate-spin` if preferred; either is acceptable, dev's discretion.

### Architecture & UX Gate Findings

- **Gate 1 & Gate 3 (cited, not re-run):** `_bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md` is marked `swept: true` for Epic 1. Its one finding (missing GraphQL authenticated-context layer, resolved by Story 0.17) does not apply here — this component is pure presentation, zero data-fetching/auth responsibility, and is not itself an `apps/web` route (so the 2026-08-01 "Dynamic Page Title & Meta Tags" addendum sweep, which only re-checked route-originating stories, correctly excluded it, the same way it excluded Story 1.6a).
- **Gate 2 (run fresh via subagent, persona Freya, during this story's creation) — No gap found.** The subagent searched `design-artifacts/UX-festgrid-run-1/{DESIGN,EXPERIENCE}.md`, `design-artifacts/UX-wizard-page-run-1/{DESIGN,EXPERIENCE}.md`, all 22 files under `design-artifacts/C-UX-Scenarios/` (including `00.1-google-login.md`), PRD §3.12, and `project-context.md`'s "UI Patterns & UX Invariants" section for any loader/spinner/overlay specification beyond what the draft ACs already cover. Finding: no dedicated loader/spinner design token or scenario-level visual spec exists anywhere in the authoritative UX artifacts — every UX-mandated behavior word ("full-screen," "semi-transparent overlay," "spinner," "prevent interaction") is already reflected in AC1/AC2, and `00.1-google-login.md` describes the OAuth flow narratively with no additional visual/blocking-overlay treatment to fold in. The only visually-adjacent DESIGN.md token (`components.notification`, a dismissible bottom-right toast) is a wholly separate, non-blocking pattern with no state/prop/lifecycle overlap with `BlockingLoader` — nothing to extract or bundle. Conclusion: this stays one small, single-purpose primitive, not a candidate for further splitting (unlike Story 1.6b's navigation hook, which had a genuinely separate, independently-reusable state/side-effect concern).
- **Lightweight guard — gaps the epic-wide sweep did not anticipate:** None found. This story introduces no new external service, no new data entity, and no cross-cutting tooling gap — it is a strictly local, dependency-free (beyond `react`/`lucide-react`, both already `packages/ui` dependencies) presentation component.

### Data Type Compatibility & Migration Requirements

- **Compatibility finding:** No mismatch found. This component has no data model — it accepts only a `boolean`, a `React.ReactNode`, and an optional string-override object as props.
- **Impacted fields/contracts:** None. No dependency on `@festgrid/shared-types`, the database, or the GraphQL schema.
- **Required DB migration changes:** No changes required.
- **Required TypeScript type changes:** No changes required to `packages/shared-types`. This story defines its own local `BlockingLoaderProps` type in `packages/ui`, with no re-export of or dependency on any backend-oriented shape.
- **Backward compatibility and rollout notes:** Not applicable — net-new component, no existing consumers to break. Story 1.7 is the first real caller and is responsible for supplying its own translated `label` text and wiring `active` to its OAuth-redirect-in-flight state.
- **Verification checks:** This story's own component tests (Task 8) cover active/inactive rendering, label present/absent (including the `labels.busyLabel` override), and focus containment/restoration. No end-to-end verification is possible until Story 1.7 wires a real consumer — track that separately when Story 1.7 is picked up.

### Project Structure Notes

- New files live under `packages/ui/src/core/`, per `project-context.md`'s "Core Primitives" convention, alongside the existing `packages/ui/src/core/multi-select.tsx` and `packages/ui/src/core/app-shell/`.
- Only existing file touched: `packages/ui/src/index.ts` (barrel re-export, add one line). No conflicts with `apps/backend` or `apps/web` — different package entirely, and no other in-flight Epic 1 story touches `packages/ui/src/core/`.
- `packages/ui`'s existing components (`AppShell.tsx`, `multi-select.tsx`, `EventCard.tsx`, `EventDetailView.tsx`) establish the pattern this story must follow: plain Tailwind classes, native HTML elements, `lucide-react` for icons, no Next.js-specific APIs (`next/link`, `next/image`), no `next-intl`, no Radix/shadcn dependency — those live only in `apps/web`.
- `packages/ui`'s testing infra (`vitest.config.ts`, `package.json` `test` script, `@festgrid/testing-config` devDependency) already exists and needs no new setup for this story — confirmed by the existing `multi-select.test.tsx`, `EventCard.test.tsx`, and `EventDetailView.test.tsx` files.

### Previous Story Intelligence

- **Story 1.6a (`EventDetailView`, `done`) / Story 1.5a (`MultiSelect`, `review`):** both establish the `labels` optional-override-prop-with-English-defaults pattern this story reuses for `labels.busyLabel` (AC3) — no new i18n mechanism is being introduced, just the same established convention applied to a new component.
- **Story 1.6 (`View event details`, `review`) — z-index/overlay precedent:** its intercepted-modal route wraps `EventDetailView` in `apps/web`'s Radix-based `Dialog` (`z-50` overlay/content). Confirms this codebase's convention of `z-50` for full-screen fixed overlays, informing this story's choice of a higher `z-[60]` so `BlockingLoader` can stack above an already-open Dialog when needed (see Dev Notes).
- **No file overlap:** the previous story in strict sequence-number order (`1.6-view-event-details.md`) is entirely `apps/web`-side (routing, GraphQL fetch/mapping, click wiring) with zero file overlap with this `packages/ui`-only story — no dev-notes/learnings carry over beyond the z-index/labels-pattern precedents already cited, matching the same "no overlap" conclusion Story 1.3b and Story 1.6a each reached against their own predecessors.

### Git Intelligence Summary

- Recent commit history (`2c817dd` `feat(ui): implement useContextAwareListNavigation hook`, `17f7298` `refactor(events): extract image logic and enforce explicit labels`, `bcdbb86` `feat(events): localize event metadata and refine schedule details layout`) shows a consistent, current pattern in this repo: small, tightly-scoped `packages/ui` additions; explicit `labels`-prop enforcement (no hardcoded copy) enforced at review time (`17f7298`); and a preference for extracting genuinely-independent concerns (e.g. `EventImage`) into their own files rather than inflating one component file. This story's scope (one small, self-contained, dependency-light primitive) fits that pattern directly — no additional extraction is warranted beyond the `.tsx`/`.types.ts` split already used by every sibling `packages/ui` component.

### References

- [Source: _bmad-output/project-context.md] — Technology Stack, Code Organization (Core Primitives vs Domain Features), UI Patterns & UX Invariants (Loaders — Blocking), i18n rules.
- [Source: _bmad-output/planning-artifacts/story-content-structure.md] — canonical story structure this file follows.
- [Source: _bmad-output/planning-artifacts/story-split-gate.md] — Gate 1/2/3 definitions and epic-level sweep mode.
- [Source: _bmad-output/planning-artifacts/epics.md#Story-1.7a] and neighboring Stories 1.6a, 1.5a, 1.7.
- [Source: _bmad-output/planning-artifacts/epic-readiness/epic-1-readiness.md] — swept Gate 1/3 report covering Epic 1.
- [Source: _bmad-output/implementation-artifacts/1-6a-build-the-reusable-event-detail-view-component.md] — sibling reusable-component precedent (`labels` override pattern, framework-agnostic constraints, file-naming/export conventions).
- [Source: packages/ui/src/core/multi-select.tsx], [Source: packages/ui/src/core/multi-select.types.ts] — closest sibling `packages/ui/src/core/` precedent (flat kebab-case files, `labels` override prop, bottom-of-file type re-export).
- [Source: packages/ui/src/core/app-shell/AppShell.tsx] — established `packages/ui` component conventions (plain Tailwind, `z-50` full-screen overlay precedent, no Next.js coupling).
- [Source: apps/web/src/components/ui/dialog.tsx] — confirms `apps/web`'s Radix-based Dialog overlay also uses `z-50`, informing this story's `z-[60]` stacking guidance.
- [Source: _bmad-output/planning-artifacts/prds/festgrid-prd-2026-07-10-2047/prd.md#3.12] — "Global UI & Navigation Patterns," Blocking loader requirement (source of this story's core requirement).
- [Source: design-artifacts/UX-festgrid-run-1/DESIGN.md] — confirmed (Gate 2) no dedicated loader/spinner token; `modal.overlay` (line 59) is the closest visually-adjacent token.
- [Source: design-artifacts/C-UX-Scenarios/00.1-google-login.md] — OAuth login scenario (first consumer context, Story 1.7); confirmed (Gate 2) no additional visual spec beyond the PRD's general blocking-overlay rule.
- [Source: packages/testing-config/] — shared Vitest/MSW config (Story 0.10), consumed via `@festgrid/testing-config/vitest-react`.

## Global Rules References

- [x] `_bmad-output/project-context.md` — Code Organization (Core Primitives), UI Patterns & UX Invariants (Blocking loaders), i18n rules.
- [x] `_bmad-output/planning-artifacts/story-content-structure.md` — this file's structure.
- [x] `_bmad-output/planning-artifacts/festgrid-architecture-spine.md` — AD-6 (i18n/locale strategy, `labels`-override pattern).
- [x] `docs/infrastructure/index.md` — reviewed; not applicable (no backend/infra changes in this story).

## Implementation Plan (Rule-Compliant)

- **File Change Plan:**
  - NEW `packages/ui/src/core/blocking-loader.tsx` — component implementation (overlay, spinner, focus containment/restoration, ARIA semantics).
  - NEW `packages/ui/src/core/blocking-loader.types.ts` — `BlockingLoaderProps` (`active`, `label?`, `labels?.busyLabel?`).
  - NEW `packages/ui/src/core/blocking-loader.test.tsx` — component tests.
  - UPDATE `packages/ui/src/index.ts` — add `export * from './core/blocking-loader';`.
  - No new `vitest.config.ts`/`package.json` changes needed — `packages/ui`'s testing infra (Story 0.10's `@festgrid/testing-config`) is already fully wired (confirmed via existing `multi-select.test.tsx`/`EventCard.test.tsx`/`EventDetailView.test.tsx`).
- **Rule Mapping:**
  - *Core Primitives (Code Organization)* → component placed in `packages/ui/src/core/`, not `features/events/`.
  - *i18n foundational principle (AD-6)* → `label` prop is caller-resolved/pre-translated; `labels.busyLabel` override-with-English-default pattern mirrors `MultiSelect`/`EventDetailView`; zero new `next-intl` locale keys introduced by this story itself.
  - *UI Patterns & UX Invariants (Blocking loaders)* → directly implements the PRD §3.12/`project-context.md`-mandated full-screen blocking-overlay pattern as the single, reusable, shared primitive.
  - *Accessibility (WCAG 2.1 AA, mirroring `EventCard`/`EventDetailView` precedent)* → `aria-busy`, `role="status"`/`aria-live="polite"`, keyboard focus containment and restoration.
  - *Testing Philosophy (testing trophy)* → integration-style component tests via Vitest + Testing Library, not exhaustive unit fragmentation.
- **Verification Plan:**
  - `pnpm --filter @festgrid/ui test` — covers: renders nothing when inactive, renders overlay + `aria-busy="true"` when active, label content rendering, default/overridden `busyLabel` fallback, focus moves into the overlay on activation, focus restores to the prior element on deactivation, `Tab` does not escape the overlay while active.
  - `pnpm --filter @festgrid/ui lint` and TypeScript strict-mode type-check for the package.
  - No E2E test for this story (nothing renders `BlockingLoader` on a real page yet — that lands with Story 1.7).

## Pre-Coding Approval Gate

- [ ] Scope confirmed: build `BlockingLoader` as a standalone, presentation-only UI component in `packages/ui/src/core/`; no backend work, no live-data wiring, no consumer integration (Story 1.7 wires the first real usage).
- [ ] Architecture confirmed: component built with plain Tailwind + native HTML elements + `lucide-react` only (no Radix, no `next-intl`, no maps SDK), placed under `packages/ui/src/core/`, self-built focus-trap (no new third-party focus-trap dependency).
- [ ] Testing plan confirmed: Vitest + `@testing-library/react` component tests via the existing `packages/ui/vitest.config.ts` (`@festgrid/testing-config/vitest-react`), no new test-infra setup required.
- [ ] Gate 1/2/3 findings acknowledged: Gate 1/3 cited from the swept `epic-readiness/epic-1-readiness.md` (no gap for this story); Gate 2 (run fresh, persona Freya) found no gap and no further split warranted — no new prerequisite story required.
- [ ] Explicit human approval state (Default: **pending approval**)

## Testing Requirements

- [ ] Component tests (Vitest + `@testing-library/react`) for: renders nothing when `active` is `false`, renders full-screen overlay + spinner + `aria-busy="true"` when `active` is `true`, renders supplied `label` content, falls back to default `busyLabel` ("Loading") when `label` is omitted, respects a `labels.busyLabel` override, moves focus into the overlay on activation, restores focus to the previously-focused element on deactivation, and confirms `Tab`/`Shift+Tab` does not move focus outside the overlay while active.
- [ ] No E2E test required for this story (no live page consumes `BlockingLoader` yet; E2E coverage arrives with Story 1.7's OAuth-redirect flow).
- [ ] 100% coverage is not mandated here — that requirement is scoped to `packages/domain` only per `project-context.md`; `packages/ui` follows the "testing trophy" integration-style approach.
- [ ] Note: use `@festgrid/testing-config/vitest-react` (Story 0.10, already available) for `packages/ui/vitest.config.ts` — do not create a parallel/ad hoc testing-config setup.

## Deliverables Checklist

- [ ] `BlockingLoader` component implemented in `packages/ui/src/core/blocking-loader.tsx`.
- [ ] Strictly-typed `BlockingLoaderProps` (`packages/ui/src/core/blocking-loader.types.ts`).
- [ ] Full-screen, semi-transparent overlay with centered spinner, rendered only when `active`.
- [ ] Interaction blocking (top-stacked, above the app's other `z-50` fixed overlays) + `aria-busy="true"`.
- [ ] Keyboard focus containment on activation and restoration on deactivation.
- [ ] `role="status"`/`aria-live="polite"` label region with `label` prop and `labels.busyLabel` English-default fallback.
- [ ] Renders nothing (no DOM, no lingering listeners/focus trap) when inactive.
- [ ] Exported from `packages/ui`'s public entry point with TSDoc prop documentation.
- [ ] Component tests written and passing.

## Out of Scope

- Wiring `BlockingLoader` into any real feature (Story 1.7's OAuth redirect flow, a future report-submission or save-location flow) — this story only builds the reusable primitive.
- Non-blocking loaders (skeleton screens, localized infinite-scroll spinners) — already covered by existing/other component patterns (`EventDetailView`'s `loading` skeleton, Story 1.3c's `useInfiniteScroll`); out of scope here per `project-context.md`'s explicit Blocking-vs-Non-Blocking distinction.
- A generic toast/notification component (`DESIGN.md`'s `notification` token) — unrelated pattern, not bundled into this story (see Gate 2 findings).
- Storybook, visual-regression, or design-token tooling — not set up anywhere in this project yet.

## Definition of Done

- [ ] All Acceptance Criteria (AC1–AC5) are met.
- [ ] Required component tests (see Testing Requirements) are written and passing.
- [ ] Lint and TypeScript strict-mode checks pass for `packages/ui`.
- [ ] `BlockingLoader` is exported from `packages/ui`'s public entry point and documented with TSDoc.
- [ ] Pre-Coding Approval Gate has moved from pending to explicitly approved before implementation began.

## Completion Status

- [ ] Not started

## Dev Agent Record

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
