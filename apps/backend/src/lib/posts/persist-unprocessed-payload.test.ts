import test from 'node:test';
import * as assert from 'node:assert';
import { persistUnprocessedPayload } from './persist-unprocessed-payload.js';
import { db } from '../../db/client.js';
import { unprocessedScraperPayloads } from '@festgrid/database';
import { eq } from 'drizzle-orm';
import { sendScraperAuditAlert, setSendScraperAuditAlert } from '../notifications/send-scraper-audit-alert.js';

test('persistUnprocessedPayload', async (t) => {
  const originalSendScraperAuditAlert = sendScraperAuditAlert;
  t.afterEach(() => {
    setSendScraperAuditAlert(originalSendScraperAuditAlert);
  });

  await t.test('persists unprocessed payload to database', async () => {
    const testPayload = {
      rawPayload: { content: 'test', url: 'https://example.com/post' },
      validationError: [
        {
          instancePath: '$.content',
          schemaPath: '#/required',
          keyword: 'type',
          message: 'must be string',
        },
      ],
      context: {
        source: 'apify' as const,
        scraperVendor: 'instagram',
        accountId: 'test_account_123',
        postUrl: 'https://example.com/post',
        timestamp: new Date().toISOString(),
        parserVersion: '3.4g',
      },
    };

    const result = await persistUnprocessedPayload(testPayload);

    assert.ok(result);
    assert.ok((result as any).id);
    assert.deepStrictEqual((result as any).rawPayload, testPayload.rawPayload);
    assert.deepStrictEqual((result as any).validationError, testPayload.validationError);
    assert.deepStrictEqual((result as any).context, testPayload.context);
    assert.ok((result as any).createdAt);
    assert.strictEqual((result as any).deletedAt, null);
  });

  await t.test('persists payload with null optional context fields', async () => {
    const testPayload = {
      rawPayload: { error: 'not_found' },
      validationError: [
        {
          instancePath: '$',
          schemaPath: '#/type',
          keyword: 'type',
          message: 'must be object',
        },
      ],
      context: {
        source: 'gemini' as const,
        scraperVendor: null,
        accountId: null,
        postUrl: null,
        timestamp: new Date().toISOString(),
        parserVersion: '3.4g',
      },
    };

    const result = await persistUnprocessedPayload(testPayload);

    assert.ok(result);
    assert.strictEqual((result as any).context.scraperVendor, null);
    assert.strictEqual((result as any).context.accountId, null);
    assert.strictEqual((result as any).context.postUrl, null);
  });

  await t.test('can query persisted payload by ID', async () => {
    const testPayload = {
      rawPayload: { content: 'test' },
      validationError: [{ keyword: 'required', message: 'field required' }],
      context: {
        source: 'brightdata' as const,
        scraperVendor: null,
        accountId: null,
        postUrl: 'https://example.com/post',
        timestamp: new Date().toISOString(),
        parserVersion: '3.4g',
      },
    };

    const inserted = await persistUnprocessedPayload(testPayload);

    const queried = await db
      .select()
      .from(unprocessedScraperPayloads)
      .where(eq(unprocessedScraperPayloads.id, (inserted as any).id))
      .limit(1)
      .then((rows) => rows[0]);

    assert.ok(queried);
    assert.strictEqual((queried as any).id, (inserted as any).id);
    assert.deepStrictEqual((queried as any).rawPayload, testPayload.rawPayload);
  });

  await t.test('FK violation: preserves the orphaned run id in context and alerts moderators', async () => {
    const nonExistentRunId = '00000000-0000-4000-8000-000000000000';
    const alertCalls: any[] = [];
    setSendScraperAuditAlert(async (details) => {
      alertCalls.push(details);
    });

    const testPayload = {
      rawPayload: { content: 'test' },
      validationError: [{ keyword: 'required', message: 'field required' }],
      context: {
        source: 'apify' as const,
        scraperVendor: 'instagram',
        accountId: null,
        postUrl: 'https://example.com/post',
        timestamp: new Date().toISOString(),
        parserVersion: '3.4g',
      },
      scraperActorRunId: nonExistentRunId,
    };

    const result = await persistUnprocessedPayload(testPayload);

    assert.ok(result);
    assert.strictEqual((result as any).scraperActorRunId, null);
    assert.strictEqual((result as any).context.orphanedScraperActorRunId, nonExistentRunId);
    assert.strictEqual(alertCalls.length, 1);
    assert.strictEqual(alertCalls[0].source, 'persistUnprocessedPayload');
    assert.ok(alertCalls[0].message.includes(nonExistentRunId));
  });
});
