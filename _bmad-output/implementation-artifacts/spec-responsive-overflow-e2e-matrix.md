---
title: 'Responsive validation routine: route x viewport page-overflow e2e matrix'
type: 'feature'
created: '2026-10-23'
status: 'done'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-responsive-page-overflow-audit.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-e2e-fake-auth-fixture.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Only Discovery at md/lg/xl is guarded against page-level horizontal overflow (BUG-045). Phone widths, signed-in pages, moderator tools tabs, the moderator view of event detail and the PWA install banner are unguarded, and a failure doesn't say which element stretched the screen.

**Approach:** A Playwright matrix in `apps/web/e2e` that loads each route once, resizes through 320-1440px, and fails with the culprit element when `documentElement.scrollWidth > clientWidth`. It reuses the `@festgrid/visual-audit/page-overflow` detector and the fake-auth fixture for signed-in groups.

## Boundaries & Constraints

**Always:** Fail a redirected, crashed or blank page instead of measuring it. Skip (not pass) signed-in groups when no session is available. Measure every moderator-tools tab, not just the default.

**Never:** Mark a failing route `fixme`/skip to get green; change app source in this story.

</frozen-after-approval>

## Code Map

- `apps/web/e2e/responsive-overflow.spec.ts` -- the matrix (signed out, user, moderator, tools tabs, PWA android + iOS)
- `packages/visual-audit/src/page-overflow-entry.ts` -- light subpath export (`@festgrid/visual-audit/page-overflow`) so e2e avoids ts-morph/sharp
- `packages/visual-audit/src/compare/page-overflow.ts` -- `settleLayout` moved here from the CLI; `src/rules/page-overflow.ts` -- `describeOverflow`
- `apps/web/package.json`, `pnpm-lock.yaml` -- workspace devDependency (lockfile edited by hand: 3 lines; a plain install rewrote 170)

## Tasks & Acceptance

**Execution:**
- [x] Share `settleLayout` + `describeOverflow` from visual-audit; unit-test `describeOverflow`
- [x] Matrix spec across 20 tests; PWA banner mounted via synthetic `beforeinstallprompt` (android) and iPhone UA + visit count (iOS), with the location ask silenced because it outranks the install ask
- [x] Run against the local stack with `E2E_FAKE_AUTH=1`

**Acceptance Criteria:**
- Given a page wider than its viewport, when the matrix runs, then the failure lists each width and the root culprit selector.
- Given no session, when signed-in groups run, then they skip with an instruction, never measure a login prompt.

## Spec Change Log

First run, before any app fix, is red on purpose and finds three root causes: the shared ambient-banner action row (all routes <=412px, and the PWA banner reuses the markup), and the moderator tools container (`div.mx-auto.max-w-6xl.px-4`, 707px wide, all five tabs <=768px). Story C fixes them.

## Verification

- `cd packages/visual-audit && pnpm lint && pnpm test` -- 79 pass
- `E2E_FAKE_AUTH=1 npx playwright test e2e/responsive-overflow.spec.ts` -- red until the bugs are fixed
