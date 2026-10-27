import { defineConfig, devices } from '@playwright/test';
import { fakeAuthServerEnv, isFakeAuthEnabled } from './test-support/fake-auth';
import { fakeGeoapifyServerEnv } from './test-support/fake-geoapify/env';

// E2E_FAKE_AUTH=1 points both servers at the local JWKS stub started by global-setup.
const fakeAuthEnv = isFakeAuthEnabled() ? fakeAuthServerEnv() : undefined;
// The same throwaway stack also answers the backend's Geoapify calls locally, so the address flows
// need neither a real API key nor network access.
const fakeBackendEnv = fakeAuthEnv ? { ...fakeAuthEnv, ...fakeGeoapifyServerEnv() } : undefined;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  // CI prints each spec to the job log and keeps the HTML report (uploaded as an artifact) without serving it.
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: process.env.CI ? 'pnpm build && pnpm start' : 'pnpm dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      // In CI this runs `next build` first, which takes far longer than Playwright's 60s default.
      timeout: process.env.CI ? 300_000 : 120_000,
      env: fakeAuthEnv,
    },
    {
      command: 'pnpm --filter backend dev',
      url: 'http://localhost:4001/graphql',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: fakeBackendEnv,
    },
  ],
});
