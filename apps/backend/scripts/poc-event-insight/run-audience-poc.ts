#!/usr/bin/env tsx
/**
 * Extraction runner for the audience, language and taxonomy POC (event-insight-poc/audience-and-taxonomy-poc-plan-2026-10-21.md, §4 step 4).
 * Runs on the OWNER'S machine with the owner's Gemini key. It makes real, billable calls and never touches a database.
 *
 *   cd apps/backend
 *   DATABASE_URL=postgres://u:p@localhost:5432/x GEMINI_API_KEY=... npx tsx scripts/poc-event-insight/run-audience-poc.ts --half tuning --dry-run
 *   ... --half tuning --ids-from scripts/poc-event-insight/local/label-sheet-owner-tuning-sample.csv
 *   ... --half heldout --frozen-sheet scripts/poc-event-insight/local/labels-final.csv        (only after `label-sheets.ts freeze`)
 *
 * Options: --runs 3 · --model <id> (default the backend's GEMINI_MODEL) · --interval-ms 4500 (minimum gap between call starts; the free tier
 * allows about 15 a minute) · --concurrency 2 · --ids-from <csv with an id column> · --out <file> · --dry-run (counts and cost only, no key needed).
 *
 * HARD RULES (same as the other local-session briefs): never print or open .env; the key comes from --gemini-key, GEMINI_API_KEY or
 * SYSTEM_GEMINI_API_KEY; the output goes to the git-ignored local/ folder and holds structured values only (no caption, no quote), so the
 * scorer needs no caption either. The held-out half runs only when the labels it will be scored against hash to the frozen value.
 *
 * Limits to state in the report: text only (the face-blurred image the real pipeline sends is not part of this run), one standalone call per
 * post rather than the production combined call, and every post is treated as an event (a recap or a shop promo is still scored).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { callGeminiGenerateContent, GeminiRateLimitedError, setGenerateContentSeam } from '../../src/lib/ai-gateway/gemini-client.js';
import { loadBackendEnv } from '../../src/env.js';
import { accountCountryOf } from './audience-country.js';
import {
  audienceInsightContents, audienceInsightSchema, audienceInsightSchemaV3, AUDIENCE_INSIGHT_INSTRUCTION_V2, AUDIENCE_INSIGHT_INSTRUCTION_V3,
} from './audience-insight.js';
import { evaluateRun, mergeRecords, runGate, type RunRecord } from './audience-poc-lib.js';
import { halfOf, parseCsv, postId, type SourcePost } from './label-sheets-lib.js';

const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const arg = (name: string, fallback?: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const flag = (name: string) => argv.includes(`--${name}`);
const log = (s: string) => process.stdout.write(s + '\n');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RUNS = parseInt(arg('runs', '3')!, 10);
const HALF = arg('half', 'tuning') as 'tuning' | 'heldout' | 'all';
const INTERVAL_MS = parseInt(arg('interval-ms', '4500')!, 10);
const CONCURRENCY = parseInt(arg('concurrency', '2')!, 10);
const LOCAL = resolve(arg('dir', join(here, 'local'))!);
const OUT = resolve(arg('out', join(LOCAL, 'extraction-runs.local.json'))!);
const API_KEY = arg('gemini-key') ?? process.env.GEMINI_API_KEY ?? process.env.SYSTEM_GEMINI_API_KEY;
// v3 (default): the model reports only the areas the post STATES (`targetAreas`); the implicit ones are derived by code (target-areas.ts).
// v2 is kept so earlier results can be reproduced. The caption-only call cannot emit `stated_poster`; the production call, which sends images, can.
const PROMPT = (arg('prompt', 'v3') === 'v2' ? 'v2' : 'v3') as 'v2' | 'v3';
const PROMPT_VERSION = `audience-${PROMPT}`;
const INSTRUCTION = PROMPT === 'v2' ? AUDIENCE_INSIGHT_INSTRUCTION_V2 : AUDIENCE_INSIGHT_INSTRUCTION_V3;
const SCHEMA = PROMPT === 'v2' ? audienceInsightSchema : audienceInsightSchemaV3(false);

let lastUsage: { prompt?: number; output?: number; thoughts?: number } = {};
setGenerateContentSeam(async (ai, params) => {
  const response: any = await ai.models.generateContent(params);
  lastUsage = { prompt: response.usageMetadata?.promptTokenCount, output: response.usageMetadata?.candidatesTokenCount, thoughts: response.usageMetadata?.thoughtsTokenCount };
  return response;
});

// A global gap between call starts, so concurrency never exceeds the vendor's per-minute allowance.
let nextSlot = 0;
async function paced(): Promise<void> {
  const now = Date.now();
  const at = Math.max(now, nextSlot);
  nextSlot = at + INTERVAL_MS;
  if (at > now) await sleep(at - now);
}

async function oneCall(model: string, contents: string): Promise<{ text: string; usage: RunRecord['usage'] }> {
  let retries = 0;
  for (;;) {
    await paced();
    const t0 = Date.now();
    try {
      const { text } = await callGeminiGenerateContent(API_KEY!, {
        contents, systemInstruction: INSTRUCTION, responseSchema: SCHEMA, responseMimeType: 'application/json', maxOutputTokens: 4096, model,
      });
      return { text, usage: { inputTokens: lastUsage.prompt, outputTokens: lastUsage.output, thoughtTokens: lastUsage.thoughts, latencyMs: Date.now() - t0, rateLimitRetries: retries } };
    } catch (e) {
      if (e instanceof GeminiRateLimitedError && retries < 5) {
        retries++;
        const wait = (e.retryAfterSeconds ?? 20 * retries) * 1000;
        log(`  429; waiting ${Math.round(wait / 1000)}s (retry ${retries}/5)`);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
}

async function main(): Promise<void> {
  if (!['tuning', 'heldout', 'all'].includes(HALF)) throw new Error('--half must be tuning, heldout or all');

  const frozenSheet = arg('frozen-sheet');
  const hashFile = join(LOCAL, 'labels-frozen.sha256');
  const gate = runGate(HALF, {
    sheetContent: frozenSheet && existsSync(frozenSheet) ? readFileSync(frozenSheet) : undefined,
    hashFileContent: existsSync(hashFile) ? readFileSync(hashFile, 'utf8') : undefined,
  });
  if (!gate.allowed) throw new Error(gate.reason);

  const postsFile = join(LOCAL, 'poc-posts.local.json');
  if (!existsSync(postsFile)) throw new Error(`no ${postsFile}: run fetch-poc-posts.ts first`);
  const all = JSON.parse(readFileSync(postsFile, 'utf8')) as SourcePost[];

  const only = arg('ids-from') ? new Set(parseCsv(readFileSync(resolve(arg('ids-from')!), 'utf8')).map((r) => r.id)) : undefined;
  const posts = all.filter((p) => (HALF === 'all' || halfOf(p.url) === HALF) && (!only || only.has(postId(p.url))));

  // The posting account's country, from the account's own posts (the whole fetched set, not only the ones selected here).
  // The scraped account (`account`), not the post's owner (`username`): a curator reposts other people's posts, and the account whose
  // profile enrichment would supply a country is the curator.
  const acct = (p: SourcePost) => p.account ?? p.username ?? '';
  const byAccount = new Map<string, string[]>();
  for (const p of all) byAccount.set(acct(p), [...(byAccount.get(acct(p)) ?? []), p.caption]);
  const accountCountry = new Map<string, string | undefined>();
  for (const [u, caps] of byAccount) accountCountry.set(u, accountCountryOf(u, caps));

  const saved: RunRecord[] = existsSync(OUT) ? (JSON.parse(readFileSync(OUT, 'utf8')).records ?? []) : [];
  const done = new Set(saved.filter((r) => r.ok).map((r) => `${r.id}#${r.run}`));
  const jobs = posts.flatMap((p) => Array.from({ length: RUNS }, (_, i) => ({ p, id: postId(p.url), run: i + 1 })).filter((j) => !done.has(`${j.id}#${j.run}`)));

  const model = arg('model') ?? (flag('dry-run') ? '(the backend default)' : loadBackendEnv().geminiModel);
  const minutes = Math.ceil((jobs.length * INTERVAL_MS) / 60000);
  log(`${posts.length} posts (${HALF}${only ? ', subset' : ''}) × ${RUNS} runs; ${jobs.length} calls to make (${done.size} already saved); model ${model}; about ${minutes} min at ${INTERVAL_MS} ms between calls`);
  const resolvedAccounts = [...accountCountry.values()].filter(Boolean).length;
  log(`account country resolved for ${resolvedAccounts} of ${accountCountry.size} accounts`);
  if (flag('dry-run')) { log('dry run: nothing sent'); return; }
  if (!API_KEY) throw new Error('No Gemini key: pass --gemini-key or set GEMINI_API_KEY / SYSTEM_GEMINI_API_KEY (never from .env by this script).');

  const fresh: RunRecord[] = [];
  let next = 0, okCount = 0;
  const save = () => {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, JSON.stringify({
      savedAt: new Date().toISOString(), promptVersion: PROMPT_VERSION, model, runs: RUNS,
      accounts: Object.fromEntries([...accountCountry.entries()].map(([u, c]) => [u, c ?? null])),
      records: mergeRecords(saved, fresh),
    }, null, 1));
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length) {
      const j = jobs[next++];
      const country = accountCountry.get(acct(j.p));
      let rec: RunRecord;
      try {
        const { text, usage } = await oneCall(model, audienceInsightContents(j.p.caption, acct(j.p), j.p.datePosted, { hashtags: j.p.hashtags, place: j.p.locationName }));
        rec = evaluateRun({ id: j.id, run: j.run, caption: j.p.caption, accountCountry: country, rawText: text, usage });
      } catch (e) {
        rec = { id: j.id, run: j.run, ok: false, errors: [`${(e as Error).name}: ${String((e as Error).message).slice(0, 160)}`], usage: { latencyMs: 0, rateLimitRetries: 0 } };
      }
      fresh.push(rec);
      if (rec.ok) okCount++;
      process.stdout.write(rec.ok ? '.' : 'x');
      if (fresh.length % 10 === 0) save();
    }
  }));
  save();
  log(`\n${okCount} of ${jobs.length} calls produced a valid answer; saved to ${OUT}`);
}

main().catch((e) => { process.stderr.write(`error: ${(e as Error).message}\n`); process.exit(1); });
