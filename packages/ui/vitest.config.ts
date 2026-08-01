import { defineConfig, mergeConfig } from 'vitest/config';
import reactConfig from '@festgrid/testing-config/vitest-react';
import react from '@vitejs/plugin-react';

export default mergeConfig(
  reactConfig,
  defineConfig({
    plugins: [react()],
  })
);
