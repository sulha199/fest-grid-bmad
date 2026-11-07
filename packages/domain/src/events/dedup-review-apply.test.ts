import { test } from 'node:test';
import assert from 'node:assert';
import {
  DEDUP_REVIEW_APPLY_BEGIN,
  DEDUP_REVIEW_APPLY_END,
  DEDUP_REVIEW_MAX_DECISIONS,
  DEDUP_REVIEW_MAX_DECISIONS_BYTES,
  DEDUP_REVIEW_PER_DAY_CAP,
  DEDUP_REVIEW_PER_DAY_REJECT_CAP,
  DEDUP_REVIEW_PER_RUN_CAP,
  DedupReviewApplyInputError,
  assertDedupReviewFloorOverrideAllowed,
  assertDedupReviewRejectsAllowed,
  checkDedupReviewFloor,
  countDedupReviewResults,
  formatDedupReviewApplyReport,
  isDedupReviewApplyDisabled,
  isDedupReviewFloorOverrideEnabled,
  isDedupReviewRejectEnabled,
  judgeDedupReviewDecision,
  parseDedupReviewApplyOptions,
  parseDedupReviewDecisions,
  parseDedupReviewInvokerHash,
  type DedupReviewApplyReport,
  type DedupReviewDecision,
  type DedupReviewFreshLookup,
  type DedupReviewFreshPair,
  type DedupReviewRunState,
} from './dedup-review-apply.js';
import type { DedupReviewEventEvidence, DedupReviewExportPair } from './dedup-review-evidence.js';

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';
const ID_C = '33333333-3333-4333-8333-333333333333';
const EVENT_X = '33333333-3333-4333-8333-333333333333';
const EVENT_Y = '44444444-4444-4444-8444-444444444444';
const EVENT_Z = '55555555-5555-4555-8555-555555555555';
const HASH = 'a'.repeat(64);

function eventEvidence(overrides: Partial<DedupReviewEventEvidence> = {}): DedupReviewEventEvidence {
  return {
    name: 'GembiRun Loka 2026',
    slug: 'ig_p_abc',
    location: 'Gelora Bung Karno',
    links: [],
    detailLevel: 'full',
    categories: [],
    types: [],
    schedules: [{ isMain: true, startDate: '2026-11-08', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null }],
    sourcePosts: [],
    ...overrides,
  };
}

function pair(overrides: Partial<DedupReviewExportPair> = {}, signals: Partial<DedupReviewExportPair['signals']> = {}): DedupReviewExportPair {
  return {
    suggestionId: ID_A,
    status: 'pending',
    storedScore: 0.6,
    signals: {
      tier: 'mid',
      scoredTier: 'mid',
      score: 0.6,
      promotedByRule: false,
      promotionRule: null,
      stubRepeat: false,
      venueMatch: false,
      nameSimilarity: 0.8,
      minDayDiff: 0,
      organizerMatch: true,
      sharedLink: false,
      ...signals,
    },
    sameAccount: true,
    undoneMergeCount: 0,
    candidate: eventEvidence(),
    newEvent: eventEvidence({ slug: 'ig_p_def' }),
    evidenceHash: HASH,
    ...overrides,
  };
}

function fresh(overrides: Partial<DedupReviewFreshPair> = {}): DedupReviewFreshPair {
  return { pair: pair(), candidateEventId: EVENT_X, newEventId: EVENT_Y, venueConflict: false, ...overrides };
}

const EMPTY_STATE: DedupReviewRunState = { claimedEventIds: new Set(), eligibleInRun: 0, rejectsInRun: 0, usedLast24h: 0, usedRejectsLast24h: 0 };
const CAPS = { perRun: DEDUP_REVIEW_PER_RUN_CAP, perDay: DEDUP_REVIEW_PER_DAY_CAP, perDayRejects: DEDUP_REVIEW_PER_DAY_REJECT_CAP };

function decisionsJson(entries: unknown[], extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ schemaVersion: 1, decisions: entries, ...extra });
}
function entry(overrides: Record<string, unknown> = {}) {
  return { suggestionId: ID_A, evidenceHash: HASH, reasons: ['same festival, bilingual name'], ...overrides };
}

test('parseDedupReviewDecisions - a valid file keeps only the id and the hash, lower-cased, and drops reasons', () => {
  const parsed = parseDedupReviewDecisions(decisionsJson([entry({ suggestionId: ID_A.toUpperCase(), evidenceHash: HASH.toUpperCase() }), entry({ suggestionId: ID_B, reasons: [] })]));
  assert.deepStrictEqual(parsed, [
    { suggestionId: ID_A, evidenceHash: HASH, action: 'accept' },
    { suggestionId: ID_B, evidenceHash: HASH, action: 'accept' },
  ]);
  assert.deepStrictEqual(parseDedupReviewDecisions(decisionsJson([])), [], 'an empty list is a no-op, not an error');
  assert.deepStrictEqual(parseDedupReviewDecisions('\uFEFF' + decisionsJson([entry()])), [{ suggestionId: ID_A, evidenceHash: HASH, action: 'accept' }], 'a leading byte order mark is ignored');
});

test('parseDedupReviewDecisions - every malformed file is refused with a message that never echoes the input', () => {
  const secret = 'SECRET-REASON-TEXT';
  const bad: Array<[string, string]> = [
    ['not json', `{ this is not json ${secret}`],
    ['an array', JSON.stringify([entry()])],
    ['null', 'null'],
    ['a missing key', JSON.stringify({ schemaVersion: 1 })],
    ['an extra top-level key', decisionsJson([entry()], { extra: secret })],
    ['a wrong schema version', JSON.stringify({ schemaVersion: 2, decisions: [] })],
    ['decisions that is not an array', JSON.stringify({ schemaVersion: 1, decisions: 'x' })],
    ['too many decisions', decisionsJson(Array.from({ length: DEDUP_REVIEW_MAX_DECISIONS + 1 }, (_, i) => entry({ suggestionId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` })))],
    ['an entry that is not an object', decisionsJson(['x'])],
    ['an entry with an extra key', decisionsJson([entry({ extra: secret })])],
    ['an action that is neither accept nor reject', decisionsJson([entry({ action: secret })])],
    ['an entry with a missing key', decisionsJson([{ suggestionId: ID_A, evidenceHash: HASH }])],
    ['a suggestion id that is not a string', decisionsJson([entry({ suggestionId: 5 })])],
    ['a suggestion id that is not a uuid', decisionsJson([entry({ suggestionId: secret })])],
    ['a duplicate suggestion (case ignored)', decisionsJson([entry(), entry({ suggestionId: ID_A.toUpperCase() })])],
    ['a hash that is not a string', decisionsJson([entry({ evidenceHash: 5 })])],
    ['a short hash', decisionsJson([entry({ evidenceHash: 'abc' })])],
    ['reasons that is not an array', decisionsJson([entry({ reasons: secret })])],
    ['too many reasons', decisionsJson([entry({ reasons: ['a', 'b', 'c', 'd', 'e', 'f'] })])],
    ['a reason that is not a string', decisionsJson([entry({ reasons: [5] })])],
    ['a reason that is too long', decisionsJson([entry({ reasons: ['x'.repeat(201)] })])],
    ['a file over the byte cap', 'x'.repeat(DEDUP_REVIEW_MAX_DECISIONS_BYTES + 1)],
  ];
  for (const [label, raw] of bad) {
    assert.throws(
      () => parseDedupReviewDecisions(raw),
      (err: unknown) => {
        assert.ok(err instanceof DedupReviewApplyInputError, label);
        assert.ok(!(err as Error).message.includes(secret), `${label}: the message must not echo the input`);
        return true;
      },
      label
    );
  }
});

test('parseDedupReviewDecisions - action is exactly accept, reject or accept-override, accept when absent, and nothing else is tolerated', () => {
  const ID_D = '44444444-4444-4444-8444-444444444445';
  const parsed = parseDedupReviewDecisions(
    decisionsJson([entry({ action: 'reject' }), entry({ suggestionId: ID_B, action: 'accept' }), entry({ suggestionId: ID_C }), entry({ suggestionId: ID_D, action: 'accept-override' })])
  );
  assert.deepStrictEqual(
    parsed.map((decision) => [decision.suggestionId, decision.action]),
    [
      [ID_A, 'reject'],
      [ID_B, 'accept'],
      [ID_C, 'accept'],
      [ID_D, 'accept-override'],
    ]
  );
  const secret = 'SECRET-ACTION-TEXT';
  for (const bad of ['delete', '', 'Reject', 'REJECT', 'reject ', ' accept', 5, null, true, ['reject'], {}, secret, 'Accept-Override', 'override', 'accept-override ', 'accept_override', 'ACCEPT-OVERRIDE']) {
    assert.throws(
      () => parseDedupReviewDecisions(decisionsJson([entry({ action: bad })])),
      (err: unknown) => err instanceof DedupReviewApplyInputError && /action must be/.test(err.message) && !err.message.includes(secret),
      JSON.stringify(bad)
    );
  }
  assert.throws(() => parseDedupReviewDecisions(decisionsJson([entry({ action: 'reject' }), entry({ action: 'accept' })])), /only once/, 'one suggestion cannot be both');
});

test('assertDedupReviewRejectsAllowed - a reject needs the flag, an accept never does', () => {
  const accept: DedupReviewDecision = { suggestionId: ID_A, evidenceHash: HASH, action: 'accept' };
  const reject: DedupReviewDecision = { suggestionId: ID_B, evidenceHash: HASH, action: 'reject' };
  assert.doesNotThrow(() => assertDedupReviewRejectsAllowed([accept], false));
  assert.doesNotThrow(() => assertDedupReviewRejectsAllowed([], false));
  assert.doesNotThrow(() => assertDedupReviewRejectsAllowed([accept, reject], true));
  assert.throws(() => assertDedupReviewRejectsAllowed([accept, reject], false), (err: unknown) => err instanceof DedupReviewApplyInputError && /--allow-rejects/.test(err.message));
});

test('assertDedupReviewFloorOverrideAllowed - an accept-override needs the flag, an accept or a reject never does', () => {
  const accept: DedupReviewDecision = { suggestionId: ID_A, evidenceHash: HASH, action: 'accept' };
  const reject: DedupReviewDecision = { suggestionId: ID_C, evidenceHash: HASH, action: 'reject' };
  const override: DedupReviewDecision = { suggestionId: ID_B, evidenceHash: HASH, action: 'accept-override' };
  assert.doesNotThrow(() => assertDedupReviewFloorOverrideAllowed([accept, reject], false));
  assert.doesNotThrow(() => assertDedupReviewFloorOverrideAllowed([], false));
  assert.doesNotThrow(() => assertDedupReviewFloorOverrideAllowed([accept, override], true));
  assert.throws(
    () => assertDedupReviewFloorOverrideAllowed([accept, override], false),
    (err: unknown) => err instanceof DedupReviewApplyInputError && /--allow-floor-override/.test(err.message)
  );
});

test('isDedupReviewFloorOverrideEnabled - the same fail-closed rule as the reject switch, in its own function: only exactly true and 1', () => {
  for (const input of [undefined, '', '0', 'false', 'TRUE', ' true', 'yes', '1 ', 'true1']) {
    assert.strictEqual(isDedupReviewFloorOverrideEnabled(input), isDedupReviewRejectEnabled(input), `the two switches agree on ${JSON.stringify(input)}`);
  }
  for (const on of ['true', '1']) assert.strictEqual(isDedupReviewFloorOverrideEnabled(on), true, on);
  for (const off of [undefined, '', '0', 'false', 'TRUE', ' true', 'yes']) assert.strictEqual(isDedupReviewFloorOverrideEnabled(off), false, JSON.stringify(off));
});

test('isDedupReviewRejectEnabled - the switch fails closed: only exactly true and 1 turn rejects on, as the workflow reads it', () => {
  for (const on of ['true', '1']) assert.strictEqual(isDedupReviewRejectEnabled(on), true, on);
  for (const off of [undefined, '', '  ', '0', 'false', 'yes', 'on', 'enabled', 'tru', 'true1', '11', 'TRUE', 'True', ' true', 'true ', ' 1\n', '1 ']) assert.strictEqual(isDedupReviewRejectEnabled(off), false, JSON.stringify(off));
});

test('parseDedupReviewInvokerHash - 64 hex characters, trimmed and lower-cased, nothing else', () => {
  assert.strictEqual(parseDedupReviewInvokerHash(`  ${HASH.toUpperCase()}\n`), HASH);
  for (const bad of [undefined, '', 'abc', 'z'.repeat(64), HASH + 'a']) {
    assert.throws(() => parseDedupReviewInvokerHash(bad), DedupReviewApplyInputError);
  }
});

test('parseDedupReviewApplyOptions - mode is required, --live needs apply, the run tag is checked', () => {
  assert.deepStrictEqual(parseDedupReviewApplyOptions({ mode: 'validate' }), { mode: 'validate', live: false, runTag: null, allowRejects: false, allowFloorOverride: false });
  assert.deepStrictEqual(parseDedupReviewApplyOptions({ mode: 'apply', live: true, runTag: ' run-1 ' }), { mode: 'apply', live: true, runTag: 'run-1', allowRejects: false, allowFloorOverride: false });
  assert.deepStrictEqual(parseDedupReviewApplyOptions({ mode: 'apply', live: false, runTag: '' }), { mode: 'apply', live: false, runTag: null, allowRejects: false, allowFloorOverride: false });
  assert.strictEqual(parseDedupReviewApplyOptions({ mode: 'apply', allowFloorOverride: true }).allowFloorOverride, true, 'the override is allowed only when asked for');
  assert.strictEqual(parseDedupReviewApplyOptions({ mode: 'apply', allowFloorOverride: false }).allowFloorOverride, false);
  assert.strictEqual(parseDedupReviewApplyOptions({ mode: 'apply', allowRejects: true }).allowRejects, true, 'rejects are allowed only when asked for');
  assert.strictEqual(parseDedupReviewApplyOptions({ mode: 'apply', allowRejects: false }).allowRejects, false);
  for (const mode of [undefined, null, '', 'live']) {
    assert.throws(() => parseDedupReviewApplyOptions({ mode }), /mode must be/);
  }
  assert.throws(() => parseDedupReviewApplyOptions({ mode: 'validate', live: true }), /--live is only valid/);
  assert.throws(() => parseDedupReviewApplyOptions({ mode: 'apply', runTag: 'bad tag!' }), /run_tag must be/);
});

test('isDedupReviewApplyDisabled - the switch fails closed: only unset, empty, 0 and false leave apply enabled', () => {
  for (const on of ['1', 'true', 'TRUE', ' True ', 'yes', 'on', 'enabled', 'tru', 'disabled']) assert.strictEqual(isDedupReviewApplyDisabled(on), true, on);
  for (const off of [undefined, '', '  ', '0', 'false', ' FALSE ']) assert.strictEqual(isDedupReviewApplyDisabled(off), false, String(off));
});

test('checkDedupReviewFloor - a same-day pair from one organizer passes', () => {
  assert.strictEqual(checkDedupReviewFloor(fresh()), null);
});

test('checkDedupReviewFloor - each rule refuses on its own, in order', () => {
  const rows: Array<[string, DedupReviewFreshPair, string]> = [
    ['high tier', fresh({ pair: pair({}, { tier: 'high' }) }), 'already-high'],
    ['low tier', fresh({ pair: pair({}, { tier: 'low' }) }), 'low-tier'],
    ['an earlier undo', fresh({ pair: pair({ undoneMergeCount: 1 }) }), 'undone-before'],
    ['no anchor at all', fresh({ pair: pair({}, { organizerMatch: false }) }), 'no-anchor'],
    ['a shared link without a venue match', fresh({ pair: pair({}, { organizerMatch: false, sharedLink: true, venueMatch: false }) }), 'no-anchor'],
    ['a venue match without a link', fresh({ pair: pair({}, { organizerMatch: false, sharedLink: false, venueMatch: true }) }), 'no-anchor'],
    ['sameAccount alone', fresh({ pair: pair({ sameAccount: true }, { organizerMatch: false }) }), 'no-anchor'],
    ['a venue conflict', fresh({ venueConflict: true }), 'venue-conflict'],
    ['no usable date pair', fresh({ pair: pair({}, { minDayDiff: null }) }), 'outside-window'],
    ['one day apart without a link', fresh({ pair: pair({}, { minDayDiff: 1 }) }), 'outside-window'],
    ['91 days apart with a link', fresh({ pair: pair({}, { sharedLink: true, minDayDiff: 91 }) }), 'outside-window'],
    [
      'a new schedule with no counterpart',
      fresh({
        pair: pair({
          newEvent: eventEvidence({
            slug: 'ig_p_def',
            schedules: [
              { isMain: true, startDate: '2026-11-08', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null },
              { isMain: false, startDate: '2026-12-25', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null },
            ],
          }),
        }),
      }),
      'schedule-uncovered',
    ],
    [
      'an unreadable schedule date',
      fresh({ pair: pair({ newEvent: eventEvidence({ slug: 'ig_p_def', schedules: [{ isMain: true, startDate: 'soon', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null }] }) }) }),
      'schedule-uncovered',
    ],
    ['numbers that differ', fresh({ pair: pair({ newEvent: eventEvidence({ slug: 'ig_p_def', name: 'GembiRun Loka 2026 Part 2' }), candidate: eventEvidence({ name: 'GembiRun Loka 2026 Part 1' }) }) }), 'name-mismatch'],
    ['bracket qualifiers that contradict', fresh({ pair: pair({ newEvent: eventEvidence({ slug: 'ig_p_def', name: 'Night Run (Morning)' }), candidate: eventEvidence({ name: 'Night Run (Evening)' }) }) }), 'name-mismatch'],
  ];
  for (const [label, input, expected] of rows) {
    assert.strictEqual(checkDedupReviewFloor(input), expected, label);
  }
});

test('checkDedupReviewFloor - a shared link with a venue match reaches 90 days; names a trigram cannot match still pass', () => {
  const linked = (days: number) =>
    fresh({
      pair: pair(
        {
          candidate: eventEvidence({ name: 'GembiRun Loka 2026', schedules: [{ isMain: true, startDate: '2026-10-21', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null }] }),
          newEvent: eventEvidence({ slug: 'ig_p_def', name: 'Lari Gembira Loka', schedules: [{ isMain: true, startDate: '2026-11-08', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null }] }),
        },
        { organizerMatch: false, sharedLink: true, venueMatch: true, minDayDiff: days, nameSimilarity: 0.1 }
      ),
    });
  assert.strictEqual(checkDedupReviewFloor(linked(18)), null, 'the deadline post and the race-day post of one event');
  assert.strictEqual(checkDedupReviewFloor(linked(90)), null, 'the window is inclusive');
});

test('checkDedupReviewFloor - an organizer pair that shares only a link (no venue match) also reaches 90 days, and no further', () => {
  // The registration-deadline post and the race-day post of one event, from one organizer. This is a decision the floor
  // makes on purpose: a link alone widens the window when the organizer anchor holds. A recurring series that shares one
  // link is kept apart by the name check (differing numbers or qualifiers) and by the reviewer, not by the floor.
  const linkOnly = (days: number) => fresh({ pair: pair({}, { organizerMatch: true, sharedLink: true, venueMatch: false, minDayDiff: days }) });
  const candidateOn = (startDate: string) => eventEvidence({ schedules: [{ isMain: true, startDate, endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null }] });
  const sixty = fresh({ pair: pair({ candidate: candidateOn('2026-09-09') }, { organizerMatch: true, sharedLink: true, venueMatch: false, minDayDiff: 60 }) });
  assert.strictEqual(checkDedupReviewFloor(sixty), null);
  assert.strictEqual(checkDedupReviewFloor(linkOnly(91)), 'outside-window');
});

test('judgeDedupReviewDecision - the pair state comes first, then the hash, then the floor', () => {
  const decision: DedupReviewDecision = { suggestionId: ID_A, evidenceHash: HASH, action: 'accept' };
  const judge = (lookup: DedupReviewFreshLookup, state: DedupReviewRunState = EMPTY_STATE) => judgeDedupReviewDecision({ decision, fresh: lookup, state, caps: CAPS });
  for (const kind of ['unknown-suggestion', 'not-pending', 'stale-pair'] as const) {
    assert.deepStrictEqual(judge({ kind }), { outcome: 'skipped', reason: kind });
  }
  assert.deepStrictEqual(judge({ kind: 'pair', ...fresh({ pair: pair({ evidenceHash: 'b'.repeat(64) }) }) }), { outcome: 'skipped', reason: 'stale-evidence' });
  assert.deepStrictEqual(judge({ kind: 'pair', ...fresh({ pair: pair({}, { tier: 'high' }) }) }), { outcome: 'skipped', reason: 'already-high' });
  assert.deepStrictEqual(judge({ kind: 'pair', ...fresh() }), { outcome: 'eligible' });
});

test('judgeDedupReviewDecision - a shared event, the per-run cap and the per-day cap come after the floor, in that order', () => {
  const decision: DedupReviewDecision = { suggestionId: ID_A, evidenceHash: HASH, action: 'accept' };
  const lookup: DedupReviewFreshLookup = { kind: 'pair', ...fresh() };
  const judge = (state: DedupReviewRunState, caps = CAPS) => judgeDedupReviewDecision({ decision, fresh: lookup, state, caps });

  assert.deepStrictEqual(judge({ ...EMPTY_STATE, claimedEventIds: new Set([EVENT_X]) }), { outcome: 'skipped', reason: 'event-already-in-run' }, 'the winner is claimed');
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, claimedEventIds: new Set([EVENT_Y]) }), { outcome: 'skipped', reason: 'event-already-in-run' }, 'the loser is claimed');
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, claimedEventIds: new Set([EVENT_Z]) }), { outcome: 'eligible' }, 'an unrelated claim does not matter');

  assert.deepStrictEqual(judge({ ...EMPTY_STATE, eligibleInRun: 10 }), { outcome: 'skipped', reason: 'per-run-cap' });
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, eligibleInRun: 9 }), { outcome: 'eligible' }, 'the tenth is allowed');
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, usedLast24h: 25 }), { outcome: 'skipped', reason: 'per-day-cap' });
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, usedLast24h: 20, eligibleInRun: 5 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'this run counts against the day');
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, usedLast24h: 20, eligibleInRun: 4 }), { outcome: 'eligible' });
  assert.deepStrictEqual(
    judge({ ...EMPTY_STATE, eligibleInRun: 10, usedLast24h: 25 }),
    { outcome: 'skipped', reason: 'per-run-cap' },
    'the per-run cap is reported before the per-day cap'
  );
  assert.deepStrictEqual(judge(EMPTY_STATE, { perRun: 2, perDay: 3, perDayRejects: 1 }), { outcome: 'eligible' }, 'the caps are injectable');
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, rejectsInRun: 5, usedLast24h: 20 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'rejects in this run count against the shared day cap of an accept');
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, rejectsInRun: 10 }), { outcome: 'eligible' }, 'rejects never use up the per-run cap of merges');
  assert.deepStrictEqual(judge({ ...EMPTY_STATE, usedRejectsLast24h: 10 }), { outcome: 'eligible' }, 'the reject cap does not bind an accept');
});

test('judgeDedupReviewDecision - an accept-override: no floor and no tier skip, but state, hash, a claimed event and both merge caps', () => {
  const decision: DedupReviewDecision = { suggestionId: ID_A, evidenceHash: HASH, action: 'accept-override' };
  const lookup = (overrides: Partial<DedupReviewFreshPair> = {}): DedupReviewFreshLookup => ({ kind: 'pair', ...fresh(overrides) });
  const judge = (fresh: DedupReviewFreshLookup, state: DedupReviewRunState = EMPTY_STATE, caps = CAPS) => judgeDedupReviewDecision({ decision, fresh, state, caps });

  for (const kind of ['unknown-suggestion', 'not-pending', 'stale-pair'] as const) {
    assert.deepStrictEqual(judge({ kind }), { outcome: 'skipped', reason: kind }, kind);
  }
  assert.deepStrictEqual(judge(lookup({ pair: pair({ evidenceHash: 'b'.repeat(64) }) })), { outcome: 'skipped', reason: 'stale-evidence' });
  assert.deepStrictEqual(judge(lookup()), { outcome: 'eligible' });

  // Every pair the floor refuses is eligible: each floor code, and both tiers the floor sets aside.
  const refusedByTheFloor: Array<[string, DedupReviewFreshLookup]> = [
    ['a high tier', lookup({ pair: pair({}, { tier: 'high' }) })],
    ['a low tier', lookup({ pair: pair({}, { tier: 'low' }) })],
    ['an earlier undo', lookup({ pair: pair({ undoneMergeCount: 1 }) })],
    ['no anchor', lookup({ pair: pair({}, { organizerMatch: false }) })],
    ['a venue conflict', lookup({ venueConflict: true })],
    ['outside the window', lookup({ pair: pair({}, { minDayDiff: null }) })],
    ['a schedule the window does not cover', lookup({ pair: pair({ newEvent: eventEvidence({ slug: 'ig_p_def', schedules: [{ isMain: true, startDate: '2027-03-01', endDate: null, startTime: null, endTime: null, timezone: null, title: null, location: null }] }) }) })],
    ['names that contradict', lookup({ pair: pair({ newEvent: eventEvidence({ slug: 'ig_p_def', name: 'GembiRun Loka 2026 Part 2' }), candidate: eventEvidence({ name: 'GembiRun Loka 2026 Part 1' }) }) })],
  ];
  for (const [label, input] of refusedByTheFloor) {
    assert.deepStrictEqual(judge(input), { outcome: 'eligible' }, label);
    assert.notStrictEqual(judgeDedupReviewDecision({ decision: { ...decision, action: 'accept' }, fresh: input, state: EMPTY_STATE, caps: CAPS }).outcome, 'eligible', `${label}: the same pair is refused as an accept`);
  }
  // Only the exact value skips the floor: any other action (a malformed one from a future caller included) gets it.
  const floorRefused = lookup({ pair: pair({}, { organizerMatch: false }) });
  for (const action of ['accept', 'Accept-Override', 'override', ''] as const) {
    assert.deepStrictEqual(
      judgeDedupReviewDecision({ decision: { ...decision, action: action as DedupReviewDecision['action'] }, fresh: floorRefused, state: EMPTY_STATE, caps: CAPS }),
      { outcome: 'skipped', reason: 'no-anchor' },
      JSON.stringify(action)
    );
  }

  // Shared event and the merge caps, in the accept's order.
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, claimedEventIds: new Set([EVENT_X]) }), { outcome: 'skipped', reason: 'event-already-in-run' });
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, claimedEventIds: new Set([EVENT_Z]) }), { outcome: 'eligible' });
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, eligibleInRun: 10 }), { outcome: 'skipped', reason: 'per-run-cap' }, 'an override uses the per-run cap of merges');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, eligibleInRun: 9 }), { outcome: 'eligible' });
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedLast24h: 25 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'and the shared day cap');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedLast24h: 20, rejectsInRun: 5 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'rejects in the run count against it');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, eligibleInRun: 10, usedLast24h: 25 }), { outcome: 'skipped', reason: 'per-run-cap' }, 'the per-run cap is reported first');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedRejectsLast24h: 10 }), { outcome: 'eligible' }, 'the reject cap does not bind an override');
});

test('judgeDedupReviewDecision - a reject: state, hash, high tier, a claimed event, the reject cap and the day cap, and no floor', () => {
  const decision: DedupReviewDecision = { suggestionId: ID_A, evidenceHash: HASH, action: 'reject' };
  const lookup = (overrides: Partial<DedupReviewFreshPair> = {}): DedupReviewFreshLookup => ({ kind: 'pair', ...fresh(overrides) });
  const judge = (fresh: DedupReviewFreshLookup, state: DedupReviewRunState = EMPTY_STATE, caps = CAPS) => judgeDedupReviewDecision({ decision, fresh, state, caps });

  for (const kind of ['unknown-suggestion', 'not-pending', 'stale-pair'] as const) {
    assert.deepStrictEqual(judge({ kind }), { outcome: 'skipped', reason: kind }, kind);
  }
  assert.deepStrictEqual(judge(lookup({ pair: pair({ evidenceHash: 'b'.repeat(64) }) })), { outcome: 'skipped', reason: 'stale-evidence' });
  assert.deepStrictEqual(judge(lookup({ pair: pair({}, { tier: 'high' }) })), { outcome: 'skipped', reason: 'already-high' }, 'the drain merges these: nothing rejects them');
  assert.deepStrictEqual(judge(lookup()), { outcome: 'eligible' });

  // The floor is not applied: every pair it refuses can still be rejected.
  const refusedByTheFloor: Array<[string, DedupReviewFreshLookup]> = [
    ['a low tier', lookup({ pair: pair({}, { tier: 'low' }) })],
    ['an earlier undo', lookup({ pair: pair({ undoneMergeCount: 1 }) })],
    ['no anchor', lookup({ pair: pair({}, { organizerMatch: false }) })],
    ['a venue conflict', lookup({ venueConflict: true })],
    ['outside the window', lookup({ pair: pair({}, { minDayDiff: null }) })],
    ['names that contradict', lookup({ pair: pair({ newEvent: eventEvidence({ slug: 'ig_p_def', name: 'GembiRun Loka 2026 Part 2' }), candidate: eventEvidence({ name: 'GembiRun Loka 2026 Part 1' }) }) })],
  ];
  for (const [label, input] of refusedByTheFloor) {
    assert.deepStrictEqual(judge(input), { outcome: 'eligible' }, label);
  }

  // A reject claims no event, but it does not pass an event an earlier accept claimed.
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, claimedEventIds: new Set([EVENT_X]) }), { outcome: 'skipped', reason: 'event-already-in-run' }, 'the winner is claimed');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, claimedEventIds: new Set([EVENT_Y]) }), { outcome: 'skipped', reason: 'event-already-in-run' }, 'the loser is claimed');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, claimedEventIds: new Set([EVENT_Z]) }), { outcome: 'eligible' });

  // Caps: the reject cap alone, the shared day cap alone, and both; the per-run cap of merges never applies.
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedRejectsLast24h: 10 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'the reject cap binds alone');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedRejectsLast24h: 9 }), { outcome: 'eligible' }, 'the tenth reject is allowed');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedRejectsLast24h: 6, rejectsInRun: 4 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'this run counts against the reject cap');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedLast24h: 25, usedRejectsLast24h: 0 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'the shared day cap binds alone');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedLast24h: 20, eligibleInRun: 5 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'merges in this run count against the shared cap');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedLast24h: 20, eligibleInRun: 4 }), { outcome: 'eligible' });
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, usedLast24h: 25, usedRejectsLast24h: 10 }), { outcome: 'skipped', reason: 'per-day-cap' }, 'both bind');
  assert.deepStrictEqual(judge(lookup(), { ...EMPTY_STATE, eligibleInRun: 10 }), { outcome: 'eligible' }, 'ten merges in the run do not stop a reject');
  assert.deepStrictEqual(judge(lookup(), EMPTY_STATE, { perRun: 0, perDay: 1, perDayRejects: 1 }), { outcome: 'eligible' }, 'the per-run cap of merges is not looked at');
});

test('formatDedupReviewApplyReport and countDedupReviewResults - one JSON line between the markers', () => {
  const results = [
    { suggestionId: ID_A, action: 'accept' as const, outcome: 'merged' as const, mergeId: ID_B },
    { suggestionId: ID_B, action: 'accept' as const, outcome: 'eligible' as const },
    { suggestionId: EVENT_X, action: 'accept' as const, outcome: 'skipped' as const, reason: 'no-anchor' as const },
    { suggestionId: EVENT_Y, action: 'accept' as const, outcome: 'skipped' as const, reason: 'per-run-cap' as const },
    { suggestionId: EVENT_Z, action: 'reject' as const, outcome: 'rejected' as const },
  ];
  assert.deepStrictEqual(countDedupReviewResults(results), { eligible: 1, merged: 1, rejected: 1, skipped: 2 });
  assert.deepStrictEqual(countDedupReviewResults([]), { eligible: 0, merged: 0, rejected: 0, skipped: 0 });

  const report: DedupReviewApplyReport = {
    schemaVersion: 1,
    generatedAt: '2026-10-31T00:00:00.000Z',
    runTag: 'run-1',
    mode: 'live',
    killSwitch: false,
    usedLast24h: 3,
    caps: CAPS,
    counts: countDedupReviewResults(results),
    results,
  };
  const lines = formatDedupReviewApplyReport(report);
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0], DEDUP_REVIEW_APPLY_BEGIN);
  assert.strictEqual(lines[2], DEDUP_REVIEW_APPLY_END);
  assert.deepStrictEqual(JSON.parse(lines[1]), report);
});
