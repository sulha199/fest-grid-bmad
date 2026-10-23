import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_USERS } from '../../../../packages/database/seed';
import { assertLocalDatabase, assertLocalUrl } from './local-guard';
import { FAKE_ANON_KEY, FAKE_SUPABASE_PORT, startFakeSupabase, toStorageState, type FakeSupabase, type FakeUser } from './fake-supabase';

export { FAKE_ANON_KEY, FAKE_SUPABASE_PORT };
export { assertLocalDatabase, assertLocalUrl };

export const FAKE_AUTH_FLAG = 'E2E_FAKE_AUTH';

export function isFakeAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[FAKE_AUTH_FLAG] === '1';
}

/** Env the web + backend servers need so they trust the stub instead of a real Supabase project. */
export function fakeAuthServerEnv(): Record<string, string> {
  const url = `http://localhost:${FAKE_SUPABASE_PORT}`;
  return { NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_URL: url, NEXT_PUBLIC_SUPABASE_ANON_KEY: FAKE_ANON_KEY };
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
  stop(): Promise<void>;
}

/**
 * Starts the JWKS stub and writes one Playwright storage state per role into `authDir`.
 * Refuses to run unless the database and every server URL are local.
 */
export async function startFakeAuth(options: { authDir: string; baseUrl: string }): Promise<FakeAuthHandle> {
  assertLocalDatabase(process.env.DATABASE_URL);
  const base = assertLocalUrl('baseURL', options.baseUrl);

  const fake: FakeSupabase = await startFakeSupabase({ keyFile: join(options.authDir, 'fake-supabase-key.json') });
  mkdirSync(options.authDir, { recursive: true });
  const write = (name: string, user: FakeUser) => {
    const path = join(options.authDir, name);
    writeFileSync(path, JSON.stringify(toStorageState(fake.issueSession(user), base.hostname)), { mode: 0o600 });
    return path;
  };
  return {
    moderatorStatePath: write('moderator.json', seededUser('moderator')),
    userStatePath: write('user.json', seededUser('user')),
    stop: () => fake.close(),
  };
}
