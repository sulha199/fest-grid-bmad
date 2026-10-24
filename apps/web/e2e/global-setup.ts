import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { FullConfig } from '@playwright/test';
import { assertFakeAuthPreconditions, isFakeAuthEnabled, startFakeAuth } from '../test-support/fake-auth';

const BACKEND_GRAPHQL_URL = 'http://localhost:4001/graphql';

export default async function globalSetup(config: FullConfig): Promise<(() => Promise<void>) | undefined> {
  const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const baseUrl = config.projects[0]?.use?.baseURL ?? 'http://localhost:3000';

  // Fake auth mints logins the backend accepts, so refuse before the seed touches any database.
  if (isFakeAuthEnabled()) assertFakeAuthPreconditions({ baseUrl });

  execFileSync(packageManager, ['--filter', '@festgrid/database', 'seed'], {
    cwd: resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  // Opt-in (E2E_FAKE_AUTH=1): serve a local JWKS and write per-role storage states, so the specs that
  // otherwise skip without E2E_AUTH_STORAGE_STATE can run against a throwaway local stack.
  if (!isFakeAuthEnabled()) return undefined;
  const fakeAuth = await startFakeAuth({ authDir: resolve(__dirname, '.auth'), baseUrl });
  try {
    await fakeAuth.assertBackendTrustsStub(BACKEND_GRAPHQL_URL);
  } catch (error) {
    await fakeAuth.stop();
    throw error;
  }
  process.env.E2E_AUTH_MODERATOR_STORAGE_STATE = fakeAuth.moderatorStatePath;
  process.env.E2E_AUTH_USER_STORAGE_STATE = fakeAuth.userStatePath;
  // Existing specs that read the generic variable run as the moderator (they are the moderator flows).
  process.env.E2E_AUTH_STORAGE_STATE ??= fakeAuth.moderatorStatePath;
  return fakeAuth.stop;
}
