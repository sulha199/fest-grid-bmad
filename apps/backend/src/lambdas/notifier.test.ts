import test from 'node:test';
import * as assert from 'node:assert';
import { handler } from './notifier.js';

test('notifier lambda handler tests', async (t) => {
  await t.test('invokes sendQuotaWarningEmails exactly once', async () => {
    let callCount = 0;
    
    const mockSendQuotaWarningEmails = async () => {
      callCount++;
    };

    // Invoke handler with injected mock
    await handler({} as any, {} as any, {
      sendQuotaWarningEmails: mockSendQuotaWarningEmails,
    });

    // Verify it was invoked exactly once
    assert.strictEqual(callCount, 1, 'Should have invoked sendQuotaWarningEmails exactly once');
  });
});
