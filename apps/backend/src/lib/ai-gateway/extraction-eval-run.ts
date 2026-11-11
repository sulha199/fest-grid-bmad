/*
 * The testable parts of the per-field extraction accuracy eval runner (IDEA-261111-5cc, slice A):
 * `scripts/run-extraction-accuracy-eval.ts` is only argument parsing and the report around these.
 * Spec: _bmad-output/implementation-artifacts/spec-extraction-accuracy-eval.md. Docs: docs/infrastructure/extraction-accuracy-eval.md.
 *
 * Nothing here is part of the production pipeline and nothing in the pipeline imports it. The live path calls the
 * production request builder and gateway client; tests drive it with the gateway seam, never a real call.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { basename, extname, join } from 'node:path';
import { parseLabelledPost, type LabelledPost, type RecordedOutputs, type RecordedRun, type ScorablePayload } from '@festgrid/domain/extraction-eval';
import { stripMalformedLocationKeywords } from '@festgrid/domain/events';
import { classifyGeminiMessage } from './gemini-situation.js';
import { nextEvalRetryDelayMs } from './eval-retry-policy.js';
import { evalExitCode } from './eval-exit-policy.js';
import { compileValidator } from '../../validation/validate.js';
import { extractedEventSchema } from '../../validation/extracted-event.schema.js';

export interface LoadedPost {
  post: LabelledPost;
  folder: string;
}

/**
 * Read and parse a JSON file. A malformed file fails with its NAME only: the parser's own message can quote a snippet of the
 * file, and the label and recording files of a real set are private while the job log of this public repo is not.
 */
export function readJsonFile(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`${file}: not readable as JSON (the content is not shown; check the file for a stray character)`);
  }
}

/** Load every `<postId>/label.json` under `dir` (validated), and check that its images sit next to it. */
export function loadLabelledPosts(dir: string, only: string | undefined): LoadedPost[] {
  const folders = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const posts = folders
    .filter((f) => existsSync(join(dir, f, 'label.json')))
    .map((f) => {
      const file = join(dir, f, 'label.json');
      const post = parseLabelledPost(readJsonFile(file), file);
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

const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };

/** Serves one post's images from 127.0.0.1 so the production builder can fetch() them like remote image URLs. */
export function serveImages(folder: string): Promise<{ server: Server; base: string }> {
  return new Promise((ok) => {
    const server = createServer((req, res) => {
      const name = basename(decodeURIComponent(req.url ?? ''));
      const file = join(folder, name);
      if (!existsSync(file)) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(200, { 'content-type': IMAGE_TYPES[extname(name).toLowerCase()] ?? 'application/octet-stream' }).end(readFileSync(file));
    });
    server.listen(0, '127.0.0.1', () => ok({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }));
  });
}

/** The instruction embeds each post's own publish date; masked, the hash identifies the prompt and not the first post. */
export function hashPrompt(systemInstruction: string, responseSchema: unknown): string {
  return createHash('sha256')
    .update(systemInstruction.replace(/published on \d{4}-\d{2}-\d{2}/g, 'published on <date>'))
    .update(JSON.stringify(responseSchema ?? {}))
    .digest('hex')
    .slice(0, 12);
}

export interface RecordLiveOptions {
  /** Where the recording is rewritten after every run. */
  recordPath: string;
  /** Pause between calls (the system key returns 429 when called quickly). */
  intervalMs: number;
  /** Test seams; the defaults are the real clock and `setTimeout`. */
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (line: string) => void;
}

/**
 * Run every post `runs` times through the production request builder and gateway client, one call at a time, paced, with
 * growing retries on 429/503, and record the raw answers. The recording is rewritten after every run, so an abort on a hard
 * error (bad key, a 400) keeps everything answered so far; the error is then rethrown.
 */
export async function recordLive(posts: LoadedPost[], runs: number, apiKey: string, options: RecordLiveOptions): Promise<RecordedOutputs> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = options.now ?? Date.now;
  const log = options.log ?? console.log;
  process.env.BACKEND_PORT ??= '4001';
  // gemini-client -> guarded-call -> db/client throws at import without a URL; this eval never queries (see the golden-prompt eval).
  process.env.DATABASE_URL ??= 'postgresql://unused:unused@127.0.0.1:5432/unused';
  const { buildGeminiExtractionRequest } = await import('../ai-processor/build-gemini-request.js');
  const { callGeminiGenerateContent } = await import('./gemini-client.js');
  const { loadBackendEnv } = await import('../../env.js');
  const model = loadBackendEnv().geminiModel;

  const recorded: RecordedRun[] = [];
  let promptHash = '';
  const snapshot = (): RecordedOutputs => ({ model, promptHash: promptHash || 'unknown', recordedAt: new Date().toISOString(), runs: recorded });
  // Paid calls must not be lost: the recording is rewritten after every run, so an abort keeps everything answered so far.
  // Returns what it wrote, so the final result and the file on disk are the same object (same timestamp).
  const save = (): RecordedOutputs => {
    const written = snapshot();
    writeFileSync(options.recordPath, `${JSON.stringify(written, null, 2)}\n`);
    return written;
  };
  try {
    let lastCallAt = 0;
    let stopped = false;
    for (const { post, folder } of posts) {
      const { server, base } = await serveImages(folder);
      try {
        const [cover, ...slides] = post.images.map((i) => `${base}/${encodeURIComponent(i)}`);
        const built = await buildGeminiExtractionRequest(
          {
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
          { maxCarouselImages: slides.length }
        );
        promptHash ||= hashPrompt(String(built.request.systemInstruction ?? ''), built.request.responseSchema);
        // The builder swallows a failed image fetch and falls back to a text-only request. Scoring that would book a harness fault as
        // a wrong extraction, so a post whose images were not all sent makes no call and counts as unavailable.
        if (built.imagesSent !== post.images.length) {
          log(`${post.postId}: only ${built.imagesSent} of ${post.images.length} image(s) could be sent to the model (unreadable or unsupported file?); no calls made for this post, its runs are unavailable`);
          for (let runIndex = 0; runIndex < runs; runIndex += 1) recorded.push({ postId: post.postId, runIndex, unavailable: true });
          save();
          continue;
        }
        for (let runIndex = 0; runIndex < runs; runIndex += 1) {
          if (stopped) {
            recorded.push({ postId: post.postId, runIndex, unavailable: true });
            continue;
          }
          let entry: RecordedRun | undefined;
          for (let attempt = 1; entry === undefined; attempt += 1) {
            const wait = lastCallAt + options.intervalMs - now();
            if (wait > 0) await sleep(wait);
            lastCallAt = now();
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
                log(`${post.postId} run ${runIndex}: unavailable (${situation}) after ${attempt} attempt(s)`);
              } else {
                log(`${post.postId} run ${runIndex}: ${situation}, retry ${attempt} in ${Math.round(delay / 1000)}s`);
                await sleep(delay);
              }
            }
          }
          recorded.push(entry);
          save();
          log(`${post.postId} run ${runIndex + 1}/${runs}: ${entry.unavailable ? 'unavailable' : (entry.finishReason ?? 'answered')}`);
        }
      } finally {
        server.close();
      }
    }
  } catch (err) {
    // Hard error (bad key, a 400, an unreadable image): keep what was answered, then fail so the run is not mistaken for a pass.
    if (recorded.length > 0) {
      save();
      console.error(`Aborted after ${recorded.length} recorded run(s); partial recording saved to ${options.recordPath} (score it with --replay).`);
    }
    throw err;
  }
  return save();
}

/**
 * Same rule as the golden-prompt eval: a score is never a failure, but a live run in which no call got an answer (quota spent,
 * 429/503 on every call, unreadable images) left no signal and must not look green.
 */
export function liveExitCode(runs: RecordedRun[]): { code: 0 | 1; answered: number } {
  const answered = runs.filter((r) => r.unavailable !== true && r.text !== undefined).length;
  const code = evalExitCode({
    evaluated: answered,
    driftedFixtures: 0,
    driftedVariants: 0,
    ...(answered === 0 ? { stoppedReason: 'no run got an answer (quota, 429/503 or unreadable images)' } : {}),
  });
  return { code, answered };
}
