---
backlog_id: FIND-085
title: "Nightly golden-prompt eval runs on a free-tier Gemini key: paced to ~13/min but a daily cap can still truncate the ~116-call run"
captured: 2026-10-18
---

# FIND-085: Nightly golden-prompt eval runs on a free-tier Gemini key: paced to ~13/min but a daily cap can still truncate the ~116-call run

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Fixed 2026-10-21 without needing a paid key: the free-tier flash cap is ~20 requests/day (the full run is 49 fixtures + 39 variants = 88 calls), so the nightly now runs a GOLDEN_EVAL_DAILY_BUDGET-sized window and leaves the rest pending. planGoldenEvalWindow (packages/domain) picks never-evaluated fixtures, then last night's drift (capped at 25% of the budget), then the stalest, rotating across categories; the ledger rides between nights in actions/cache; a per-day 429 ends the run early as a warning. Verified against a stubbed Gemini over a 7-night simulation (full rotation in 5 nights) -- the first live windowed run is the next scheduled nightly. Original advice follows: use a paid GEMINI_NIGHTLY_EVAL_API_KEY and set GOLDEN_EVAL_MIN_INTERVAL_MS to 0, or unset GOLDEN_EVAL_VARIANTS on most nights (now: remove GOLDEN_EVAL_DAILY_BUDGET).
