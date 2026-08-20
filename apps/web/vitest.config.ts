import { defineConfig, mergeConfig } from 'vitest/config';
import reactConfig from '@festgrid/testing-config/vitest-react';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default mergeConfig(
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
  })
);
