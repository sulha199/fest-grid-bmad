---
title: 'Configurable Gemini post quota'
type: 'feature'
created: '2026-09-07'
status: 'done'
route: 'one-shot'
---

# Configurable Gemini post quota

## Intent

**Problem:** The per-key extraction quota is hardcoded to 50 posts, so deployments cannot tune the quota without changing backend source code.

**Approach:** Add `GEMINI_POSTS_PER_KEY_PER_CYCLE` to backend configuration with a default of 300, and use it consistently for quota reporting and mutation enforcement. Wire the variable through deployment and example setup configuration.

## Suggested Review Order

1. [`apps/backend/src/env.ts`](../../apps/backend/src/env.ts) — confirm the default, override parsing, and invalid-value guard.
2. [`apps/backend/src/schema/resolvers.ts`](../../apps/backend/src/schema/resolvers.ts) — confirm both quota calculation paths use the configured value.
3. [`apps/infrastructure/lib/festgrid-backend-stack.ts`](../../apps/infrastructure/lib/festgrid-backend-stack.ts) — confirm production Lambda wiring.
4. [`.env.example`](../../.env.example) and [`SETUP_WALKTHROUGH.md`](../../SETUP_WALKTHROUGH.md) — confirm local configuration guidance.
