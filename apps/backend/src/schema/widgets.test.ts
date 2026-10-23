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
  let createdWidgetId: string | undefined;

  t.after(async () => {
    if (createdWidgetId) {
      // deleteWidget (action: DELETE) below is a soft delete (sets deletedAt) -- the row
      // itself still counts toward `widgets`'s row count, so hard-delete it here.
      await db.delete(embedDomains).where(eq(embedDomains.widgetId, createdWidgetId));
      await db.delete(widgets).where(eq(widgets.id, createdWidgetId));
    }
  });

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
    createdWidgetId = widget.id;
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

  await t.test('widgets with expression (Story 9.3 AC1/AC2)', async (t) => {
    mockUser = { userId: testUser.id, role: testUser.role };
    const createdIds: string[] = [];
    t.after(async () => {
      if (createdIds.length > 0) {
        await db.delete(embedDomains).where(inArray(embedDomains.widgetId, createdIds));
        await db.delete(widgets).where(inArray(widgets.id, createdIds));
      }
    });

    async function createWithExpression(expression: unknown) {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation Create($expression: FilterNodeInput, $filters: EventFilterInput) {
              createWidget(input: { expression: $expression, filters: $filters }) {
                id
                filters { keyword }
                expression { op field value }
              }
            }
          `,
          variables: { expression },
        }),
      });
      return res.json();
    }

    await t.test('a valid flat-representable expression create resolves filters and expression', async () => {
      const result = await createWithExpression({ op: 'AND', children: [{ field: 'keyword', value: 'jazz' }] });
      assert.ok(!result.errors, JSON.stringify(result.errors));
      createdIds.push(result.data.createWidget.id);
      assert.strictEqual(result.data.createWidget.filters.keyword, 'jazz');
      assert.ok(result.data.createWidget.expression);
    });

    await t.test('a non-flat (OR) expression create resolves filters: null, expression populated', async () => {
      const result = await createWithExpression({
        op: 'OR',
        children: [{ field: 'keyword', value: 'jazz' }, { field: 'isFree', value: true }],
      });
      assert.ok(!result.errors, JSON.stringify(result.errors));
      createdIds.push(result.data.createWidget.id);
      assert.strictEqual(result.data.createWidget.filters, null);
      assert.ok(result.data.createWidget.expression);
    });

    await t.test('an invalid expression create returns BAD_USER_INPUT', async () => {
      const result = await createWithExpression({ field: 'notARealField', value: 1 });
      assert.ok(result.errors, 'invalid expression should error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_USER_INPUT');
    });

    await t.test('both filters and expression supplied on create returns BAD_USER_INPUT', async () => {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation {
              createWidget(input: { filters: { keyword: "jazz" }, expression: { field: "keyword", value: "jazz" } }) {
                id
              }
            }
          `,
        }),
      });
      const resultBoth = await res.json();
      assert.ok(resultBoth.errors, 'both supplied should error');
      assert.strictEqual(resultBoth.errors[0].extensions?.code, 'BAD_USER_INPUT');
    });

    await t.test('neither filters nor expression supplied on create returns BAD_USER_INPUT', async () => {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { createWidget(input: {}) { id } }`,
        }),
      });
      const result = await res.json();
      assert.ok(result.errors, 'neither supplied should error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_USER_INPUT');
    });

    await t.test('updateWidget with only expression (no filters) succeeds', async () => {
      const created = await createWithExpression({ op: 'AND', children: [{ field: 'keyword', value: 'rock' }] });
      assert.ok(!created.errors, JSON.stringify(created.errors));
      const widgetId = created.data.createWidget.id;
      createdIds.push(widgetId);

      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation Update($id: ID!, $expression: FilterNodeInput) {
              updateWidget(id: $id, input: { expression: $expression }) {
                id
                filters { keyword }
                expression { op field value }
              }
            }
          `,
          variables: { id: widgetId, expression: { op: 'AND', children: [{ field: 'keyword', value: 'reggae' }] } },
        }),
      });
      const result = await res.json();
      assert.ok(!result.errors, JSON.stringify(result.errors));
      assert.strictEqual(result.data.updateWidget.filters.keyword, 'reggae');
    });

    await t.test('Epic 9 review P7: a legacy flat filter the validator rejects (radiusMeters 0) is refused on create', async () => {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { createWidget(input: { filters: { location: { coordinates: { lat: -7.7, lng: 110.3 }, radiusMeters: 0 } } }) { id } }`,
        }),
      });
      const result = await res.json();
      assert.ok(result.errors, 'an invalid flat filter should error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_USER_INPUT');
    });

    await t.test('Epic 9 review P17: a date range x weekdays filter that would expand past the cap is refused on create', async () => {
      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation {
            createWidget(input: { filters: {
              dateRange: { anchor: TODAY, offsetAmount: 0, offsetUnit: DAY, spanAmount: 24, spanUnit: MONTH },
              dayOfWeek: [MON, TUE, WED, THU, FRI, SAT, SUN]
            } }) { id }
          }`,
        }),
      });
      const result = await res.json();
      assert.ok(result.errors, 'an oversized weekday window should error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_USER_INPUT');
      assert.match(result.errors[0].message, /limit 150/);
    });

    await t.test('Epic 9 review P23: updateWidget treats an explicit null filters as absent, like createWidget', async () => {
      const created = await createWithExpression({ field: 'keyword', value: 'ska' });
      assert.ok(!created.errors, JSON.stringify(created.errors));
      const widgetId = created.data.createWidget.id;
      createdIds.push(widgetId);

      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation Update($id: ID!) {
              updateWidget(id: $id, input: { filters: null, expression: { field: "keyword", value: "dub" } }) {
                id
                filters { keyword }
              }
            }
          `,
          variables: { id: widgetId },
        }),
      });
      const result = await res.json();
      assert.ok(!result.errors, JSON.stringify(result.errors));
      assert.strictEqual(result.data.updateWidget.filters.keyword, 'dub');
    });

    await t.test('updateWidget with both filters and expression in the same call returns BAD_USER_INPUT', async () => {
      const created = await createWithExpression({ field: 'keyword', value: 'folk' });
      assert.ok(!created.errors, JSON.stringify(created.errors));
      const widgetId = created.data.createWidget.id;
      createdIds.push(widgetId);

      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `
            mutation Update($id: ID!) {
              updateWidget(id: $id, input: { filters: { keyword: "x" }, expression: { field: "keyword", value: "x" } }) {
                id
              }
            }
          `,
          variables: { id: widgetId },
        }),
      });
      const result = await res.json();
      assert.ok(result.errors, 'both supplied on update should error');
      assert.strictEqual(result.errors[0].extensions?.code, 'BAD_USER_INPUT');
    });

    await t.test('a legacy (no-version) widget row resolves both filters and expression correctly', async () => {
      const [legacyWidget] = await db.insert(widgets).values({
        ownerUserId: testUser.id,
        filters: { keyword: 'legacy keyword', types: ['FESTIVAL'] },
        displayMode: 'CARD',
        theme: 'LIGHT',
      }).returning();
      createdIds.push(legacyWidget.id);

      const res = await yoga.fetch('http://yoga/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `{ myWidgets { id filters { keyword types } expression { op field value } } }`,
        }),
      });
      const result = await res.json();
      assert.ok(!result.errors, JSON.stringify(result.errors));
      const row = result.data.myWidgets.find((w: any) => w.id === legacyWidget.id);
      assert.ok(row, 'legacy widget row should be returned by myWidgets');
      assert.strictEqual(row.filters.keyword, 'legacy keyword');
      assert.deepStrictEqual(row.filters.types, ['FESTIVAL']);
      assert.ok(row.expression);
    });
  });
});
