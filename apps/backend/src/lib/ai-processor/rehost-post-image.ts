import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { type BackendEnv } from '../../env.js';

export let s3ClientInstance = new S3Client({});

export function setS3ClientInstance(client: S3Client) {
  s3ClientInstance = client;
}

/**
 * Best-effort helper to upload post image bytes to durable S3 storage and record
 * the CloudFront-backed durable URL in the posts database table.
 *
 * This function handles its own errors: if configured correctly but S3 upload fails,
 * it logs the failure and returns null without throwing.
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

  const key = `posts/${postId}`;
  try {
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

    return durableImageUrl;
  } catch (error) {
    console.error(`S3 rehosting failed for post ${postId}:`, error);
    return null;
  }
}
