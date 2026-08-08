import { db } from '../../db/client.js';
import { posts } from '@festgrid/database';
import { eq } from 'drizzle-orm';

export async function markPostExtracted(postId: string) {
  const [updatedPost] = await db
    .update(posts)
    .set({ isExtracted: true })
    .where(eq(posts.id, postId))
    .returning();

  return updatedPost || undefined;
}
