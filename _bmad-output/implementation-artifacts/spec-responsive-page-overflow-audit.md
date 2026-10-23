---
title: 'Responsive page-overflow audit: detector + route×viewport sweep'
type: 'feature'
created: '2026-10-23'
status: 'draft'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/project-context.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-bug-045-masonry-horizontal-overflow.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Only Discovery (`/en`, md/lg/xl) is tested for page-level horizontal overflow (BUG-045). Other routes and narrow phone widths are unchecked, and when overflow does occur nothing names the element that stretched the page.

**Approach:** Add a reusable in-page detector to `packages/visual-audit` that reports document-level overflow plus the culprit elements, and a CLI sweep that runs it over every public route at 320–1440px against a running dev stack, writing a findings report. This is the audit only (step 1 of 2); the permanent e2e matrix spec is a separate follow-up.

## Boundaries & Constraints

**Always:** Detector logic that needs no browser (offender ranking, selector-path formatting, report rendering) is pure and unit-tested with `tsx --test` per project-context's Meta-Testing tier. Browser-driving code is proven by running the sweep for real, not mocked. The detector must work with `page.evaluate` only (no app code changes).

**Ask First:** Fixing any overflow the audit finds (they become separate `spec-bug-*` specs); auditing auth-gated routes (`moderator/*`, `settings/*`, `favorites`, `my-calendar`, `reports`, `votes`) beyond what works without a login.

**Never:** Modify `apps/web` or `packages/ui` source; add the permanent e2e spec (step 2); use `fixtures.mount()` isolated render for this (page-level overflow needs the real shell + CSS).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| No overflow | `scrollWidth <= clientWidth` | `{ overflowPx: 0, offenders: [] }` | N/A |
| Page stretched | `scrollWidth > clientWidth` | `overflowPx` = delta; offenders = elements whose right edge > viewport, innermost/widest-first, each with selector path, rect, tag/classes | N/A |
| Intentional clip | Offender inside an `overflow-x: auto/hidden/clip` ancestor | Not reported (cannot widen the document) | N/A |
| Fixed/off-screen | `position: fixed`, `visibility:hidden`, `display:none`, 0-size | Ignored | N/A |
| Route unreachable | Non-2xx / navigation timeout | Row marked `error` in report, sweep continues | Never abort the sweep |

</frozen-after-approval>

## Code Map

- `packages/visual-audit/src/page-overflow.ts` -- NEW: `detectPageOverflow(page)` (page.evaluate) + pure `rankOffenders`, `formatSelectorPath`
- `packages/visual-audit/src/page-overflow-report.ts` -- NEW: pure markdown/JSON report renderer
- `packages/visual-audit/src/cli/page-overflow-audit.ts` -- NEW: route×viewport sweep CLI (`BASE_URL`, `--routes`, `--out`)
- `packages/visual-audit/src/index.ts` -- export new public API
- `packages/visual-audit/page-overflow.test.ts` -- NEW: unit tests for pure parts
- `packages/visual-audit/package.json` -- `audit:page-overflow` script
- `apps/web/src/app/[locale]/**/page.tsx` -- route inventory source (read-only)
- `apps/web/e2e/discovery.spec.ts:29` -- existing BUG-045 check (read-only; superseded in step 2)
- `_bmad-output/implementation-artifacts/page-overflow-audit-2026-10-23.md` -- NEW: generated findings report

## Tasks & Acceptance

**Execution:**
- [ ] `packages/visual-audit/src/page-overflow.ts` -- implement detector and pure helpers -- shared by CLI now and e2e spec in step 2
- [ ] `packages/visual-audit/src/page-overflow-report.ts` -- render findings grouped by route → viewport → offenders -- human-readable audit output
- [ ] `packages/visual-audit/src/cli/page-overflow-audit.ts` -- sweep public routes at 320/360/375/390/412/768/1024/1280/1440, resolve dynamic params (event slug, platform/username) from links found on `/en`, skip-and-record unreachable routes -- the audit
- [ ] `packages/visual-audit/page-overflow.test.ts` -- cover each I/O matrix row for the pure functions -- Meta-Testing tier unit bar
- [ ] `packages/visual-audit/src/index.ts`, `package.json` -- export + script -- usable from other packages
- [ ] Run the sweep against local dev stack (Postgres seeded, backend :4001, web :3000) and commit the generated report -- real integration proof

**Acceptance Criteria:**
- Given a page whose `scrollWidth` exceeds `clientWidth`, when `detectPageOverflow` runs, then it returns the overflow in px and at least the element(s) whose right edge crosses the viewport, with a stable CSS selector path.
- Given the sweep completes, when the report is read, then every audited route×viewport appears as pass, overflow (with offenders), or error, and no route is silently omitted.
- Given `pnpm --filter @festgrid/visual-audit test` and `lint`, when run, then both pass.

## Design Notes

Document overflow = `documentElement.scrollWidth - documentElement.clientWidth`. Offender scan walks `document.body` descendants, keeps those with `rect.right > clientWidth + 0.5` and visible, drops any with a clipping ancestor (`overflow-x` not `visible`) strictly below `<body>`, and drops descendants of an already-reported offender so the report names the outermost cause plus the widest leaf.

## Verification

**Commands:**
- `pnpm --filter @festgrid/visual-audit test` -- expected: pass
- `pnpm --filter @festgrid/visual-audit lint` -- expected: 0 warnings
- `pnpm --filter @festgrid/visual-audit audit:page-overflow` -- expected: report written, exit 0 even when overflow is found
