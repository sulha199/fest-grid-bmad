import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { CLEAN_EXTRACTION_LEDGER } from './extraction-ledger.js';

export async function markPostExtracted(postId: string) {
  const [updatedPost] = await db
    .update(posts)
    // AD-52 Rule 4: a finished extraction clears any failure it had on record. (It leaves a stepped chain's cursor
    // alone: a chain ends only through finishExtractionChain, by its lease holder.)
    .set({ isExtracted: true, ...CLEAN_EXTRACTION_LEDGER })
    .where(eq(posts.id, postId))
    .returning();

  return updatedPost || undefined;
}
