import test from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEDUP_REVIEW_APPLY_BEGIN, DEDUP_REVIEW_APPLY_END, DedupReviewApplyInputError } from '@festgrid/domain/events';
import { describeFailure, parseCliArgs } from './dedup-review-apply.js';
import { DedupReviewInvokerError, DedupReviewRoleError } from './lib/events/dedup-review-errors.js';

const HASH = 'a'.repeat(64);
const ID = '11111111-1111-4111-8111-111111111111';

// No DATABASE_URL and no BACKEND_PORT: loading the database client would throw a different error,
// so reaching a validation message (or a clean exit) proves the client was never imported.
function runCli(args: string[], env: Record<string, string> = {}) {
  return spawnSync(process.execPath, ['--import', 'tsx', resolve(process.cwd(), 'src/dedup-review-apply.ts'), ...args], {
    env: { PATH: process.env.PATH ?? '', HOME: process.env.HOME ?? '', ...env },
    encoding: 'utf8',
  });
}

test('dedup-review-apply CLI', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ddap-cli-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const file = (name: string, content: string) => {
    const path = join(dir, name);
    writeFileSync(path, content);
    return path;
  };
  const valid = file('valid.json', JSON.stringify({ schemaVersion: 1, decisions: [{ suggestionId: ID, evidenceHash: HASH, reasons: [] }] }));

  await t.test('arguments: mode and decisions file are required, --live needs apply, a value is needed where one is expected', () => {
    assert.deepStrictEqual(parseCliArgs(['--mode', 'validate', '--decisions-file', 'd.json']), { options: { mode: 'validate', live: false, runTag: null }, decisionsFile: 'd.json' });
    assert.deepStrictEqual(parseCliArgs(['--mode', 'apply', '--live', '--run-tag', 'daily-1', '--decisions-file', 'd.json']), {
      options: { mode: 'apply', live: true, runTag: 'daily-1' },
      decisionsFile: 'd.json',
    });
    assert.throws(() => parseCliArgs(['--decisions-file', 'd.json']), /mode must be/);
    assert.throws(() => parseCliArgs(['--mode', 'apply']), /--decisions-file is required/);
    assert.throws(() => parseCliArgs(['--mode', 'validate', '--live', '--decisions-file', 'd.json']), /--live is only valid/);
    assert.throws(() => parseCliArgs(['--mode', 'apply', '--run-tag', 'a b', '--decisions-file', 'd.json']), /run_tag must be/);
    assert.throws(() => parseCliArgs(['--invoker-hash', HASH]), /Unknown argument/, 'the hash is never an argument');
    for (const flag of ['--mode', '--run-tag', '--decisions-file']) {
      assert.throws(() => parseCliArgs([flag]), new RegExp(`${flag} needs a value`));
    }
  });

  await t.test('describeFailure prints the typed errors, and for anything else only the class, the code and a fixed hint', () => {
    assert.match(describeFailure(new DedupReviewApplyInputError('mode must be "validate" or "apply"')), /^Invalid input: mode must be/);
    assert.match(describeFailure(new DedupReviewRoleError('cannot bypass row level security')), /^Apply refused: cannot bypass/);
    assert.match(describeFailure(new DedupReviewInvokerError('No single active moderator matches the invoker.')), /^Apply refused: No single active moderator/);
    const dbError = Object.assign(new Error('permission denied for table users at db.private-host.example'), { code: '42501', name: 'PostgresError' });
    const text = describeFailure(dbError);
    assert.match(text, /^Apply failed: PostgresError \(42501\)\. Likely cause: /);
    assert.ok(!text.includes('private-host') && !text.includes('permission denied'), 'the error message is not printed');
    assert.match(describeFailure(Object.assign(new Error('x'), { code: '40001' })), /Likely cause: a concurrent change/);
  });

  await t.test('the kill switch exits 0 with a disabled report before it reads arguments, the file or the database', () => {
    for (const on of ['1', 'true', 'TRUE']) {
      const result = runCli(['--nonsense'], { DEDUP_REVIEW_APPLY_DISABLED: on });
      assert.strictEqual(result.status, 0, on);
      const lines = result.stdout.trim().split('\n');
      assert.strictEqual(lines[0], DEDUP_REVIEW_APPLY_BEGIN);
      assert.strictEqual(lines[2], DEDUP_REVIEW_APPLY_END);
      const report = JSON.parse(lines[1]);
      assert.strictEqual(report.killSwitch, true);
      assert.strictEqual(report.mode, 'disabled');
      assert.deepStrictEqual(report.results, []);
      assert.strictEqual(report.usedLast24h, null);
    }
  });

  await t.test('0 and false leave the switch off, so a bad argument is then refused', () => {
    for (const off of ['0', 'false', '']) {
      const result = runCli(['--nonsense'], { DEDUP_REVIEW_APPLY_DISABLED: off });
      assert.strictEqual(result.status, 1, off);
      assert.match(result.stderr, /Invalid input: Unknown argument/);
    }
  });

  await t.test('bad input exits 1 with a fixed message before any connection, and never echoes the hash or the file', () => {
    const cases: Array<[string, string[], Record<string, string>, RegExp]> = [
      ['no mode', ['--decisions-file', valid], { DEDUP_REVIEW_INVOKER_HASH: HASH }, /Invalid input: mode must be/],
      ['--live with validate', ['--mode', 'validate', '--live', '--decisions-file', valid], { DEDUP_REVIEW_INVOKER_HASH: HASH }, /Invalid input: --live is only valid/],
      ['an unreadable file', ['--mode', 'validate', '--decisions-file', join(dir, 'missing.json')], { DEDUP_REVIEW_INVOKER_HASH: HASH }, /Invalid input: the decisions file could not be read/],
      ['a malformed file', ['--mode', 'validate', '--decisions-file', file('bad.json', 'SECRET-TEXT {')], { DEDUP_REVIEW_INVOKER_HASH: HASH }, /Invalid input: the decisions file is not valid JSON/],
      ['no invoker hash', ['--mode', 'validate', '--decisions-file', valid], {}, /Invalid input: the invoker hash must be 64 hex characters/],
      ['a short invoker hash', ['--mode', 'validate', '--decisions-file', valid], { DEDUP_REVIEW_INVOKER_HASH: 'abc' }, /Invalid input: the invoker hash must be/],
    ];
    for (const [label, args, env, expected] of cases) {
      const result = runCli(args, env);
      assert.strictEqual(result.status, 1, label);
      assert.match(result.stderr, expected, label);
      assert.ok(!result.stderr.includes('SECRET-TEXT') && !result.stderr.includes(HASH) && !result.stderr.includes(dir), `${label}: nothing echoed`);
    }
  });
});
