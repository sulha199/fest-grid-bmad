import test from 'node:test';
import * as assert from 'node:assert';
import { handler } from './notifier.js';

test('notifier lambda handler tests', async (t) => {
  await t.test('invokes sendQuotaWarningEmails exactly once', async () => {
    let callCount = 0;

    const mockSendQuotaWarningEmails = async () => {
      callCount++;
    };
    const mockSendScraperProviderDownAlerts = async () => {};

    // Invoke handler with injected mock
    await handler({} as any, {} as any, {
      sendQuotaWarningEmails: mockSendQuotaWarningEmails,
      sendScraperProviderDownAlerts: mockSendScraperProviderDownAlerts,
    });

    // Verify it was invoked exactly once
    assert.strictEqual(callCount, 1, 'Should have invoked sendQuotaWarningEmails exactly once');
  });

  await t.test('invokes sendScraperProviderDownAlerts exactly once, alongside the quota sweep', async () => {
    let quotaCallCount = 0;
    let scraperAlertCallCount = 0;

    await handler({} as any, {} as any, {
      sendQuotaWarningEmails: async () => {
        quotaCallCount++;
      },
      sendScraperProviderDownAlerts: async () => {
        scraperAlertCallCount++;
      },
    });

    assert.strictEqual(quotaCallCount, 1, 'Should have invoked sendQuotaWarningEmails exactly once');
    assert.strictEqual(scraperAlertCallCount, 1, 'Should have invoked sendScraperProviderDownAlerts exactly once');
  });

  await t.test('a failure in sendScraperProviderDownAlerts does not prevent sendQuotaWarningEmails from running', async () => {
    let quotaCallCount = 0;

    await assert.rejects(
      handler({} as any, {} as any, {
        sendQuotaWarningEmails: async () => {
          quotaCallCount++;
        },
        sendScraperProviderDownAlerts: async () => {
          throw new Error('scraper alert boom');
        },
      })
    );

    assert.strictEqual(quotaCallCount, 1, 'sendQuotaWarningEmails should still run even though the other sweep threw');
  });

  await t.test('a failure in sendQuotaWarningEmails does not prevent sendScraperProviderDownAlerts from running', async () => {
    let scraperAlertCallCount = 0;

    await assert.rejects(
      handler({} as any, {} as any, {
        sendQuotaWarningEmails: async () => {
          throw new Error('quota warning boom');
        },
        sendScraperProviderDownAlerts: async () => {
          scraperAlertCallCount++;
        },
      })
    );

    assert.strictEqual(scraperAlertCallCount, 1, 'sendScraperProviderDownAlerts should still run even though the other sweep threw first');
  });
});
