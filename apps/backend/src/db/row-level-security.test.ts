import test from 'node:test';
import assert from 'node:assert';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db } from './client.js';

// Row level security (RLS), migration 0084. These tests run against the real test database and
// every behavioural case runs inside a transaction that is always rolled back, so nothing leaks
// into the suite's row-count ratchet.
//
// Roles. Supabase provides the `anon` and `authenticated` roles and `auth.uid()`; migration 0084
// creates stand-ins on a plain Postgres. The test connection is the table owner (a superuser in
// CI), which is exactly the backend's position and bypasses RLS, so the cases below
// `SET LOCAL ROLE` to the API roles to see what the REST API would see. Supabase grants those
// roles table privileges by default; a plain Postgres does not, so the helper grants them inside
// the rolled-back transaction. That keeps the test about RLS (row filtering), not about GRANTs.

class Rollback extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function inRolledBackTransaction(work: (tx: Tx) => Promise<void>): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await work(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) {
      throw error;
    }
  }
}

async function seedTwoUsersWithFavorites(tx: Tx) {
  const userA = randomUUID();
  const userB = randomUUID();
  await tx.execute(sql`insert into users (id, email) values (${userA}, ${`rls-a-${userA}@example.test`}), (${userB}, ${`rls-b-${userB}@example.test`})`);

  const events = await tx.execute(sql`select id from events limit 2`);
  assert.ok(events.length >= 2, 'the seeded test database must contain at least two events');
  const [eventOne, eventTwo] = events as unknown as { id: string }[];

  await tx.execute(sql`insert into favorites (user_id, event_id) values (${userA}, ${eventOne.id}), (${userB}, ${eventTwo.id})`);
  await tx.execute(sql`insert into api_keys (user_id, key_encrypted, key_last4, provider) values (${userA}, 'ciphertext', '1234', 'gemini')`);
  await tx.execute(sql`grant select, insert, update, delete on all tables in schema public to anon, authenticated`);
  return { userA, userB, eventOne: eventOne.id, eventTwo: eventTwo.id };
}

async function actAs(tx: Tx, role: 'anon' | 'authenticated', userId?: string) {
  await tx.execute(sql`select set_config('request.jwt.claims', ${JSON.stringify(userId ? { sub: userId, role } : { role })}, true)`);
  await tx.execute(sql.raw(`set local role ${role}`));
}

async function resetRole(tx: Tx) {
  await tx.execute(sql`reset role`);
}

async function count(tx: Tx, table: string): Promise<number> {
  const rows = await tx.execute(sql.raw(`select count(*)::int as n from public.${table}`));
  return (rows as unknown as { n: number }[])[0].n;
}

test('every table in the public schema has row level security enabled', async () => {
  const rows = await db.execute(sql`
    select c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
    order by c.relname
  `);
  const withoutRls = (rows as unknown as { name: string }[]).map((row) => row.name);
  assert.deepStrictEqual(
    withoutRls,
    [],
    `These tables have RLS disabled: ${withoutRls.join(', ')}. Add "ALTER TABLE ... ENABLE ROW LEVEL SECURITY" to the migration that creates them (see migration 0084 and docs/infrastructure/supabase-rls-and-kms-rollout.md).`,
  );
});

test('the owner connection the backend uses is not filtered by RLS', async () => {
  await inRolledBackTransaction(async (tx) => {
    await seedTwoUsersWithFavorites(tx);
    assert.ok((await count(tx, 'favorites')) >= 2);
    assert.ok((await count(tx, 'api_keys')) >= 1);
  });
});

test('the anon role sees no rows in any table, even tables that hold rows', async () => {
  await inRolledBackTransaction(async (tx) => {
    await seedTwoUsersWithFavorites(tx);
    const populated = ['users', 'favorites', 'events', 'api_keys'];
    for (const table of populated) {
      assert.ok((await count(tx, table)) > 0, `control: ${table} should hold rows for the owner`);
    }
    await actAs(tx, 'anon');
    for (const table of populated) {
      assert.strictEqual(await count(tx, table), 0, `anon must see no rows in ${table}`);
    }
    await resetRole(tx);
  });
});

test('an authenticated user sees only their own user row and favorites', async () => {
  await inRolledBackTransaction(async (tx) => {
    const { userA, userB, eventOne } = await seedTwoUsersWithFavorites(tx);

    await actAs(tx, 'authenticated', userA);
    const users = (await tx.execute(sql`select id from users`)) as unknown as { id: string }[];
    assert.deepStrictEqual(users.map((row) => row.id), [userA]);
    const favorites = (await tx.execute(sql`select user_id, event_id from favorites`)) as unknown as { user_id: string; event_id: string }[];
    // postgres.js returns an Array subclass, so compare plain mapped values.
    assert.deepStrictEqual(favorites.map((row) => ({ user_id: row.user_id, event_id: row.event_id })), [{ user_id: userA, event_id: eventOne }]);
    await resetRole(tx);

    await actAs(tx, 'authenticated', userB);
    const favoritesOfB = (await tx.execute(sql`select user_id from favorites`)) as unknown as { user_id: string }[];
    assert.deepStrictEqual(favoritesOfB.map((row) => row.user_id), [userB]);
    await resetRole(tx);
  });
});

test('an authenticated user with no matching sub claim sees nothing', async () => {
  await inRolledBackTransaction(async (tx) => {
    await seedTwoUsersWithFavorites(tx);
    await actAs(tx, 'authenticated', randomUUID());
    assert.strictEqual(await count(tx, 'favorites'), 0);
    assert.strictEqual(await count(tx, 'users'), 0);
    await resetRole(tx);
  });
});

test('WITH CHECK: an authenticated user cannot insert a favorite on behalf of another user', async () => {
  await inRolledBackTransaction(async (tx) => {
    const { userA, userB, eventOne } = await seedTwoUsersWithFavorites(tx);
    await actAs(tx, 'authenticated', userA);

    // A savepoint lets the test observe the failure without aborting the whole transaction.
    await assert.rejects(
      tx.transaction(async (inner) => {
        await inner.execute(sql`insert into favorites (user_id, event_id) values (${userB}, ${eventOne})`);
      }),
      (error: unknown) => {
        const message = String((error as { cause?: { message?: string }; message?: string }).cause?.message ?? (error as Error).message);
        assert.match(message, /row-level security|row level security/i);
        return true;
      },
    );
    await resetRole(tx);
  });
});

test('USING: an authenticated user can manage their own favorites but cannot touch another user\'s', async () => {
  await inRolledBackTransaction(async (tx) => {
    const { userA, userB, eventOne, eventTwo } = await seedTwoUsersWithFavorites(tx);
    await actAs(tx, 'authenticated', userA);

    await tx.execute(sql`insert into favorites (user_id, event_id) values (${userA}, ${eventTwo})`);
    assert.strictEqual(await count(tx, 'favorites'), 2);

    // B's row is invisible to A, so an UPDATE or DELETE aimed at it matches zero rows.
    await tx.execute(sql`delete from favorites where user_id = ${userB}`);
    await resetRole(tx);
    const stillThere = (await tx.execute(sql`select count(*)::int as n from favorites where user_id = ${userB}`)) as unknown as { n: number }[];
    assert.strictEqual(stillThere[0].n, 1, "A's DELETE must not remove B's favorite");

    await actAs(tx, 'authenticated', userA);
    await tx.execute(sql`delete from favorites where user_id = ${userA} and event_id = ${eventOne}`);
    assert.strictEqual(await count(tx, 'favorites'), 1);
    await resetRole(tx);
  });
});

test('server-only tables stay closed to authenticated users, even for their own rows', async () => {
  await inRolledBackTransaction(async (tx) => {
    const { userA } = await seedTwoUsersWithFavorites(tx);
    await actAs(tx, 'authenticated', userA);
    assert.strictEqual(await count(tx, 'api_keys'), 0, 'api_keys has no policy, so even the owner of a key cannot read it through the API');
    assert.strictEqual(await count(tx, 'events'), 0, 'catalog tables have no client policy yet');
    await resetRole(tx);
  });
});
