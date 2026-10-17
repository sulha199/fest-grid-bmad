#!/usr/bin/env tsx
/**
 * Small, idempotent backfill that builds the face-blurred durable thumbnail
 * (`posts.durableThumbnailUrl`, AD-28) for posts that lack one although their ORIGINAL image URL
 * has not expired yet. Also the recovery path for posts whose pre-AI cover blur failed closed
 * (`extraction_audit_logs.ai_image_input = 'text_only_fail_closed'`): the extraction pipeline never
 * retries those, so re-running this while the original image is still valid is how they recover.
 *
 * Posts whose original image has already expired are not touched (the bytes are gone), and posts
 * the extraction pipeline's relevance gate would skip (the event ends before the image expires)
 * are skipped here too. See `lib/ai-processor/backfill-post-thumbnails.ts` for the full rules.
 *
 * Usage:
 *
 *   tsx src/backfill-post-thumbnails.ts backfill [--apply] [--limit N] [--post <postId>]...
 *     Without `--apply`: dry run. Lists every post it would build a thumbnail for and writes
 *       nothing (no fetch, no S3 upload, no DB write).
 *     With `--apply`: for each post, fetches the original image, face-blurs it, resizes it to the
 *       480x480 thumbnail and uploads it (`uploadFaceBlurThumbnail`, which writes the column).
 *
 * Re-running is safe: a post that already has a thumbnail is no longer a candidate.
 */
import { loadBackendEnv } from './env.js';
import { runThumbnailBackfill } from './lib/ai-processor/backfill-post-thumbnails.js';

function parseArgs(args: string[]): { apply: boolean; limit?: number; postIds?: string[] } {
  const apply = args.includes('--apply');
  let limit: number | undefined;
  const postIds: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit') {
      const value = Number(args[i + 1]);
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`--limit expects a positive integer, got "${args[i + 1]}"`);
      }
      limit = value;
      i++;
    } else if (args[i] === '--post') {
      const value = args[i + 1];
      if (!value) throw new Error('--post expects a post id');
      postIds.push(value);
      i++;
    }
  }
  return { apply, limit, postIds: postIds.length > 0 ? postIds : undefined };
}

async function main() {
  const [, , mode, ...rest] = process.argv;

  if (mode === 'backfill') {
    const env = loadBackendEnv();
    const options = parseArgs(rest);
    const result = await runThumbnailBackfill(env, options);
    if (result.failed > 0) process.exitCode = 1;
    return;
  }

  console.error('Usage:');
  console.error('  tsx src/backfill-post-thumbnails.ts backfill [--apply] [--limit N] [--post <postId>]...');
  process.exit(1);
}

// Standalone script, always run directly via `tsx` (mirrors backfill-post-media-keys.ts); its
// testable logic lives in lib/ai-processor/backfill-post-thumbnails.ts.
main().catch((err) => {
  console.error('Backfill script failed:', err);
  process.exit(1);
});
