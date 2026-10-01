#!/usr/bin/env tsx
/**
 * One-time, idempotent backfill script to migrate already-rehosted `posts.durableImageUrl`
 * values off the legacy flat `posts/{postId}` S3 key format onto the content-versioned
 * `posts/{postId}/full-{hash8}.{ext}` format introduced by Story 3.6q (AD-28 Rule 9).
 *
 * Modes:
 *
 *   tsx src/backfill-post-media-keys.ts sizing
 *     Read-only. Counts `posts` rows whose `durableImageUrl` is set but does not yet match
 *     the versioned-key pattern.
 *
 *   tsx src/backfill-post-media-keys.ts backfill [--apply]
 *     Without `--apply`: dry run. Lists every row it *would* migrate (postId, current key)
 *       and writes nothing.
 *     With `--apply`: for each row needing migration, re-fetches the object's *current*
 *       bytes + content type from S3 (the already-rehosted durable copy -- never the
 *       original, long-expired source URL), then calls `rehostPostImage()` directly. That
 *       function already does exactly "upload at the versioned key, update
 *       `durableImageUrl`, best-effort delete+invalidate whatever the previous key was" --
 *       precisely this backfill's job per row (see this story's Dev Notes, "Design
 *       Decision: Reusing `rehostPostImage` for the Backfill").
 *
 * A row whose `durableImageUrl` already matches the versioned-key pattern is skipped with
 * zero S3/CloudFront calls, in both modes -- re-running the backfill after a successful run,
 * or over a mix of migrated/unmigrated rows, is a no-op for already-migrated rows and
 * idempotent for the rest.
 *
 * Never mutates `posts.imageUrl` (the original scraped URL) -- only `durableImageUrl` and
 * the underlying S3 objects.
 */
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { isNotNull } from 'drizzle-orm';
import { posts } from '@festgrid/database';
import { db } from './db/client.js';
import { loadBackendEnv, type BackendEnv } from './env.js';
import { extractPostMediaKeyFromUrl } from '@festgrid/domain/posts';
import { rehostPostImage } from './lib/ai-processor/rehost-post-image.js';
import { needsMigration, type PostMediaRow } from './lib/ai-processor/post-media-migration.js';

export type { PostMediaRow };
export { needsMigration };

export let s3ClientInstance = new S3Client({});

export function setS3ClientInstance(client: S3Client) {
  s3ClientInstance = client;
}

async function fetchDurableImageRows(): Promise<PostMediaRow[]> {
  return db
    .select({ id: posts.id, durableImageUrl: posts.durableImageUrl })
    .from(posts)
    .where(isNotNull(posts.durableImageUrl));
}

export async function runSizing(env: BackendEnv): Promise<{ total: number; needingMigration: number }> {
  const { postMediaCdnDomain } = env;
  if (!postMediaCdnDomain) {
    throw new Error('runSizing: postMediaCdnDomain is not configured.');
  }

  const rows = await fetchDurableImageRows();
  const needingMigration = rows.filter((row) => needsMigration(row, postMediaCdnDomain));

  console.log(`posts rows with durableImageUrl set: ${rows.length}`);
  console.log(`posts rows needing migration (legacy flat key format): ${needingMigration.length}`);

  return { total: rows.length, needingMigration: needingMigration.length };
}

export async function runBackfill(env: BackendEnv, apply: boolean): Promise<{ migrated: number; skipped: number; failed: number }> {
  const { postMediaCdnDomain, postMediaBucketName } = env;
  if (!postMediaCdnDomain) {
    throw new Error('runBackfill: postMediaCdnDomain is not configured.');
  }
  if (!postMediaBucketName) {
    throw new Error('runBackfill: postMediaBucketName is not configured.');
  }

  const rows = await fetchDurableImageRows();

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!needsMigration(row, postMediaCdnDomain)) {
      skipped++;
      continue;
    }
    // Already-filtered by needsMigration above: durableImageUrl is set and matches this
    // CDN's domain, so extractPostMediaKeyFromUrl is guaranteed non-null here.
    const currentKey = extractPostMediaKeyFromUrl(postMediaCdnDomain, row.durableImageUrl) as string;

    if (!apply) {
      console.log(`[DRY RUN] would migrate post ${row.id}: current key "${currentKey}"`);
      continue;
    }

    try {
      const object = await s3ClientInstance.send(new GetObjectCommand({ Bucket: postMediaBucketName, Key: currentKey }));
      if (!object.Body) {
        throw new Error(`GetObjectCommand returned no Body for key "${currentKey}"`);
      }
      const bytes = Buffer.from(await object.Body.transformToByteArray());
      const contentType = object.ContentType || 'image/jpeg';

      const newUrl = await rehostPostImage(row.id, bytes, contentType, env);
      if (newUrl) {
        migrated++;
        console.log(`Migrated post ${row.id}: ${row.durableImageUrl} -> ${newUrl}`);
      } else {
        failed++;
        console.error(`Failed to migrate post ${row.id}: rehostPostImage returned null`);
      }
    } catch (error) {
      failed++;
      console.error(`Failed to migrate post ${row.id} (key "${currentKey}"):`, error);
    }
  }

  console.log('');
  console.log(`migrated: ${migrated}, skipped-already-versioned: ${skipped}, failed: ${failed}`);

  return { migrated, skipped, failed };
}

async function main() {
  const [, , mode, ...rest] = process.argv;
  const env = loadBackendEnv();

  if (mode === 'sizing') {
    await runSizing(env);
    return;
  }

  if (mode === 'backfill') {
    const apply = rest.includes('--apply');
    await runBackfill(env, apply);
    return;
  }

  console.error('Usage:');
  console.error('  tsx src/backfill-post-media-keys.ts sizing');
  console.error('  tsx src/backfill-post-media-keys.ts backfill [--apply]');
  process.exit(1);
}

// Mirrors trigger-brightdata-onetime.ts's existing convention: a standalone script, always
// run directly via `tsx`, never imported elsewhere (its testable logic lives in
// `needsMigration`/`runSizing`/`runBackfill`, exported above and in
// `lib/ai-processor/post-media-migration.ts`, which its own test file imports instead).
main().catch((err) => {
  console.error('Backfill script failed:', err);
  process.exit(1);
});
