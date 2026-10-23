import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { FullConfig } from '@playwright/test';
import { isFakeAuthEnabled, startFakeAuth } from '../test-support/fake-auth';

export default async function globalSetup(config: FullConfig): Promise<(() => Promise<void>) | undefined> {
  const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  execFileSync(packageManager, ['--filter', '@festgrid/database', 'seed'], {
    cwd: resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  // Opt-in (E2E_FAKE_AUTH=1): serve a local JWKS and write per-role storage states, so the specs that
  // otherwise skip without E2E_AUTH_STORAGE_STATE can run against a throwaway local stack.
  if (!isFakeAuthEnabled()) return undefined;
  const fakeAuth = await startFakeAuth({
    authDir: resolve(__dirname, '.auth'),
    baseUrl: config.projects[0]?.use?.baseURL ?? 'http://localhost:3000',
  });
  process.env.E2E_AUTH_MODERATOR_STORAGE_STATE = fakeAuth.moderatorStatePath;
  process.env.E2E_AUTH_USER_STORAGE_STATE = fakeAuth.userStatePath;
  process.env.E2E_AUTH_STORAGE_STATE ??= fakeAuth.moderatorStatePath;
  return fakeAuth.stop;
}
