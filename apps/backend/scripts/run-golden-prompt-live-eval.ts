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
 *
 * `GOLDEN_EVAL_VARIANTS=true` additionally sends ONE metamorphic variant per eligible fixture
 * (vague-word prefix, filler, typo, uppercase -- see generate-prompt-variants.ts) and requires it to
 * resolve to the same leaf fields as its fixture. The variant kind rotates with
 * `GOLDEN_EVAL_VARIANT_SEED` (default: the UTC day number), so coverage widens night by night while
 * any failure stays reproducible by re-running with the printed seed.
 */
import {
  GOLDEN_PROMPT_FIXTURES,
  dropUngroundedVenueTypes,
  pickPromptVariant,
  summarizeGoldenPromptDrift,
  summarizeMetamorphicDrift,
  transformGeminiResponseToFilterExpression,
} from '@festgrid/domain/ai-event-filters';
import { buildFilterExtractionSystemInstruction, buildFilterExtractionResponseSchema } from '../src/lib/ai-event-filters/build-filter-extraction-request.js';
import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';
import { loadBackendEnv } from '../src/env.js';
import { nextEvalRetryDelayMs } from '../src/lib/ai-gateway/eval-retry-policy.js';

// Free-tier keys allow ~15 requests/minute, and a run with variants makes ~120 calls: space calls
// out (default 4.5s ~= 13/min) instead of only reacting to 429s. Set GOLDEN_EVAL_MIN_INTERVAL_MS=0
// for a paid key.
const MIN_INTERVAL_MS = Number(process.env.GOLDEN_EVAL_MIN_INTERVAL_MS ?? 4500);
let lastCallAt = 0;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// One transient failure (503, connection reset, per-minute 429) must not abort a ~120-call run.
// A per-day quota or a non-transient error propagates immediately (see eval-retry-policy.ts).
async function callWithRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    try {
      return await call();
    } catch (err) {
      const delayMs = nextEvalRetryDelayMs(String((err as Error)?.message), attempt);
      if (delayMs === undefined) throw err;
      console.log(`Gemini call failed (attempt ${attempt}); retrying in ${Math.round(delayMs / 1000)}s: ${String((err as Error)?.name)}`);
      await sleep(delayMs);
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

  // Same pipeline as `resolvePromptToEventFilter`: Gemini -> transform -> venueType guard.
  async function resolveLive(prompt: string) {
    const response = await callWithRetry(() =>
      callGeminiGenerateContent(apiKey!, {
        contents: `Parse this prompt: "${prompt}"`,
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
      return undefined;
    }
    const transformed = transformGeminiResponseToFilterExpression(parsed);
    const guarded = dropUngroundedVenueTypes(transformed.expression, prompt);
    return { expression: guarded.expression, caveats: [...transformed.caveats, ...guarded.caveats] };
  }

  const runVariants = process.env.GOLDEN_EVAL_VARIANTS === 'true';
  const seed = Number(process.env.GOLDEN_EVAL_VARIANT_SEED ?? Math.floor(Date.now() / 86_400_000));
  if (runVariants) {
    console.log(`Metamorphic variants enabled; seed=${seed} (re-run with GOLDEN_EVAL_VARIANT_SEED=${seed} to reproduce).`);
  }
  const variantResults = [];

  for (const [index, fixture] of fixtures.entries()) {
    const liveResult = await resolveLive(fixture.prompt);
    if (liveResult) {
      results.push(summarizeGoldenPromptDrift(fixture, liveResult));
    } else {
      results.push({ fixtureId: fixture.id, drifted: true, details: 'live response was not valid JSON' });
    }

    const variant = runVariants ? pickPromptVariant(fixture, index, seed) : undefined;
    if (variant) {
      const variantLive = await resolveLive(variant.prompt);
      variantResults.push(
        variantLive
          ? summarizeMetamorphicDrift(fixture, variant, variantLive)
          : { fixtureId: fixture.id, kind: variant.kind, variantPrompt: variant.prompt, drifted: true, details: 'live response was not valid JSON' }
      );
    }
  }

  const drifted = results.filter((r) => r.drifted);
  console.log(`Golden-prompt live eval: ${results.length} fixtures, ${drifted.length} drifted.`);
  for (const r of drifted) {
    console.log(`::warning::Golden-prompt drift on "${r.fixtureId}": ${r.details}`);
  }
  const driftedVariants = variantResults.filter((r) => r.drifted);
  if (runVariants) {
    console.log(`Metamorphic variants: ${variantResults.length} run, ${driftedVariants.length} drifted.`);
    // A drifted variant is a candidate new fixture: promote its prompt (with the correct, human-
    // reviewed expectation) into golden-prompt-fixtures.ts so the regression is pinned permanently.
    for (const r of driftedVariants) {
      console.log(`::warning::Metamorphic drift on "${r.fixtureId}" (${r.kind}, seed ${seed}): ${r.details}`);
    }
  }
  if (drifted.length > 0 || driftedVariants.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
