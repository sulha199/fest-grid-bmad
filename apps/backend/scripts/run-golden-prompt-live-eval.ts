/*
 * Opt-in live-Gemini drift eval for the golden-prompt fixture suite (Story 9.7 AC2).
 *
 * NOT part of `pnpm --filter backend test`, `dev-story`'s verification, or PR CI --
 * this script makes real, billable calls to the live Gemini API and is a strict no-op unless
 * explicitly opted into via RUN_LIVE_GEMINI_EVAL=true. Invoked by
 * .github/workflows/ai-filter-golden-prompt-nightly-eval.yml (schedule + workflow_dispatch) or
 * manually: `RUN_LIVE_GEMINI_EVAL=true GEMINI_NIGHTLY_EVAL_API_KEY=... BACKEND_PORT=4001
 * pnpm --filter backend exec tsx scripts/run-golden-prompt-live-eval.ts`.
 *
 * Deliberately bypasses the full callGemini()/BYOK key-selection orchestration
 * (apps/backend/src/lib/ai-gateway/adapter.ts) -- this script has no authenticated user and no
 * DB-stored key to select from. It calls callGeminiGenerateContent (gemini-client.ts) directly
 * with a dedicated, platform-funded GEMINI_NIGHTLY_EVAL_API_KEY, structurally isolated from
 * both BYOK keys and SYSTEM_GEMINI_API_KEY (see SETUP_WALKTHROUGH.md #8).
 *
 * Mirrors `resolvePromptToEventFilter` (resolvers.ts): same dedicated GEMINI_FILTER_MODEL and the
 * same `dropUnsupportedVenueTypes` post-processing, so drift is measured on what users actually
 * receive. Optional `GOLDEN_EVAL_CATEGORY=<category>` limits the run to one fixture category.
 *
 * `GOLDEN_EVAL_VARIANTS=true` additionally sends ONE metamorphic variant per eligible fixture
 * (vague-word prefix, filler, typo, uppercase -- see generate-prompt-variants.ts) and requires it to
 * resolve to the same leaf fields as its fixture. The variant kind rotates with
 * `GOLDEN_EVAL_VARIANT_SEED` (default: the UTC day number), so coverage widens night by night while
 * any failure stays reproducible by re-running with the printed seed.
 *
 * `GOLDEN_EVAL_DAILY_BUDGET=<n>` windows the run for a quota-capped key (a free-tier flash model
 * allows ~20 requests/day, far below the ~90 calls of a full run with variants). At most n Gemini
 * calls are made, retries included; the window is chosen by `planGoldenEvalWindow` -- never-evaluated
 * fixtures first, then fixtures that drifted last time, then the stalest -- and every fixture left
 * out stays pending, highest-priority-first, for the next run. A Gemini per-day 429 ends the run
 * early the same way (a warning, not a failure) instead of discarding the run. Unset (or 0) runs the
 * whole suite, as a paid key should.
 *
 * `GOLDEN_EVAL_LEDGER_PATH=<file>` is where the "what was evaluated when, and did it drift" ledger
 * is read from and written to between runs (the nightly workflow caches it with actions/cache).
 * Without it every run starts from an empty ledger, so a windowed run always picks the same window.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  GOLDEN_PROMPT_FIXTURES,
  dropUnsupportedVenueTypes,
  parseGoldenEvalLedger,
  pickPromptVariant,
  planGoldenEvalWindow,
  summarizeGoldenPromptDrift,
  summarizeMetamorphicDrift,
  transformGeminiResponseToFilterExpression,
  type GoldenEvalLedger,
} from '@festgrid/domain/ai-event-filters';
import { buildFilterExtractionSystemInstruction, buildFilterExtractionResponseSchema } from '../src/lib/ai-event-filters/build-filter-extraction-request.js';
import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';
import { loadBackendEnv } from '../src/env.js';
import { isEvalDailyQuotaError, nextEvalRetryDelayMs } from '../src/lib/ai-gateway/eval-retry-policy.js';
import { truncateForLog } from '../src/lib/ai-gateway/eval-log-format.js';

// Free-tier keys cap requests/minute (15 on a lite model, fewer on flash -- the nightly workflow sets
// 13s ~= 4.6/min for flash): space calls out instead of only reacting to 429s, since every retry
// also spends the call budget below. The 4.5s default (~13/min) suits a 15/min key. Set
// GOLDEN_EVAL_MIN_INTERVAL_MS=0 for a paid key.
const MIN_INTERVAL_MS = Number(process.env.GOLDEN_EVAL_MIN_INTERVAL_MS ?? 4500);
let lastCallAt = 0;

// Hard cap on Gemini requests this run (every retry attempt counts); Infinity = the whole suite.
const rawBudget = Number(process.env.GOLDEN_EVAL_DAILY_BUDGET ?? 0);
const CALL_BUDGET = Number.isFinite(rawBudget) && rawBudget >= 1 ? Math.floor(rawBudget) : Infinity;
let attemptsUsed = 0;

// Longest Gemini error message / raw response echoed to the log (see truncateForLog).
const RESPONSE_LOG_MAX_CHARS = 600;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Thrown to end the run early with the rest of the window left pending (not a drift, not a crash).
class EvalStopped extends Error {}

// One transient failure (503, connection reset, per-minute 429) must not abort a ~120-call run.
// A per-day quota or a non-transient error propagates immediately (see eval-retry-policy.ts).
async function callWithRetry<T>(call: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    if (attemptsUsed >= CALL_BUDGET) throw new EvalStopped(`the ${CALL_BUDGET}-call budget is spent`);
    const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    attemptsUsed++;
    try {
      return await call();
    } catch (err) {
      const message = String((err as Error)?.message);
      if (isEvalDailyQuotaError(message)) throw new EvalStopped('Gemini reports the per-day quota is exhausted');
      const delayMs = nextEvalRetryDelayMs(message, attempt);
      if (delayMs === undefined) throw err;
      console.log(`Gemini call failed (attempt ${attempt}); retrying in ${Math.round(delayMs / 1000)}s: ${String((err as Error)?.name)}: ${truncateForLog(message, RESPONSE_LOG_MAX_CHARS)}`);
      await sleep(delayMs);
    }
  }
}

const ledgerPath = process.env.GOLDEN_EVAL_LEDGER_PATH;

function loadLedger(knownFixtureIds: readonly string[]): GoldenEvalLedger {
  if (!ledgerPath || !existsSync(ledgerPath)) return {};
  try {
    return parseGoldenEvalLedger(JSON.parse(readFileSync(ledgerPath, 'utf8')), knownFixtureIds);
  } catch {
    console.log(`Ignoring unreadable ledger at ${ledgerPath}; every fixture counts as never evaluated.`);
    return {};
  }
}

function saveLedger(ledger: GoldenEvalLedger): void {
  if (!ledgerPath) return;
  mkdirSync(dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`);
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
  const results: Array<{ fixtureId: string; drifted: boolean; details: string; rawText?: string }> = [];

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
    // `rawText` rides along so a drifted fixture can show exactly what the model returned.
    const rawText = response.text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return { rawText, result: undefined };
    }
    const transformed = transformGeminiResponseToFilterExpression(parsed);
    const guarded = dropUnsupportedVenueTypes(transformed.expression);
    return { rawText, result: { expression: guarded.expression, caveats: [...transformed.caveats, ...guarded.caveats] } };
  }

  const runVariants = process.env.GOLDEN_EVAL_VARIANTS === 'true';
  const seed = Number(process.env.GOLDEN_EVAL_VARIANT_SEED ?? Math.floor(Date.now() / 86_400_000));
  if (runVariants) {
    console.log(`Metamorphic variants enabled; seed=${seed} (re-run with GOLDEN_EVAL_VARIANT_SEED=${seed} to reproduce).`);
  }
  const variantResults: Array<{ fixtureId: string; kind: string; drifted: boolean; details: string; rawText?: string }> = [];

  // The ledger spans the whole suite, so a GOLDEN_EVAL_CATEGORY run never forgets the other categories.
  const ledger = loadLedger(GOLDEN_PROMPT_FIXTURES.map((f) => f.id));
  const window = planGoldenEvalWindow(fixtures, ledger, { budget: CALL_BUDGET, withVariants: runVariants });
  const countReason = (reason: string) => window.filter((item) => item.reason === reason).length;
  console.log(
    `Window: ${window.length}/${fixtures.length} fixtures (${countReason('never-evaluated')} never evaluated, ${countReason('drift-recheck')} drift rechecks, ${countReason('stalest')} stalest); ` +
      `call budget ${Number.isFinite(CALL_BUDGET) ? CALL_BUDGET : 'unlimited'}.`
  );

  const runAt = new Date().toISOString();
  const nextLedger: GoldenEvalLedger = { ...ledger };
  let stoppedReason: string | undefined;
  try {
    for (const { fixture, index, withVariant } of window) {
      const live = await resolveLive(fixture.prompt);
      const baseResult = live.result
        ? summarizeGoldenPromptDrift(fixture, live.result)
        : { fixtureId: fixture.id, drifted: true, details: 'live response was not valid JSON' };
      results.push({ ...baseResult, rawText: live.rawText });
      // Recorded before the variant call, so a run that ends there still counts the base prompt as evaluated.
      nextLedger[fixture.id] = { lastEvaluatedAt: runAt, drifted: baseResult.drifted };

      const variant = runVariants && withVariant ? pickPromptVariant(fixture, index, seed) : undefined;
      if (variant) {
        const variantLive = await resolveLive(variant.prompt);
        const variantResult = variantLive.result
          ? summarizeMetamorphicDrift(fixture, variant, variantLive.result)
          : { fixtureId: fixture.id, kind: variant.kind, variantPrompt: variant.prompt, drifted: true, details: 'live response was not valid JSON' };
        variantResults.push({ ...variantResult, rawText: variantLive.rawText });
        nextLedger[fixture.id] = { lastEvaluatedAt: runAt, drifted: baseResult.drifted || variantResult.drifted };
      }
    }
  } catch (err) {
    if (!(err instanceof EvalStopped)) throw err;
    stoppedReason = err.message;
  } finally {
    // Even a crash keeps what this run evaluated; a fixture it never reached keeps its old priority.
    saveLedger(nextLedger);
  }

  const drifted = results.filter((r) => r.drifted);
  console.log(`Golden-prompt live eval: ${results.length} fixtures, ${drifted.length} drifted.`);
  for (const r of drifted) {
    console.log(`::warning::Golden-prompt drift on "${r.fixtureId}": ${r.details}`);
    console.log(`    model returned: ${truncateForLog(r.rawText ?? '', RESPONSE_LOG_MAX_CHARS)}`);
  }
  const driftedVariants = variantResults.filter((r) => r.drifted);
  if (runVariants) {
    console.log(`Metamorphic variants: ${variantResults.length} run, ${driftedVariants.length} drifted.`);
    // A drifted variant is a candidate new fixture: promote its prompt (with the correct, human-
    // reviewed expectation) into golden-prompt-fixtures.ts so the regression is pinned permanently.
    for (const r of driftedVariants) {
      console.log(`::warning::Metamorphic drift on "${r.fixtureId}" (${r.kind}, seed ${seed}): ${r.details}`);
      console.log(`    model returned: ${truncateForLog(r.rawText ?? '', RESPONSE_LOG_MAX_CHARS)}`);
    }
  }

  const pending = fixtures.filter((f) => !results.some((r) => r.fixtureId === f.id)).length;
  console.log(`Evaluated ${results.length}/${fixtures.length} fixtures with ${attemptsUsed} Gemini requests; ${pending} pending for the next runs.`);
  if (stoppedReason) {
    console.log(`::warning::Golden-prompt eval stopped early: ${stoppedReason}. The unevaluated fixtures keep their priority for the next run.`);
  }
  // A quota stop after some evaluations is routine; one before the first result left no signal at all.
  if (drifted.length > 0 || driftedVariants.length > 0 || (stoppedReason && results.length === 0)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
