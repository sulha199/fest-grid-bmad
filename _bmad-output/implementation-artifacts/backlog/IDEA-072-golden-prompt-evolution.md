---
backlog_id: IDEA-072
title: "Let the AI-filter golden prompts grow from real usage"
captured: 2026-10-18
---

# IDEA-072 — Let the AI-filter golden prompts grow from real usage

**Captured:** 2026-10-18. Spawned by BUG-062: the golden suite had no case for vague words
("exciting", "fun", "seru"), so the lite-model failure was never caught.

## Already done (PR #83)

**Metamorphic variants** in the nightly live eval (`GOLDEN_EVAL_VARIANTS=true`): each eligible
fixture also sends one template-generated variant (vague-word prefix, filler, typo in a neutral
word, UPPERCASE) that must resolve to the same leaf fields as its fixture. No hand-written
expectation, no LLM in generation; the kind rotates with `GOLDEN_EVAL_VARIANT_SEED` (default: UTC
day) and the seed is printed so a failure reproduces. A failing variant is a ready candidate
fixture. Logic: `packages/domain/.../golden-prompts/generate-prompt-variants.ts`.

## Not done — the real flywheel

A model must not write its own answer key, so growth has to come from real usage plus a human gate:

1. **Production capture.** When `resolvePromptToEventFilter` returns an empty expression, a
   caveat-only result, or the user immediately re-prompts / edits, log the prompt, resolved
   expression and caveats. **Needs a privacy decision first** (prompts are user text): opt-in,
   anonymised, or shape-only.
2. **Human-gated promotion.** A script turns a captured case into a fixture draft (prompt, the
   model's actual output, blank "ideal") that a person completes and merges.
3. **Drift-triggered mining.** When the nightly flags drift, keep the failing live response as a
   candidate fixture in the report artifact.

## Notes

- The nightly now pauses ~4.5 s between calls (free tier: 15 requests/min) and retries 429/503;
  see FIND-085 for the remaining free-tier daily-cap risk.
- Drop a variant kind from `PROMPT_VARIANT_KINDS` if it proves consistently noisy after the first
  few nights.
