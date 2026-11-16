---
backlog_id: BUG-001
title: "Logo.tsx logotype span still hardcodes 'Grid' — FestDaily rename unfinished"
captured: 2026-08-01
---

# BUG-001: Logo.tsx logotype span still hardcodes 'Grid' — FestDaily rename unfinished

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Verified 2026-09-04: 0 occurrences of 'Daily' in packages/ui/src/core/app-shell/Logo.tsx. Fixed 2026-09-11 (quick-dev) — replaced the hardcoded 'Grid' logotype span in packages/ui/src/core/app-shell/Logo.tsx with 'Daily' (now renders 'FestDaily'), completing CC-002's leftover. Only the '2x2 grid logomark' comment retains the word grid, describing the icon graphic. Verified via pnpm --filter @festgrid/ui test (app-shell: 3 files / 11 tests passed), commit 831800c.
