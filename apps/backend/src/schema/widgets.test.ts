import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users, widgets, embedDomains } from '@festgrid/database';
import { eq, inArray } from 'drizzle-orm';

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

test('widgets resolvers integration', async (t) => {
  let testUser: any;
  let anotherUser: any;

  await t.test('setup - get test users and clear existing widgets', async () => {
    const seededUsers = await db.select().from(users).limit(2);
    assert.ok(seededUsers.length >= 2, 'Should have at least 2 users');
    testUser = seededUsers[0];
    anotherUser = seededUsers[1];

    const staleWidgets = await db
      .select({ id: widgets.id })
      .from(widgets)
      .where(inArray(widgets.ownerUserId, [testUser.id, anotherUser.id]));
    const staleWidgetIds = staleWidgets.map((w) => w.id);

    if (staleWidgetIds.length > 0) {
      await db.delete(embedDomains).where(inArray(embedDomains.widgetId, staleWidgetIds));
    }

    await db.delete(widgets).where(eq(widgets.ownerUserId, testUser.id));
    await db.delete(widgets).where(eq(widgets.ownerUserId, anotherUser.id));
  });

  await t.test('createWidget, myWidgets, updateWidget, widgetById, and deleteWidget flow', async () => {
    mockUser = { userId: testUser.id, role: testUser.role };

    // 1. Create widget
    const resCreate = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            createWidget(input: {
              filters: { types: [FESTIVAL] },
              displayMode: CARD,
              theme: DARK
            }) {
              id
              ownerUserId
              displayMode
              theme
              filters { types }
            }
          }
        `
      })
    });
    const resultCreate = await resCreate.json();
    assert.ok(!resultCreate.errors, 'create should not fail: ' + JSON.stringify(resultCreate.errors));
    const widget = resultCreate.data.createWidget;
    assert.strictEqual(widget.displayMode, 'CARD');
    assert.strictEqual(widget.theme, 'DARK');

    // 2. Query myWidgets
    const resMy = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ myWidgets { id theme } }`
      })
    });
    const resultMy = await resMy.json();
    assert.strictEqual(resultMy.data.myWidgets.length, 1);
    assert.strictEqual(resultMy.data.myWidgets[0].id, widget.id);

    // 3. Query widgetById (public, unauthenticated)
    mockUser = null;
    const resById = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ widgetById(id: "${widget.id}") { id theme filters { types } } }`
      })
    });
    const resultById = await resById.json();
    assert.ok(resultById.data.widgetById, 'publicById query should succeed');
    assert.strictEqual(resultById.data.widgetById.theme, 'DARK');

    // 4. Update widget
    mockUser = { userId: testUser.id, role: testUser.role };
    const resUpdate = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            updateWidget(id: "${widget.id}", input: { theme: LIGHT }) {
              id
              theme
            }
          }
        `
      })
    });
    const resultUpdate = await resUpdate.json();
    assert.ok(!resultUpdate.errors, 'update should succeed');
    assert.strictEqual(resultUpdate.data.updateWidget.theme, 'LIGHT');

    // 5. Delete widget (soft delete)
    const resDelete = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            deleteWidget(id: "${widget.id}", action: DELETE) {
              id
              deletedAt
            }
          }
        `
      })
    });
    const resultDelete = await resDelete.json();
    assert.ok(!resultDelete.errors, 'delete should succeed');
    assert.ok(resultDelete.data.deleteWidget.deletedAt);

    // 6. Query myWidgets again - should be empty
    const resMyEmpty = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ myWidgets { id } }`
      })
    });
    const resultMyEmpty = await resMyEmpty.json();
    assert.strictEqual(resultMyEmpty.data.myWidgets.length, 0);
  });
});
