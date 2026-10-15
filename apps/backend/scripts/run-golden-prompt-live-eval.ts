/*
 * Opt-in live-Gemini drift eval for the golden-prompt fixture suite (Story 9.7 AC2).
 *
 * NOT part of `pnpm --filter @festgrid/backend test`, `dev-story`'s verification, or PR CI --
 * this script makes real, billable calls to the live Gemini API and is a strict no-op unless
 * explicitly opted into via RUN_LIVE_GEMINI_EVAL=true. Invoked by
 * .github/workflows/ai-filter-golden-prompt-nightly-eval.yml (schedule + workflow_dispatch) or
 * manually: `RUN_LIVE_GEMINI_EVAL=true GEMINI_NIGHTLY_EVAL_API_KEY=... BACKEND_PORT=4001
 * pnpm --filter @festgrid/backend exec tsx scripts/run-golden-prompt-live-eval.ts`.
 *
 * Deliberately bypasses the full callGemini()/BYOK key-selection orchestration
 * (apps/backend/src/lib/ai-gateway/adapter.ts) -- this script has no authenticated user and no
 * DB-stored key to select from. It calls callGeminiGenerateContent (gemini-client.ts) directly
 * with a dedicated, platform-funded GEMINI_NIGHTLY_EVAL_API_KEY, structurally isolated from
 * both BYOK keys and SYSTEM_GEMINI_API_KEY (see SETUP_WALKTHROUGH.md #8).
 */
import {
  GOLDEN_PROMPT_FIXTURES,
  summarizeGoldenPromptDrift,
  transformGeminiResponseToFilterExpression,
} from '@festgrid/domain/ai-event-filters';
import { buildFilterExtractionSystemInstruction, buildFilterExtractionResponseSchema } from '../src/lib/ai-event-filters/build-filter-extraction-request.js';
import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';

async function main(): Promise<void> {
  if (process.env.RUN_LIVE_GEMINI_EVAL !== 'true') {
    console.log('RUN_LIVE_GEMINI_EVAL is not "true" -- skipping live Gemini golden-prompt eval (this is the expected no-op state for every PR/dev-story run).');
    return;
  }
  const apiKey = process.env.GEMINI_NIGHTLY_EVAL_API_KEY;
  if (!apiKey) {
    throw new Error('RUN_LIVE_GEMINI_EVAL=true but GEMINI_NIGHTLY_EVAL_API_KEY is not set.');
  }

  const systemInstruction = buildFilterExtractionSystemInstruction();
  const responseSchema = buildFilterExtractionResponseSchema();
  const results = [];

  for (const fixture of GOLDEN_PROMPT_FIXTURES) {
    const response = await callGeminiGenerateContent(apiKey, {
      contents: `Parse this prompt: "${fixture.prompt}"`,
      systemInstruction,
      responseSchema,
      responseMimeType: 'application/json',
    });
    let parsed: unknown;
    try {
      const rawText = response.text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(rawText);
    } catch {
      results.push({ fixtureId: fixture.id, drifted: true, details: 'live response was not valid JSON' });
      continue;
    }
    const liveResult = transformGeminiResponseToFilterExpression(parsed);
    results.push(summarizeGoldenPromptDrift(fixture, liveResult));
  }

  const drifted = results.filter((r) => r.drifted);
  console.log(`Golden-prompt live eval: ${results.length} fixtures, ${drifted.length} drifted.`);
  for (const r of drifted) {
    console.log(`::warning::Golden-prompt drift on "${r.fixtureId}": ${r.details}`);
  }
  if (drifted.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
