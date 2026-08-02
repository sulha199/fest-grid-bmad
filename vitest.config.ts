import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/web', 'packages/database', 'packages/analytics', 'packages/ui'],
  },
});
