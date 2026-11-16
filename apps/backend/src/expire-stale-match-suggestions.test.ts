import test from 'node:test';
import * as assert from 'node:assert';
import { formatReport, parseArgs, type ExpireArgs } from './expire-stale-match-suggestions.js';
import type { ExpireSuggestionsReport } from './lib/events/expire-match-suggestions.js';

const SUGGESTION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const base: ExpireArgs = { evaluateOnly: false, apply: false, today: undefined, list: false };

test('expire-stale-match-suggestions parseArgs', async (t) => {
  await t.test('defaults to a dry run on the current UTC date', () => {
    assert.deepStrictEqual(parseArgs([]), base);
  });
  await t.test('accepts --apply, --evaluate-only, --list and --today', () => {
    assert.strictEqual(parseArgs(['--apply']).apply, true);
    assert.strictEqual(parseArgs(['--evaluate-only']).evaluateOnly, true);
    assert.strictEqual(parseArgs(['--list']).list, true);
    assert.strictEqual(parseArgs(['--today', '2026-10-30']).today, '2026-10-30');
  });
  await t.test('rejects bad input', () => {
    assert.throws(() => parseArgs(['--apply', '--evaluate-only']), /cannot be combined/);
    assert.throws(() => parseArgs(['--today']), /YYYY-MM-DD/);
    assert.throws(() => parseArgs(['--today', '30-10-2026']), /YYYY-MM-DD/);
    assert.throws(() => parseArgs(['--today', '2026-13-45']), /YYYY-MM-DD/);
    assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
  });
});

test('expire-stale-match-suggestions formatReport', async (t) => {
  const report: ExpireSuggestionsReport = {
    pending: 6,
    expired: [
      { suggestionId: SUGGESTION, reason: 'both-over' },
      { suggestionId: 'second', reason: 'event-merged' },
    ],
    byReason: { 'event-deleted': 0, 'event-merged': 1, 'both-over': 1 },
    kept: 4,
    closed: 2,
  };

  await t.test('labels the mode, prints the counts and tells the operator how to proceed', () => {
    const dry = formatReport(report, base, '2026-10-30').join('\n');
    assert.match(dry, /DRY RUN \(rolled back\) \(run date 2026-10-30\)/);
    assert.match(dry, /pending suggestions:\s+6/);
    assert.match(dry, /expired \/ updated:\s+2 \/ 2/);
    assert.match(dry, /both events over:\s+1/);
    assert.match(dry, /kept for a moderator:\s+4/);
    assert.match(dry, /Re-run with --apply/);
    assert.doesNotMatch(dry, new RegExp(SUGGESTION), 'ids are listed only on request');
    const evalOnly = formatReport(report, { ...base, evaluateOnly: true }, '2026-10-30').join('\n');
    assert.match(evalOnly, /EVALUATE ONLY \(nothing updated\)/);
    assert.match(evalOnly, /Re-run without --evaluate-only/);
  });

  await t.test('--list prints every expired suggestion with its reason; nothing when none expired', () => {
    const listed = formatReport(report, { ...base, list: true }, '2026-10-30').join('\n');
    assert.match(listed, new RegExp(`${SUGGESTION} \\[both-over\\]`));
    assert.match(listed, /second \[event-merged\]/);
    const none = formatReport({ ...report, expired: [], closed: 0 }, { ...base, list: true }, '2026-10-30').join('\n');
    assert.doesNotMatch(none, /Expired suggestions:/);
  });

  await t.test('an applied run prints no re-run hint', () => {
    const applied = formatReport(report, { ...base, apply: true }, '2026-10-30').join('\n');
    assert.match(applied, /^APPLIED \(run date 2026-10-30\):/);
    assert.doesNotMatch(applied, /Re-run/);
  });
});
