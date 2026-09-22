import { defineConfig, devices } from '@playwright/test';

/**
 * Config for this package's own integration proof (`pnpm test:manifests`) -- separate from
 * `apps/web`'s `playwright.config.ts` (no live server/DB, per AD-26 Rule 4). Snapshot baselines
 * are committed alongside `manifests-proof.spec.ts` (`manifests-proof.spec.ts-snapshots/`),
 * established via `playwright test --update-snapshots` the same way any Playwright visual-
 * regression baseline is first captured.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: false,
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- CI is a standard, implicitly-set env var (not a repo-declared build input); apps/web's own playwright.config.ts references it the same way, outside next lint's scoped globs.
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
