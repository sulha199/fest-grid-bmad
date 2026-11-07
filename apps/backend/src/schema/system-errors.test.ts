import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { setSesClient } from '../lib/email/ses-client.js';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { eq } from 'drizzle-orm';
import { alertEmailRateLimits } from '@festgrid/database';
import { db } from '../db/client.js';
import { REPORT_SYSTEM_ERROR_ALERT_KEY } from '../lib/alerts/alert-email-budget-store.js';

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

  const originalMaxEmails = process.env.SYSTEM_ERROR_ALERT_MAX_EMAILS;
  const originalWindow = process.env.SYSTEM_ERROR_ALERT_WINDOW_MINUTES;
  const resetAlertBudget = () => db.delete(alertEmailRateLimits).where(eq(alertEmailRateLimits.key, REPORT_SYSTEM_ERROR_ALERT_KEY));
  await resetAlertBudget();

  process.env.SES_FROM_EMAIL_ADDRESS = 'notifications@festdaily.app';
  process.env.NODE_ENV = 'development';
  process.env.SYSTEM_ERROR_ALERT_EMAIL = 'admin@festdaily.app';

  t.after(async () => {
    // The budget row is shared state in the database and counts toward the row-count ratchet.
    await resetAlertBudget();
    if (originalMaxEmails === undefined) delete process.env.SYSTEM_ERROR_ALERT_MAX_EMAILS;
    else process.env.SYSTEM_ERROR_ALERT_MAX_EMAILS = originalMaxEmails;
    if (originalWindow === undefined) delete process.env.SYSTEM_ERROR_ALERT_WINDOW_MINUTES;
    else process.env.SYSTEM_ERROR_ALERT_WINDOW_MINUTES = originalWindow;
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
  // --- Alert email budget: the mutation is public, so the alert address gets at most N emails per window. ---
  const report = async (message: string): Promise<any> => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation ($input: ReportSystemErrorInput!) { reportSystemError(input: $input) }`,
        variables: { input: { source: 'budget-test', message } },
      }),
    });
    return response.json();
  };

  /** Installs a counting SES client; returns the live sent-count reader. */
  const countSends = () => {
    const sent: any[] = [];
    setSesClient({ send: async (command: any) => { sent.push(command); return { MessageId: `m-${sent.length}` }; } } as unknown as SESv2Client);
    return sent;
  };

  /** Captures console.error lines while `fn` runs. */
  const captureErrors = async (fn: () => Promise<void>) => {
    const lines: string[] = [];
    const original = console.error;
    console.error = (...args: any[]) => { lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
    try { await fn(); } finally { console.error = original; }
    return lines;
  };

  await t.test('sends at most the budget per window; the rest are logged, and every caller still gets true', async () => {
    await resetAlertBudget();
    process.env.SYSTEM_ERROR_ALERT_MAX_EMAILS = '3';
    process.env.SYSTEM_ERROR_ALERT_WINDOW_MINUTES = '10';
    const sent = countSends();

    const results: any[] = [];
    const logged = await captureErrors(async () => {
      for (let i = 0; i < 7; i += 1) results.push(await report(`flood ${i}`));
    });

    assert.strictEqual(sent.length, 3, 'only the first 3 reports are emailed');
    assert.ok(results.every((r) => !r.errors && r.data.reportSystemError === true), 'a caller cannot tell it was limited');
    const suppressed = logged.filter((l) => l.includes('alert email suppressed'));
    assert.strictEqual(suppressed.length, 4, 'the other 4 are logged');
    assert.ok(suppressed.every((l, i) => l.includes(`flood ${i + 3}`)), 'the log carries the report, so nothing is lost');
  });

  await t.test('a burst of parallel reports still sends exactly the budget', async () => {
    await resetAlertBudget();
    process.env.SYSTEM_ERROR_ALERT_MAX_EMAILS = '5';
    const sent = countSends();

    await captureErrors(async () => {
      const results = await Promise.all(Array.from({ length: 25 }, (_, i) => report(`burst ${i}`)));
      assert.ok(results.every((r) => !r.errors && r.data.reportSystemError === true));
    });

    assert.strictEqual(sent.length, 5, 'concurrent calls cannot spend more than the budget');
  });

  await t.test('the budget comes back when the window has passed', async () => {
    await resetAlertBudget();
    process.env.SYSTEM_ERROR_ALERT_MAX_EMAILS = '1';
    process.env.SYSTEM_ERROR_ALERT_WINDOW_MINUTES = '10';
    const sent = countSends();

    await captureErrors(async () => {
      await report('first');
      await report('second, over budget');
    });
    assert.strictEqual(sent.length, 1);

    await db
      .update(alertEmailRateLimits)
      .set({ windowStartAt: new Date(Date.now() - 11 * 60 * 1000) })
      .where(eq(alertEmailRateLimits.key, REPORT_SYSTEM_ERROR_ALERT_KEY));

    await report('third, new window');
    assert.strictEqual(sent.length, 2, 'a new window starts a fresh budget');
  });

  await t.test('a database error in the limiter sends nothing (fails closed) and still returns true', async (t) => {
    await resetAlertBudget();
    process.env.SYSTEM_ERROR_ALERT_MAX_EMAILS = '10';
    const sent = countSends();
    t.mock.method(db, 'select', () => { throw new Error('DB_DOWN'); });

    let result: any;
    const logged = await captureErrors(async () => { result = await report('while the database is down'); });

    assert.ok(!result.errors);
    assert.strictEqual(result.data.reportSystemError, true);
    assert.strictEqual(sent.length, 0, 'no email when the budget cannot be checked');
    assert.ok(logged.some((l) => l.includes('failed to send alert email') && l.includes('while the database is down')), 'the report is still logged');
  });
});
