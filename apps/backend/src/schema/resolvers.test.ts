import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { resolvers } from './resolvers.js';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../db/client.js';
import { users } from '@festgrid/database';
import { eq } from 'drizzle-orm';

// read the generated schema for the yoga server
const typeDefs = fs.readFileSync(path.resolve(process.cwd(), 'src/schema/events.graphql'), 'utf-8');
const authDefs = fs.readFileSync(path.resolve(process.cwd(), 'src/schema/auth.graphql'), 'utf-8');

const schema = createSchema({
  typeDefs: `
    ${typeDefs}
    ${authDefs}
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

test('events resolver integration via Yoga', async (t) => {
  await t.test('events - default sort by soonest upcoming', async () => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            events(limit: 5) {
              items {
                id
                eventName
              }
              totalCount
              hasMore
            }
          }
        `
      })
    });
    
    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.ok(result.data.events.items, 'should return items');
    assert.strictEqual(typeof result.data.events.totalCount, 'number', 'should return total count');
    assert.strictEqual(typeof result.data.events.hasMore, 'boolean', 'should return hasMore');
  });

  await t.test('events - filtering by type', async () => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query {
            events(query: { field: "types", operator: "contains", value: "MUSIC" }, limit: 10) {
              items {
                id
                types
              }
            }
          }
        `
      })
    });
    
    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.ok(Array.isArray(result.data.events.items), 'should return array');
  });

  await t.test('event - fetch single event by ID with schedules', async () => {
    const allReq = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ events(limit: 1) { items { id } } }` })
    });
    const allRes = await allReq.json();

    if (allRes.data.events.items.length === 0) return; // skip if no seed data
    const firstEventId = allRes.data.events.items[0].id;
    
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEvent($id: ID!) {
            event(id: $id) {
              id
              eventName
              schedules {
                id
                eventStartDate
              }
            }
          }
        `,
        variables: { id: firstEventId }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.strictEqual(result.data.event.id, firstEventId);
    assert.ok(result.data.event.eventName);
    assert.ok(Array.isArray(result.data.event.schedules));
  });

  await t.test('eventBySlug - fetch single event by slug with schedules', async () => {
    const allReq = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ events(limit: 1) { items { id slug } } }` })
    });
    const allRes = await allReq.json();

    if (allRes.data.events.items.length === 0) return; // skip if no seed data
    const firstEvent = allRes.data.events.items[0];
    
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEventBySlug($slug: String!) {
            eventBySlug(slug: $slug) {
              id
              eventName
              slug
              imageUrl
              sourcePostUrl
              originalPostUrl
              schedules {
                id
                eventStartDate
              }
            }
          }
        `,
        variables: { slug: firstEvent.slug }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.strictEqual(result.data.eventBySlug.id, firstEvent.id);
    assert.strictEqual(result.data.eventBySlug.slug, firstEvent.slug);
    assert.ok(result.data.eventBySlug.eventName);
    assert.ok(Array.isArray(result.data.eventBySlug.schedules));
    assert.strictEqual(result.data.eventBySlug.originalPostUrl, null);
  });

  await t.test('eventBySlug - return null for non-existent slug', async () => {
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetEventBySlug($slug: String!) {
            eventBySlug(slug: $slug) {
              id
            }
          }
        `,
        variables: { slug: 'non-existent-slug-12345' }
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.strictEqual(result.data.eventBySlug, null);
  });

  await t.test('me - throws UNAUTHENTICATED error when not authenticated', async () => {
    mockUser = null;
    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            me {
              id
              email
              role
            }
          }
        `
      })
    });

    const result = await response.json();
    assert.ok(result.errors, 'should return errors');
    assert.strictEqual(result.errors[0].extensions?.code, 'UNAUTHENTICATED');
  });

  await t.test('me - returns user details when authenticated', async () => {
    // Get an existing seeded user
    const seededUsers = await db.select().from(users).limit(1);
    if (seededUsers.length === 0) return;

    const testUser = seededUsers[0];
    mockUser = { userId: testUser.id, role: testUser.role };

    const response = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            me {
              id
              email
              role
            }
          }
        `
      })
    });

    const result = await response.json();
    assert.ok(!result.errors, 'GraphQL errors returned');
    assert.strictEqual(result.data.me.id, testUser.id);
    assert.strictEqual(result.data.me.email, testUser.email);
    assert.strictEqual(result.data.me.role, testUser.role);
  });
});
