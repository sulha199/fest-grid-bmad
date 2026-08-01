/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert';
import { buildSchema, graphql } from 'graphql';
import { buildOptimizedDrizzleSelect } from './optimized-select.js';
import { pgTable, text, integer } from 'drizzle-orm/pg-core';

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

  type Query {
    user: User
    post: Post
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
});
