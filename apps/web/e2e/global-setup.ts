import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { FullConfig } from '@playwright/test';

export default function globalSetup(_config: FullConfig): void {
  const packageManager = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  execFileSync(packageManager, ['--filter', '@festgrid/database', 'seed'], {
    cwd: resolve(__dirname, '../..'),
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}
