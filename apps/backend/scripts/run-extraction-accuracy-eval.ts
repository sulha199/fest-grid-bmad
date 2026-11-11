/*
 * Per-field accuracy eval of event extraction against labelled posts (IDEA-261111-5cc, slice A).
 * Spec: _bmad-output/implementation-artifacts/spec-extraction-accuracy-eval.md. Docs: docs/infrastructure/extraction-accuracy-eval.md.
 *
 * Live:   EXTRACTION_EVAL_DIR=<labelled dir> EXTRACTION_EVAL_GEMINI_API_KEY=... \
 *         pnpm --filter backend exec tsx scripts/run-extraction-accuracy-eval.ts [--runs 3] [--only <postId>]
 * Replay: pnpm --filter backend exec tsx scripts/run-extraction-accuracy-eval.ts --dir <labelled dir> --replay <recorded.json>
 *         (no network, no key: scores the recorded raw answers with the same code as a live run)
 *
 * A labelled dir holds one folder per post: <postId>/label.json plus the image files it names. Optional
 * <dir>/baseline.json is compared against. NEVER put real images, real captions or contact data in a dir that
 * lives in this public repo: the repo only ever holds the synthetic set (see the docs page).
 *
 * Live calls go through the production request builder and gateway client, one at a time, paced (default 5 s),
 * with growing retries on 429/503. Raw answers are recorded to --record (default ./extraction-eval-recorded.json).
 * Never a CI gate: the exit code is 0 for any score, non-zero only when the eval itself cannot run (bad args, bad labels).
 * With no key or no labelled dir the live path prints why and exits 0.
 *
 * Options: --dir, --replay, --runs N (default 3), --only <postId>, --record <file>, --baseline <file>,
 * --write-baseline <file>, --json <file> (report JSON), --interval-ms N (or EXTRACTION_EVAL_MIN_INTERVAL_MS).
 */
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  aggregateRuns,
  buildBaseline,
  buildReport,
  classifyRun,
  compareToBaseline,
  parseBaseline,
  parseLabelledPost,
  parseRecordedOutputs,
  type Baseline,
  type LabelledPost,
  type RecordedOutputs,
  type RecordedRun,
  type ScorablePayload,
} from '@festgrid/domain/extraction-eval';
import { stripMalformedLocationKeywords } from '@festgrid/domain/events';
import { classifyGeminiMessage } from '../src/lib/ai-gateway/gemini-situation.js';
import { nextEvalRetryDelayMs } from '../src/lib/ai-gateway/eval-retry-policy.js';
import { compileValidator } from '../src/validation/validate.js';
import { extractedEventSchema } from '../src/validation/extracted-event.schema.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function loadPosts(dir: string, only: string | undefined): Array<{ post: LabelledPost; folder: string }> {
  const folders = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
  const posts = folders
    .filter((f) => existsSync(join(dir, f, 'label.json')))
    .map((f) => {
      const file = join(dir, f, 'label.json');
      const post = parseLabelledPost(JSON.parse(readFileSync(file, 'utf8')), file);
      if (post.postId !== f) throw new Error(`${file}: postId "${post.postId}" must equal its folder name "${f}"`);
      for (const image of post.images) {
        if (!existsSync(join(dir, f, image))) throw new Error(`${file}: image "${image}" is missing next to the label`);
      }
      return { post, folder: join(dir, f) };
    });
  const picked = only ? posts.filter((p) => p.post.postId === only) : posts;
  if (only && picked.length === 0) throw new Error(`--only ${only}: no such post in ${dir}`);
  return picked;
}

// The same post-answer step the pipeline applies (process-extraction-step.ts): parse, strip malformed keywords, validate.
const validatePayload = compileValidator<ScorablePayload>(extractedEventSchema);
export function parseLikePipeline(text: string): ScorablePayload | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    stripMalformedLocationKeywords(parsed as Parameters<typeof stripMalformedLocationKeywords>[0]);
    return validatePayload(parsed) ? (parsed as ScorablePayload) : undefined;
  } catch {
    return undefined;
  }
}

/** Serves one post's images from 127.0.0.1 so the production builder can fetch() them like remote image URLs. */
function serveImages(folder: string): Promise<{ server: Server; base: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const name = basename(decodeURIComponent(req.url ?? ''));
      const file = join(folder, name);
      if (!existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': name.endsWith('.jpg') || name.endsWith('.jpeg') ? 'image/jpeg' : 'image/png' }).end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
}

async function recordLive(posts: Array<{ post: LabelledPost; folder: string }>, runs: number, apiKey: string, intervalMs: number): Promise<RecordedOutputs> {
  process.env.BACKEND_PORT ??= '4001';
  // gemini-client -> guarded-call -> db/client throws at import without a URL; this eval never queries (see the golden-prompt eval).
  process.env.DATABASE_URL ??= 'postgresql://unused:unused@127.0.0.1:5432/unused';
  const { buildGeminiExtractionRequest } = await import('../src/lib/ai-processor/build-gemini-request.js');
  const { callGeminiGenerateContent } = await import('../src/lib/ai-gateway/gemini-client.js');
  const { loadBackendEnv } = await import('../src/env.js');
  const model = loadBackendEnv().geminiModel;

  const recorded: RecordedRun[] = [];
  let promptHash = '';
  let lastCallAt = 0;
  let stopped = false;
  for (const { post, folder } of posts) {
    const { server, base } = await serveImages(folder);
    try {
      const [cover, ...slides] = post.images.map((i) => `${base}/${encodeURIComponent(i)}`);
      const built = await buildGeminiExtractionRequest({
        postId: post.postId,
        accountId: 'eval',
        content: post.caption,
        ...(cover ? { imageUrl: cover } : {}),
        ...(slides.length > 0 ? { additionalImageUrls: slides } : {}),
        postUrl: `https://example.invalid/${post.postId}`,
        publishedAt: post.publishedAt,
        ...(post.ownerUsername ? { ownerUsername: post.ownerUsername } : {}),
      },
      // Like the pipeline (process-extraction-step.ts): send every labelled slide, not only the env default.
      { maxCarouselImages: slides.length });
      promptHash ||= createHash('sha256').update(String(built.request.systemInstruction ?? '')).update(JSON.stringify(built.request.responseSchema ?? {})).digest('hex').slice(0, 12);
      for (let runIndex = 0; runIndex < runs; runIndex += 1) {
        if (stopped) {
          recorded.push({ postId: post.postId, runIndex, unavailable: true });
          continue;
        }
        let entry: RecordedRun | undefined;
        for (let attempt = 1; entry === undefined; attempt += 1) {
          const wait = lastCallAt + intervalMs - Date.now();
          if (wait > 0) await sleep(wait);
          lastCallAt = Date.now();
          try {
            const result = await callGeminiGenerateContent(apiKey, built.request);
            entry = { postId: post.postId, runIndex, text: result.text, ...(result.finishReason ? { finishReason: result.finishReason } : {}) };
          } catch (err) {
            const message = String((err as Error)?.message);
            const situation = classifyGeminiMessage(message).situation;
            const transient = situation === 'rate_limited' || situation === 'unavailable' || situation === 'quota_exhausted_daily';
            if (!transient) throw err;
            const delay = situation === 'quota_exhausted_daily' ? undefined : nextEvalRetryDelayMs(message, attempt);
            if (delay === undefined) {
              if (situation === 'quota_exhausted_daily') stopped = true;
              entry = { postId: post.postId, runIndex, unavailable: true };
              console.log(`${post.postId} run ${runIndex}: unavailable (${situation}) after ${attempt} attempt(s)`);
            } else {
              console.log(`${post.postId} run ${runIndex}: ${situation}, retry ${attempt} in ${Math.round(delay / 1000)}s`);
              await sleep(delay);
            }
          }
        }
        recorded.push(entry);
        console.log(`${post.postId} run ${runIndex + 1}/${runs}: ${entry.unavailable ? 'unavailable' : (entry.finishReason ?? 'answered')}`);
      }
    } finally {
      server.close();
    }
  }
  return { model, promptHash: promptHash || 'unknown', recordedAt: new Date().toISOString(), runs: recorded };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      dir: { type: 'string' },
      replay: { type: 'string' },
      runs: { type: 'string' },
      only: { type: 'string' },
      record: { type: 'string' },
      baseline: { type: 'string' },
      'write-baseline': { type: 'string' },
      json: { type: 'string' },
      'interval-ms': { type: 'string' },
    },
  });
  const dirArg = values.dir ?? process.env.EXTRACTION_EVAL_DIR;
  if (!dirArg || !existsSync(dirArg)) {
    console.log('No labelled directory configured (use --dir or EXTRACTION_EVAL_DIR, pointing at a folder of <postId>/label.json). Nothing to evaluate; exiting cleanly.');
    return;
  }
  const dir = resolve(dirArg);
  const runs = Number(values.runs ?? 3);
  if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');
  const posts = loadPosts(dir, values.only);
  if (posts.length === 0) {
    console.log(`No labelled posts found in ${dir}. Exiting cleanly.`);
    return;
  }

  let recorded: RecordedOutputs;
  let mode: 'live' | 'replay';
  if (values.replay) {
    mode = 'replay';
    recorded = parseRecordedOutputs(JSON.parse(readFileSync(values.replay, 'utf8')), values.replay);
  } else {
    mode = 'live';
    const apiKey = process.env.EXTRACTION_EVAL_GEMINI_API_KEY || process.env.SYSTEM_GEMINI_API_KEY;
    if (!apiKey) {
      console.log('No Gemini key (EXTRACTION_EVAL_GEMINI_API_KEY or SYSTEM_GEMINI_API_KEY) is set, so the live run cannot start. Use --replay <recorded.json> to score recorded answers offline. Exiting cleanly.');
      return;
    }
    const intervalMs = Number(values['interval-ms'] ?? process.env.EXTRACTION_EVAL_MIN_INTERVAL_MS ?? 5000);
    recorded = await recordLive(posts, runs, apiKey, intervalMs);
    const recordPath = values.record ?? 'extraction-eval-recorded.json';
    writeFileSync(recordPath, `${JSON.stringify(recorded, null, 2)}\n`);
    console.log(`Recorded raw answers to ${recordPath}`);
  }

  const byId = new Map(posts.map((p) => [p.post.postId, p.post]));
  const results = recorded.runs.filter((r) => byId.has(r.postId)).map((r) => classifyRun(byId.get(r.postId)!, r, parseLikePipeline));
  const aggregate = aggregateRuns(results);

  const baselinePath = values.baseline ?? join(dir, 'baseline.json');
  const baseline: Baseline | null = existsSync(baselinePath) ? parseBaseline(JSON.parse(readFileSync(baselinePath, 'utf8')), baselinePath) : null;
  const comparison = baseline ? compareToBaseline(aggregate, baseline) : null;
  const maxRun = Math.max(0, ...recorded.runs.map((r) => r.runIndex)) + 1;
  const report = buildReport(aggregate, { model: recorded.model, promptHash: recorded.promptHash, runs: mode === 'replay' ? maxRun : runs, mode }, baseline, comparison);

  console.log(report.markdown);
  if (values.json) writeFileSync(values.json, `${JSON.stringify(report.json, null, 2)}\n`);
  if (values['write-baseline']) {
    writeFileSync(values['write-baseline'], `${JSON.stringify(buildBaseline(aggregate, { model: recorded.model, promptHash: recorded.promptHash, date: new Date().toISOString().slice(0, 10), runs: maxRun }), null, 2)}\n`);
  }
  // Job summary only: counts and scores, never captions or images.
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report.markdown}\n`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
