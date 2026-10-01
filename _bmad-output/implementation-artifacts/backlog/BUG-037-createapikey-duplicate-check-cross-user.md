---
backlog_id: BUG-037
title: "createApiKey's duplicate-key check compared against every user's active keys, not just the caller's own"
captured: 2026-09-18
fixed: 2026-09-18
---

# BUG-037 — createApiKey duplicate check leaked across users

## Capture

`resolvers.ts:434`'s `activeKeys` query for the `DUPLICATE_API_KEY` check had no
`apiKeys.userId` filter — decrypted and compared every active key for the given provider
across ALL users on every `createApiKey` call, so User A could get a false
`DUPLICATE_API_KEY` block because User B happens to have registered the identical key text, and
every key-add unnecessarily decrypted other users' secrets into memory.

Found incidentally: the BUG-015/FIND-020/FIND-017/IDEA-015 ritual-orchestrator quick-dev
dispatch (2026-09-18) never actually implemented its own target scope (spec-only, no code
landed) but its post-check auto-fix pass, triggered by 2 real pre-existing test failures,
correctly root-caused and fixed this one plus an unrelated Story 4.8 test-isolation flake
(`resolvers.test.ts`'s "events - includeMyArchived opt-in bypass" used fixed literal user IDs
that collided with rows other tests create via unfiltered `LIMIT N` selects — switched to
`crypto.randomUUID()` + defensive `accountVotes` cleanup).

## Fix

Added `eq(apiKeys.userId, authUser.userId)` to the `activeKeys` query.

Verified independently: all 74 tests in `resolvers.test.ts` pass (targeted re-run, not the
full suite).
