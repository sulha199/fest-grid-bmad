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
 * with growing retries on 429/503. Raw answers are recorded to --record (default ./extraction-eval-recorded.json), rewritten
 * after every run; on a hard error (bad key, a 400) the partial recording is kept, the message names the file, and the exit is 1.
 * Never a CI gate: the exit code is 0 for any score, non-zero when the eval itself cannot run (bad args, bad labels, a missing
 * or empty labelled dir, or a live run in which no call got an answer), so such a run is never read as a pass. Each of those
 * also writes one line to the job summary. With no Gemini key the live path prints why and exits 0.
 * The logic (loading, the live loop, pacing, exit code) is in src/lib/ai-gateway/extraction-eval-run.ts, where it is tested.
 *
 * Options: --dir, --replay, --runs N (default 3), --only <postId>, --record <file>, --baseline <file>,
 * --write-baseline <file>, --json <file> (report JSON), --interval-ms N (or EXTRACTION_EVAL_MIN_INTERVAL_MS),
 * --noise-floor <points> (the lowest noise band, default 15; a starting value to tune after the first real baseline),
 * --show-names (event names in the count_mismatch detail; off by default because the report goes to a public job summary).
 */
import { appendFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import {
  aggregateRuns,
  buildBaseline,
  buildReport,
  DEFAULT_NOISE_FLOOR,
  classifyRun,
  compareToBaseline,
  parseBaseline,
  parseRecordedOutputs,
  type Baseline,
  type RecordedOutputs,
} from '@festgrid/domain/extraction-eval';
import { liveExitCode, loadLabelledPosts, parseLikePipeline, prepareEvalEnv, readJsonFile, recordLive } from '../src/lib/ai-gateway/extraction-eval-run.js';

/** The eval could not run: say so in one line on the console and in the job summary, and exit 1 (never a silent pass). */
function cannotRun(reason: string): void {
  console.error(reason);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `> **The eval did not run, this is not a pass:** ${reason}\n`);
  process.exitCode = 1;
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
      'noise-floor': { type: 'string' },
      'show-names': { type: 'boolean' },
    },
  });
  const dirArg = values.dir || process.env.EXTRACTION_EVAL_DIR;
  if (!dirArg) return cannotRun('no labelled directory is configured (use --dir or EXTRACTION_EVAL_DIR, pointing at a folder of <postId>/label.json).');
  if (!existsSync(dirArg)) return cannotRun('the labelled directory does not exist (check --dir or EXTRACTION_EVAL_DIR).');
  const dir = resolve(dirArg);
  const runs = Number(values.runs ?? 3);
  if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs must be a positive integer');
  const noiseFloorPoints = Number(values['noise-floor'] ?? DEFAULT_NOISE_FLOOR * 100);
  if (!Number.isFinite(noiseFloorPoints) || noiseFloorPoints < 0 || noiseFloorPoints > 100) throw new Error('--noise-floor must be a number of points between 0 and 100');
  const posts = loadLabelledPosts(dir, values.only);
  if (posts.length === 0) return cannotRun('the labelled directory holds no <postId>/label.json (is the path one level too high or too low, e.g. a nested bucket prefix?).');

  let recorded: RecordedOutputs;
  let mode: 'live' | 'replay';
  if (values.replay) {
    mode = 'replay';
    recorded = parseRecordedOutputs(readJsonFile(values.replay), values.replay);
  } else {
    mode = 'live';
    const apiKey = process.env.EXTRACTION_EVAL_GEMINI_API_KEY || process.env.SYSTEM_GEMINI_API_KEY;
    if (!apiKey) {
      console.log('No Gemini key (EXTRACTION_EVAL_GEMINI_API_KEY or SYSTEM_GEMINI_API_KEY) is set, so the live run cannot start. Use --replay <recorded.json> to score recorded answers offline. Exiting cleanly.');
      return;
    }
    // An empty variable counts as unset; anything else must be a whole number of milliseconds (0 turns pacing off on purpose).
    const intervalRaw = values['interval-ms'] || process.env.EXTRACTION_EVAL_MIN_INTERVAL_MS || '5000';
    const intervalMs = Number(intervalRaw);
    if (!Number.isInteger(intervalMs) || intervalMs < 0) throw new Error(`--interval-ms / EXTRACTION_EVAL_MIN_INTERVAL_MS must be a whole number of milliseconds, got "${intervalRaw}"`);
    const recordPath = values.record ?? 'extraction-eval-recorded.json';
    // The production gateway client, imported here (not in the library: the AD-32 ratchet allows only the gateway's own files).
    prepareEvalEnv();
    const { callGeminiGenerateContent } = await import('../src/lib/ai-gateway/gemini-client.js');
    recorded = await recordLive(posts, runs, apiKey, { intervalMs, recordPath, callGemini: callGeminiGenerateContent });
    console.log(`Recorded raw answers to ${recordPath}`);
  }

  const byId = new Map(posts.map((p) => [p.post.postId, p.post]));
  const results = recorded.runs.filter((r) => byId.has(r.postId)).map((r) => classifyRun(byId.get(r.postId)!, r, parseLikePipeline));
  const aggregate = aggregateRuns(results);

  const baselinePath = values.baseline ?? join(dir, 'baseline.json');
  const baseline: Baseline | null = existsSync(baselinePath) ? parseBaseline(readJsonFile(baselinePath), baselinePath) : null;
  const comparison = baseline ? compareToBaseline(aggregate, baseline, noiseFloorPoints / 100) : null;
  const maxRun = Math.max(0, ...recorded.runs.map((r) => r.runIndex)) + 1;
  const report = buildReport(aggregate, { model: recorded.model, promptHash: recorded.promptHash, runs: mode === 'replay' ? maxRun : runs, mode }, baseline, comparison, { showNames: values['show-names'] === true });

  console.log(report.markdown);
  if (values.json) writeFileSync(values.json, `${JSON.stringify(report.json, null, 2)}\n`);
  if (values['write-baseline']) {
    writeFileSync(values['write-baseline'], `${JSON.stringify(buildBaseline(aggregate, { model: recorded.model, promptHash: recorded.promptHash, date: new Date().toISOString().slice(0, 10), runs: maxRun }), null, 2)}\n`);
  }
  // Job summary only: counts and scores, never captions or images.
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report.markdown}\n`);
  if (mode === 'live') {
    const { code, answered } = liveExitCode(recorded.runs);
    if (code === 1) cannotRun(`no run got an answer (${answered} of ${recorded.runs.length}), so nothing was scored (quota, 429/503 or unreadable images).`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
