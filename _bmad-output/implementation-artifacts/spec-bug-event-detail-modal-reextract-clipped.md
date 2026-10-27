---
title: 'Event detail modal as moderator: Re-extract area stretched the dialog past the screen'
type: 'bugfix'
created: '2026-10-26'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-bug-popup-viewport-containment.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Opening an event from a card as a moderator on a phone shows its content laid out ~600px wide inside a 320px dialog: the right side, including the "Re-extract" button, is clipped and unreachable. The earlier responsive matrices missed it because they loaded the direct page route (which is fine) and the popup check only compared an overlay's box to the viewport.

**Approach:** Fix the cause in the shared `DialogContent` (a bare `grid` sizes its single implicit column to its widest child's minimum width; the moderator panel's `truncate`d, no-wrap source URL made that ~600px), and make the popup check detect content wider than its own box, with a scenario that opens the event-detail modal as a moderator.

## Boundaries & Constraints

**Always:** Consumers that set their own grid columns still win (merged by `cn`). Test both the modal route and the direct page route for event detail.

**Never:** Patch only the Re-extract panel; hide the symptom with `overflow-x: hidden` (the dialog already had it, which is why the button was clipped rather than stretching the page).

</frozen-after-approval>

## Code Map

- `apps/web/src/components/ui/dialog.tsx` -- `grid-cols-[minmax(0,1fr)]` on `DialogContent`
- `packages/visual-audit/src/rules/popup-containment.ts`, `src/compare/popup-containment.ts` -- `horizontalOverflowPx` (`scrollWidth - clientWidth`) measured and reported
- `apps/web/e2e/responsive-popups.spec.ts` -- "event detail modal (moderator)" scenario (card click -> modal route -> Re-extract visible)
- `_bmad-output/project-context.md` -- Responsive Containment rule extended

## Tasks & Acceptance

**Execution:**
- [x] Reproduce red: 4/5 viewports failed (content 235-327px wider than the dialog at 320/360/375/412)
- [x] Fix `DialogContent`; re-run green; screenshot at 320 shows the URL truncating and Re-extract fully visible
- [x] Unit test the new rule branch (the 597px-in-320px case); project-context rule

**Acceptance Criteria:**
- Given a moderator opens an event modal at 320-412px, when measured, then the dialog's content is no wider than the dialog and Re-extract is visible.
- Given the direct event page route, when measured, then there is no page-level overflow (unchanged).

## Verification

- `E2E_FAKE_AUTH=1 npx playwright test e2e/responsive-popups.spec.ts` -- all scenarios pass
- `cd packages/visual-audit && pnpm test` -- 96 pass
