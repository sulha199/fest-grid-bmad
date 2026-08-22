import { defineConfig, mergeConfig } from 'vitest/config';
import reactConfig from '@festgrid/testing-config/vitest-react';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

const merged = mergeConfig(
  reactConfig,
  defineConfig({
    plugins: [react(), tsconfigPaths()],
    resolve: {
      alias: {
        'next/navigation': 'next/navigation.js',
        'next/link': 'next/link.js',
        'next/headers': 'next/headers.js',
      },
    },
    test: {
      // Without this, Vitest externalizes next-intl and imports it via
      // Node's native ESM loader, which bypasses the resolve.alias above
      // (Node ESM has no automatic extension resolution, unlike CJS) and
      // fails to resolve next-intl's bare `next/navigation` import.
      // Inlining forces it through Vite's transform pipeline instead,
      // where the alias applies.
      server: {
        deps: {
          inline: [/next-intl/],
        },
      },
    },
  })
);

// Every apps/web test file sets up its own local MSW server (setupServer per
// file). mergeConfig concatenates array fields, so the shared testing-config
// server would otherwise stay active alongside each file's local one,
// installing a second, competing interceptor whose stricter
// onUnhandledRequest policy shadows per-file handlers. Replace (not merge)
// setupFiles so only one server is ever active.
merged.test.setupFiles = ['./vitest.setup.ts'];

export default merged;
