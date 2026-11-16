import { inArray } from 'drizzle-orm';
import { posts } from '@festgrid/database';
import { db } from '../../db/client.js';

export type PostExtractionProgress = 'COMPLETE' | 'IN_PROGRESS' | 'PARTIAL';

/**
 * AD-50 Rules 1 and 3: whether each post's list of events may be incomplete. A persisted cursor means a stepped extraction is
 * still adding events (IN_PROGRESS); the permanent flag means it ended without reading every slide (PARTIAL). One small read
 * keyed by post id, kept out of `Query.events` and `Query.eventBySlug` on purpose (AD-30 Rule 4).
 */
export async function postExtractionProgressByPostId(postIds: readonly string[]): Promise<Map<string, PostExtractionProgress>> {
  const result = new Map<string, PostExtractionProgress>();
  if (postIds.length === 0) {
    return result;
  }
  const rows = await db
    .select({ id: posts.id, cursor: posts.extractionCursor, partial: posts.extractionPartial })
    .from(posts)
    .where(inArray(posts.id, [...postIds]));
  for (const row of rows) {
    result.set(row.id, row.cursor !== null ? 'IN_PROGRESS' : row.partial ? 'PARTIAL' : 'COMPLETE');
  }
  return result;
}
