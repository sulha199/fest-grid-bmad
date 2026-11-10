import test from 'node:test';
import * as assert from 'node:assert';
import { eq, inArray } from 'drizzle-orm';
import { posts, socialMediaAccountProfiles } from '@festgrid/database';
import { db } from '../../db/client.js';
import { postExtractionProgressByPostId } from './post-extraction-progress.js';

const suffix = Date.now().toString();

test('postExtractionProgressByPostId (AD-50)', async (t) => {
  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({ accountId: 'prog-' + suffix, platform: 'instagram', username: 'prog_' + suffix, displayName: 'Progress' })
    .returning();
  const ids: string[] = [];
  const makePost = async (tag: string, values: Partial<typeof posts.$inferInsert> = {}) => {
    const [post] = await db
      .insert(posts)
      .values({ accountId: profile.id, platform: 'instagram', content: tag, postUrl: `https://instagram.com/p/prog_${tag}_${suffix}`, publishedAt: new Date(), ...values })
      .returning();
    ids.push(post.id);
    return post;
  };
  t.after(async () => {
    if (ids.length) await db.delete(posts).where(inArray(posts.id, ids));
    await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
  });

  await t.test('maps the cursor and the partial flag to the three states, a chain outranking the flag, one read for many posts', async () => {
    const complete = await makePost('complete');
    const partial = await makePost('partial', { extractionPartial: true });
    const running = await makePost('running', { extractionCursor: { version: 1 } });
    const both = await makePost('both', { extractionCursor: { version: 1 }, extractionPartial: true });

    const result = await postExtractionProgressByPostId([complete.id, partial.id, running.id, both.id, '00000000-0000-4000-8000-0000000000aa']);

    assert.strictEqual(result.get(complete.id), 'COMPLETE');
    assert.strictEqual(result.get(partial.id), 'PARTIAL');
    assert.strictEqual(result.get(running.id), 'IN_PROGRESS');
    assert.strictEqual(result.get(both.id), 'IN_PROGRESS');
    assert.strictEqual(result.has('00000000-0000-4000-8000-0000000000aa'), false, 'an unknown post is simply absent');
  });

  await t.test('no ids, no query', async () => {
    assert.strictEqual((await postExtractionProgressByPostId([])).size, 0);
  });
});
