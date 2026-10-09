// Story 0.51 (FIND-064) -- row-count ratchet.
//
// Wraps the real backend test command (unchanged argv/behavior -- `stdio: 'inherit'`) with a
// before/after COUNT(*) snapshot across every table in the schema. If any table's row count is
// higher after the run than before, the run leaked rows -- fail the wrapper non-zero even when
// every individual test passed, since that is precisely the gap that let FIND-064's leaking
// files go unnoticed: each test can pass its own assertions while the suite as a whole still
// accumulates rows run over run.
//
// Deliberately does NOT reseed, truncate, or otherwise touch the database itself (see the story's
// Dev Notes "Why not force a reseed") -- this only ever reads COUNT(*), before and after.
import { spawn } from 'node:child_process';
import { sql } from 'drizzle-orm';
import { getTableConfig } from 'drizzle-orm/pg-core';
import { getTablesInDeleteOrder } from '@festgrid/database';
import { db } from '../src/db/client.js';

async function snapshotCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  for (const table of getTablesInDeleteOrder()) {
    const name = getTableConfig(table).name;
    const [row] = await db.select({ count: sql<number>`count(*)`.mapWith(Number) }).from(table);
    counts.set(name, row?.count ?? 0);
  }
  return counts;
}

function runRealTests(): Promise<number> {
  return new Promise((resolve, reject) => {
    // The exact argv apps/backend's own "test" script ran before this wrapper existed (AC6b) --
    // a single quoted glob argv element, shell left at its Node default (false), so tsx --test's
    // own internal glob resolution behaves identically to today.
    //
    // Pass-through: any argv this wrapper itself receives (e.g. `tsx scripts/run-tests-with-row-count-ratchet.ts
    // src/lib/foo.test.ts`) replaces the default glob below, so a single file (or any other node:test
    // argv) can be ratchet-checked in isolation -- useful for bisecting a leak to one file without
    // running the whole suite.
    const passthroughArgs = process.argv.slice(2);
    const testArgs = passthroughArgs.length > 0 ? passthroughArgs : ['src/**/*.test.ts'];
    const child = spawn('tsx', ['--test', '--test-concurrency=1', ...testArgs], {
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      // code is null when the child was killed by a signal rather than exiting normally --
      // treat that as a failure exit code rather than silently resolving 0.
      resolve(code ?? 1);
    });
  });
}

async function main() {
  const before = await snapshotCounts();
  const testExitCode = await runRealTests();
  const after = await snapshotCounts();

  const leaks: Array<{ table: string; before: number; after: number }> = [];
  for (const [table, beforeCount] of before) {
    const afterCount = after.get(table) ?? beforeCount;
    if (afterCount > beforeCount) {
      leaks.push({ table, before: beforeCount, after: afterCount });
    }
  }

  if (leaks.length > 0) {
    console.error('\nRow-count ratchet FAILED -- this run left extra rows behind:');
    for (const leak of leaks) {
      console.error(`  ${leak.table}: ${leak.before} -> ${leak.after} (+${leak.after - leak.before})`);
    }
    // A real test failure (testExitCode !== 0) is reported via that original exit code rather
    // than being masked as "just" a leak failure; a clean test run (testExitCode === 0) that
    // still leaked rows exits 1 so the leak itself is caught.
    process.exit(testExitCode !== 0 ? testExitCode : 1);
  }

  process.exit(testExitCode);
}

main().catch((err) => {
  console.error('Row-count ratchet wrapper crashed:', err);
  process.exit(1);
});
