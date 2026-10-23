#!/usr/bin/env node
// Builds the shields.io "endpoint" JSON behind the README's domain-coverage badge from the
// coverage summary `pnpm --filter @festgrid/domain test` writes (c8, see packages/domain/.c8rc.json).
//
//   node scripts/coverage-badge.mjs           rewrite docs/badges/domain-coverage.json
//   node scripts/coverage-badge.mjs --check   exit 1 if the committed badge is out of date (CI)
//
// The badge shows the LOWEST of the four metrics (lines/statements/functions/branches), truncated
// rather than rounded, so it can never read higher than the real coverage.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const summaryFile = path.join(root, 'packages/domain/coverage/coverage-summary.json');
const badgeFile = path.join(root, 'docs/badges/domain-coverage.json');

function colorFor(pct) {
  if (pct >= 100) return 'brightgreen';
  if (pct >= 90) return 'green';
  if (pct >= 75) return 'yellow';
  if (pct >= 50) return 'orange';
  return 'red';
}

if (!fs.existsSync(summaryFile)) {
  console.error(`Missing ${path.relative(root, summaryFile)} -- run \`pnpm --filter @festgrid/domain test\` first.`);
  process.exit(2);
}

const { total } = JSON.parse(fs.readFileSync(summaryFile, 'utf8'));
const lowest = Math.min(...['lines', 'statements', 'functions', 'branches'].map((metric) => total[metric].pct));
const truncated = Math.floor(lowest * 10) / 10;

const badge = {
  schemaVersion: 1,
  label: 'domain coverage',
  message: `${truncated}%`,
  color: colorFor(truncated),
};
const rendered = `${JSON.stringify(badge, null, 2)}\n`;

if (process.argv.includes('--check')) {
  const committed = fs.existsSync(badgeFile) ? fs.readFileSync(badgeFile, 'utf8') : '';
  if (committed !== rendered) {
    console.error(
      `${path.relative(root, badgeFile)} is out of date (measured ${badge.message}).\n` +
        'Run `pnpm coverage:badge` after `pnpm --filter @festgrid/domain test` and commit the result.'
    );
    process.exit(1);
  }
  console.log(`Coverage badge is current (${badge.message}).`);
} else {
  fs.mkdirSync(path.dirname(badgeFile), { recursive: true });
  fs.writeFileSync(badgeFile, rendered);
  console.log(`Wrote ${path.relative(root, badgeFile)} (${badge.message}).`);
}
