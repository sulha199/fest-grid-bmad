import { defineConfig, devices } from '@playwright/test';
import { fakeAuthServerEnv, isFakeAuthEnabled } from './test-support/fake-auth';

// E2E_FAKE_AUTH=1 points both servers at the local JWKS stub started by global-setup.
const fakeAuthEnv = isFakeAuthEnabled() ? fakeAuthServerEnv() : undefined;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
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
      env: fakeAuthEnv,
    },
  ],
});
