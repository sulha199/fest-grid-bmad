---
title: 'Responsive page-overflow audit: detector + route×viewport sweep'
type: 'feature'
created: '2026-10-23'
status: 'done'
baseline_commit: 'eb7079960ba508dc616d42e2c4666142bf87cd23'
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

- `packages/visual-audit/src/rules/page-overflow.ts` -- pure: `formatSelectorPath`, `rankOffenders`, `buildPageOverflowResult`, `classifyPageHealth`, `shortenPath`, `culpritKey`
- `packages/visual-audit/src/compare/page-overflow.ts` -- `detectPageOverflow(page)` in-page DOM walk (+ `installEvaluateHelpers` for the tsx `__name` quirk)
- `packages/visual-audit/src/rules/page-overflow-report.ts` -- pure markdown renderer (matrix, distinct culprits, per-route findings, caveats)
- `packages/visual-audit/src/cli/page-overflow-audit.ts` -- route×viewport sweep CLI (`BASE_URL`, `CHROMIUM_EXECUTABLE_PATH`, `--routes`, `--widths`, `--out`)
- `packages/visual-audit/page-overflow.test.ts` -- unit tests for the pure parts
- `packages/visual-audit/src/index.ts`, `package.json` -- exports + `audit:page-overflow` script
- `apps/web/e2e/discovery.spec.ts:29` -- existing BUG-045 check (read-only; superseded in step 2)
- `_bmad-output/implementation-artifacts/page-overflow-audit-2026-10-23.md` -- generated findings report

## Tasks & Acceptance

**Execution:**
- [x] `packages/visual-audit/src/rules/page-overflow.ts`, `src/compare/page-overflow.ts` -- detector and pure helpers
- [x] `packages/visual-audit/src/rules/page-overflow-report.ts` -- report renderer
- [x] `packages/visual-audit/src/cli/page-overflow-audit.ts` -- sweep (static routes + event slug discovered by opening the first card; account route skipped when no link is found; gated routes recorded as caveats)
- [x] `packages/visual-audit/page-overflow.test.ts` -- unit tests (76 pass package-wide)
- [x] `packages/visual-audit/src/index.ts`, `package.json` -- export + script
- [x] Run the sweep against the local dev stack and keep the report

**Acceptance Criteria:**
- Given a page whose `scrollWidth` exceeds `clientWidth`, when `detectPageOverflow` runs, then it returns the overflow in px and at least the element(s) whose right edge crosses the viewport, with a stable CSS selector path.
- Given the sweep completes, when the report is read, then every audited route×viewport appears as pass, overflow (with offenders), or error, and no route is silently omitted.
- Given `pnpm --filter @festgrid/visual-audit test` and `lint`, when run, then both pass.

## Design Notes

Audit lessons baked into the tool: (1) a crashed or blank page reads as "no overflow", so `classifyPageHealth` turns uncaught page errors / the Next error screen into an `error` row; (2) client-side UI that appears late (the location banner) makes results timing-dependent, so the sweep waits for layout to stop changing before measuring.

Document overflow = `documentElement.scrollWidth - documentElement.clientWidth`. Offender scan walks `document.body` descendants, keeps those with `rect.right > clientWidth + 0.5` and visible, drops any with a clipping ancestor (`overflow-x` not `visible`) strictly below `<body>`, and drops descendants of an already-reported offender so the report names the outermost cause plus the widest leaf.

## Verification

**Commands:**
- `pnpm --filter @festgrid/visual-audit test` -- expected: pass
- `pnpm --filter @festgrid/visual-audit lint` -- expected: 0 warnings
- `pnpm --filter @festgrid/visual-audit audit:page-overflow` -- expected: report written, exit 0 even when overflow is found

## Suggested Review Order

**Detection (the core idea)**

- In-page walk: finds elements whose right edge crosses the viewport, skipping clipped/fixed/hidden ones.
  [`page-overflow.ts:48`](../../packages/visual-audit/src/compare/page-overflow.ts#L48)

- Roots (no overflowing ancestor) rank first: that is where the overflow starts.
  [`page-overflow.ts:82`](../../packages/visual-audit/src/rules/page-overflow.ts#L82)

**Not trusting a clean result**

- A crashed or blank page reads as "no overflow"; this turns it into an error row instead.
  [`page-overflow.ts:124`](../../packages/visual-audit/src/rules/page-overflow.ts#L124)

- Waits for layout to stop moving, because the location banner mounts about 1s after hydration.
  [`page-overflow-audit.ts:53`](../../packages/visual-audit/src/cli/page-overflow-audit.ts#L53)

**Sweep and report**

- Route discovery clicks the first event card; account route is skipped when no link exists.
  [`page-overflow-audit.ts:81`](../../packages/visual-audit/src/cli/page-overflow-audit.ts#L81)

- Same element across routes collapses to one culprit instead of 85 repeated lines.
  [`page-overflow-report.ts:87`](../../packages/visual-audit/src/rules/page-overflow-report.ts#L87)

- Same-element grouping ignores sibling slot (`nth-of-type`) differences.
  [`page-overflow.ts:139`](../../packages/visual-audit/src/rules/page-overflow.ts#L139)

**Findings and wiring**

- The generated audit report: one culprit, 85 of 153 checks overflowing.
  [`page-overflow-audit-2026-10-23.md`](page-overflow-audit-2026-10-23.md)

- Script entry point.
  [`package.json:17`](../../packages/visual-audit/package.json#L17)

**Tests**

- Unit tests for the pure logic: ranking, grouping, health, report rendering.
  [`page-overflow.test.ts:35`](../../packages/visual-audit/page-overflow.test.ts#L35)

## Review Findings

Code review (2026-10-24) of `eb70799..e965f1f`: Blind Hunter, Edge Case Hunter and Acceptance Auditor (all three layers ran; none failed). 0 `decision-needed`, 26 `patch` (all applied), 4 `defer` clusters (`FIND-092`), about 30 dismissed as noise or already handled.

- [x] [Review][Patch] Fake-auth guard ran after the destructive seed; now `assertFakeAuthPreconditions` runs first [apps/web/e2e/global-setup.ts]
- [x] [Review][Patch] Guard never checked the configured `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`; now rejects a non-loopback value [apps/web/test-support/fake-auth/local-guard.ts]
- [x] [Review][Patch] Reused servers keep the Supabase URL they started with; `assertBackendTrustsStub` sends a stub token to the backend and fails with the fix [apps/web/test-support/fake-auth/index.ts]
- [x] [Review][Patch] Port left bound when setup threw after the stub started; now closed on every failure path [apps/web/test-support/fake-auth/index.ts]
- [x] [Review][Patch] `EADDRINUSE` (e.g. a local Supabase CLI on 54321) gets an explanatory error; corrupt key file regenerates; JWKS path ignores a query string [apps/web/test-support/fake-auth/fake-supabase.ts]
- [x] [Review][Patch] Stub URL is `127.0.0.1` (it binds IPv4 only; `localhost` may resolve to `::1`); guard accepts all of 127.0.0.0/8, rejects `0.0.0.0` and a `?host=` DB override [apps/web/test-support/fake-auth/]
- [x] [Review][Patch] Signed-in groups could measure the login prompt if the session was rejected; `expectSignedIn` requires the profile menu first [apps/web/e2e/responsive-overflow.spec.ts]
- [x] [Review][Patch] HTTP status ignored (a 404 passed); health re-checked after the width sweep; `settleLayout` "never settled" surfaced as an annotation; tab loop scoped to the first tablist; timeout 120s -> 300s [apps/web/e2e/responsive-overflow.spec.ts]
- [x] [Review][Patch] `classifyPageHealth` missed Next's 404 and runtime-error overlay text [packages/visual-audit/src/rules/page-overflow.ts]
- [x] [Review][Patch] Element scan cap was silent; result now carries `truncated` and `describeOverflow` says so, also names extra roots and the no-culprit case [packages/visual-audit/src/]
- [x] [Review][Patch] Report: summary arithmetic, "No overflow detected" contradicting overflow rows, unescaped error text [packages/visual-audit/src/rules/page-overflow-report.ts]
- [x] [Review][Patch] CLI: `--widths` typos silently dropped, `--routes` without a slash or with a query read as a redirect, `/en` exempt from the redirect check, no guard against auditing a remote site [packages/visual-audit/src/cli/page-overflow-audit.ts, src/rules/audit-args.ts]
- [x] [Review][Patch] `TabbedShell`: active tab not scrolled into view; scroll box clipped the focus ring [packages/ui/src/core/tabbed-shell/TabbedShell.tsx]
- [x] [Review][Patch] Token "matches DESIGN.md" test only compared strings to themselves; now reads DESIGN.md [packages/ui/src/core/ambient-capability-banner-tokens.test.ts]
- [x] [Review][Patch] Hydration fix had no unit test; `renderToString` regression test added [apps/web/src/lib/hooks/usePwaInstallPrompt.test.ts]
- [x] [Review][Patch] Untested pure branches (masked/missing cells, `describeOverflow` variants, `MAX` truncation, `startFakeAuth` throwing before opening a port) now have named cases
- [x] [Review][Patch] "Android" PWA test name overstated (no Android UA is set); renamed
- [x] [Review][Defer] Detector v1 blind spots (absolute-positioned escape, left-edge/RTL, translated drawers, deep recursion) [packages/visual-audit/src/compare/page-overflow.ts] -- deferred, accepted limitation
- [x] [Review][Defer] Path-prefix ancestry and `culpritKey` grouping can merge elements with a truncated identical path [packages/visual-audit/src/rules/page-overflow.ts] -- deferred, no collision observed
- [x] [Review][Defer] `settleLayout` signature blind to class-only changes; duplicated route/width lists; hard-coded English labels and storage keys in the PWA tests -- deferred, low
- [x] [Review][Defer] Stub does not emulate `/auth/v1/user` or token refresh; fixed port -- deferred, app only calls `getSession()` today

Dismissed (verified false or by design): `.auth` not git-ignored (it is: `.gitignore:22`), `PageContainer` drops `space-y-8` (it includes it), `::1` / `[::1]` handling (covered by tests), `.js` specifiers in the TS export (Playwright and Vite resolve them), `seed.ts` imported for `FIXTURE_USERS` (guarded by `require.main`), `E2E_AUTH_STORAGE_STATE ??=` (opt-in by design, now commented), cumulative `pageErrors` in the CLI (any page error taints the page).

Spec reconciliation: `rankOffenders` keeps descendants and ranks outermost roots first (the Design Notes and Review Order), not "innermost/widest-first" as the I/O matrix row reads; the Design Notes sentence "drops descendants" is superseded by the `isRoot` / `descendantCount` model. The frozen block is left untouched.

