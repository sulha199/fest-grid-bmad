---
backlog_id: FIND-063
title: "system-key-adapter tests fail whenever .env defines SYSTEM_GEMINI_API_KEY"
captured: 2026-10-02
---

# FIND-063: system-key-adapter tests fail whenever .env defines SYSTEM_GEMINI_API_KEY

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

The test deletes process.env.SYSTEM_GEMINI_API_KEY but loadBackendEnv() re-reads .env and restores it; 4 tests fail with a key configured. Fixed 2026-10-04 (orchestrator batch-end test-fix pass): set the var to '' instead of deleting it in both affected system-key-adapter.test.ts blocks -- an empty string is still 'defined' in process.env, so loadBackendEnv()'s per-call dotenv.config() leaves it alone instead of refilling it from the repo's real .env.
