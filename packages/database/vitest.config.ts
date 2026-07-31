import { defineConfig, mergeConfig } from 'vitest/config';
import nodeConfig from '@festgrid/testing-config/vitest-node';

export default mergeConfig(
  nodeConfig,
  defineConfig({})
);
