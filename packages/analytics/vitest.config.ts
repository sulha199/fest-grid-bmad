import { defineConfig, mergeConfig } from 'vitest/config';
import reactConfig from '@festgrid/testing-config/vitest-react';

export default mergeConfig(
  reactConfig,
  defineConfig({})
);
