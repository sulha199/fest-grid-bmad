---
baseline_commit: f809a8e7a10d6808715ba4a62d3c14cfb8f20d2e
---
# Story 5.1b: Build the reusable PostCard component

## Story Details

- Epic: 5
- Story ID: 5.1b
- Status: review

## Story

As a developer,
I want a reusable `PostCard` component and companion `PostCardSkeleton` in `packages/ui`,
So that we can render individual social media posts consistently with fallback images, skeletons, and selectable checkboxes across the Manual Post Selection screen and other social media-related pages.

## Acceptance Criteria

*   **Given** a post object conforming to the standard `Post` interface (Story 5.1a),
*   **When** the `PostCard` is rendered,
*   **Then** it displays the post's text content, publisher information (profile name/platform), and publication date formatted using the active locale.
*   **And** if a post has an image, it renders the image. If the image fails to load, it falls back to a stylized, brand-aligned visual placeholder using the `onError` image-fallback pattern (matching `EventCard`'s fallback pattern at `packages/ui/src/features/events/EventCard.tsx:155-164`).
*   **And** if no image is present, the layout adapts gracefully without leaving blank space or empty image boxes (e.g. content expands to fill space).
*   **And** the component accepts an `isSelected: boolean` prop and an `onSelectionChange: (selected: boolean) => void` callback. Renders a checkbox at the top-right corner; clicking the checkbox triggers `onSelectionChange`.
*   **And** the component accepts a `disabled` prop. If true, the card is visually greyed out, the checkbox is disabled, and clicking the card is a no-op (used for already-extracted posts, Story 5.3).
*   **And** a companion `PostCardSkeleton` component is provided to represent the loading state of the card, minimizing CLS during lazy load.
*   **And** the component is created inside `packages/ui/src/features/posts/PostCard.tsx` (not `apps/web`), ensuring it contains no React Query or GraphQL-client imports and is fully pure and reusable.

## Tasks / Subtasks

- [x] **Task 1: Core Types Declaration** (AC: All)
  - Declare the properties of `PostCardProps` and `PostCardSkeletonProps` inside `packages/ui/src/features/posts/PostCard.types.ts`.
  - Ensure correct reference to `@festgrid/shared-types`'s `Post` interface.

- [x] **Task 2: Component Implementation** (AC: All)
  - Create the `PostCard` and `PostCardSkeleton` inside `packages/ui/src/features/posts/PostCard.tsx`.
  - Handle date formatting with graceful degradation by importing and using `useScopedLocale` and `useScopedTimezone` hooks from `../../hooks`.
  - Implement the `onError` state for imageUrl fallback using React state `imgError` (mirroring `EventCard`).
  - Add a styled checkbox in the top-right corner mapped to `isSelected` and `onSelectionChange`. Ensure clicking the checkbox (or label, if any) correctly toggles selection.
  - Implement the `disabled` state: visually grayed out (using class names like `opacity-60 grayscale` and `cursor-not-allowed`), checkbox set to `disabled`, and mouse events/clicks are a no-op.
  - Create `PostCardSkeleton` with `animate-pulse` styling representing a loading skeleton that mirrors the card's dimensions and layout to avoid Layout Shift (CLS).

- [x] **Task 3: Module Exports** (AC: Pure Exports)
  - Create `packages/ui/src/features/posts/index.ts` exporting `PostCard`, `PostCardSkeleton`, and their types.
  - Add `export * from './features/posts'` to `packages/ui/src/index.ts`.

- [x] **Task 4: Automated Testing** (AC: All)
  - Create `packages/ui/src/features/posts/PostCard.test.tsx` and write comprehensive tests covering:
    - Renders text content, publisher name, and platform icon or label.
    - Gracefully formats the `publishedAt` timestamp using the scoped locale and timezone hooks.
    - Image fallback rendering: mock a broken image and verify the stylized text fallback is rendered.
    - Selection change behavior: verify that checking/unchecking the top-right checkbox triggers `onSelectionChange` with correct boolean.
    - Disabled behavior: verify the card is visually greyed out, checkbox is disabled, and clicks do not trigger selection change.
    - Loading state: verify `PostCardSkeleton` renders correct layout with `animate-pulse` and `aria-busy="true"`.

- [x] **Task 5: Pre-dev Verification & Verification** (AC: Clean build)
  - Verify that tests run successfully and there are no TypeScript compile or ESLint errors:
    - Run `pnpm --filter @festgrid/ui test` to run tests.
    - Run workspace lint and typecheck checks.

## Dev Notes

- **Package boundaries:** Strictly separate responsibilities. No React Query or GraphQL-client queries are permitted within `packages/ui`. This component must remain pure, stateless, and fully driven by props.
- **Image Fallback pattern:** Follow `EventCard`'s pattern:
  ```tsx
  const [imgError, setImgError] = useState(false);
  // inside render:
  {!imgError && imageUrl ? (
    <img src={imageUrl} onError={() => setImgError(true)} ... />
  ) : (
    <div className="flex flex-col items-center justify-center text-muted-foreground bg-muted ...">
      {/* Fallback pattern */}
    </div>
  )}
  ```
- **Social Media Platforms:** Keep platform displays modern and clean. Utilize `PlatformIcon` pattern importing `Instagram` and `Link` from `lucide-react` to match the subscription picker.
- **Nullability and Typing:** Ensure date values are parsed cleanly (Drizzle database timestamps are serialized to ISO-8601 strings; `publishedAt` is a string which we convert to a `Date` object before formatting).

### Architecture & UX Gate Findings

- **Gate 1 (Architecture/Infrastructure Completeness):** Swept by Epic 5 readiness sweep (`epic-5-readiness.md`). No architecture gaps.
- **Gate 2 (UI Complexity & Reusability):** Swept. Splitting `PostCard` as its own reusable presentation component ensures full focus on the image fallback, skeleton loader, and interactive selection checkbox before the Manual Post Selection screen is wired.
- **Gate 3 (Foundational/Cross-Cutting Dependency Completeness):** Swept. Reuses existing `@festgrid/shared-types` models and `useScopedLocale` hooks. No new cross-cutting foundation required.

## Global Rules References

- `_bmad-output/project-context.md` — Core AI and framework rules
- `_bmad-output/planning-artifacts/story-content-structure.md` — Formatting standard
- `_bmad-output/planning-artifacts/epic-readiness/epic-5-readiness.md` — Epic 5 gate sweep
- `_bmad-output/planning-artifacts/story-split-gate.md` — Splitting gates guidelines

## Implementation Plan (Rule-Compliant)

### File Change Plan
- `packages/ui/src/features/posts/PostCard.types.ts` (NEW) — Define TypeScript interfaces.
- `packages/ui/src/features/posts/PostCard.tsx` (NEW) — Implement `PostCard` and `PostCardSkeleton`.
- `packages/ui/src/features/posts/index.ts` (NEW) — Export feature members.
- `packages/ui/src/features/posts/PostCard.test.tsx` (NEW) — Write unit/integration tests using vitest.
- `packages/ui/src/index.ts` (UPDATE) — Add exports for the posts feature.

### Rule Mapping
- **Pure component isolation:** Ensure no direct API or database calls exist in `PostCard.tsx` — enforced by Task 2.
- **Image fallback consistency:** Match `EventCard`'s pattern — mapped to Task 2.
- **Graceful date formatting:** Use `useScopedLocale` / `useScopedTimezone` for formatting — mapped to Task 2 and verified in Task 4.

### Verification Plan
- Run tests: `pnpm --filter @festgrid/ui test`
- Build verification: `pnpm build`
- Linting and type-checking check: `pnpm lint`

## Pre-Coding Approval Gate

- [x] Scope matches the user intent and requirements precisely.
- [x] Architecture design complies with pure component isolation principles.
- [x] Test coverage covers fallback, disabled, selection, and skeleton states exhaustively.
- [x] Explicit human approval state (Approved: shulha, 2026-08-12)

## Testing Requirements

- Write unit tests in `packages/ui/src/features/posts/PostCard.test.tsx` using `vitest` and `@testing-library/react`.
- Mock scoped locale/timezone context using `ScopedLocaleProvider` to verify localized timestamp formatting.
- Verify image `onError` fallback trigger through event simulation.
- Ensure that disabled checkbox prevents the selection callback from firing.

## Deliverables Checklist

- [x] `packages/ui/src/features/posts/PostCard.types.ts`
- [x] `packages/ui/src/features/posts/PostCard.tsx`
- [x] `packages/ui/src/features/posts/index.ts`
- [x] `packages/ui/src/features/posts/PostCard.test.tsx`
- [x] Updated `packages/ui/src/index.ts`

## Out of Scope

- Integrating with the manual selection screen (Story 5.1/5.2) — that is owned by separate story tasks.
- Network API calls to retrieve posts.

## Definition of Done

- All acceptance criteria satisfied.
- Unit tests pass with 100% success on the added components.
- Standard workspace build, lint, and type checking pass successfully.

## Completion Status

- Status: review
- Progress: 100%

## Dev Agent Record

- Story created on 2026-08-12.
- Created by Gemini CLI using ultimate BMad context engine rules.
- Status updated to `in-progress` on 2026-08-12.
- Status updated to `review` on 2026-08-12.

### Completion Notes
- Fully implemented `PostCard` and `PostCardSkeleton` in `packages/ui/src/features/posts/PostCard.tsx` in a completely stateless, pure manner.
- Handled graceful formatting of post publication date utilizing the existing `useScopedLocale` and `useScopedTimezone` hooks with appropriate fallbacks to prevent runtime RangeErrors.
- Implemented `imgError` state so that broken image URLs cleanly fallback to styled placeholders, and adjusted layout dynamically to omit the image element if `imageUrl` is absent.
- Integrated a customized checkbox (utilizing `@festgrid/ui` core's `Checkbox` primitive) in the top-right corner to handle state selection. Handled event click propagation carefully to avoid double-triggers.
- Programmed a greyed out, un-clickable disabled state to represent posts that are already extracted.
- Wrote robust and extensive tests inside `packages/ui/src/features/posts/PostCard.test.tsx` covering core rendering, fallback images, disabled checks, interactive callbacks, and skeleton loaders.
- Confirmed that `pnpm --filter @festgrid/ui test` executes with 100% clean passes, and lint and type-checking pass without any errors in the new codebase paths.
