/**
 * Manual POC: mimics the real ingestion pipeline (Instagram post URL -> scrape -> Gemini
 * extraction) so prompt/data-structure changes to `build-gemini-request.ts` can be iterated
 * on locally, without touching the real posts/events/schedules tables.
 *
 * This is NOT wired into the production pipeline and never writes to the DB. It reuses the
 * same functions the real Lambdas call (`getScraperAdapter(...).getPostByUrl`,
 * `buildGeminiExtractionRequest`, `callGeminiGenerateContent`) so editing
 * `apps/backend/src/lib/ai-processor/build-gemini-request.ts`'s prompt/schema is reflected
 * immediately on the next run.
 *
 * Scrape results are cached locally (scripts/.poc-cache/) keyed by post URL, and reused until
 * the post's Instagram-CDN image URL expiry (parsed from its `oe=` query param, same as the
 * real pipeline's AD-12 handling) has passed -- so repeated prompt iterations don't re-spend
 * Apify quota. Pass --force to always re-scrape.
 *
 * Usage (from repo root, PowerShell):
 *   pnpm --filter backend exec tsx scripts/poc-ingestion-preview.ts --url "https://www.instagram.com/p/XXXXXXXXX/"
 *
 * Options:
 *   --url <url>              Instagram post URL to scrape (required)
 *   --apify-token <token>    Overrides APIFY_API_TOKEN for this run only (falls back to the
 *                            configured value via loadBackendEnv() if omitted). Prefer setting
 *                            this in .env instead of passing it here -- a CLI flag value lands
 *                            in shell history and is visible to other processes on the machine.
 *   --gemini-key <key>       Overrides SYSTEM_GEMINI_API_KEY for this run only. This key is
 *                            normally reserved for production's default-location inference
 *                            only (never general extraction) -- reusing it here is a
 *                            deliberate local-only shortcut so this POC doesn't need the real
 *                            BYOK/KMS machinery. Use your own key via this flag if you'd
 *                            rather not touch the shared system key (same shell-history caveat
 *                            as --apify-token above -- prefer .env when possible).
 *   --force                  Bypass the cache and always re-scrape
 *   --skip-validation        Skip the AJV schema check on Gemini's output (never blocks the
 *                            script either way -- this only silences the warning, useful once
 *                            you're intentionally trying a data structure that no longer
 *                            matches extracted-event.schema.ts)
 *   --preview-insert         Also print the events/schedules rows that WOULD be inserted --
 *                            DRY RUN ONLY, nothing is ever written to the database. No-ops
 *                            with a message when Gemini reports isEvent: false, matching the
 *                            real pipeline (process-ai-job.ts), which inserts nothing then too.
 *   --cache-dir <path>       Override the cache directory (default: scripts/.poc-cache)
 *   --help, -h               Print this usage text and exit
 *
 * If a network call to Apify or Gemini stalls, there's no built-in timeout -- Ctrl+C to abort.
 *
 * NOTE: `buildEventInsertValues`/`transformGeminiResponseToEventInfo`/`parseImageUrlExpiry`/etc.
 * are imported from `@festgrid/domain`, which resolves to that package's compiled `dist/`
 * output (its own `tsc --watch`, not this repo's `tsx watch`). If you edit that package's
 * source to iterate on the DB-mapping shape, rebuild it first (`pnpm --filter @festgrid/domain
 * build`) or the preview will silently keep using the stale compiled version. Prompt/schema
 * edits in `build-gemini-request.ts` don't have this problem -- that file is imported straight
 * from backend `src` and picked up immediately.
 */

import '../src/lib/scraper/register-adapters.js';
import { parseArgs } from 'node:util';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import {
  detectPlatformFromUrl,
  getScraperAdapter,
  parseImageUrlExpiry,
  buildEventInsertValues,
  transformGeminiResponseToEventInfo,
  type ScrapedPost,
  type GeminiExtractionPayload,
} from '@festgrid/domain';
import { buildGeminiExtractionRequest } from '../src/lib/ai-processor/build-gemini-request.js';
import { callGeminiGenerateContent } from '../src/lib/ai-gateway/gemini-client.js';
import { compileValidator } from '../src/validation/validate.js';
import { extractedEventSchema } from '../src/validation/extracted-event.schema.js';
import { loadBackendEnv } from '../src/env.js';

// Matches env.ts's own defensive fallback: this package compiles to CommonJS (no "type":
// "module" in package.json), where __dirname is ambient, but tsx's runtime loading can vary.
const scriptDir = typeof __dirname !== 'undefined' ? __dirname : resolve(process.cwd(), 'scripts');

interface CacheEntry {
  scrapedAt: string;
  imageUrlExpiresAt: string | null;
  scrapedPost: ScrapedPost;
}

const USAGE = `Usage:
  pnpm --filter backend exec tsx scripts/poc-ingestion-preview.ts --url "<instagram-post-url>" [options]

Options:
  --url <url>              Instagram post URL to scrape (required)
  --apify-token <token>    Overrides APIFY_API_TOKEN for this run only (prefer .env)
  --gemini-key <key>       Overrides SYSTEM_GEMINI_API_KEY for this run only (prefer .env)
  --force                  Bypass the cache and always re-scrape
  --skip-validation        Skip the AJV schema check on Gemini's output
  --preview-insert         Also print the events/schedules rows that WOULD be inserted (dry run)
  --cache-dir <path>       Override the cache directory (default: scripts/.poc-cache)
  --help, -h               Print this usage text and exit

See the file's top-of-file doc comment for full details on each option.`;

function parseCliArgs() {
  try {
    const { values } = parseArgs({
      options: {
        url: { type: 'string' },
        'apify-token': { type: 'string' },
        'gemini-key': { type: 'string' },
        force: { type: 'boolean', default: false },
        'skip-validation': { type: 'boolean', default: false },
        'preview-insert': { type: 'boolean', default: false },
        'cache-dir': { type: 'string' },
        help: { type: 'boolean', short: 'h', default: false },
      },
    });
    return values;
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    console.error(`\n${USAGE}`);
    process.exit(1);
  }
}

/** Strips query/hash and a trailing slash so trivially-different URLs for the same post
 * (tracking params, trailing slash) share one cache entry instead of silently bypassing it. */
function normalizeUrlForCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    let normalized = `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized.toLowerCase();
  } catch {
    return url;
  }
}

function cacheKeyFor(url: string): string {
  return createHash('sha256').update(normalizeUrlForCacheKey(url)).digest('hex').slice(0, 16);
}

function readCache(cacheFile: string): CacheEntry | null {
  if (!existsSync(cacheFile)) return null;
  try {
    return JSON.parse(readFileSync(cacheFile, 'utf-8')) as CacheEntry;
  } catch (err) {
    console.warn(`[cache] Ignoring unreadable/corrupt cache file ${cacheFile}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

async function main() {
  const args = parseCliArgs();

  if (args.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const url = args.url;
  if (!url) {
    console.error('Missing required --url <instagram-post-url>');
    console.error(`\n${USAGE}`);
    process.exit(1);
  }

  if (args['apify-token']) {
    // eslint-disable-next-line turbo/no-undeclared-env-vars -- read by instagram-adapter.ts's own loadBackendEnv() call, not this file
    process.env.APIFY_API_TOKEN = args['apify-token'];
  }

  const cacheDir = resolve(scriptDir, args['cache-dir'] || '.poc-cache');
  mkdirSync(cacheDir, { recursive: true });
  const cacheFile = resolve(cacheDir, `${cacheKeyFor(url)}.json`);

  const platform = detectPlatformFromUrl(url);
  if (!platform) {
    console.error(`Unsupported platform for URL: ${url}`);
    process.exit(1);
  }

  let scrapedPost: ScrapedPost;
  const cached = readCache(cacheFile);
  const now = new Date();

  if (!args.force && cached && cached.imageUrlExpiresAt && new Date(cached.imageUrlExpiresAt) > now) {
    console.log(`[cache] Reusing scrape from ${cached.scrapedAt} (image expires ${cached.imageUrlExpiresAt}) -- pass --force to re-scrape anyway`);
    scrapedPost = cached.scrapedPost;
  } else {
    if (args.force) {
      console.log('[scrape] --force set, bypassing cache');
    } else if (cached) {
      console.log(`[scrape] Cached image expired at ${cached.imageUrlExpiresAt ?? '(no parseable expiry)'}, re-scraping`);
    } else {
      console.log('[scrape] No cache entry found, scraping fresh');
    }

    const adapter = getScraperAdapter(platform);
    const result = await adapter.getPostByUrl(url);
    if (!result) {
      console.error('Scrape returned no post (could not retrieve content from this URL).');
      process.exit(1);
    }
    scrapedPost = result;

    const imageUrlExpiresAt = parseImageUrlExpiry(scrapedPost.imageUrl ?? null);
    const entry: CacheEntry = {
      scrapedAt: now.toISOString(),
      imageUrlExpiresAt: imageUrlExpiresAt ? imageUrlExpiresAt.toISOString() : null,
      scrapedPost,
    };
    writeFileSync(cacheFile, JSON.stringify(entry, null, 2));
    console.log(
      `[scrape] Cached to ${cacheFile}` +
        (imageUrlExpiresAt
          ? ` (image expires ${imageUrlExpiresAt.toISOString()})`
          : ' (no parseable image expiry -- will re-scrape every run)')
    );
  }

  console.log('\n--- Scraped Post ---');
  console.log(JSON.stringify(scrapedPost, null, 2));

  const env = loadBackendEnv();
  const geminiKey = args['gemini-key'] || env.systemGeminiApiKey;
  if (!geminiKey) {
    console.error('No Gemini API key available. Pass --gemini-key or set SYSTEM_GEMINI_API_KEY in .env.');
    process.exit(1);
  }

  const message = {
    postId: randomUUID(),
    accountId: '',
    content: scrapedPost.content,
    imageUrl: scrapedPost.imageUrl,
    postUrl: scrapedPost.postUrl,
    publishedAt: scrapedPost.publishedAt,
    ownerDisplayName: scrapedPost.ownerDisplayName,
    ownerUsername: scrapedPost.ownerUsername,
    additionalImageUrls: scrapedPost.additionalImageUrls,
  };

  console.log('\n--- Building Gemini extraction request (edit build-gemini-request.ts to iterate on the prompt/schema) ---');
  const { request } = await buildGeminiExtractionRequest(message);

  console.log('--- Calling Gemini ---');
  const result = await callGeminiGenerateContent(geminiKey, request);

  console.log('\n--- Raw Gemini Response ---');
  console.log(result.text);

  let payload: GeminiExtractionPayload;
  try {
    payload = JSON.parse(result.text);
  } catch (err) {
    console.error('\nGemini response was not valid JSON:', err);
    process.exit(1);
  }

  console.log('\n--- Parsed Extraction Payload ---');
  console.log(JSON.stringify(payload, null, 2));

  if (!args['skip-validation']) {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    const valid = validate(payload);
    if (valid) {
      console.log('\n[validation] PASSED against extracted-event.schema.ts');
    } else {
      console.warn('\n[validation] FAILED against extracted-event.schema.ts (non-fatal -- pass --skip-validation to silence while you experiment with a different shape):');
      console.warn(validate.errors);
    }
  }

  if (args['preview-insert']) {
    console.log('\n--- DRY RUN: would-be DB rows (nothing written to the database) ---');
    if (payload.isEvent === false) {
      // Matches process-ai-job.ts's real behavior: isEvent === false inserts nothing at all,
      // just marks the post extracted. Previewing an events row here would be fabricated.
      console.log('Gemini reported isEvent: false -- the real pipeline inserts nothing for this post (just marks it extracted). Nothing to preview.');
    } else {
      const extractedMessage = transformGeminiResponseToEventInfo(payload, {
        postId: message.postId,
        sourceSocialMediaAccountId: '',
        // No defaultLocation: this script has no account context to source one from (it's a
        // one-off URL, not a subscribed account), so the top-level location fallback branch
        // in transformGeminiResponseToEventInfo is intentionally never exercised here.
        resolvedScheduleLocations: new Map(),
        sourcePostText: scrapedPost.content,
      });
      const { event, schedules } = buildEventInsertValues(extractedMessage);
      console.log('events row:', JSON.stringify(event, null, 2));
      console.log(`schedules rows (${schedules.length}):`, JSON.stringify(schedules, null, 2));
      console.log(
        "\nNote: events.postId carries a strict DB-level UNIQUE constraint -- the real pipeline supports exactly one event per post today, not multiple."
      );
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('POC script failed:', err);
  process.exit(1);
});
