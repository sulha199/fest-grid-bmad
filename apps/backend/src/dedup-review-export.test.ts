import test from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { parseCliArgs } from './dedup-review-export.js';

test('dedup-review-export CLI arguments', async (t) => {
  await t.test('defaults when no flags are given', () => {
    assert.deepStrictEqual(parseCliArgs([]), { limit: 30, skipIds: [], runTag: null });
  });

  await t.test('reads all three flags', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    assert.deepStrictEqual(parseCliArgs(['--limit', '12', '--skip-ids', id, '--run-tag', 'daily-1']), { limit: 12, skipIds: [id], runTag: 'daily-1' });
  });

  await t.test('rejects an unknown flag, a bad limit, a bad id and a bad run tag', () => {
    assert.throws(() => parseCliArgs(['--apply']), /Unknown argument/);
    assert.throws(() => parseCliArgs(['--limit', '500']), /limit must be/);
    assert.throws(() => parseCliArgs(['--skip-ids', 'nope']), /skip_ids must be/);
    assert.throws(() => parseCliArgs(['--run-tag', 'a b']), /run_tag must be/);
  });

  await t.test('a bad value exits 1 before any database connection is opened', () => {
    // No DATABASE_URL and no BACKEND_PORT: loading the database client would throw a different error,
    // so reaching the validation message proves the client was never imported.
    const result = spawnSync(process.execPath, ['--import', 'tsx', resolve(process.cwd(), 'src/dedup-review-export.ts'), '--limit', '999'], {
      env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '' },
      encoding: 'utf8',
    });

    assert.strictEqual(result.status, 1);
    assert.match(result.stderr, /Invalid input: limit must be an integer from 1 to 50/);
  });
});
