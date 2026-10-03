// Story 3.6n (AC4, Task 3): resize the already-blurred (Task 2, detect-and-blur-faces.ts)
// image to the final thumbnail dimensions, upload it, and record posts.durableThumbnailUrl.
// Mirrors rehost-post-image.ts's S3-client-seam, key-building, and previous-key-cleanup
// pattern -- reusing the SAME S3 client seam (s3ClientInstance/setS3ClientInstance) rather than
// constructing a second client (AC4).
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { type BackendEnv } from '../../env.js';
import { buildPostMediaKey, extractPostMediaKeyFromUrl } from '@festgrid/domain/posts';
import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { CreateInvalidationCommand } from '@aws-sdk/client-cloudfront';
import { s3ClientInstance, cloudFrontClientInstance } from './rehost-post-image.js';

/**
 * Resizes/crops the already face-blurred image (AC3's processing order: blur happens before
 * this), re-encodes it as JPEG quality 80, uploads it to the content-versioned
 * `posts/{postId}/thumb-{hash8}.jpg` key (AD-28 Rule 9), and writes the resulting CloudFront URL
 * to `posts.durableThumbnailUrl` -- independent of `isImageStorageOptedIn` (AC4).
 *
 * Best-effort: the entire upload+DB-write sequence is wrapped in its own try/catch (mirroring
 * `rehostPostImage`'s outer try/catch) so a failure here returns/logs cleanly without throwing,
 * never affecting the caller's own backfill decision (AC9 -- the real detected face count is
 * backfilled by the caller independent of whether this upload step succeeds).
 */
export async function uploadFaceBlurThumbnail(
  postId: string,
  blurredImageBuffer: Buffer,
  env: BackendEnv
): Promise<string | null> {
  const { postMediaBucketName, postMediaCdnDomain } = env;

  if (!postMediaBucketName || !postMediaCdnDomain) {
    console.warn(
      `Face-blur thumbnail upload skipped for post ${postId}: Missing postMediaBucketName or postMediaCdnDomain environment configuration`
    );
    return null;
  }

  try {
    const thumbnailBuffer = await sharp(blurredImageBuffer)
      .resize(480, 480, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    const [currentRow] = await db
      .select({ durableThumbnailUrl: posts.durableThumbnailUrl })
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    const previousKey = extractPostMediaKeyFromUrl(postMediaCdnDomain, currentRow?.durableThumbnailUrl);

    const hash8 = createHash('sha256').update(thumbnailBuffer).digest('hex').slice(0, 8);
    const key = buildPostMediaKey(postId, 'thumb', hash8, 'jpg');

    await s3ClientInstance.send(
      new PutObjectCommand({
        Bucket: postMediaBucketName,
        Key: key,
        Body: thumbnailBuffer,
        ContentType: 'image/jpeg',
      })
    );

    const durableThumbnailUrl = `https://${postMediaCdnDomain}/${key}`;

    await db.update(posts).set({ durableThumbnailUrl }).where(eq(posts.id, postId));

    // Best-effort cleanup of a superseded previous thumbnail -- never affects this function's
    // own success/failure (mirrors rehostPostImage's identical precedent).
    if (previousKey && previousKey !== key) {
      try {
        await s3ClientInstance.send(new DeleteObjectCommand({ Bucket: postMediaBucketName, Key: previousKey }));
      } catch (cleanupError) {
        console.error(`Face-blur thumbnail S3 cleanup failed for post ${postId} (previousKey=${previousKey}):`, cleanupError);
      }
      try {
        await cloudFrontClientInstance.send(
          new CreateInvalidationCommand({
            DistributionId: env.postMediaDistributionId,
            InvalidationBatch: {
              CallerReference: `${postId}-thumb-${hash8}-${Date.now()}`,
              Paths: { Quantity: 1, Items: [`/${previousKey}`] },
            },
          })
        );
      } catch (cleanupError) {
        console.error(
          `Face-blur thumbnail CloudFront invalidation failed for post ${postId} (previousKey=${previousKey}):`,
          cleanupError
        );
      }
    }

    return durableThumbnailUrl;
  } catch (error) {
    console.error(`Face-blur thumbnail upload failed for post ${postId}:`, error);
    return null;
  }
}

export let uploadFaceBlurThumbnailSeam = uploadFaceBlurThumbnail;
export function setUploadFaceBlurThumbnailSeam(fn: typeof uploadFaceBlurThumbnail) {
  uploadFaceBlurThumbnailSeam = fn;
}
