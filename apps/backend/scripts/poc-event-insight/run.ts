/**
 * Manual POC: can Gemini extract "audience insight" (who an event is for, where its audience
 * is) reliably enough to drive per-user Discovery ranking?
 *
 * NOT part of `pnpm --filter backend test`, never touches the database, and never runs in CI —
 * it makes real, billable Gemini calls. Same convention as `poc-ingestion-preview.ts`: it calls
 * `callGeminiGenerateContent` directly with a local key, bypassing the BYOK/KMS machinery.
 *
 * Three experiments:
 *   A  standalone  one dedicated insight call per post, N runs each (accuracy + stability)
 *   A' model-cmp   the same posts once on a second model (`--compare-model`)
 *   B  combined    the REAL production extraction request (`buildGeminiExtractionRequest`) with
 *                  the insight object injected into each event's response schema. Answers two
 *                  questions: does the bigger nested schema still get accepted by Gemini
 *                  (build-gemini-request.ts documents a past 400 INVALID_ARGUMENT from schema
 *                  size), and what does piggy-backing cost in tokens versus the same request
 *                  without the insight?
 *
 * Usage (from apps/backend):
 *   BACKEND_PORT=4001 SYSTEM_GEMINI_API_KEY=... npx tsx scripts/poc-event-insight/run.ts \
 *     [--runs 3] [--model gemini-3.5-flash-lite] [--compare-model gemini-3.5-flash] \
 *     [--variants standalone,combined] [--set core|holdout|all] [--prompt v1] [--only id1,id2] [--out <dir>]
 *
 * `DATABASE_URL` must be set to any placeholder (the vendor-gateway module imports the DB client at
 * load time; nothing here ever connects) — same trick as the nightly golden-prompt Gemini eval.
 *
 * The key is read from --gemini-key, GEMINI_API_KEY or SYSTEM_GEMINI_API_KEY (in that order).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProcessingJobMessage } from '@festgrid/domain/posts';
import { buildGeminiExtractionRequest } from '../../src/lib/ai-processor/build-gemini-request.js';
import {
  callGeminiGenerateContent, GeminiRateLimitedError, setGenerateContentSeam,
} from '../../src/lib/ai-gateway/gemini-client.js';
import {
  insightRules, insightSchema, standaloneSystemInstruction, type EventInsight,
} from './insight-schema.js';
import { loadCases, type Case } from './corpus.js';
import { avg, pct, perCaseTable, failureDetails, quantile, summarise, type CallRecord } from './report.js';
import { scoreInsight, validateInsight } from './score.js';

// ---- args -----------------------------------------------------------------------------------
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const RUNS = parseInt(arg('runs', '3')!, 10);
const MODEL = arg('model', process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite')!;
const COMPARE_MODEL = arg('compare-model', 'gemini-3.5-flash')!;
const VARIANTS = new Set(arg('variants', 'standalone,combined')!.split(','));
const ONLY = arg('only')?.split(',');
// core = real + synthetic set used to design the prompt; holdout = written before the v1 failure
// analysis, for checking a revised prompt on cases it was not tuned on; all = both.
const SET = arg('set', 'core')!;
const PROMPT = arg('prompt', 'v1')!;
const OUT_DIR = resolve(arg('out', resolve(dirname(fileURLToPath(import.meta.url)), '../../../../_bmad-output/planning-artifacts/event-insight-poc'))!);
const API_KEY = arg('gemini-key') ?? process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;

// ---- gemini plumbing ------------------------------------------------------------------------
let lastUsage: { prompt?: number; output?: number; thoughts?: number } = {};
setGenerateContentSeam(async (ai, params) => {
  const response: any = await ai.models.generateContent(params);
  lastUsage = {
    prompt: response.usageMetadata?.promptTokenCount,
    output: response.usageMetadata?.candidatesTokenCount,
    thoughts: response.usageMetadata?.thoughtsTokenCount,
  };
  return response;
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gemini(model: string, request: Parameters<typeof callGeminiGenerateContent>[1]): Promise<{ text: string; ms: number; usage: typeof lastUsage }> {
  process.env.GEMINI_MODEL = model;
  for (let attempt = 0; ; attempt++) {
    const t0 = Date.now();
    try {
      const { text } = await callGeminiGenerateContent(API_KEY!, request);
      return { text, ms: Date.now() - t0, usage: { ...lastUsage } };
    } catch (e) {
      if (e instanceof GeminiRateLimitedError && attempt < 4) {
        const wait = (e.retryAfterSeconds ?? 15 * (attempt + 1)) * 1000;
        console.warn(`  429 on ${model}; waiting ${wait / 1000}s (attempt ${attempt + 1}/4)`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

const parseJson = (text: string): unknown => JSON.parse(text.replace(/^\s*```json/, '').replace(/```\s*$/, '').trim());

// ---- experiment A: standalone ---------------------------------------------------------------
async function runStandalone(c: Case, model: string, run: number): Promise<CallRecord> {
  const rec: CallRecord = { caseId: c.id, variant: 'standalone', model, run, ok: false, errors: [], latencyMs: 0 };
  const contents = `${c.account ? `Account Name Metadata: "${c.account}"\n` : ''}Post published: ${c.publishedAt.slice(0, 10)}\nPost text:\n"""\n${c.caption}\n"""`;
  try {
    const r = await gemini(model, {
      contents, systemInstruction: standaloneSystemInstruction(PROMPT),
      responseSchema: insightSchema, responseMimeType: 'application/json', maxOutputTokens: 4096,
    });
    rec.latencyMs = r.ms; rec.rawText = r.text;
    rec.inputTokens = r.usage.prompt; rec.outputTokens = r.usage.output; rec.thoughtTokens = r.usage.thoughts;
    const v = validateInsight(parseJson(r.text));
    rec.errors = v.errors; rec.ok = v.ok;
    if (v.ok && v.insight) { rec.insight = v.insight; rec.score = scoreInsight(v.insight, c.label, c.caption); }
  } catch (e: any) {
    rec.errors = [`${e?.name ?? 'Error'}: ${String(e?.message ?? e).slice(0, 300)}`];
  }
  return rec;
}

// ---- experiment B: combined with the production extraction request --------------------------
async function runCombined(c: Case, model: string, withInsight: boolean): Promise<CallRecord> {
  const rec: CallRecord = { caseId: c.id, variant: withInsight ? 'combined' : 'baseline-extraction', model, run: 1, ok: false, errors: [], latencyMs: 0 };
  const message: ProcessingJobMessage = {
    postId: `poc-${c.id}`, accountId: 'poc', content: c.caption, postUrl: 'https://example.invalid/poc',
    publishedAt: c.publishedAt, ownerUsername: c.account, ownerDisplayName: c.account,
  };
  try {
    // No imageUrl => text-only request (the real pipeline's own fallback shape); the committed
    // image URLs have long expired, so this deliberately measures the caption-only path.
    const { request } = await buildGeminiExtractionRequest(message);
    if (withInsight) {
      const schema: any = structuredClone(request.responseSchema);
      schema.properties.events.items.properties.insight = insightSchema;
      schema.properties.events.items.required = [...schema.properties.events.items.required, 'insight'];
      request.responseSchema = schema;
      request.systemInstruction = `${request.systemInstruction}\n\n${insightRules(PROMPT)}\n\nPut each event's audience insight in that event's "insight" object.`;
    }
    const r = await gemini(model, request);
    rec.latencyMs = r.ms; rec.rawText = r.text;
    rec.inputTokens = r.usage.prompt; rec.outputTokens = r.usage.output; rec.thoughtTokens = r.usage.thoughts;
    const payload: any = parseJson(r.text);
    const eventCount: number = Array.isArray(payload?.events) ? payload.events.length : 0;
    rec.eventCount = eventCount;
    rec.ok = eventCount > 0;
    if (!rec.ok) rec.errors = [`isEvent=${payload?.isEvent}, events=${eventCount}`];
    if (withInsight && rec.ok) {
      const v = validateInsight(payload.events[0].insight);
      rec.errors = v.errors; rec.ok = v.ok;
      // Only a single-event post has an unambiguous label for events[0].
      if (v.ok && v.insight && eventCount === 1) { rec.insight = v.insight; rec.score = scoreInsight(v.insight, c.label, c.caption); }
      else if (v.ok && v.insight) rec.insight = v.insight;
    }
  } catch (e: any) {
    rec.errors = [`${e?.name ?? 'Error'}: ${String(e?.message ?? e).slice(0, 300)}`];
  }
  return rec;
}

// ---- main -----------------------------------------------------------------------------------
const CONCURRENCY = parseInt(arg('concurrency', '2')!, 10);

async function mapPool<T, R>(items: T[], size: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

async function main(): Promise<void> {
  if (!API_KEY) throw new Error('No Gemini key: pass --gemini-key or set GEMINI_API_KEY / SYSTEM_GEMINI_API_KEY.');
  const cases = loadCases(SET, ONLY);
  console.log(`POC: ${cases.length} posts (${SET}), prompt=${PROMPT}, model=${MODEL}, compare=${COMPARE_MODEL}, runs=${RUNS}, variants=${[...VARIANTS].join(',')}`);
  const all: CallRecord[] = [];
  const sections: string[] = [];

  if (VARIANTS.has('standalone')) {
    const jobs = cases.flatMap((c) => Array.from({ length: RUNS }, (_, i) => ({ c, run: i + 1 })));
    const recsA = await mapPool(jobs, CONCURRENCY, async ({ c, run }) => { const r = await runStandalone(c, MODEL, run); process.stdout.write(r.ok ? '.' : 'x'); return r; });
    console.log(`\nstandalone ${MODEL} done`);
    all.push(...recsA);
    sections.push(summarise(`A. Standalone insight call — ${MODEL} (production default), ${RUNS} runs/post`, recsA), '', '#### Per-post (✓ all runs pass · ✗ none · n/m partial · · not applicable)', '', perCaseTable(recsA), '', '#### Misses on run 1', '', failureDetails(recsA), '');

    if (COMPARE_MODEL && COMPARE_MODEL !== MODEL) {
      const recsM = await mapPool(cases, CONCURRENCY, async (c) => { const r = await runStandalone(c, COMPARE_MODEL, 1); process.stdout.write(r.ok ? '.' : 'x'); return r; });
      console.log(`\nstandalone ${COMPARE_MODEL} done`);
      all.push(...recsM);
      sections.push(summarise(`A'. Same posts, single run — ${COMPARE_MODEL}`, recsM), '', failureDetails(recsM), '');
    }
  }

  if (VARIANTS.has('combined')) {
    const recsBase = await mapPool(cases, CONCURRENCY, async (c) => { const r = await runCombined(c, MODEL, false); process.stdout.write(r.ok ? '.' : 'x'); return r; });
    const recsComb = await mapPool(cases, CONCURRENCY, async (c) => { const r = await runCombined(c, MODEL, true); process.stdout.write(r.ok ? '.' : 'x'); return r; });
    console.log('\ncombined done');
    all.push(...recsBase, ...recsComb);
    const pairs = cases.map((c) => ({ b: recsBase.find((r) => r.caseId === c.id)!, w: recsComb.find((r) => r.caseId === c.id)! }))
      .filter((p) => p.b.inputTokens !== undefined && p.w.inputTokens !== undefined);
    const tok = (r: CallRecord) => (r.outputTokens ?? 0) + (r.thoughtTokens ?? 0);
    sections.push(
      summarise(`B. Combined with the production extraction request — ${MODEL}, text-only, 1 run/post (scored on single-event posts only)`, recsComb), '',
      `- baseline extraction (no insight): avg ${avg(pairs.map((p) => p.b.inputTokens!))} in / ${avg(pairs.map((p) => tok(p.b)))} out tokens, p50 latency ${quantile(pairs.map((p) => p.b.latencyMs), 0.5)} ms`,
      `- with insight: avg ${avg(pairs.map((p) => p.w.inputTokens!))} in / ${avg(pairs.map((p) => tok(p.w)))} out tokens, p50 latency ${quantile(pairs.map((p) => p.w.latencyMs), 0.5)} ms`,
      `- marginal cost of piggy-backing: +${avg(pairs.map((p) => p.w.inputTokens! - p.b.inputTokens!))} in / +${avg(pairs.map((p) => tok(p.w) - tok(p.b)))} out tokens per post, 0 extra requests`,
      `- baseline calls that returned ≥1 event: ${pct(recsBase.filter((r) => r.ok).length, recsBase.length)}; combined calls with a valid insight on events[0]: ${pct(recsComb.filter((r) => r.ok).length, recsComb.length)}`,
      `- request failures (schema rejection etc.): ${recsComb.filter((r) => r.errors.some((e) => /Gemini|Error/.test(e))).length}`, '',
      '#### Per-post (single-event posts only)', '', perCaseTable(recsComb.filter((r) => r.eventCount === 1)), '',
      '#### Posts that yielded several events', '',
      ...recsComb.filter((r) => (r.eventCount ?? 0) > 1).map((r) => `- ${r.caseId}: ${r.eventCount} events`), '',
      '#### Misses', '', failureDetails(recsComb), '',
    );
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  writeFileSync(resolve(OUT_DIR, `results-${stamp}.json`), JSON.stringify({ promptVersion: PROMPT, set: SET, model: MODEL, compareModel: COMPARE_MODEL, runs: RUNS, records: all.map(({ rawText, ...r }) => r) }, null, 1));
  writeFileSync(resolve(OUT_DIR, `report-${stamp}.generated.md`), `# Event-insight POC — generated metrics (${stamp}; prompt ${PROMPT}; set ${SET})\n\nGenerated by \`apps/backend/scripts/poc-event-insight/run.ts\`. Labels are one reviewer's; see labels.ts.\n\n${sections.join('\n')}\n`);
  console.log(`wrote ${OUT_DIR}/report-${stamp}.generated.md`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
