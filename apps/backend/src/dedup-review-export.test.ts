import test from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describeFailure, parseCliArgs } from './dedup-review-export.js';
import { DedupReviewOptionsError } from '@festgrid/domain/events';
import { DedupReviewRoleError } from './lib/events/dedup-review-errors.js';

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

  await t.test('a flag with no value is rejected by name instead of falling back to the default', () => {
    for (const flag of ['--limit', '--skip-ids', '--run-tag']) {
      assert.throws(() => parseCliArgs([flag]), new RegExp(`${flag} needs a value`));
    }
  });

  await t.test('describeFailure prints the typed errors, and for anything else only the class and code, never the message', () => {
    assert.match(describeFailure(new DedupReviewOptionsError('limit must be an integer from 1 to 50')), /^Invalid input: limit must be/);
    assert.match(describeFailure(new DedupReviewRoleError('cannot bypass row level security')), /^Export refused: cannot bypass/);

    const dbError = Object.assign(new Error('password authentication failed for user "secret_role" at db.private-host.example'), { code: '28P01' });
    const text = describeFailure(dbError);
    assert.match(text, /^Export failed: Error \(28P01\)\./);
    assert.match(text, /Likely cause: authentication failed; check the DEDUP_REVIEW_READONLY_DATABASE_URL secret/);
    assert.ok(!text.includes('secret_role') && !text.includes('private-host'), 'the error message is not printed');
    assert.match(describeFailure('a plain string'), /^Export failed: Error\./);
    assert.match(describeFailure(null), /^Export failed: Error\./);
  });

  await t.test('describeFailure gives a fixed hint for the known database codes and none for an unknown one', () => {
    const withCode = (code: string, message: string) => Object.assign(new Error(message), { code, name: 'PostgresError' });
    const missingFunction = describeFailure(withCode('42883', 'function similarity(text, text) does not exist'));
    assert.match(missingFunction, /^Export failed: PostgresError \(42883\)\. Likely cause: a database function was not found.*pg_trgm similarity\(\)/);
    assert.ok(!missingFunction.includes('does not exist'), "the database's own message is not printed");
    for (const code of ['42501', '42P01', '28000', '25006']) {
      assert.match(describeFailure(withCode(code, 'private detail')), new RegExp(`\\(${code}\\)\\. Likely cause: `));
    }
    const unknown = describeFailure(withCode('99999', 'private detail'));
    assert.match(unknown, /^Export failed: PostgresError \(99999\)\. The error's own text/);
    assert.ok(!unknown.includes('Likely cause'));
    assert.match(describeFailure(withCode('constructor', 'x')), /^Export failed: PostgresError \(constructor\)\. The error's own text/, 'an object key such as "constructor" is not mistaken for a code');
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
