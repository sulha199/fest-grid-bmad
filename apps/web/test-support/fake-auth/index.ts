import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_USERS } from '../../../../packages/database/seed';
import { assertLocalDatabase, assertLocalSupabaseEnv, assertLocalUrl } from './local-guard';
import { FAKE_ANON_KEY, FAKE_SUPABASE_PORT, FAKE_SUPABASE_URL, startFakeSupabase, toStorageState, type FakeSupabase, type FakeUser } from './fake-supabase';

export { FAKE_ANON_KEY, FAKE_SUPABASE_PORT };
export { assertLocalDatabase, assertLocalUrl };

export const FAKE_AUTH_FLAG = 'E2E_FAKE_AUTH';

export function isFakeAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[FAKE_AUTH_FLAG] === '1';
}

/** Env the web + backend servers need so they trust the stub instead of a real Supabase project. */
export function fakeAuthServerEnv(): Record<string, string> {
  return { NEXT_PUBLIC_SUPABASE_URL: FAKE_SUPABASE_URL, SUPABASE_URL: FAKE_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: FAKE_ANON_KEY };
}

/**
 * Pure precondition check, run before anything touches the database (including the e2e seed): the
 * database, any configured Supabase URL and the app under test must all be this machine.
 */
export function assertFakeAuthPreconditions(options: { baseUrl: string }, env: NodeJS.ProcessEnv = process.env): URL {
  assertLocalDatabase(env.DATABASE_URL);
  assertLocalSupabaseEnv(env);
  return assertLocalUrl('baseURL', options.baseUrl);
}

/** Seeded fixture users (`packages/database/seed.ts`), so no DB writes are needed to be "logged in". */
function seededUser(role: 'moderator' | 'user'): FakeUser {
  const user = FIXTURE_USERS.find((u) => u.role === role);
  if (!user) throw new Error(`seed.ts has no ${role} fixture user.`);
  return { id: user.id, email: user.email, name: user.name };
}

export interface FakeAuthHandle {
  moderatorStatePath: string;
  userStatePath: string;
  /**
   * Playwright reuses servers that are already running, and those keep the SUPABASE_URL they were
   * started with. Sends a stub-signed token to the backend and throws with a fix if it isn't accepted.
   */
  assertBackendTrustsStub(graphqlUrl: string): Promise<void>;
  stop(): Promise<void>;
}

/**
 * Starts the JWKS stub and writes one Playwright storage state per role into `authDir`.
 * Refuses to run unless the database and every server URL are local; releases the port if setup fails.
 */
export async function startFakeAuth(options: { authDir: string; baseUrl: string }): Promise<FakeAuthHandle> {
  const base = assertFakeAuthPreconditions(options);

  const fake: FakeSupabase = await startFakeSupabase({ keyFile: join(options.authDir, 'fake-supabase-key.json') });
  try {
    mkdirSync(options.authDir, { recursive: true });
    const moderatorSession = fake.issueSession(seededUser('moderator'));
    const write = (name: string, session: ReturnType<FakeSupabase['issueSession']>) => {
      const path = join(options.authDir, name);
      writeFileSync(path, JSON.stringify(toStorageState(session, base.hostname)), { mode: 0o600 });
      return path;
    };
    return {
      moderatorStatePath: write('moderator.json', moderatorSession),
      userStatePath: write('user.json', fake.issueSession(seededUser('user'))),
      assertBackendTrustsStub: async (graphqlUrl) => {
        const response = await fetch(graphqlUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${moderatorSession.accessToken}` },
          body: JSON.stringify({ query: '{ me { role } }' }),
        });
        const body = (await response.json().catch(() => null)) as { data?: { me?: { role?: string } | null } } | null;
        if (body?.data?.me?.role !== 'moderator') {
          throw new Error(
            `The backend at ${graphqlUrl} did not accept the fake-auth token (a reused server keeps the SUPABASE_URL it started with). ` +
              `Stop it, or start it with SUPABASE_URL=${FAKE_SUPABASE_URL}, then re-run.`
          );
        }
      },
      stop: () => fake.close(),
    };
  } catch (error) {
    await fake.close();
    throw error;
  }
}
