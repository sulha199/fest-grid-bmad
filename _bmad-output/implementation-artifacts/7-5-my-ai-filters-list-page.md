# Story 7.5: "My AI Filters" list page

## 1. Story Requirements

**As a** user with a saved Gemini API key,
**I want** to save a resolved AI Event Filter and reload it later from a dedicated list page,
**So that** I don't have to re-type the same prompt every time I want the same filtered view.

**Acceptance Criteria:**
* **Given** I am logged in and navigate to "My AI Filters" from the user menu (same discovery pattern as Favorites, Story 2.2, and Subscribed Accounts, Story 3.2),
* **When** the page loads, **then** it lists my saved `AIEventFilter` records (`myAIEventFilters`, Story 7.2a), each row rendered via Story 7.3's `renderAIFilterSummary` — no row ever shows raw field data or a different summary than the one Story 7.4's live overlay would have shown for the same filter.
* **And** from Story 7.4's overlay, after a successful resolve, a "Save this filter" action calls `saveAIEventFilter` (Story 7.2a) and confirms success — this is the only path that creates a new `AIEventFilter` row; this list page itself has no create/prompt UI of its own, matching PRD §3.15's "no edit UI, ever, only re-prompting" constraint.
* **And** clicking a saved filter's row navigates to Discovery with that filter's `resolvedFilter` applied to the query state (same application mechanism as Story 7.4's live resolve), and FilterHub shows it as the same collapsed summary row Story 7.4 defines — loading a save and resolving a fresh prompt are visually indistinguishable once applied.
* **And** each row has a delete action calling `deleteAIEventFilter` (Story 7.2a, soft-delete), using the existing `SwipeToReveal`/soft-delete-with-undo pattern (Story 0.18/0.19) already used by Saved Locations (`/settings/locations`) — the codebase's other precedent, Subscribed Accounts, is now folded into the tabbed Account Settings shell (Story 0.29), so Saved Locations is the more directly comparable standalone-page example — not a new delete-confirmation mechanism.
* **And** a zero-saved-filters state renders a defined empty-state message and CTA, matching this codebase's existing empty-state precedent (Story 3.7's Feed empty state) rather than a bare blank list.

**Depends on:** Story 7.2a, Story 7.3.

## 2. Developer Context Section

### Technical Requirements
- Create the page at `apps/web/src/app/[locale]/settings/ai-filters/page.tsx` (using Next.js app router layout), utilizing `PageContainer` and `PageHeader` from `packages/ui` — matching the real `/settings/locations` and `/settings/widgets` directory convention (both "manage my saved resource" pages, the closest structural analogs to a saved-AI-filters list), not a bare `/ai-filters` route.
- Add an entry to the User Menu's real registry, `packages/ui/src/core/app-shell/profile-menu-entries.ts` (a static `ProfileMenuEntry[]` array — `UserMenu.tsx` itself lives at `packages/ui/src/core/app-shell/UserMenu.tsx`, not `packages/ui/src/features/user/`, which doesn't exist), e.g. `{ id: 'ai-filters', labelKey: 'aiFilters', href: '/settings/ai-filters', icon: Sparkles }` (reusing the `Sparkles` icon is intentional — it's the same icon Story 7.4's FilterHub AI trigger already uses, for visual consistency). Also wire the new `aiFilters` label into `apps/web/src/components/layout/AppShellWrapper.tsx`'s `userMenuLabels` object (alongside `locations`/`widgets`/etc.) and the `UserMenu` locale namespace.
- Add the "Save this filter" action button to the `AIFilterOverlay` component (from Story 7.4). The "Save" action calls the `saveAIEventFilter` GraphQL mutation.
- On the `/settings/ai-filters` page, fetch data using the `myAIEventFilters` GraphQL query. Handle loading states according to existing patterns.
- Use `renderAIFilterSummary` from Story 7.3 to display the content of each row.
- Integrate `SwipeToReveal` and `undo` patterns from Story 0.18/0.19 for the deletion action, calling `deleteAIEventFilter(id, action: SoftDeleteAction!)` — Story 7.2a's real signature takes an explicit `action: DELETE | RESTORE` (matching `deleteWidget`/`deleteUserLocation`'s established contract), not an id-only call.
- Update `apps/web/locales/en.json` and `apps/web/locales/id.json` to include all new user-facing strings (empty state messages, "Save this filter", "My AI Filters", etc.) — this project has no separate `i18n/` directory, locale files live at `apps/web/locales/`.

### Architecture Compliance
- Strictly separate UI components (in `@festgrid/ui`) from Next.js page files (in `apps/web`). Component rendering and layout should be presentational and stateless (props driven) inside `packages/ui` whenever possible, while data queries/mutations run in `apps/web` page/component wrappers.
- The Next.js page must maintain the pattern of placing the data-fetching and state management at the `page` or `*-content` level, passing data down to the UI components.
- Do not introduce a shared dependency between backend and frontend validation beyond `@festgrid/shared-types`.

### Library & Framework Requirements
- GraphQL operations must use `@graphql-codegen/cli` generated hooks based on the project's existing GraphQL client configuration.
- Use `next-intl` for all localizations.
- Components use `Shadcn/ui` foundation and `Tailwind CSS`.

### File Structure Requirements
- `apps/web/src/app/[locale]/settings/ai-filters/page.tsx` (and a `*-content.tsx` companion, matching `settings/locations`/`settings/widgets`'s existing page/content split)
- `packages/ui/src/features/events/AIFilterOverlay.tsx` (edit to add save button)
- `packages/ui/src/core/app-shell/profile-menu-entries.ts` (add the new entry; `UserMenu.tsx`/`AppShell.tsx` in the same directory consume it, no direct edit needed there)
- `apps/web/src/components/layout/AppShellWrapper.tsx` (add the new `aiFilters` key to `userMenuLabels`)

### Testing Requirements
- Unit tests for any new helpers or modifications in `packages/domain` (if applicable).
- Integration tests in `apps/web` testing the saving functionality, list rendering, and soft deletion.
- Verify `SwipeToReveal` delete logic works without side effects.
- Must not decrease overall project test coverage.

### Data Type Compatibility Requirements
- Input to `saveAIEventFilter` must map from the resolved output exactly.
- Applying a saved filter to URL query params via `nuqs` must use the same function/mechanism as Story 7.4.

## 3. Project Context Reference
- Ensure all styling strictly adheres to the established Tailwind CSS and Shadcn/ui rules.
- Review `_bmad-output/project-context.md` if further clarification is needed regarding the codebase's strict workspace segregation.
- Adhere strictly to the `SwipeToReveal` interaction pattern established in Story 0.19 and `undo` pattern in Story 0.18.

## 4. Story Completion Status
Status: done

### Dev Agent Record (Completion Notes)
- Successfully implemented the "My AI Filters" list page at `apps/web/src/app/[locale]/settings/ai-filters/page.tsx` with a stateless prop-driven presentation component layout.
- Added "Save this filter" action inside the `AIFilterOverlay` component to save resolved filters synchronously using the `saveAIEventFilter` GraphQL mutation.
- Built a localized empty state with direct CTA to Discovery.
- Integrated standard swipe-to-reveal soft delete with instant feedback and RESTORE-enabled undo callback using `useSoftDeleteWithUndo` hook and `deleteAIEventFilter` GraphQL mutation.
- Fully synchronized generated GraphQL hooks.
- Added comprehensive unit and integration test suites covering happy paths, navigation with query parameters, soft deletion, and undo restore actions. All tests pass with 100% success.

### Independent verification (Claude, before commit)
Correctly followed the corrected spec: `/settings/ai-filters` route (page/`*-content.tsx` split, matching `settings/locations`), the real `profile-menu-entries.ts` registry (not a hallucinated `features/user/UserMenu.tsx`), the real `deleteAIEventFilter(id, action: SoftDeleteAction!)` signature, and the real `useSoftDeleteWithUndo`/`SwipeToReveal` primitives. Preserved my earlier fixes from 7.4 (the manual-edit-detection effect, `useApiKeyStatus`'s null-safety, and my two regression tests) intact while extending `use-ai-filter.ts` with the save/re-prompt flow. No real bugs found this time — full verification suite run regardless, given the pattern of dev-story missing sibling-file regressions at both 7.1a and 7.4: `packages/domain` (189/189), `@festgrid/ui` (346/346, +2 for the new save-flow overlay states), `apps/web` (289/289, +5 for the new page and save-mutation coverage), `apps/web` typecheck matches the exact pre-existing baseline (same 12 errors, none in files this story touched).
