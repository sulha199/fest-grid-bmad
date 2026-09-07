import { and, eq, gt } from 'drizzle-orm';
import { db } from '../../db/client.js';
import { instagramOembedCache } from '@festgrid/database';
import { InstagramOEmbedAdapterResult } from './types.js';

export async function getCachedEmbed(postUrl: string): Promise<InstagramOEmbedAdapterResult | null> {
  const result = await db.query.instagramOembedCache.findFirst({
    where: and(
      eq(instagramOembedCache.postUrl, postUrl),
      gt(instagramOembedCache.expiresAt, new Date())
    ),
  });

  if (!result) {
    return null;
  }

  if (result.status === 'AVAILABLE') {
    // A cached AVAILABLE row is always written with a non-null html (setCachedEmbed only
    // persists the html field for AVAILABLE results) -- fall back to UNAVAILABLE defensively
    // rather than returning a malformed AVAILABLE-with-null-html shape.
    return result.html != null ? { status: 'AVAILABLE', html: result.html } : { status: 'UNAVAILABLE' };
  }

  return { status: 'UNAVAILABLE' };
}

export async function setCachedEmbed(postUrl: string, result: InstagramOEmbedAdapterResult, ttlMs: number): Promise<void> {
  const expiresAt = new Date(Date.now() + ttlMs);
  const html = result.status === 'AVAILABLE' ? result.html : null;

  await db
    .insert(instagramOembedCache)
    .values({
      postUrl,
      status: result.status,
      html,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: instagramOembedCache.postUrl,
      set: {
        status: result.status,
        html,
        expiresAt,
        updatedAt: new Date(),
      },
    });
}
