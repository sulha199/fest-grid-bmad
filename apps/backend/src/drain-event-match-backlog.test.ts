import test from 'node:test';
import * as assert from 'node:assert';
import { formatReport, parseArgs } from './drain-event-match-backlog.js';
import type { DrainReport } from './lib/events/drain-match-backlog.js';

const MOD = '11111111-2222-4333-8444-555555555555';
const SUGGESTION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

test('drain-event-match-backlog parseArgs', async (t) => {
  await t.test('defaults to a dry run', () => {
    assert.deepStrictEqual(parseArgs(['--moderator-id', MOD]), { moderatorId: MOD, excludeSuggestionIds: [], evaluateOnly: false, apply: false });
  });
  await t.test('accepts --apply, --evaluate-only and repeated --exclude', () => {
    assert.strictEqual(parseArgs(['--moderator-id', MOD, '--apply']).apply, true);
    assert.strictEqual(parseArgs(['--moderator-id', MOD, '--evaluate-only']).evaluateOnly, true);
    assert.deepStrictEqual(parseArgs(['--moderator-id', MOD, '--exclude', SUGGESTION, '--exclude', MOD]).excludeSuggestionIds, [SUGGESTION, MOD]);
  });
  await t.test('rejects bad input', () => {
    assert.throws(() => parseArgs([]), /Usage/);
    assert.throws(() => parseArgs(['--moderator-id', 'nope']), /users.id uuid/);
    assert.throws(() => parseArgs(['--moderator-id', MOD, '--exclude', 'nope']), /suggestion uuid/);
    assert.throws(() => parseArgs(['--moderator-id', MOD, '--exclude']), /suggestion uuid/);
    assert.throws(() => parseArgs(['--moderator-id', MOD, '--apply', '--evaluate-only']), /cannot be combined/);
    assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
  });
});

test('drain-event-match-backlog formatReport', async (t) => {
  const report: DrainReport = {
    pending: 3,
    stale: [{ suggestionId: SUGGESTION, reason: 'gone' }],
    excluded: [],
    qualifying: [],
    remaining: 2,
    merged: 0,
    mergeIds: [],
  };
  await t.test('labels the mode and tells the operator how to proceed', () => {
    const dry = formatReport(report, { moderatorId: MOD, excludeSuggestionIds: [], evaluateOnly: false, apply: false }).join('\n');
    assert.match(dry, /DRY RUN \(rolled back\)/);
    assert.match(dry, /Re-run with --apply/);
    assert.match(dry, /gone/);
    const evalOnly = formatReport(report, { moderatorId: MOD, excludeSuggestionIds: [], evaluateOnly: true, apply: false }).join('\n');
    assert.match(evalOnly, /EVALUATE ONLY/);
  });
  await t.test('lists journal ids after an apply and prints no re-run hint', () => {
    const applied = formatReport({ ...report, merged: 1, mergeIds: ['m1'], stale: [] }, { moderatorId: MOD, excludeSuggestionIds: [], evaluateOnly: false, apply: true }).join('\n');
    assert.match(applied, /^APPLIED:/);
    assert.match(applied, /m1/);
    assert.doesNotMatch(applied, /Re-run/);
  });
});
