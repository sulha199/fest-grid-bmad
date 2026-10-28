import test from 'node:test';
import * as assert from 'node:assert';
import { formatReport, formatScanReport, parseArgs, type DrainArgs } from './drain-event-match-backlog.js';
import type { DrainReport } from './lib/events/drain-match-backlog.js';
import type { StubScanEvent, StubScanReport } from './lib/events/scan-stub-repeats.js';

const MOD = '11111111-2222-4333-8444-555555555555';
const SUGGESTION = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

const base: DrainArgs = { moderatorId: MOD, excludeSuggestionIds: [], evaluateOnly: false, apply: false, scanStubs: false };

test('drain-event-match-backlog parseArgs', async (t) => {
  await t.test('defaults to a dry run of the suggestion drain', () => {
    assert.deepStrictEqual(parseArgs(['--moderator-id', MOD]), base);
  });
  await t.test('accepts --apply, --evaluate-only, --scan-stubs and repeated --exclude', () => {
    assert.strictEqual(parseArgs(['--moderator-id', MOD, '--apply']).apply, true);
    assert.strictEqual(parseArgs(['--moderator-id', MOD, '--evaluate-only']).evaluateOnly, true);
    assert.strictEqual(parseArgs(['--moderator-id', MOD, '--scan-stubs']).scanStubs, true);
    assert.deepStrictEqual(parseArgs(['--moderator-id', MOD, '--exclude', SUGGESTION, '--exclude', MOD]).excludeSuggestionIds, [SUGGESTION, MOD]);
  });
  await t.test('rejects bad input', () => {
    assert.throws(() => parseArgs([]), /Usage/);
    assert.throws(() => parseArgs(['--moderator-id', 'nope']), /users.id uuid/);
    assert.throws(() => parseArgs(['--moderator-id', MOD, '--exclude', 'nope']), /must be a uuid/);
    assert.throws(() => parseArgs(['--moderator-id', MOD, '--exclude']), /must be a uuid/);
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
    const dry = formatReport(report, base).join('\n');
    assert.match(dry, /DRY RUN \(rolled back\)/);
    assert.match(dry, /Re-run with --apply/);
    assert.match(dry, /gone/);
    const evalOnly = formatReport(report, { ...base, evaluateOnly: true }).join('\n');
    assert.match(evalOnly, /EVALUATE ONLY/);
  });
  await t.test('lists journal ids after an apply and prints no re-run hint', () => {
    const applied = formatReport({ ...report, merged: 1, mergeIds: ['m1'], stale: [] }, { ...base, apply: true }).join('\n');
    assert.match(applied, /^APPLIED:/);
    assert.match(applied, /m1/);
    assert.doesNotMatch(applied, /Re-run/);
  });
});

test('drain-event-match-backlog formatScanReport', async (t) => {
  const ev = (id: string, createdAt: string): StubScanEvent => ({
    id,
    slug: `slug-${id}`,
    eventName: 'Yonex French Open 2026',
    createdAt: new Date(createdAt),
  });
  const winner = ev('w', '2026-10-23T03:24:45Z');
  const loser = ev('l', '2026-10-23T03:24:51Z');
  const other = ev('o', '2026-10-23T03:30:00Z');
  const report: StubScanReport = {
    candidatePairs: 4,
    clusters: [{ winner, losers: [loser] }],
    nearMisses: [{ a: winner, b: other, reason: 'venue-differs' }],
    excluded: ['x'],
    stale: [{ eventId: 'l2', reason: 'already merged' }],
    merged: 0,
    mergeIds: [],
  };

  await t.test('prints the counts, each cluster with its winner, and the near-miss list with its reason', () => {
    const text = formatScanReport(report, { ...base, scanStubs: true }).join('\n');
    assert.match(text, /DRY RUN \(rolled back\) \(stub-repeat scan\)/);
    assert.match(text, /1 \/ 1 \/ 0/); // clusters / would merge away / merged
    assert.match(text, /WINNER "Yonex French Open 2026" \(slug-w, w,/);
    assert.match(text, /<- "Yonex French Open 2026" \(slug-l, l,/);
    assert.match(text, /Near-misses \(same strict name and start date, NOT merged\)/);
    assert.match(text, /\[venue-differs\]/);
    assert.match(text, /excluded by --exclude: 1/);
    assert.match(text, /l2: already merged/);
    assert.match(text, /Re-run with --apply/);
  });
  await t.test('evaluate-only and apply label themselves; apply lists journal ids and no re-run hint', () => {
    assert.match(formatScanReport(report, { ...base, scanStubs: true, evaluateOnly: true }).join('\n'), /EVALUATE ONLY \(nothing merged\)/);
    const applied = formatScanReport({ ...report, merged: 1, mergeIds: ['m1'], nearMisses: [], stale: [], excluded: [] }, { ...base, scanStubs: true, apply: true }).join('\n');
    assert.match(applied, /^APPLIED \(stub-repeat scan\)/);
    assert.match(applied, /m1/);
    assert.doesNotMatch(applied, /Re-run/);
    assert.doesNotMatch(applied, /Near-misses/);
  });
  await t.test('an empty scan prints counts only', () => {
    const empty = formatScanReport({ candidatePairs: 0, clusters: [], nearMisses: [], excluded: [], stale: [], merged: 0, mergeIds: [] }, { ...base, scanStubs: true, evaluateOnly: true }).join('\n');
    assert.match(empty, /0 \/ 0 \/ 0/);
    assert.doesNotMatch(empty, /Clusters/);
  });
});
