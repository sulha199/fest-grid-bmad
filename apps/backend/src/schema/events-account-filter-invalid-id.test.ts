import test from 'node:test';
import * as assert from 'node:assert';
import { createSchema, createYoga } from 'graphql-yoga';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { resolvers } from './resolvers.js';
import { db } from '../db/client.js';
import { users } from '@festgrid/database';

const schemaDir = path.resolve(process.cwd(), 'src/schema');
const typeDefs = fs
  .readdirSync(schemaDir)
  .filter((f) => f.endsWith('.graphql'))
  .map((f) => fs.readFileSync(path.join(schemaDir, f), 'utf8'))
  .join('\n');
const schema = createSchema({ typeDefs: `${typeDefs}\ntype Query { health: Boolean }`, resolvers: resolvers as any });

let mockUser: any = null;
const yoga = createYoga({ schema, context: () => ({ user: mockUser }) as any });

// Regression: the Favorites page ANDs `isFavorited` with the AI filter's `accountId`. A non-UUID
// accountId used to reach `post_account_associations.account_id = $1` (uuid column) and 500 with
// "invalid input syntax for type uuid".
test('events: favorited + non-UUID / UUID social account filter does not error', async (t) => {
  const [user] = await db
    .insert(users)
    .values({ email: `acct-filter-${Date.now()}@test.com`, role: 'user' })
    .returning();
  t.after(async () => {
    await db.delete(users).where(eq(users.id, user.id));
  });
  mockUser = { userId: user.id, role: user.role };

  for (const value of ['not-a-uuid', '@some_handle', '00000000-0000-0000-0000-000000000001']) {
    const res = await yoga.fetch('http://yoga/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($q: EventQueryConditionInput){ events(query:$q){ totalCount items{ id } } }`,
        variables: {
          q: {
            operator: 'and',
            conditions: [
              { field: 'isFavorited', operator: 'eq', value: true },
              { field: 'socialMediaAccountProfileId', operator: 'eq', value },
            ],
          },
        },
      }),
    });
    const body = await res.json();
    assert.equal(body.errors, undefined, `accountId=${value}: ${JSON.stringify(body.errors)}`);
    assert.equal(body.data.events.totalCount, 0);
    assert.deepEqual(body.data.events.items, []);
  }
});
