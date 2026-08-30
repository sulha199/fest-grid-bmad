import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { setSesClient } from '../lib/email/ses-client.js';
import { SESv2Client } from '@aws-sdk/client-sesv2';

const schemaDir = path.resolve(process.cwd(), 'src/schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.graphql'));
const typeDefs = files.map(f => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');

const schema = createSchema({
  typeDefs: `
    ${typeDefs}
    type Query {
      health: Boolean
    }
  `,
  resolvers: resolvers as any
});

let mockUser: any = null;

const yoga = createYoga({
  schema,
  context: () => ({
    user: mockUser,
  }) as any,
});

test('GraphQL Mutation - reportSystemError', async (t) => {
  const originalFrom = process.env.SES_FROM_EMAIL_ADDRESS;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalAlertEmail = process.env.SYSTEM_ERROR_ALERT_EMAIL;

  process.env.SES_FROM_EMAIL_ADDRESS = 'notifications@festdaily.app';
  process.env.NODE_ENV = 'development';
  process.env.SYSTEM_ERROR_ALERT_EMAIL = 'admin@festdaily.app';

  t.after(() => {
    process.env.SES_FROM_EMAIL_ADDRESS = originalFrom;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.SYSTEM_ERROR_ALERT_EMAIL = originalAlertEmail;
    setSesClient(null);
  });

  await t.test('unauthenticated call succeeds', async () => {
    mockUser = null;
    let sentCommand: any = null;
    const mockSesClient = {
      send: async (command: any) => {
        sentCommand = command;
        return { MessageId: 'msg-system-error-1' };
      }
    } as unknown as SESv2Client;
    setSesClient(mockSesClient);

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ReportSystemError($input: ReportSystemErrorInput!) {
            reportSystemError(input: $input)
          }
        `,
        variables: {
          input: {
            source: 'service-worker',
            message: 'Failed to register Service Worker',
            context: 'Stack trace details'
          }
        }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'Should not return any errors');
    assert.strictEqual(result.data.reportSystemError, true);
    assert.ok(sentCommand);
    assert.equal(sentCommand.input.FromEmailAddress, 'notifications@festdaily.app');
    assert.deepEqual(sentCommand.input.Destination.ToAddresses, ['admin@festdaily.app']);
    assert.ok(sentCommand.input.Content.Simple.Subject.Data.includes('[FestDaily System Alert]'));
  });

  await t.test('invalid input (missing source) is rejected with BAD_REQUEST', async () => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ReportSystemError($input: ReportSystemErrorInput!) {
            reportSystemError(input: $input)
          }
        `,
        variables: {
          input: {
            // source is missing/empty (which AJV schema minLength: 1 rejects)
            source: '',
            message: 'Failed to register Service Worker'
          }
        }
      })
    });

    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  await t.test('invalid input (context too long) is rejected with BAD_REQUEST', async () => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation ReportSystemError($input: ReportSystemErrorInput!) {
            reportSystemError(input: $input)
          }
        `,
        variables: {
          input: {
            source: 'service-worker',
            message: 'Failed',
            context: 'a'.repeat(5001)
          }
        }
      })
    });

    const result = await response.json();
    assert.ok(result.errors);
    assert.strictEqual(result.errors[0].extensions?.code, 'BAD_REQUEST');
  });

  await t.test('swallows SES delivery failure but still returns true', async () => {
    const mockSesClient = {
      send: async () => {
        throw new Error('SES_SERVICE_DOWN');
      }
    } as unknown as SESv2Client;
    setSesClient(mockSesClient);

    const originalConsoleError = console.error;
    let consoleErrorCalled = false;
    console.error = (...args: any[]) => {
      consoleErrorCalled = true;
      originalConsoleError(...args);
    };

    try {
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ReportSystemError($input: ReportSystemErrorInput!) {
              reportSystemError(input: $input)
            }
          `,
          variables: {
            input: {
              source: 'service-worker',
              message: 'Failed to register Service Worker'
            }
          }
        })
      });

      const result = await response.json();
      assert.ok(!result.errors, 'Should swallow SES error and not throw to caller');
      assert.strictEqual(result.data.reportSystemError, true);
      assert.ok(consoleErrorCalled, 'Should log error to console.error');
    } finally {
      console.error = originalConsoleError;
    }
  });

  await t.test('SYSTEM_ERROR_ALERT_EMAIL unset still returns true without calling SES', async () => {
    delete process.env.SYSTEM_ERROR_ALERT_EMAIL;
    
    let sendCalled = false;
    const mockSesClient = {
      send: async () => {
        sendCalled = true;
        return { MessageId: 'should-not-be-called' };
      }
    } as unknown as SESv2Client;
    setSesClient(mockSesClient);

    const originalConsoleError = console.error;
    let consoleErrorCalled = false;
    console.error = (...args: any[]) => {
      consoleErrorCalled = true;
      originalConsoleError(...args);
    };

    try {
      const response = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation ReportSystemError($input: ReportSystemErrorInput!) {
              reportSystemError(input: $input)
            }
          `,
          variables: {
            input: {
              source: 'service-worker',
              message: 'Failed to register Service Worker'
            }
          }
        })
      });

      const result = await response.json();
      assert.ok(!result.errors);
      assert.strictEqual(result.data.reportSystemError, true);
      assert.strictEqual(sendCalled, false);
      assert.ok(consoleErrorCalled, 'Should log unconfigured warning to console.error');
    } finally {
      console.error = originalConsoleError;
      process.env.SYSTEM_ERROR_ALERT_EMAIL = 'admin@festdaily.app';
    }
  });
});
