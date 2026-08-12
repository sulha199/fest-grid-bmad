import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, widgets, embedDomains } from '@festgrid/database';
import { eq, and, inArray, isNull } from 'drizzle-orm';

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

test('embed domains resolvers integration', async (t) => {
  let testUser: any;
  let widget: any;

  await t.test('setup - get test user and create temporary widget', async () => {
    const seededUsers = await db.select().from(users).limit(1);
    assert.ok(seededUsers.length > 0, 'Should have at least 1 user');
    testUser = seededUsers[0];

    // Clear existing embed domains referencing user's widgets first
    const userWidgets = await db.select({ id: widgets.id }).from(widgets).where(eq(widgets.ownerUserId, testUser.id));
    const widgetIds = userWidgets.map(w => w.id);
    if (widgetIds.length > 0) {
      await db.delete(embedDomains).where(inArray(embedDomains.widgetId, widgetIds));
    }

    // Clear existing widgets for user
    await db.delete(widgets).where(eq(widgets.ownerUserId, testUser.id));

    const [inserted] = await db.insert(widgets).values({
      ownerUserId: testUser.id,
      filters: {},
    }).returning();
    widget = inserted;
  });

  await t.test('registerEmbedDomain, embedDomainsForWidget, deregisterEmbedDomain, and isOriginAllowedForWidget flow', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // 1. Register valid exact domain
    const resRegExact = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            registerEmbedDomain(widgetId: "${widget.id}", pattern: "http://localhost:3000/some-path") {
              id
              pattern
            }
          }
        `
      })
    });
    const resultRegExact = await resRegExact.json();
    assert.ok(!resultRegExact.errors, 'register exact should succeed: ' + JSON.stringify(resultRegExact.errors));
    assert.strictEqual(resultRegExact.data.registerEmbedDomain.pattern, 'localhost:3000');

    // 2. Register valid wildcard domain
    const resRegWildcard = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            registerEmbedDomain(widgetId: "${widget.id}", pattern: "*.acmecorp.com") {
              id
              pattern
            }
          }
        `
      })
    });
    const resultRegWildcard = await resRegWildcard.json();
    assert.ok(!resultRegWildcard.errors, 'register wildcard should succeed');
    assert.strictEqual(resultRegWildcard.data.registerEmbedDomain.pattern, '*.acmecorp.com');

    // 3. Register public suffix wildcard - MUST fail (PSL check)
    const resRegInvalid = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            registerEmbedDomain(widgetId: "${widget.id}", pattern: "*.vercel.app") {
              id
            }
          }
        `
      })
    });
    const resultRegInvalid = await resRegInvalid.json();
    assert.ok(resultRegInvalid.errors, 'register public suffix wildcard must fail');
    assert.ok(resultRegInvalid.errors[0].message.includes('public suffix'), 'Should throw public suffix error message');

    // 4. Query isOriginAllowedForWidget (exact match)
    const resAllowedExact = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ isOriginAllowedForWidget(widgetId: "${widget.id}", origin: "http://localhost:3000") }`
      })
    });
    const resultAllowedExact = await resAllowedExact.json();
    assert.strictEqual(resultAllowedExact.data.isOriginAllowedForWidget, true);

    // 5. Query isOriginAllowedForWidget (wildcard match)
    const resAllowedWildcard = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ isOriginAllowedForWidget(widgetId: "${widget.id}", origin: "https://sub.acmecorp.com/path") }`
      })
    });
    const resultAllowedWildcard = await resAllowedWildcard.json();
    assert.strictEqual(resultAllowedWildcard.data.isOriginAllowedForWidget, true);

    // 6. Query isOriginAllowedForWidget (non-matching)
    const resNotAllowed = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ isOriginAllowedForWidget(widgetId: "${widget.id}", origin: "https://evilacmecorp.com") }`
      })
    });
    const resultNotAllowed = await resNotAllowed.json();
    assert.strictEqual(resultNotAllowed.data.isOriginAllowedForWidget, false);

    // 7. Deregister domain (soft delete)
    const activeRows = await db.select().from(embedDomains).where(and(eq(embedDomains.widgetId, widget.id), isNull(embedDomains.deletedAt)));
    const domainToDeregister = activeRows[0];

    const resDereg = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deregisterEmbedDomain(id: "${domainToDeregister.id}", action: DELETE) {
              id
              deletedAt
            }
          }
        `
      })
    });
    const resultDereg = await resDereg.json();
    assert.ok(!resultDereg.errors, 'deregister should succeed');
    assert.ok(resultDereg.data.deregisterEmbedDomain.deletedAt);
  });
});
