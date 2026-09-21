/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert';
import { buildSchema, graphql } from 'graphql';
import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { buildOptimizedDrizzleSelect, getRequestedFieldNames } from './optimized-select.js';

const users = pgTable('users', {
  id: integer('id').primaryKey(),
  name: text('name'),
  email: text('email'),
  unrelated: text('unrelated'),
});

const posts = pgTable('posts', {
  id: integer('id').primaryKey(),
  title: text('title'),
  content: text('content'),
  userId: integer('user_id'),
});

// Synthetic tables backing the virtual-fields and multi-level-path tests (Task 1).
const eventItems = pgTable('event_items', {
  id: integer('id').primaryKey(),
  title: text('title'),
  content: text('content'),
});

const eventLocations = pgTable('event_locations', {
  city: text('city'),
  country: text('country'),
});

const schema = buildSchema(`
  type User {
    id: Int
    name: String
    email: String
  }
  
  type Post {
    id: Int
    title: String
    content: String
  }

  type EventLocation {
    city: String
    country: String
  }

  type EventItem {
    id: Int
    title: String
    content: String
    likes: Int
    location: EventLocation
  }

  type EventFeed {
    items: [EventItem!]!
  }

  type Query {
    user: User
    post: Post
    eventFeed: EventFeed
  }
`);

test('buildOptimizedDrizzleSelect', async (t) => {
  await t.test('selects only requested fields for users table', async () => {
    let selectResult: any = null;
    
    const rootValue = {
      user: (_args: any, context: any, info: any) => {
        selectResult = buildOptimizedDrizzleSelect(users, info);
        return { id: 1, name: 'Test' };
      }
    };

    await graphql({
      schema,
      source: '{ user { id name } }',
      rootValue,
    });

    assert.ok(selectResult);
    assert.strictEqual(Object.keys(selectResult).length, 2);
    assert.ok(selectResult.id);
    assert.ok(selectResult.name);
    assert.strictEqual(selectResult.email, undefined);
    assert.strictEqual(selectResult.unrelated, undefined);
  });

  await t.test('selects only requested fields for posts table', async () => {
    let selectResult: any = null;
    
    const rootValue = {
      post: (_args: any, context: any, info: any) => {
        selectResult = buildOptimizedDrizzleSelect(posts, info);
        return { id: 1, title: 'Hello' };
      }
    };

    await graphql({
      schema,
      source: '{ post { id title } }',
      rootValue,
    });

    assert.ok(selectResult);
    assert.strictEqual(Object.keys(selectResult).length, 2);
    assert.ok(selectResult.id);
    assert.ok(selectResult.title);
    assert.strictEqual(selectResult.content, undefined);
    assert.strictEqual(selectResult.userId, undefined);
  });

  await t.test('includes a virtual field when requested, omits when not requested', async () => {
    const likesExpr = sql`(SELECT count(*) FROM favorites)`;
    let selectResult: any = null;

    const rootValue = {
      eventFeed: (_args: any, context: any, info: any) => {
        selectResult = buildOptimizedDrizzleSelect(eventItems, info, {
          path: 'items',
          virtualFields: { likes: likesExpr },
        });
        return { items: [] };
      },
    };

    await graphql({
      schema,
      source: '{ eventFeed { items { id title likes } } }',
      rootValue,
    });

    assert.ok(selectResult, 'virtual-field select result was not captured');
    assert.ok(selectResult.id, 'physical column `id` should be selected');
    assert.ok(selectResult.title, 'physical column `title` should be selected');
    assert.strictEqual(selectResult.content, undefined, 'unrequested physical column should be omitted');
    assert.ok(selectResult.likes, 'requested virtual field `likes` should be included');
  });

  await t.test('omits a virtual field when it is not requested and no physical column matches', async () => {
    const likesExpr = sql`(SELECT count(*) FROM favorites)`;
    let selectResult: any = null;

    const rootValue = {
      eventFeed: (_args: any, context: any, info: any) => {
        selectResult = buildOptimizedDrizzleSelect(eventItems, info, {
          path: 'items',
          virtualFields: { likes: likesExpr },
        });
        return { items: [] };
      },
    };

    await graphql({
      schema,
      source: '{ eventFeed { items { id title } } }',
      rootValue,
    });

    assert.ok(selectResult);
    assert.ok(selectResult.id);
    assert.ok(selectResult.title);
    assert.strictEqual(selectResult.likes, undefined, 'virtual field `likes` should be omitted when not requested');
  });

  await t.test('traverses a nested two-level path array to a child type', async () => {
    let selectResult: any = null;

    const rootValue = {
      eventFeed: (_args: any, context: any, info: any) => {
        selectResult = buildOptimizedDrizzleSelect(eventLocations, info, {
          path: ['items', 'location'],
        });
        return { items: [] };
      },
    };

    await graphql({
      schema,
      source: '{ eventFeed { items { location { city } } } }',
      rootValue,
    });

    assert.ok(selectResult, 'nested two-level traversal should not return an empty select');
    assert.ok(selectResult.city, '`city` column should be selected via the nested path');
    assert.strictEqual(selectResult.country, undefined, 'unrequested nested column should be omitted');
  });

  await t.test('traverses a dot-separated nested path string to a child type (Story 1.i1h Task 1)', async () => {
    let selectResult: any = null;

    const rootValue = {
      eventFeed: (_args: any, context: any, info: any) => {
        selectResult = buildOptimizedDrizzleSelect(eventLocations, info, {
          path: 'items.location',
        });
        return { items: [] };
      },
    };

    await graphql({
      schema,
      source: '{ eventFeed { items { location { city } } } }',
      rootValue,
    });

    assert.ok(selectResult, 'dot-separated path traversal should not return an empty select');
    assert.ok(selectResult.city, '`city` column should be selected via the dot-separated path');
    assert.strictEqual(selectResult.country, undefined, 'unrequested nested column should be omitted');
  });

  await t.test('a dot-separated path behaves identically to the equivalent segment array', async () => {
    const captured: { fromString?: any; fromArray?: any } = {};

    const makeRootValue = (slot: 'fromString' | 'fromArray') => ({
      eventFeed: (_args: any, context: any, info: any) => {
        captured[slot] = buildOptimizedDrizzleSelect(eventLocations, info, {
          path: slot === 'fromString' ? 'items.location' : ['items', 'location'],
        });
        return { items: [] };
      },
    });

    await graphql({
      schema,
      source: '{ eventFeed { items { location { city country } } } }',
      rootValue: makeRootValue('fromString'),
    });
    await graphql({
      schema,
      source: '{ eventFeed { items { location { city country } } } }',
      rootValue: makeRootValue('fromArray'),
    });

    assert.ok(captured.fromString, 'string-form select should be captured');
    assert.ok(captured.fromArray, 'array-form select should be captured');
    assert.deepStrictEqual(
      Object.keys(captured.fromString).sort(),
      Object.keys(captured.fromArray).sort(),
      'both path forms should select the same column set'
    );
  });

  await t.test('a no-dot string path is still a single segment (backward compatible)', async () => {
    let selectResult: any = null;

    const rootValue = {
      eventFeed: (_args: any, context: any, info: any) => {
        selectResult = buildOptimizedDrizzleSelect(eventItems, info, { path: 'items' });
        return { items: [] };
      },
    };

    await graphql({
      schema,
      source: '{ eventFeed { items { id title } } }',
      rootValue,
    });

    assert.ok(selectResult, 'single-segment string path should not return an empty select');
    assert.ok(selectResult.id, '`id` should be selected');
    assert.ok(selectResult.title, '`title` should be selected');
    assert.strictEqual(selectResult.likes, undefined, 'unrequested field should be omitted');
  });

  await t.test('getRequestedFieldNames returns leaf fields for the current type and for a path', async () => {
    const captured: { currentType?: Set<string>; nested?: Set<string> } = {};

    const rootValue = {
      eventFeed: (_args: any, context: any, info: any) => {
        captured.currentType = getRequestedFieldNames(info);
        captured.nested = getRequestedFieldNames(info, 'items');
        return { items: [] };
      },
    };

    await graphql({
      schema,
      source: '{ eventFeed { items { id likes } } }',
      rootValue,
    });

    const currentType = captured.currentType;
    const nested = captured.nested;
    assert.ok(currentType, 'current-type requested fields should be captured');
    assert.ok(nested, 'path-scoped requested fields should be captured');
    if (currentType && nested) {
      assert.ok(currentType.has('items'), '`items` should be in the EventFeed requested fields');
      assert.ok(nested.has('id'), '`id` should be in the Item requested fields');
      assert.ok(nested.has('likes'), '`likes` should be in the Item requested fields');
    }
  });
});
