---
backlog_id: FIND-049
title: "assertFormattingFunctionExists's regex only matches export function declarations, false-throws on export const formatX = (...) =>-style formatters"
captured: 2026-09-25
---

# FIND-049: assertFormattingFunctionExists's regex only matches export function declarations, false-throws on export const formatX = (...) =>-style formatters

## Board note (moved verbatim from backlog.yaml, 2026-11-02)

Deferred by the reviewer, 2026-09-25 second-pass code review on Story 0.43: pre-existing pattern risk, not a regression -- every formatting function this repo has today (e.g. format-event-date.ts) uses function declarations, so nothing trips this yet. Fix when a consumer needs an arrow-function-style formatter: either widen the regex or document function-declaration-only as this guard's contract. packages/visual-audit/src/rules/overflow.ts:110-115.
