import test from 'node:test';
import * as assert from 'node:assert';
import { activeOnly } from './active-only.js';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { and, eq } from 'drizzle-orm';

const testTableWithDeletedAt = pgTable('test_table_deleted_at', {
  id: uuid('id'),
  name: text('name'),
  deletedAt: timestamp('deleted_at'),
});

test('activeOnly', async (t) => {
  await t.test('builds a valid SQL where-fragment', () => {
    const fragment = activeOnly(testTableWithDeletedAt);
    assert.ok(fragment);
  });

  await t.test('composes correctly inside and()', () => {
    const condition = and(activeOnly(testTableWithDeletedAt), eq(testTableWithDeletedAt.id, '123'));
    assert.ok(condition);
  });
});
