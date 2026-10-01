---
backlog_id: FIND-019
title: "ModeratorToolsContent test has no Accounts-tab coverage and an inaccurate test name"
captured: 2026-09-05
fixed: 2026-09-14
---

# FIND-019 — ModeratorToolsContent missing Accounts-tab test coverage

## Capture

Deferred from: `moderator-tools-test-missing-message` (2026-09-05). 2 findings.

## Fixed, 2026-09-14 (bmad-quick-dev, commit 3af8d50)

Mocked `./moderator-accounts-content` in `moderator-tools-content.test.tsx` the same way its
sibling tab content components are already mocked (removing the inconsistent unmocked third
tab), and added real assertions for the Accounts tab: its trigger renders and is labeled
correctly (`getByRole('tab', { name: /accounts/i })`), it is not mounted by default, and it
mounts `ModeratorAccountsContent` on tab-switch along with the URL-param update.

Also renamed the `it(...)` description from the inaccurate "renders both tab triggers..." to
"renders all three tab triggers, matches active tab, and updates URL on tab switch".

Verified via targeted vitest (moderator/tools directory: 26 tests pass), lint clean (only two
pre-existing any-type warnings).
