/* eslint-disable @typescript-eslint/no-explicit-any */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphQLError } from 'graphql';
import { createContext, requireAuth, requireModerator, __deps } from './context.js';

test('Auth Context Layer', async (t) => {
  let verifyMock: any = null;
  let getOrCreateMock: any = null;

  const originalVerify = __deps.verifySupabaseJwt;
  const originalGetOrCreate = __deps.getOrCreateUser;

  __deps.verifySupabaseJwt = async (token: string) => verifyMock ? verifyMock(token) : originalVerify(token);
  __deps.getOrCreateUser = async (payload: any) => getOrCreateMock ? getOrCreateMock(payload) : originalGetOrCreate(payload);

  t.afterEach(() => {
    verifyMock = null;
    getOrCreateMock = null;
  });


  await t.test('createContext', async (t2) => {
    await t2.test('returns user: null if no Authorization header', async () => {
      const req = new Request('http://localhost');
      const ctx = await createContext({ request: req });
      assert.deepEqual(ctx, { user: null });
      // Not calling mock count directly, just relying on return values for now
    });

    await t2.test('returns user: null and skips getOrCreateUser if verification fails', async () => {
      let called = false;
      verifyMock = async () => { called = true; return null; };
      
      const req = new Request('http://localhost', {
        headers: { authorization: 'Bearer bad.token' },
      });
      const ctx = await createContext({ request: req });
      
      assert.deepEqual(ctx, { user: null });
      assert.equal(called, true);
    });

    await t2.test('returns user context for valid token', async () => {
      const payload = { sub: 'test-user', email: 'test@example.com' };
      const dbUser = { id: 'test-user', role: 'user' as const };
      
      let verifyCalled = false;
      let getOrCreateCalledWith: any = null;
      
      verifyMock = async () => { verifyCalled = true; return payload; };
      getOrCreateMock = async (p: any) => { getOrCreateCalledWith = p; return dbUser; };
      
      const req = new Request('http://localhost', {
        headers: { authorization: 'Bearer good.token' },
      });
      const ctx = await createContext({ request: req });
      
      assert.deepEqual(ctx, { user: { userId: 'test-user', role: 'user' } });
      assert.equal(verifyCalled, true);
      assert.deepEqual(getOrCreateCalledWith, payload);
    });
  });

  await t.test('requireAuth', async (t2) => {
    await t2.test('throws UNAUTHENTICATED if user is null', () => {
      assert.throws(
        () => requireAuth({ user: null }),
        (err: any) => err instanceof GraphQLError && err.extensions.code === 'UNAUTHENTICATED'
      );
    });

    await t2.test('returns user if authenticated', () => {
      const user = { userId: '1', role: 'user' as const };
      const result = requireAuth({ user });
      assert.deepEqual(result, user);
    });
  });

  await t.test('requireModerator', async (t2) => {
    await t2.test('throws UNAUTHENTICATED if user is null', () => {
      assert.throws(
        () => requireModerator({ user: null }),
        (err: any) => err instanceof GraphQLError && err.extensions.code === 'UNAUTHENTICATED'
      );
    });

    await t2.test('throws FORBIDDEN if user is not a moderator', () => {
      const user = { userId: '1', role: 'user' as const };
      assert.throws(
        () => requireModerator({ user }),
        (err: any) => err instanceof GraphQLError && err.extensions.code === 'FORBIDDEN'
      );
    });

    await t2.test('returns user if authenticated as moderator', () => {
      const user = { userId: '1', role: 'moderator' as const };
      const result = requireModerator({ user });
      assert.deepEqual(result, user);
    });
  });
});
