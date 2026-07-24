---
baseline_commit: HEAD
---

# Story 0.3: Set up Shadcn/UI and configure themes

Status: done

## Story

**As a** developer,
**I want** to set up Shadcn/UI in the Next.js app and configure it with the project's color palette and themes,
**So that** I can use a consistent and accessible component library for building the user interface.

## Acceptance Criteria

1. **Given** the Next.js app is initialized,
2. **When** I add a new Shadcn/UI component to the project,
3. **Then** the component is styled with the project's themes (e.g., primary, secondary, accent colors).
4. **And** the application supports both light and dark themes.

## Tasks / Subtasks

- [x] Task 1: Initialize Shadcn UI in the Next.js app (`apps/web/`) (AC: 1)
  - [x] Run Shadcn CLI to initialize configuration in `apps/web/`
  - [x] Verify `components.json`, `tailwind.config.ts` (or JS), and globals.css are generated correctly
- [x] Task 2: Configure project themes and font (AC: 3, 4)
  - [x] Add `next-themes` and set up `ThemeProvider` to support light/dark modes
  - [x] Configure `Inter` font in Next.js layout
  - [x] Define the UX color palette in Tailwind config and CSS variables, including FestGrid and Wizard specifications:
        - primary: "#1E293B"
        - secondary: "#6366F1"
        - accent: "#FF5A5F"
        - neutral: "#FAFAFC"
        - success: "#10B981"
        - error: "#EF4444"
        - background: "#F9FAFB" (from Wizard DESIGN.md)
        - foreground (text): "#111827" (from Wizard DESIGN.md)
        - wizard-primary: "#3B82F6"
        - wizard-secondary: "#6B7280"
  - [x] Set base corner radius to `0.5rem` (from FestGrid DESIGN.md)
- [x] Task 3: Test component installation and styling (AC: 2)
  - [x] Install basic Shadcn components (e.g., Button, Card, Dialog)
  - [x] Implement them on the main page to verify styling matches the color palettes, button disabled states match Wizard design, and dark/light toggle works

### Review Findings

- [x] [Review][Patch] Inter font not configured in Tailwind [apps/web/tailwind.config.ts]
- [x] [Review][Patch] Tailwind CSS vs PostCSS plugin versions mismatch [apps/web/package.json]

## Dev Notes

- **Workspace Path:** Ensure Shadcn commands are run specifically within `apps/web/`, not the monorepo root. Use `cd apps/web && pnpm dlx shadcn@latest init` or similar.
- **Theme Support:** For Next.js 15, `next-themes` is the standard approach for dark/light mode switching. Wrap the root layout's children in the `ThemeProvider`.
- **CSS Variables:** Shadcn relies heavily on CSS variables. You will map the project's UX colors to Shadcn's CSS variables (e.g. `--primary`, `--secondary`, `--destructive` for error) inside `globals.css` or equivalent.
- **Font Integration:** "Inter" is specified in the design. Use Next.js `next/font/google` for optimized loading and assign it to a CSS variable to be used by Tailwind.

## Developer Context

### Architecture Compliance
- The UI must be implemented in the frontend application package (`apps/web/`).
- Components must be ready to support LTR/RTL layouts and i18n (as noted in project context) for future expansion. Keep UI clean and responsive.
- Accessibility (WCAG 2.1 AA) is a requirement. Shadcn's Radix UI foundation helps with this, so do not override accessibility defaults unless necessary.

### Library / Framework Requirements
- **Next.js:** version 15+ (App Router).
- **React:** version 19.
- **Tailwind CSS:** Ensure the Tailwind configuration properly references the Shadcn UI color variables and paths.
- **Shadcn UI:** Use the official CLI.

### File Structure Requirements
- `apps/web/components/ui/` should hold all generated Shadcn components.
- `apps/web/components/providers/` can hold the `ThemeProvider`.
- Update `apps/web/app/layout.tsx` to include the theme provider and font.
- `apps/web/tailwind.config.ts` and `apps/web/app/globals.css` must house the color tokens and theme setup.

### Testing Requirements
- E2E testing will eventually cover UI, but for this story, manual verification or a simple component test is sufficient to ensure the themes load and toggling works without errors.
- Ensure adding the button component and rendering it doesn't break the build (`pnpm build`).

### Previous Story Intelligence
- Story 0.2 set up strict ESLint flat configs (`eslint.config.mjs`) and TypeScript configs.
- Any generated files by Shadcn might trigger ESLint rules or TypeScript strictness. Be prepared to configure ESLint to ignore certain Shadcn generated files if they violate strict rules, or fix them to comply.

### Project Context Reference
- **Theme Palette:** Derived from `UX-festgrid-run-1/DESIGN.md` and `UX-wizard-page-run-1/DESIGN.md`. Ensure both FestGrid core colors and Wizard specific colors (like background `#F9FAFB`, text `#111827`, and wizard-specific primary/secondary) are configured.
- **Base Radius:** `0.5rem` from `UX-festgrid-run-1/DESIGN.md`.
- **Font:** "Inter, sans-serif" from `UX-festgrid-run-1/DESIGN.md` and `UX-wizard-page-run-1/DESIGN.md`.
- **Component Behaviors:** Note the button states (disabled state opacity and not-allowed cursor) defined in `UX-wizard-page-run-1/DESIGN.md`, as well as soft-delete/modal patterns in `UX-festgrid-run-1/EXPERIENCE.md`.

---
*Ultimate context engine analysis completed - comprehensive developer guide created*
