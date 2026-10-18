import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, apiKeys, aiEventFilters, vendorCallLocks, socialMediaAccountProfiles, promptFilterRateLimits } from '@festgrid/database';
import { eq, and } from 'drizzle-orm';
import { setCallGeminiGenerateContent, callGeminiGenerateContent, GeminiInvalidKeyError } from '../lib/ai-gateway/gemini-client.js';
import { setDecryptApiKey } from '../lib/ai-gateway/kms.js';
import { setSleepForTest, sleepSeam } from '../lib/ai-gateway/adapter.js';

// Read all required schema fragments dynamically from the schema directory
const schemaDir = path.resolve(process.cwd(), 'src/schema');
const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.graphql'));
const typeDefs = files.map(f => fs.readFileSync(path.join(schemaDir, f), 'utf8')).join('\n');

const schema = createSchema({
  typeDefs,
  resolvers: resolvers as any
});

let mockUser: any = null;

const yoga = createYoga({
  schema,
  context: () => ({
    user: mockUser,
  }) as any,
});

test('ai event filters resolvers integration', async (t) => {
  let testUser: any;
  let anotherUser: any;
  let testApiKey: any;

  const originalCall = callGeminiGenerateContent;
  t.after(async () => {
    setCallGeminiGenerateContent(originalCall);
    if (testApiKey) {
      // callGemini now runs through the real callVendor lease; a released lease persists as a row
      // (release is an UPDATE), so delete this key's row along with the key itself.
      await db.delete(vendorCallLocks).where(eq(vendorCallLocks.lockKey, `gemini:key:${testApiKey.id}`));
      await db.delete(apiKeys).where(eq(apiKeys.id, testApiKey.id));
    }
    if (testUser) {
      await db.delete(aiEventFilters).where(eq(aiEventFilters.ownerUserId, testUser.id));
      // Story 9.8 -- row-count-ratchet cleanup for the new prompt_filter_rate_limits table.
      await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, testUser.id));
    }
  });

  await t.test('setup - get test users and clear existing data', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Should have at least 2 users for cross-user tests');
    testUser = seededUsers[0];
    anotherUser = seededUsers[1];

    await db.delete(aiEventFilters).where(eq(aiEventFilters.ownerUserId, testUser.id));
    await db.delete(aiEventFilters).where(eq(aiEventFilters.ownerUserId, anotherUser.id));
    await db.delete(apiKeys).where(eq(apiKeys.userId, testUser.id));
  });

  await t.test('unauthenticated calls are rejected', async () => {
    mockUser = null;

    const resQuery = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ myAIEventFilters { id } }`
      })
    });
    const resultQuery = await resQuery.json();
    assert.ok(resultQuery.errors, 'should return error');
    assert.strictEqual(resultQuery.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('resolvePromptToEventFilter rejects when user has no API key', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            resolvePromptToEventFilter(prompt: "Show me jazz events in Yogyakarta") {
              resolvedFilter {
                keyword
              }
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(result.errors, 'should return error when no api key');
    assert.strictEqual(result.errors[0].extensions?.code, 'NO_API_KEY');
  });

  await t.test('resolvePromptToEventFilter succeeds when user has key and Gemini responds successfully', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // Seed key in DB
    const [insertedKey] = await db.insert(apiKeys).values({
      userId: testUser.id,
      keyEncrypted: Buffer.from('mock-gemini-key').toString('base64'),
      keyLast4: 'gem1',
      provider: 'gemini',
      isValid: true,
      invalidAttempts: 0,
      usageCount: 0,
    }).returning();
    testApiKey = insertedKey;

    setDecryptApiKey(async (cipher) => {
      return Buffer.from(cipher, 'base64').toString('utf-8');
    });

    // Story 9.4 AC1/AC2: Gemini now returns the tree-shaped `expression` (not the legacy flat
    // `resolvedFilter`) -- this fixture is a leaf-shaped, flat-representable tree (no op/children),
    // so it round-trips to the exact same `resolvedFilter` back-projection as before.
    setCallGeminiGenerateContent(async () => {
      return {
        text: JSON.stringify({
          expression: {
            keyword: 'live jazz',
            types: ['PERFORMANCE'],
            categories: ['MUSIC'],
          },
          caveats: ['ignoring price filter'],
        })
      };
    });

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            resolvePromptToEventFilter(prompt: "Show me jazz events in Yogyakarta") {
              resolvedFilter {
                keyword
                types
                categories
              }
              expression {
                op
                children { field value }
              }
              caveats
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, 'Should succeed without errors');
    assert.strictEqual(result.data.resolvePromptToEventFilter.resolvedFilter.keyword, 'live jazz');
    assert.deepStrictEqual(result.data.resolvePromptToEventFilter.resolvedFilter.types, ['PERFORMANCE']);
    assert.deepStrictEqual(result.data.resolvePromptToEventFilter.resolvedFilter.categories, ['MUSIC']);
    assert.deepStrictEqual(result.data.resolvePromptToEventFilter.caveats, ['ignoring price filter']);

    const expression = result.data.resolvePromptToEventFilter.expression;
    assert.strictEqual(expression.op, 'AND');
    const leaves = expression.children;
    assert.ok(leaves.some((l: any) => l.field === 'keyword' && l.value === 'live jazz'));
    assert.ok(leaves.some((l: any) => l.field === 'type' && JSON.stringify(l.value) === JSON.stringify(['PERFORMANCE'])));
    assert.ok(leaves.some((l: any) => l.field === 'category' && JSON.stringify(l.value) === JSON.stringify(['MUSIC'])));
  });

  await t.test('resolvePromptToEventFilter calls the dedicated filter model and drops a venueType the prompt never mentioned (BUG: "exiting events for kid in the weekend")', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const originalFilterModel = process.env.GEMINI_FILTER_MODEL;
    process.env.GEMINI_FILTER_MODEL = 'gemini-filter-test-model';
    let requestedModel: string | undefined;
    setCallGeminiGenerateContent(async (_apiKey, request) => {
      requestedModel = request.model;
      // The lite-model failure mode: a placeholder venueType and nothing else.
      return { text: JSON.stringify({ expression: { venueType: 'kids' }, caveats: [] }) };
    });

    try {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              resolvePromptToEventFilter(prompt: "exiting events for kid in the weekend") {
                resolvedFilter { venueType }
                expression { op children { field value } }
                caveats
              }
            }
          `
        })
      });
      const result = await res.json();
      assert.ok(!result.errors, JSON.stringify(result.errors));
      assert.strictEqual(requestedModel, 'gemini-filter-test-model');
      const payload = result.data.resolvePromptToEventFilter;
      assert.strictEqual(payload.resolvedFilter.venueType ?? null, null);
      assert.deepStrictEqual(payload.expression.children ?? [], []);
      assert.deepStrictEqual(payload.caveats, ['Ignored the venue type "kids" because your prompt did not mention a place.']);
    } finally {
      if (originalFilterModel === undefined) {
        delete process.env.GEMINI_FILTER_MODEL;
      } else {
        process.env.GEMINI_FILTER_MODEL = originalFilterModel;
      }
    }
  });

  await t.test('resolvePromptToEventFilter denies over the configured per-user rate limit without calling Gemini (Story 9.8 AC1/AC2)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const originalMaxEnv = process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS;
    process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS = '2';

    let callCount = 0;
    setCallGeminiGenerateContent(async () => {
      callCount++;
      return {
        text: JSON.stringify({ expression: { keyword: 'live jazz' }, caveats: [] }),
      };
    });

    try {
      await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, testUser.id));
      // Seed a row already at the configured max (2) with a fresh window, so the next request
      // is the denied one.
      await db.insert(promptFilterRateLimits).values({
        userId: testUser.id,
        requestCount: 2,
        windowStartAt: new Date(),
      });

      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              resolvePromptToEventFilter(prompt: "Show me jazz events in Yogyakarta") {
                resolvedFilter { keyword }
              }
            }
          `
        })
      });
      const result = await res.json();
      assert.ok(result.errors, 'should deny the request over the configured limit');
      assert.strictEqual(result.errors[0].extensions?.code, 'RATE_LIMITED');
      assert.strictEqual(callCount, 0, 'callGemini must never be invoked for a denied attempt');
    } finally {
      await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, testUser.id));
      // loadBackendEnv() is not memoized -- restoring process.env is sufficient, no cache to bust.
      if (originalMaxEnv === undefined) {
        delete process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS;
      } else {
        process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS = originalMaxEnv;
      }
    }
  });

  await t.test('resolvePromptToEventFilter succeeds and resets the counter once the rate-limit window has elapsed (Story 9.8 AC1/AC2)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    const originalMaxEnv = process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS;
    const originalWindowEnv = process.env.PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES;
    process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS = '2';
    process.env.PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES = '10';

    let callCount = 0;
    setCallGeminiGenerateContent(async () => {
      callCount++;
      return {
        text: JSON.stringify({ expression: { keyword: 'live jazz' }, caveats: [] }),
      };
    });

    try {
      await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, testUser.id));
      // Seed a row at/above the max, but with a windowStartAt far enough in the past (20 minutes,
      // > the configured 10-minute window) that the window has elapsed.
      await db.insert(promptFilterRateLimits).values({
        userId: testUser.id,
        requestCount: 2,
        windowStartAt: new Date(Date.now() - 20 * 60 * 1000),
      });

      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              resolvePromptToEventFilter(prompt: "Show me jazz events in Yogyakarta") {
                resolvedFilter { keyword }
              }
            }
          `
        })
      });
      const result = await res.json();
      assert.ok(!result.errors, 'should succeed once the window has elapsed: ' + JSON.stringify(result.errors));
      assert.strictEqual(callCount, 1, 'callGemini must be invoked once the window has reset');

      const [row] = await db.select().from(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, testUser.id));
      assert.ok(row, 'a row should exist after the reset');
      assert.strictEqual(row.requestCount, 1, 'the counter should reset to 1, not keep incrementing the stale count');
    } finally {
      await db.delete(promptFilterRateLimits).where(eq(promptFilterRateLimits.userId, testUser.id));
      if (originalMaxEnv === undefined) {
        delete process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS;
      } else {
        process.env.PROMPT_FILTER_RATE_LIMIT_MAX_REQUESTS = originalMaxEnv;
      }
      if (originalWindowEnv === undefined) {
        delete process.env.PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES;
      } else {
        process.env.PROMPT_FILTER_RATE_LIMIT_WINDOW_MINUTES = originalWindowEnv;
      }
    }
  });

  await t.test('resolvePromptToEventFilter still accepts the legacy flat `resolvedFilter` response shape (AC2 regression)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    setCallGeminiGenerateContent(async () => {
      return {
        text: JSON.stringify({
          resolvedFilter: {
            keyword: 'live jazz',
            types: ['PERFORMANCE'],
            categories: ['MUSIC'],
          },
          caveats: ['ignoring price filter'],
        })
      };
    });

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            resolvePromptToEventFilter(prompt: "Show me jazz events in Yogyakarta") {
              resolvedFilter { keyword types categories }
              expression { op children { field value } }
              caveats
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, 'Should succeed without errors');
    assert.strictEqual(result.data.resolvePromptToEventFilter.resolvedFilter.keyword, 'live jazz');
    assert.deepStrictEqual(result.data.resolvePromptToEventFilter.resolvedFilter.types, ['PERFORMANCE']);
    assert.deepStrictEqual(result.data.resolvePromptToEventFilter.resolvedFilter.categories, ['MUSIC']);
    assert.deepStrictEqual(result.data.resolvePromptToEventFilter.caveats, ['ignoring price filter']);
    assert.ok(result.data.resolvePromptToEventFilter.expression, 'a derived expression is still returned');
  });

  await t.test('resolvePromptToEventFilter returns a grouped (OR/NOT) expression with an honest, non-fabricated empty resolvedFilter (AC4)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    setCallGeminiGenerateContent(async () => {
      return {
        text: JSON.stringify({
          expression: {
            op: 'OR',
            children: [{ keyword: 'jazz' }, { keyword: 'blues' }],
          },
          caveats: [],
        })
      };
    });

    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            resolvePromptToEventFilter(prompt: "jazz or blues events") {
              resolvedFilter { keyword }
              expression { op children { field value } }
              caveats
            }
          }
        `
      })
    });
    const result = await res.json();
    assert.ok(!result.errors, JSON.stringify(result.errors));
    assert.deepStrictEqual(result.data.resolvePromptToEventFilter.resolvedFilter, { keyword: null });
    assert.strictEqual(result.data.resolvePromptToEventFilter.expression.op, 'OR');
    assert.strictEqual(result.data.resolvePromptToEventFilter.expression.children.length, 2);
  });

  await t.test('resolvePromptToEventFilter resolves a named @handle to the real profile id, and drops an unknown one with a caveat (IDEA-065)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const stamp = Date.now();
    const [profile] = await db.insert(socialMediaAccountProfiles).values({
      accountId: `ai-handle-${stamp}`,
      platform: 'instagram',
      username: `Jogja_Fest_${stamp}`,
      displayName: 'Jogja Fest',
    } as any).returning();

    const ask = async (accountId: string) => {
      setCallGeminiGenerateContent(async () => ({
        text: JSON.stringify({ expression: { accountId }, caveats: [] }),
      }));
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { resolvePromptToEventFilter(prompt: "events from that account") { resolvedFilter { accountId } caveats } }`,
        }),
      });
      const result = await res.json();
      assert.ok(!result.errors, JSON.stringify(result.errors));
      return result.data.resolvePromptToEventFilter;
    };

    const askOr = async (accountIdA: string, accountIdB: string) => {
      setCallGeminiGenerateContent(async () => ({
        text: JSON.stringify({
          expression: {
            op: 'OR',
            children: [{ accountId: accountIdA }, { accountId: accountIdB }],
          },
          caveats: [],
        }),
      }));
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { resolvePromptToEventFilter(prompt: "events from either account") { resolvedFilter { accountId } expression { op field value } caveats } }`,
        }),
      });
      const result = await res.json();
      assert.ok(!result.errors, JSON.stringify(result.errors));
      return result.data.resolvePromptToEventFilter;
    };

    try {
      const found = await ask(`@jogja_fest_${stamp}`);
      assert.strictEqual(found.resolvedFilter.accountId, profile.id);
      assert.deepStrictEqual(found.caveats, []);

      const missing = await ask('@no_such_account_anywhere');
      assert.strictEqual(missing.resolvedFilter.accountId, null);
      assert.strictEqual(missing.caveats.length, 1);
      assert.match(missing.caveats[0], /no_such_account_anywhere/);

      // AC3: two accountId leaves under an OR -- one resolves, one drops with a caveat, the
      // surviving single leaf collapses the OR (normalize()) so resolvedFilter is still flat.
      const mixed = await askOr(`@jogja_fest_${stamp}`, '@no_such_account_anywhere_either');
      assert.strictEqual(mixed.resolvedFilter.accountId, profile.id);
      assert.strictEqual(mixed.expression.field, 'accountId');
      assert.strictEqual(mixed.caveats.length, 1);
      assert.match(mixed.caveats[0], /no_such_account_anywhere_either/);
    } finally {
      await db.delete(socialMediaAccountProfiles).where(eq(socialMediaAccountProfiles.id, profile.id));
    }
  });

  await t.test('resolvePromptToEventFilter reports temporary key contention as TEMPORARILY_BUSY, not QUOTA_EXHAUSTED (PR #57 review)', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const lockKey = `gemini:key:${testApiKey.id}`;
    await db.delete(vendorCallLocks).where(eq(vendorCallLocks.lockKey, lockKey));
    await db.insert(vendorCallLocks).values({ lockKey, lockedUntil: new Date(Date.now() + 60_000) });

    const originalSleep = sleepSeam;
    setSleepForTest(async () => {});
    let thunkInvoked = false;
    setCallGeminiGenerateContent(async () => {
      thunkInvoked = true;
      return { text: '{}' };
    });

    try {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { resolvePromptToEventFilter(prompt: "jazz in Yogyakarta") { caveats } }`,
        }),
      });
      const result = await res.json();
      assert.ok(result.errors, 'busy keys must surface an error');
      assert.strictEqual(result.errors[0].extensions?.code, 'TEMPORARILY_BUSY');
      assert.notStrictEqual(result.errors[0].extensions?.code, 'QUOTA_EXHAUSTED');
      assert.strictEqual(thunkInvoked, false);
    } finally {
      setSleepForTest(originalSleep);
      await db.delete(vendorCallLocks).where(eq(vendorCallLocks.lockKey, lockKey));
    }
  });

  await t.test('saveAIEventFilter, myAIEventFilters, and deleteAIEventFilter flow', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // 1. Save filter
    const resSave = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            saveAIEventFilter(
              prompt: "jazz events",
              resolvedFilter: { keyword: "live jazz", types: [PERFORMANCE] }
            ) {
              id
              prompt
              resolvedFilter {
                keyword
              }
            }
          }
        `
      })
    });
    const resultSave = await resSave.json();
    assert.ok(!resultSave.errors, 'Save should succeed');
    const filterId = resultSave.data.saveAIEventFilter.id;
    assert.strictEqual(resultSave.data.saveAIEventFilter.prompt, 'jazz events');
    assert.strictEqual(resultSave.data.saveAIEventFilter.resolvedFilter.keyword, 'live jazz');

    // 2. Query saved filters
    const resQuery = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            myAIEventFilters {
              id
              prompt
            }
          }
        `
      })
    });
    const resultQuery = await resQuery.json();
    assert.ok(!resultQuery.errors, 'Query should succeed');
    assert.ok(resultQuery.data.myAIEventFilters.length >= 1);
    assert.strictEqual(resultQuery.data.myAIEventFilters[0].id, filterId);

    // 3. Delete filter
    const resDelete = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteAIEventFilter(id: "${filterId}", action: DELETE) {
              id
              deletedAt
            }
          }
        `
      })
    });
    const resultDelete = await resDelete.json();
    assert.ok(!resultDelete.errors, 'Delete should succeed');
    assert.ok(resultDelete.data.deleteAIEventFilter.deletedAt !== null, 'deletedAt should be set');

    // 4. Double delete should throw INVALID_STATE_TRANSITION
    const resDeleteAgain = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteAIEventFilter(id: "${filterId}", action: DELETE) {
              id
            }
          }
        `
      })
    });
    const resultDeleteAgain = await resDeleteAgain.json();
    assert.ok(resultDeleteAgain.errors, 'Double delete should fail');
    assert.strictEqual(resultDeleteAgain.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');

    // 5. Restore deleted filter
    const resRestore = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteAIEventFilter(id: "${filterId}", action: RESTORE) {
              id
              deletedAt
            }
          }
        `
      })
    });
    const resultRestore = await resRestore.json();
    assert.ok(!resultRestore.errors, 'Restore should succeed');
    assert.strictEqual(resultRestore.data.deleteAIEventFilter.deletedAt, null);

    // 6. Double restore should throw INVALID_STATE_TRANSITION
    const resRestoreAgain = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteAIEventFilter(id: "${filterId}", action: RESTORE) {
              id
            }
          }
        `
      })
    });
    const resultRestoreAgain = await resRestoreAgain.json();
    assert.ok(resultRestoreAgain.errors, 'Double restore should fail');
    assert.strictEqual(resultRestoreAgain.errors[0].extensions?.code, 'INVALID_STATE_TRANSITION');
  });

  await t.test('saveAIEventFilter with expression (Story 9.3 AC1/AC2)', async (t) => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const createdIds: string[] = [];
    t.after(async () => {
      if (createdIds.length > 0) {
        await db.delete(aiEventFilters).where(eq(aiEventFilters.ownerUserId, testUser.id));
      }
    });

    async function save(args: { prompt: string; resolvedFilter?: unknown; expression?: unknown }) {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation Save($prompt: String!, $resolvedFilter: EventFilterInput, $expression: FilterNodeInput) {
              saveAIEventFilter(prompt: $prompt, resolvedFilter: $resolvedFilter, expression: $expression) {
                id
                resolvedFilter { keyword isFree }
                expression { op field value }
              }
            }
          `,
          variables: args,
        }),
      });
      return res.json();
    }

    await t.test('a valid flat-representable expression persists {version:2,expression} and resolves both fields', async () => {
      const result = await save({
        prompt: 'flat expression save',
        expression: { op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] },
      });
      assert.ok(!result.errors, JSON.stringify(result.errors));
      createdIds.push(result.data.saveAIEventFilter.id);
      assert.strictEqual(result.data.saveAIEventFilter.resolvedFilter.keyword, 'jazz');
      assert.ok(result.data.saveAIEventFilter.expression);

      const [row] = await db.select().from(aiEventFilters).where(eq(aiEventFilters.id, result.data.saveAIEventFilter.id));
      assert.deepStrictEqual(row.resolvedFilter, {
        version: 2,
        expression: { op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] },
      });
    });

    await t.test('a non-flat (OR) expression save returns resolvedFilter: null', async () => {
      const result = await save({
        prompt: 'OR expression save',
        expression: {
          op: 'OR',
          children: [{ field: 'keyword', value: 'jazz' }, { field: 'isFree', value: true }],
        },
      });
      assert.ok(!result.errors, JSON.stringify(result.errors));
      createdIds.push(result.data.saveAIEventFilter.id);
      assert.strictEqual(result.data.saveAIEventFilter.resolvedFilter, null);
      assert.ok(result.data.saveAIEventFilter.expression);
    });

    await t.test('an invalid expression returns BAD_USER_INPUT', async () => {
      const result = await save({
        prompt: 'invalid expression save',
        expression: { field: 'notARealField', value: 1 },
      });
      assert.ok(result.errors, 'invalid expression should error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_USER_INPUT');
    });

    await t.test('supplying both resolvedFilter and expression returns BAD_USER_INPUT', async () => {
      const result = await save({
        prompt: 'both supplied',
        resolvedFilter: { keyword: 'jazz' },
        expression: { field: 'keyword', value: 'jazz' },
      });
      assert.ok(result.errors, 'both supplied should error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_USER_INPUT');
    });

    await t.test('supplying neither resolvedFilter nor expression returns BAD_USER_INPUT', async () => {
      const result = await save({ prompt: 'neither supplied' });
      assert.ok(result.errors, 'neither supplied should error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_USER_INPUT');
    });

    await t.test('a pre-existing legacy (no-version) row still resolves the same resolvedFilter plus a populated expression', async () => {
      const result = await save({ prompt: 'legacy flat save', resolvedFilter: { keyword: 'live jazz', types: ['PERFORMANCE'] } });
      assert.ok(!result.errors, JSON.stringify(result.errors));
      createdIds.push(result.data.saveAIEventFilter.id);
      assert.strictEqual(result.data.saveAIEventFilter.resolvedFilter.keyword, 'live jazz');
      assert.ok(result.data.saveAIEventFilter.expression);

      const resQuery = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ myAIEventFilters { id resolvedFilter { keyword types } expression { op field value } } }`,
        }),
      });
      const resultQuery = await resQuery.json();
      assert.ok(!resultQuery.errors, JSON.stringify(resultQuery.errors));
      const row = resultQuery.data.myAIEventFilters.find((r: any) => r.id === result.data.saveAIEventFilter.id);
      assert.ok(row, 'legacy row should still be returned by myAIEventFilters');
      assert.strictEqual(row.resolvedFilter.keyword, 'live jazz');
      assert.deepStrictEqual(row.resolvedFilter.types, ['PERFORMANCE']);
      assert.ok(row.expression);
    });
  });
});
