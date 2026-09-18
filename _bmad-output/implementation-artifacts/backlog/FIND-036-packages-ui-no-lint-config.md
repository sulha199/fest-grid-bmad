---
backlog_id: FIND-036
title: "packages/ui has no lint script or ESLint config at all, unlike every sibling package"
captured: 2026-09-18
---

# FIND-036 — packages/ui has no lint config

## Renumbered from FIND-035

A real, separate FIND-035 (daily scraper cron re-requesting a non-incremental window, commit
`5fe85a2`) landed on master first (03:00 UTC) via a concurrent session, before this row's own
originating commit (`59c561e`, 03:46 UTC) — same collision-resolution precedent already used
for this row's own Story 0.40 → 0.41 renumber ("master independently landed its own real Story
0.40 for FIND-034 first").

## Capture

Discovered while wiring Story 1.i1k's own narrow lint guard (FIND-025 finding 2):
`packages/ui/package.json` has no `lint` script and no `eslint.config.mjs` (confirmed by direct
read; every other workspace package — `database`, `domain`, `graphql-select`, `shared-types`,
`apps/backend`, `apps/web` — has one), so `pnpm run lint` (`turbo run lint`) silently skips
`packages/ui` entirely in CI today — has for the whole life of the package.

Story 1.i1k deliberately does NOT fix this broadly: it adds its own minimal, narrowly-scoped
`eslint.config.mjs` (one custom rule, files-scoped to `src/features/events/**`) rather than
retroactively enabling `packages/ui`'s full standard ruleset (`react-internal`, matching every
sibling), which would surface an unknown, unbounded number of pre-existing violations across
the whole package — unrelated blast radius, a real Gate-1-shaped infra gap on its own.

## Promoted

Split into Story 0.41 (Epic 0, tooling/infrastructure gap per the numbering rule; renumbered
from 0.40 on merge with master, which independently landed its own Story 0.40 for FIND-034
first) to give `packages/ui` full lint parity with its siblings as its own reviewable change.
Not yet drafted as a story file — once it is, fold this history into its Dev Notes.
