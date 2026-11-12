import test from 'node:test';
import * as assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DEDUP_REVIEW_APPLY_BEGIN, DEDUP_REVIEW_APPLY_END, DedupReviewApplyInputError } from '@festgrid/domain/events';
import { describeFailure, parseCliArgs } from './dedup-review-apply.js';
import {
  DedupReviewFloorOverrideDisabledError,
  DedupReviewInvokerError,
  DedupReviewRejectsDisabledError,
  DedupReviewReportLostError,
  DedupReviewRoleError,
  FLOOR_OVERRIDE_DISABLED_MESSAGE,
  REJECTS_DISABLED_MESSAGE,
} from './lib/events/dedup-review-errors.js';

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
    assert.deepStrictEqual(parseCliArgs(['--mode', 'validate', '--decisions-file', 'd.json']), { options: { mode: 'validate', live: false, runTag: null, allowRejects: false, allowFloorOverride: false }, decisionsFile: 'd.json' });
    assert.deepStrictEqual(parseCliArgs(['--mode', 'apply', '--live', '--run-tag', 'daily-1', '--decisions-file', 'd.json']), {
      options: { mode: 'apply', live: true, runTag: 'daily-1', allowRejects: false, allowFloorOverride: false },
      decisionsFile: 'd.json',
    });
    assert.strictEqual(parseCliArgs(['--mode', 'validate', '--allow-rejects', '--decisions-file', 'd.json']).options.allowRejects, true, 'rejects are allowed only when the flag is given');
    assert.throws(() => parseCliArgs(['--mode', 'apply', '--allow-rejects', '--allow-rejects', '--decisions-file', 'd.json']), /--allow-rejects was given more than once/);
    assert.strictEqual(parseCliArgs(['--mode', 'validate', '--allow-floor-override', '--decisions-file', 'd.json']).options.allowFloorOverride, true, 'overrides are allowed only when the flag is given');
    assert.strictEqual(parseCliArgs(['--mode', 'validate', '--allow-rejects', '--decisions-file', 'd.json']).options.allowFloorOverride, false, 'the reject flag does not allow overrides');
    assert.throws(() => parseCliArgs(['--mode', 'apply', '--allow-floor-override', '--allow-floor-override', '--decisions-file', 'd.json']), /--allow-floor-override was given more than once/);
    assert.throws(() => parseCliArgs(['--decisions-file', 'd.json']), /mode must be/);
    assert.throws(() => parseCliArgs(['--mode', 'apply']), /--decisions-file is required/);
    assert.throws(() => parseCliArgs(['--mode', 'validate', '--live', '--decisions-file', 'd.json']), /--live is only valid/);
    assert.throws(() => parseCliArgs(['--mode', 'apply', '--run-tag', 'a b', '--decisions-file', 'd.json']), /run_tag must be/);
    assert.throws(() => parseCliArgs(['--invoker-hash', HASH]), /Unknown argument/, 'the hash is never an argument');
    assert.throws(() => parseCliArgs(['--mode', 'validate', '--mode', 'apply', '--decisions-file', 'd.json']), /--mode was given more than once/, 'a repeated flag cannot flip validate to apply');
    assert.throws(() => parseCliArgs(['--mode', 'apply', '--live', '--live', '--decisions-file', 'd.json']), /--live was given more than once/);
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
    assert.match(describeFailure(Object.assign(new Error('x'), { code: '40P01' })), /Likely cause: a deadlock/);
    assert.match(describeFailure(Object.assign(new Error('x'), { code: '55P03' })), /Likely cause: a lock was not available/);
    const lost = describeFailure(new DedupReviewReportLostError(2));
    assert.match(lost, /committed 2 merge\(s\) and 0 reject\(s\), but its report could not be written\. Do not run it again/, 'a lost report after a commit says the merges are in');
    const lostRejects = describeFailure(new DedupReviewReportLostError(0, 3));
    assert.match(lostRejects, /committed 0 merge\(s\) and 3 reject\(s\)/);
    assert.match(lostRejects, /event_match_candidates rows with status = 'rejected' and resolved_via = 'ai_skill'/, 'a run that only rejected points at the suggestion rows, since a reject writes no journal row');
    assert.ok(!/UPDATE /i.test(lostRejects), 'the reopening SQL lives in the runbook, never in a message');
    assert.match(
      describeFailure(new DedupReviewFloorOverrideDisabledError(FLOOR_OVERRIDE_DISABLED_MESSAGE)),
      /^Apply refused: The floor override is switched off\. The owner turns it on with the variable DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED/
    );
    assert.match(describeFailure(new DedupReviewRejectsDisabledError(REJECTS_DISABLED_MESSAGE)), /^Apply refused: Rejects are switched off\. The owner turns them on with the variable DEDUP_REVIEW_REJECT_ENABLED/);
  });

  await t.test('the kill switch exits 0 with a disabled report before it reads arguments, the file or the database', () => {
    // It fails closed: 1 and true, but also any other value (yes, on, a typo).
    for (const on of ['1', 'true', 'TRUE', 'yes', 'on', 'tru']) {
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
      assert.deepStrictEqual(report.counts, { eligible: 0, merged: 0, rejected: 0, skipped: 0 }, 'the disabled report has the new counts shape');
      assert.strictEqual(report.caps.perDayRejects, 10);
    }
  });

  await t.test('unset, empty, 0 and false leave apply enabled, so a bad argument is then refused', () => {
    for (const off of ['0', 'false', 'FALSE', '']) {
      const result = runCli(['--nonsense'], { DEDUP_REVIEW_APPLY_DISABLED: off });
      assert.strictEqual(result.status, 1, off);
      assert.match(result.stderr, /Invalid input: Unknown argument/);
    }
    assert.strictEqual(runCli(['--nonsense']).status, 1, 'unset');
  });

  await t.test('bad input exits 1 with a fixed message before any connection, and never echoes the hash or the file', () => {
    const cases: Array<[string, string[], Record<string, string>, RegExp]> = [
      ['no mode', ['--decisions-file', valid], { DEDUP_REVIEW_INVOKER_HASH: HASH }, /Invalid input: mode must be/],
      ['--live with validate', ['--mode', 'validate', '--live', '--decisions-file', valid], { DEDUP_REVIEW_INVOKER_HASH: HASH }, /Invalid input: --live is only valid/],
      ['a decisions file that is a directory', ['--mode', 'validate', '--decisions-file', dir], { DEDUP_REVIEW_INVOKER_HASH: HASH }, /Invalid input: the decisions file could not be read/],
      ['a decisions file that is far too large', ['--mode', 'validate', '--decisions-file', file('big.json', 'x'.repeat(300_000))], { DEDUP_REVIEW_INVOKER_HASH: HASH }, /Invalid input: the decisions file could not be read/],
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

  await t.test('the cap variables (FIND-126): a bad one exits 1 naming the variable before any connection, in both modes; a good or unset one gets past the check', () => {
    const base = { DEDUP_REVIEW_INVOKER_HASH: HASH };
    const bad: Array<[string, string]> = [
      ['DEDUP_REVIEW_PER_DAY_CAP', '201'],
      ['DEDUP_REVIEW_PER_DAY_CAP', '1e2'],
      ['DEDUP_REVIEW_PER_DAY_CAP', '0'],
      ['DEDUP_REVIEW_PER_RUN_CAP', '101'],
      ['DEDUP_REVIEW_PER_DAY_REJECT_CAP', '101'],
      ['DEDUP_REVIEW_PER_DAY_REJECT_CAP', 'twenty'],
    ];
    for (const mode of ['validate', 'apply']) {
      for (const [name, value] of bad) {
        const result = runCli(['--mode', mode, '--decisions-file', valid], { ...base, [name]: value });
        assert.strictEqual(result.status, 1, `${mode} ${name}=${value}`);
        assert.match(result.stderr, new RegExp(`Invalid input: the variable ${name} must be a whole number`), `${mode} ${name}=${value}`);
        assert.ok(!result.stderr.includes(`=${value}`) && !result.stderr.includes(HASH), 'nothing echoed');
      }
      // Valid values pass the check; the run then stops at the database client (no DATABASE_URL here), which is a different failure.
      for (const env of [{}, { DEDUP_REVIEW_PER_DAY_CAP: '100' }, { DEDUP_REVIEW_PER_RUN_CAP: '100', DEDUP_REVIEW_PER_DAY_CAP: '200', DEDUP_REVIEW_PER_DAY_REJECT_CAP: '100' }, { DEDUP_REVIEW_PER_DAY_CAP: '' }]) {
        const result = runCli(['--mode', mode, '--decisions-file', valid], { ...base, ...env });
        assert.strictEqual(result.status, 1, `${mode} ${JSON.stringify(env)}`);
        assert.ok(!/must be a whole number/.test(result.stderr), `${mode} ${JSON.stringify(env)} passes the cap check: ${result.stderr.slice(0, 200)}`);
      }
    }
  });

  await t.test('a reject needs --allow-rejects, and apply (dry or live) also needs the owner variable: both refuse before any connection', () => {
    const rejects = file('rejects.json', JSON.stringify({ schemaVersion: 1, decisions: [{ suggestionId: ID, evidenceHash: HASH, reasons: [], action: 'reject' }] }));
    const bad = file('bad-action.json', JSON.stringify({ schemaVersion: 1, decisions: [{ suggestionId: ID, evidenceHash: HASH, reasons: [], action: 'Reject' }] }));
    const env = { DEDUP_REVIEW_INVOKER_HASH: HASH };
    const refused = (args: string[], extra: Record<string, string>, expected: RegExp, label: string) => {
      const result = runCli(args, { ...env, ...extra });
      assert.strictEqual(result.status, 1, label);
      assert.match(result.stderr, expected, label);
      assert.ok(!result.stderr.includes(HASH) && !result.stderr.includes(dir), `${label}: nothing echoed`);
    };

    refused(['--mode', 'validate', '--decisions-file', rejects], {}, /Invalid input: a reject decision needs --allow-rejects/, 'validate without the flag');
    refused(['--mode', 'apply', '--decisions-file', rejects], { DEDUP_REVIEW_REJECT_ENABLED: 'true' }, /Invalid input: a reject decision needs --allow-rejects/, 'the variable cannot stand in for the flag');
    refused(['--mode', 'validate', '--allow-rejects', '--decisions-file', bad], {}, /Invalid input: action must be "accept", "reject" or "accept-override"/, 'no case folding');
    for (const off of [undefined, '', '0', 'false', 'yes', 'on', 'tru', 'TRUE', ' true', '1 ']) {
      const extra: Record<string, string> = off === undefined ? {} : { DEDUP_REVIEW_REJECT_ENABLED: off };
      refused(['--mode', 'apply', '--allow-rejects', '--decisions-file', rejects], extra, /Apply refused: Rejects are switched off\./, `apply, variable ${JSON.stringify(off)}`);
      refused(['--mode', 'apply', '--live', '--allow-rejects', '--decisions-file', rejects], extra, /Apply refused: Rejects are switched off\./, `live, variable ${JSON.stringify(off)}`);
      // The run that allows rejects needs the switch whether or not a decision holds one, as the workflow's own step reads it.
      refused(['--mode', 'apply', '--allow-rejects', '--decisions-file', valid], extra, /Apply refused: Rejects are switched off\./, `an accept-only run that allows rejects, variable ${JSON.stringify(off)}`);
    }
  });

  await t.test('an accept-override needs --allow-floor-override, and apply (dry or live) also needs its own owner variable: both refuse before any connection, independent of the reject switch', () => {
    const overrides = file('overrides.json', JSON.stringify({ schemaVersion: 1, decisions: [{ suggestionId: ID, evidenceHash: HASH, reasons: [], action: 'accept-override' }] }));
    const env = { DEDUP_REVIEW_INVOKER_HASH: HASH };
    const refused = (args: string[], extra: Record<string, string>, expected: RegExp, label: string) => {
      const result = runCli(args, { ...env, ...extra });
      assert.strictEqual(result.status, 1, label);
      assert.match(result.stderr, expected, label);
      assert.ok(!result.stderr.includes(HASH) && !result.stderr.includes(dir), `${label}: nothing echoed`);
    };

    refused(['--mode', 'validate', '--decisions-file', overrides], {}, /Invalid input: an accept-override decision needs --allow-floor-override/, 'validate without the flag');
    refused(['--mode', 'apply', '--decisions-file', overrides], { DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED: 'true' }, /Invalid input: an accept-override decision needs --allow-floor-override/, 'the variable cannot stand in for the flag');
    refused(['--mode', 'apply', '--allow-rejects', '--decisions-file', overrides], { DEDUP_REVIEW_REJECT_ENABLED: 'true', DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED: 'true' }, /an accept-override decision needs --allow-floor-override/, 'the reject flag and variable do not allow overrides');
    for (const off of [undefined, '', '0', 'false', 'yes', 'on', 'tru', 'TRUE', ' true', '1 ']) {
      const extra: Record<string, string> = off === undefined ? {} : { DEDUP_REVIEW_FLOOR_OVERRIDE_ENABLED: off };
      refused(['--mode', 'apply', '--allow-floor-override', '--decisions-file', overrides], extra, /Apply refused: The floor override is switched off\./, `apply, variable ${JSON.stringify(off)}`);
      refused(['--mode', 'apply', '--live', '--allow-floor-override', '--decisions-file', overrides], extra, /Apply refused: The floor override is switched off\./, `live, variable ${JSON.stringify(off)}`);
      // A run that allows overrides needs the switch whether or not a decision holds one, as the workflow's own step reads it.
      refused(['--mode', 'apply', '--allow-floor-override', '--decisions-file', valid], extra, /Apply refused: The floor override is switched off\./, `an accept-only run that allows overrides, variable ${JSON.stringify(off)}`);
      // The reject switch does not stand in for it.
      refused(['--mode', 'apply', '--allow-floor-override', '--decisions-file', overrides], { ...extra, DEDUP_REVIEW_REJECT_ENABLED: 'true' }, /Apply refused: The floor override is switched off\./, `the reject variable on, override variable ${JSON.stringify(off)}`);
    }
  });
});
