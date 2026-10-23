import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../db/client.js';
import { socialMediaAccountProfiles, users } from '@festgrid/database';
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

  const [seededUser] = await db.select().from(users).limit(1);
  assert.ok(seededUser, 'at least one seeded user is required');
  const userId = seededUser.id;

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
    const result = await resolveFilterExpressionAccountIds(node, userId);
    assert.deepEqual(result.expression, node);
    assert.deepEqual(result.caveats, []);
  });

  await t.test('a single resolving accountId leaf updates its value to the real profile UUID', async () => {
    const node: FilterNode = { field: 'accountId', value: `@jogja_fest_expr_${stamp}` };
    const result = await resolveFilterExpressionAccountIds(node, userId);
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
    const result = await resolveFilterExpressionAccountIds(node, userId);
    assert.deepEqual(result.expression, { field: 'accountId', value: profile.id });
    assert.equal(result.caveats.length, 1);
    assert.match(result.caveats[0], new RegExp(`no_such_account_anywhere_${stamp}`));
  });

  const NO_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';
  const unknownHandle = `@no_such_account_anywhere_${stamp}`;

  await t.test('D3: an unresolved account directly under an AND is still dropped as an ignored constraint', async () => {
    const node: FilterNode = {
      op: 'AND',
      children: [{ field: 'accountId', value: unknownHandle }, { field: 'keyword', value: 'jazz' }],
    };
    const result = await resolveFilterExpressionAccountIds(node, userId);
    assert.deepEqual(result.expression, { field: 'keyword', value: 'jazz' });
    assert.deepEqual(result.caveats, [`Could not find an account matching "${unknownHandle}", so events from all accounts are shown.`]);
  });

  await t.test('D3: an OR of only unresolved accounts matches no events, with one accurate caveat per distinct handle', async () => {
    const node: FilterNode = {
      op: 'OR',
      children: [
        { field: 'accountId', value: unknownHandle },
        { op: 'AND', children: [{ field: 'accountId', value: unknownHandle }, { field: 'keyword', value: 'jazz' }] },
      ],
    };
    const result = await resolveFilterExpressionAccountIds(node, userId);
    assert.equal(result.caveats.length, 1);
    assert.match(result.caveats[0], /treated as matching no events/);
    assert.deepEqual(result.expression, { field: 'accountId', value: NO_ACCOUNT_ID });
  });

  await t.test('D3: NOT over an AND containing an unresolved account excludes nothing, so it leaves no filter and no stand-in leaf', async () => {
    const node: FilterNode = {
      op: 'NOT',
      child: { op: 'AND', children: [{ field: 'accountId', value: unknownHandle }, { field: 'keyword', value: 'jazz' }] },
    };
    const result = await resolveFilterExpressionAccountIds(node, userId);
    // AND(never, jazz) matches nothing, so NOT(...) matches every event: no filter at all.
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.equal(result.caveats.length, 1);
    assert.match(result.caveats[0], /treated as matching no events/);
  });

  await t.test('Epic 9 re-review: a bare NOT(@unknown) excludes nothing and never leaks the stand-in id', async () => {
    const result = await resolveFilterExpressionAccountIds(
      { op: 'NOT', child: { field: 'accountId', value: unknownHandle } },
      userId
    );
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
    assert.doesNotMatch(JSON.stringify(result.expression), new RegExp(NO_ACCOUNT_ID));
    // The wording must not claim the filter matches nothing: here it matches everything.
    assert.doesNotMatch(result.caveats[0], /that part of your filter matches no events/);
  });

  await t.test('Epic 9 re-review: NOT(@unknown) beside other conditions simply drops out of an AND', async () => {
    const result = await resolveFilterExpressionAccountIds(
      {
        op: 'AND',
        children: [{ field: 'keyword', value: 'jazz' }, { op: 'NOT', child: { field: 'accountId', value: unknownHandle } }],
      },
      userId
    );
    assert.deepEqual(result.expression, { field: 'keyword', value: 'jazz' });
  });

  await t.test('Epic 9 re-review: an OR with a NOT(@unknown) branch matches every event, so it leaves no filter', async () => {
    const result = await resolveFilterExpressionAccountIds(
      {
        op: 'OR',
        children: [{ field: 'keyword', value: 'jazz' }, { op: 'NOT', child: { field: 'accountId', value: unknownHandle } }],
      },
      userId
    );
    assert.deepEqual(result.expression, { op: 'AND', children: [] });
  });

  await t.test('Epic 9 re-review: an unresolved branch of an OR is pruned and the other branch stays', async () => {
    const result = await resolveFilterExpressionAccountIds(
      { op: 'OR', children: [{ field: 'accountId', value: unknownHandle }, { field: 'keyword', value: 'jazz' }] },
      userId
    );
    assert.deepEqual(result.expression, { field: 'keyword', value: 'jazz' });
  });

  await t.test('Epic 9 re-review: NOT over an all-unresolved OR (a NOT of nothing) is no filter, and an unresolved AND child voids its AND', async () => {
    const notOr = await resolveFilterExpressionAccountIds(
      { op: 'NOT', child: { op: 'OR', children: [{ field: 'accountId', value: unknownHandle }, { field: 'accountId', value: `${unknownHandle}2` }] } },
      userId
    );
    assert.deepEqual(notOr.expression, { op: 'AND', children: [] });

    const orOfAnds = await resolveFilterExpressionAccountIds(
      {
        op: 'OR',
        children: [
          { op: 'AND', children: [{ field: 'accountId', value: unknownHandle }, { field: 'keyword', value: 'a' }] },
          { field: 'keyword', value: 'b' },
        ],
      },
      userId
    );
    assert.deepEqual(orOfAnds.expression, { field: 'keyword', value: 'b' });
  });
});
