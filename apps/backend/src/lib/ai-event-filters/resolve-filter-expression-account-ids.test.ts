import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { resolveFilterExpressionAccountIds } from './resolve-filter-expression-account-ids.js';
import type { FilterNode } from '@festgrid/domain/ai-event-filters';

test('resolveFilterExpressionAccountIds (AC3)', async (t) => {
  const stamp = Date.now();
  const createdProfileIds: string[] = [];
  t.after(async () => {
    for (const id of createdProfileIds) {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, id));
    }
  });

  const [profile] = await db
    .insert(socialMediaAccountProfiles)
    .values({
      accountId: `ai-expr-handle-${stamp}`,
      platform: 'instagram',
      username: `Jogja_Fest_Expr_${stamp}`,
      displayName: 'Jogja Fest Expr',
    } as any)
    .returning();
  createdProfileIds.push(profile.id);

  await t.test('a tree with zero accountId leaves passes through unchanged, performing no DB query', async () => {
    const node: FilterNode = { op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] };
    const result = await resolveFilterExpressionAccountIds(node, 'some-user-id');
    assert.deepEqual(result.expression, node);
    assert.deepEqual(result.caveats, []);
  });

  await t.test('a single resolving accountId leaf updates its value to the real profile UUID', async () => {
    const node: FilterNode = { field: 'accountId', value: `@jogja_fest_expr_${stamp}` };
    const result = await resolveFilterExpressionAccountIds(node, 'some-user-id');
    assert.deepEqual(result.expression, { field: 'accountId', value: profile.id });
    assert.deepEqual(result.caveats, []);
  });

  await t.test('two distinct accountId leaves under an OR -- one resolves, one drops with a caveat, tree still validates', async () => {
    const node: FilterNode = {
      op: 'OR',
      children: [
        { field: 'accountId', value: `@jogja_fest_expr_${stamp}` },
        { field: 'accountId', value: `@no_such_account_anywhere_${stamp}` },
      ],
    };
    const result = await resolveFilterExpressionAccountIds(node, 'some-user-id');
    assert.deepEqual(result.expression, { field: 'accountId', value: profile.id });
    assert.equal(result.caveats.length, 1);
    assert.match(result.caveats[0], new RegExp(`no_such_account_anywhere_${stamp}`));
  });
});
