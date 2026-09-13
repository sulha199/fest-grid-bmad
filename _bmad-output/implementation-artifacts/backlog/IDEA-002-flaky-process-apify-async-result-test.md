---
backlog_id: IDEA-002
title: "Flaky order-dependent assertion in process-apify-async-result.test.ts"
captured: 2026-09-12
status: fixed
resolved: 2026-09-13
---

**Fixed 2026-09-13** (Story 0.i7c's `bmad-quick-dev` auto-dispatch, after this exact
flake reproduced again under full-suite load): both affected queries in
`process-apify-async-result.test.ts` now add `.orderBy(posts.postUrl)`, matching this
row's own root-cause diagnosis below (no explicit tiebreaker on the previously
timestamp-implicit ordering).

`apps/backend/src/lib/scraper/process-apify-async-result.test.ts`'s "skips AJV-invalid
items and persists valid ones" test fails intermittently when run as part of the full
monorepo `pnpm test` suite, but passes cleanly every time in isolation
(`npx tsx --test src/lib/scraper/process-apify-async-result.test.ts`, 4/4 pass).

Failure signature when it does trip:

```
Expected values to be strictly equal:
+ actual - expected
+ 'Valid post 2'
- 'Valid post 1'
```

Seen twice in a row (2026-09-12, during Story 3.6l's post-act verification) as one of
only ~2 failures left once an unrelated local-DB corruption issue (see
`_bmad-output/specs/ritual-session-orchestrator/README.md`'s "Unrelated but
compounding" note) was fixed -- so this is a real, separate, pre-existing flake, not
fallout from that incident or from 3.6l's own changes (the test file wasn't touched by
either 3.4r or 3.6l).

Likely cause: the assertion depends on the persisted order of two posts inserted in
the same test, probably via `created_at DEFAULT now()` with millisecond resolution --
under full-suite load (concurrent DB activity from other test files sharing the same
Postgres instance) two inserts can land in the same millisecond, making insertion
order non-deterministic without an explicit `ORDER BY` tiebreaker (e.g. a sequence
column or explicit insert-order assertion instead of a timestamp-sorted read).

Not yet reproduced deterministically enough to bisect further; flagged here rather
than blocking a story that doesn't own this test file.
