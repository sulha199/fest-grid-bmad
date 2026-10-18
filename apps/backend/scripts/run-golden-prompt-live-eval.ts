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
 *
 * Mirrors `resolvePromptToEventFilter` (resolvers.ts): same dedicated GEMINI_FILTER_MODEL and the
 * same `dropUngroundedVenueTypes` post-processing, so drift is measured on what users actually
 * receive. Optional `GOLDEN_EVAL_CATEGORY=<category>` limits the run to one fixture category.
 */
import {
  GOLDEN_PROMPT_FIXTURES,
  dropUngroundedVenueTypes,
  summarizeGoldenPromptDrift,
  transformGeminiResponseToFilterExpression,
} from '@festgrid/domain/ai-event-filters';
import { buildFilterExtractionSystemInstruction, buildFilterExtractionResponseSchema } from '../src/lib/ai-event-filters/build-filter-extraction-request.js';
import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';
import { loadBackendEnv } from '../src/env.js';

// Gemini answers 503 "high demand" (or resets the connection) in bursts; one transient spike must not abort a ~50-call run.
async function callWithRetry<T>(call: () => Promise<T>, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (attempt >= attempts || !/UNAVAILABLE|fetch failed|ECONNRESET/.test(String((err as Error)?.message))) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

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
  const filterModel = loadBackendEnv().geminiFilterModel;
  const onlyCategory = process.env.GOLDEN_EVAL_CATEGORY;
  const fixtures = onlyCategory ? GOLDEN_PROMPT_FIXTURES.filter((f) => f.category === onlyCategory) : GOLDEN_PROMPT_FIXTURES;
  console.log(`Golden-prompt live eval model: ${filterModel}; fixtures: ${fixtures.length}`);
  const results = [];

  for (const fixture of fixtures) {
    const response = await callWithRetry(() =>
      callGeminiGenerateContent(apiKey, {
        contents: `Parse this prompt: "${fixture.prompt}"`,
        systemInstruction,
        responseSchema,
        responseMimeType: 'application/json',
        model: filterModel,
      })
    );
    let parsed: unknown;
    try {
      const rawText = response.text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(rawText);
    } catch {
      results.push({ fixtureId: fixture.id, drifted: true, details: 'live response was not valid JSON' });
      continue;
    }
    const transformed = transformGeminiResponseToFilterExpression(parsed);
    const guarded = dropUngroundedVenueTypes(transformed.expression, fixture.prompt);
    const liveResult = { expression: guarded.expression, caveats: [...transformed.caveats, ...guarded.caveats] };
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
