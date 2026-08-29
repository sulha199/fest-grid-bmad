import test from 'node:test';
import * as assert from 'node:assert';
import { db } from '../db/client.js';
import { persistUnprocessedPayload } from '../lib/posts/persist-unprocessed-payload.js';
import { sql } from 'drizzle-orm';
import { unprocessedScraperPayloads } from '@festgrid/database';
import { resolvers } from './resolvers.js';
import crypto from 'node:crypto';

test('jsonb double-encoding fix', async (t) => {
  await t.test('freshly inserted row is correctly single-encoded', async () => {
    const payload = { source: 'TEST_SOURCE', parserVersion: '1.0', data: { foo: 'bar' } };
    const context = { accountId: 'test-account', source: 'TEST_SOURCE', parserVersion: '1.0' };
    
    const result = await persistUnprocessedPayload({
      rawPayload: payload,
      context: context as any,
      validationError: { message: 'test error' },
      isUnprocessable: true
    } as any);
    
    const rawQuery = sql`SELECT id, context::text as ctx_text, raw_payload::text as raw_text, validation_error::text as val_text FROM unprocessed_scraper_payloads WHERE id = ${result.id}`;
    
    const rows = await db.execute(rawQuery);
    const row = rows[0] as any;
    
    // They should not have extra quotes around them (i.e. starts with '{' instead of '"')
    assert.ok(row.ctx_text.startsWith('{'), `context should not be stringified twice: ${row.ctx_text}`);
    assert.ok(row.raw_text.startsWith('{'), `raw_payload should not be stringified twice: ${row.raw_text}`);
    assert.ok(row.val_text.startsWith('{'), `validation_error should not be stringified twice: ${row.val_text}`);

    // clean up
    await db.delete(unprocessedScraperPayloads).where(sql`id = ${result.id}`);
  });

  await t.test('queryUnprocessedPayloads matches both OLD and NEW encoding shapes', async () => {
    // 1. insert old double-encoded row bypassing Drizzle (via string)
    const oldId = crypto.randomUUID();
    const oldContextStr = JSON.stringify({ accountId: 'old-acc', source: 'test_old', parserVersion: '2.0' });
    await db.execute(sql`INSERT INTO unprocessed_scraper_payloads (id, raw_payload, validation_error, context) VALUES (${oldId}, ${oldContextStr}, ${oldContextStr}, ${oldContextStr})`);

    // 2. insert new single-encoded row
    const newId = crypto.randomUUID();
    const newContext = { accountId: 'new-acc', source: 'test_old', parserVersion: '2.0' };
    // with customJsonb, passing the object single-encodes it. To make sure, we just use standard Drizzle insert
    await db.insert(unprocessedScraperPayloads).values({
      id: newId,
      rawPayload: newContext,
      validationError: newContext,
      context: newContext
    });

    // Query via resolvers
    const res: any = await (resolvers.Query as any).queryUnprocessedPayloads(
      null, 
      { filters: { source: 'test_old', parserVersion: '2.0' }, first: 10 }, 
      { user: { role: 'moderator' } }, 
      null
    );

    const nodes = res.edges.map((e: any) => e.node);
    assert.ok(nodes.find((n: any) => n.id === oldId), 'should match OLD double-encoded row');
    assert.ok(nodes.find((n: any) => n.id === newId), 'should match NEW single-encoded row');

    // clean up
    await db.delete(unprocessedScraperPayloads).where(sql`id IN (${oldId}, ${newId})`);
  });
});
