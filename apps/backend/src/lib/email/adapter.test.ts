import test from 'node:test';
import assert from 'node:assert/strict';
import { sendTemplatedEmail } from './adapter.js';
import { setSesClient } from './ses-client.js';
import { SESv2Client } from '@aws-sdk/client-sesv2';

process.env.SES_FROM_EMAIL_ADDRESS = 'notifications@festdaily.app';
process.env.BACKEND_PORT = '4000';

test('sendTemplatedEmail adapter tests', async (t) => {
  await t.test('sends QUOTA_EXHAUSTION_WARNING email via SESv2Client successfully', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      let sentCommand: any = null;
      
      const mockSesClient = {
        send: async (command: any) => {
          sentCommand = command;
          return { MessageId: 'msg-12345' };
        }
      } as unknown as SESv2Client;

      setSesClient(mockSesClient);

      const messageId = await sendTemplatedEmail('QUOTA_EXHAUSTION_WARNING', 'user@example.com', {
        userName: 'Maria',
        queuedPostCount: 3,
        queuedDays: 5,
        apiKeyManagementUrl: 'https://festdaily.app/api-keys',
      });

      assert.equal(messageId, 'msg-12345');
      assert.ok(sentCommand);
      assert.equal(sentCommand.input.FromEmailAddress, 'notifications@festdaily.app');
      assert.deepEqual(sentCommand.input.Destination.ToAddresses, ['user@example.com']);
      
      const simpleContent = sentCommand.input.Content.Simple;
      assert.equal(simpleContent.Subject.Data, 'Action Required: Your FestDaily event extraction is paused');
      assert.ok(simpleContent.Body.Html.Data.includes('Maria'));
      assert.ok(simpleContent.Body.Text.Data.includes('3'));
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  await t.test('propagates SES send errors unmodified', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    try {
      const mockSesClient = {
        send: async () => {
          throw new Error('SES_SERVICE_DOWN');
        }
      } as unknown as SESv2Client;

      setSesClient(mockSesClient);

      await assert.rejects(
        async () => {
          await sendTemplatedEmail('INVALID_API_KEY_ALERT', 'user@example.com', {
            userName: 'John',
            invalidAttemptCount: 5,
            apiKeyManagementUrl: 'https://festdaily.app/api-keys',
          });
        },
        /SES_SERVICE_DOWN/
      );
    } finally {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  await t.test('stubs email send and logs to console if SES_FROM_EMAIL_ADDRESS is missing', async () => {
    const originalFrom = process.env.SES_FROM_EMAIL_ADDRESS;
    const originalNodeEnv = process.env.NODE_ENV;
    
    delete process.env.SES_FROM_EMAIL_ADDRESS;
    process.env.NODE_ENV = 'development';

    let sendCalled = false;
    const mockSesClient = {
      send: async () => {
        sendCalled = true;
        return { MessageId: 'msg-should-not-be-called' };
      }
    } as unknown as SESv2Client;
    
    setSesClient(mockSesClient);

    try {
      const messageId = await sendTemplatedEmail('DANGEROUS_EVENT_MODERATOR_ALERT', 'moderator@example.com', {
        eventName: 'Dangerous Event',
        moderatorReviewUrl: 'https://festdaily.app/moderation',
      });

      assert.match(messageId, /^local-dev-/);
      assert.equal(sendCalled, false);
    } finally {
      process.env.SES_FROM_EMAIL_ADDRESS = originalFrom;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  await t.test('stubs email send and logs to console if NODE_ENV is test regardless of SES_FROM_EMAIL_ADDRESS', async () => {
    const originalFrom = process.env.SES_FROM_EMAIL_ADDRESS;
    const originalNodeEnv = process.env.NODE_ENV;

    process.env.SES_FROM_EMAIL_ADDRESS = 'notifications@festdaily.app';
    process.env.NODE_ENV = 'test';

    let sendCalled = false;
    const mockSesClient = {
      send: async () => {
        sendCalled = true;
        return { MessageId: 'msg-should-not-be-called' };
      }
    } as unknown as SESv2Client;

    setSesClient(mockSesClient);

    try {
      const messageId = await sendTemplatedEmail('INVALID_API_KEY_ALERT', 'user@example.com', {
        userName: 'John',
        invalidAttemptCount: 5,
        apiKeyManagementUrl: 'https://festdaily.app/api-keys',
      });

      assert.match(messageId, /^local-dev-/);
      assert.equal(sendCalled, false);
    } finally {
      process.env.SES_FROM_EMAIL_ADDRESS = originalFrom;
      process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
