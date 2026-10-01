import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { createHash } from 'node:crypto';
import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { type BackendEnv } from '../../env.js';
import { buildPostMediaKey, resolvePostMediaExtension, extractPostMediaKeyFromUrl } from '@festgrid/domain/posts';

export let s3ClientInstance = new S3Client({});

export function setS3ClientInstance(client: S3Client) {
  s3ClientInstance = client;
}

export let cloudFrontClientInstance = new CloudFrontClient({});

export function setCloudFrontClientInstance(client: CloudFrontClient) {
  cloudFrontClientInstance = client;
}

/**
 * Best-effort helper to upload post image bytes to durable S3 storage and record
 * the CloudFront-backed durable URL in the posts database table.
 *
 * This function handles its own errors: if configured correctly but S3 upload fails,
 * it logs the failure and returns null without throwing.
 *
 * The S3 key is content-versioned (AD-28 Rule 9): `posts/{postId}/full-{hash8}.{ext}`,
 * where `hash8` is derived from the exact uploaded bytes. If a previous `durableImageUrl`
 * already pointed at a *different* key for this post (a changed/re-blurred image, or a
 * pre-versioning flat key), the previous S3 object is deleted and its CloudFront path is
 * invalidated on a best-effort basis after the new upload + DB update both succeed — never
 * blocking or undoing the already-committed new `durableImageUrl`. This generic "clean up
 * whatever the DB row already points at" behavior is also what lets the one-time backfill
 * script (Task 6) reuse this same function instead of duplicating the upload/cleanup logic.
 */
export async function rehostPostImage(
  postId: string,
  imageBytes: Buffer,
  imageContentType: string,
  env: BackendEnv
): Promise<string | null> {
  const { postMediaBucketName, postMediaCdnDomain } = env;

  if (!postMediaBucketName || !postMediaCdnDomain) {
    console.warn(
      `S3 rehosting skipped for post ${postId}: Missing postMediaBucketName or postMediaCdnDomain environment configuration`
    );
    return null;
  }

  try {
    const [currentRow] = await db
      .select({ durableImageUrl: posts.durableImageUrl })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    const previousKey = extractPostMediaKeyFromUrl(postMediaCdnDomain, currentRow?.durableImageUrl);

    const hash8 = createHash('sha256').update(imageBytes).digest('hex').slice(0, 8);
    const ext = resolvePostMediaExtension(imageContentType);
    const key = buildPostMediaKey(postId, 'full', hash8, ext);

    await s3ClientInstance.send(
      new PutObjectCommand({
        Bucket: postMediaBucketName,
        Key: key,
        Body: imageBytes,
        ContentType: imageContentType,
      })
    );

    const durableImageUrl = `https://${postMediaCdnDomain}/${key}`;

    // Update the post with the durable image URL
    await db
      .update(posts)
      .set({ durableImageUrl })
      .where(eq(posts.id, postId));

    // Best-effort cleanup of a previous, now-superseded object. Never allowed to affect
    // the function's return value (AC3) -- a cleanup failure must not turn a successful
    // rehost into a null return.
    if (previousKey && previousKey !== key) {
      // Delete and invalidation are independent best-effort steps: a failed delete must not
      // skip the invalidation (and vice versa).
      try {
        await s3ClientInstance.send(new DeleteObjectCommand({ Bucket: postMediaBucketName, Key: previousKey }));
      } catch (cleanupError) {
        console.error(`S3 cleanup failed for post ${postId} (previousKey=${previousKey}):`, cleanupError);
      }
      try {
        await cloudFrontClientInstance.send(
          new CreateInvalidationCommand({
            DistributionId: env.postMediaDistributionId,
            InvalidationBatch: {
              CallerReference: `${postId}-${hash8}-${Date.now()}`,
              Paths: { Quantity: 1, Items: [`/${previousKey}`] },
            },
          })
        );
      } catch (cleanupError) {
        console.error(`CloudFront invalidation failed for post ${postId} (previousKey=${previousKey}):`, cleanupError);
      }
    }

    return durableImageUrl;
  } catch (error) {
    console.error(`S3 rehosting failed for post ${postId}:`, error);
    return null;
  }
}
