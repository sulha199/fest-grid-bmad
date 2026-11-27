## What and why

<!-- One or two sentences. Link the story or issue. -->

## Checks

- [ ] `pnpm run lint`, `pnpm run test` pass for the touched packages
- [ ] **UI in the navbar, event list or event detail (skip otherwise):**
  - [ ] every new or changed control has a case in `packages/ui/src/a11y/` (axe, keyboard, screen reader) and `pnpm run test:a11y` passes
  - [ ] icon-only controls use `IconButton`, toggles use `ToggleIconButton` (name fixed, state in `aria-pressed`)
  - [ ] a popup is a Radix primitive, or a menu that follows the WAI-ARIA menu button pattern
  - [ ] keyboard-only pass done on the changed screen (Tab, Shift+Tab, Enter, Space, arrows, Escape), or "not done" is said here
  - [ ] no claim of "WCAG compliant": the automated suites do not prove it (see `_bmad-output/project-context.md`, Accessibility rule 8)
