import test from 'node:test';
import * as assert from 'node:assert';
import {
  decideMatchTier,
  evaluateStubRepeat,
  matchesStubRepeat,
  normalizeEventNameStrict,
  type MatchDecisionInput,
  type StubRepeatInput,
  type StubRepeatSchedule,
} from './match-scoring.js';

// The prod case (2026-10-25): 11 stub events "Yonex French Open 2026" from one curator account, all
// 20-25 Oct, one with the venue text, two with only the coordinates.
const ARENA: StubRepeatSchedule = {
  eventStartDate: '2026-10-20',
  location: 'Arena Grand Paris',
  latitude: 48.9764032,
  longitude: 2.5300418,
};
const ARENA_COORDS_ONLY: StubRepeatSchedule = { eventStartDate: '2026-10-20', latitude: 48.9764032, longitude: 2.5300418 };

function repeatInput(overrides: Partial<StubRepeatInput> = {}): StubRepeatInput {
  return {
    newIsStub: true,
    candidateIsStub: true,
    newEventName: 'Yonex French Open 2026',
    candidateEventName: 'Yonex French Open 2026',
    newSchedules: [ARENA],
    candidateSchedules: [ARENA],
    ...overrides,
  };
}

test('normalizeEventNameStrict', async (t) => {
  await t.test('lowercases and drops punctuation and year tokens', () => {
    assert.strictEqual(normalizeEventNameStrict('  Yonex   French-Open 2026!! '), 'yonex french open');
  });
  await t.test('keeps bracketed text, unlike normalizeEventNameForMatch', () => {
    assert.strictEqual(normalizeEventNameStrict('Open (Morning)'), 'open morning');
    assert.notStrictEqual(normalizeEventNameStrict('Open (Morning)'), normalizeEventNameStrict('Open (Evening)'));
  });
  await t.test('keeps non-year numbers', () => {
    assert.strictEqual(normalizeEventNameStrict('Sale Day 12'), 'sale day 12');
  });
});

test('evaluateStubRepeat: the prod case links', async (t) => {
  await t.test('same name, start date and venue text between two stubs', () => {
    assert.strictEqual(evaluateStubRepeat(repeatInput()), 'match');
    assert.strictEqual(matchesStubRepeat(repeatInput()), true);
  });
  await t.test('a venue given only by coordinates within 150 m still matches (two of the 11 had no venue text)', () => {
    assert.strictEqual(evaluateStubRepeat(repeatInput({ candidateSchedules: [ARENA_COORDS_ONLY] })), 'match');
    assert.strictEqual(evaluateStubRepeat(repeatInput({ newSchedules: [ARENA_COORDS_ONLY], candidateSchedules: [ARENA_COORDS_ONLY] })), 'match');
  });
  await t.test('names differing only by case, punctuation or a year are the same name', () => {
    assert.strictEqual(
      evaluateStubRepeat(repeatInput({ newEventName: 'YONEX French Open!', candidateEventName: 'Yonex French Open 2026' })),
      'match'
    );
  });
  await t.test('the account is not an input: two different curators link on the same terms', () => {
    // The input carries no account at all; this documents that nothing else can make it differ.
    assert.strictEqual(evaluateStubRepeat(repeatInput()), 'match');
  });
  await t.test('equal start times link; a missing time on either side does not block', () => {
    const at = (eventStartTime: string | null): StubRepeatSchedule => ({ ...ARENA, eventStartTime });
    assert.strictEqual(evaluateStubRepeat(repeatInput({ newSchedules: [at('19:00:00')], candidateSchedules: [at('19:00')] })), 'match');
    assert.strictEqual(evaluateStubRepeat(repeatInput({ newSchedules: [at('19:00:00')], candidateSchedules: [at(null)] })), 'match');
    assert.strictEqual(evaluateStubRepeat(repeatInput({ newSchedules: [at(null)], candidateSchedules: [at(null)] })), 'match');
  });
  await t.test('one matching schedule pair is enough when the events have several schedules', () => {
    assert.strictEqual(
      evaluateStubRepeat(
        repeatInput({
          newSchedules: [{ eventStartDate: '2026-10-23', location: 'Elsewhere' }, ARENA],
          candidateSchedules: [ARENA, { eventStartDate: '2026-10-24', location: 'Elsewhere' }],
        })
      ),
      'match'
    );
  });
});

test('evaluateStubRepeat: events that must stay apart', async (t) => {
  await t.test('same name and date at a DIFFERENT venue (several "Christmas Market" listings) are different events', () => {
    const result = evaluateStubRepeat(
      repeatInput({
        newEventName: 'Christmas Market',
        candidateEventName: 'Christmas Market',
        newSchedules: [{ eventStartDate: '2026-12-24', location: 'Grand Mall Jakarta', latitude: -6.2, longitude: 106.8 }],
        candidateSchedules: [{ eventStartDate: '2026-12-24', location: 'Tunjungan Plaza Surabaya', latitude: -7.26, longitude: 112.74 }],
      })
    );
    assert.strictEqual(result, 'venue-differs');
  });
  await t.test('same name and date, venue unknown on one side: not linked', () => {
    const result = evaluateStubRepeat(
      repeatInput({
        newEventName: 'Christmas Market',
        candidateEventName: 'Christmas Market',
        newSchedules: [{ eventStartDate: '2026-12-24', location: 'Grand Mall Jakarta' }],
        candidateSchedules: [{ eventStartDate: '2026-12-24' }],
      })
    );
    assert.strictEqual(result, 'venue-unknown-one-side');
  });
  await t.test('same name and date, venue unknown on both sides: not linked', () => {
    const result = evaluateStubRepeat(
      repeatInput({
        newEventName: 'Christmas Market',
        candidateEventName: 'Christmas Market',
        newSchedules: [{ eventStartDate: '2026-12-24' }],
        candidateSchedules: [{ eventStartDate: '2026-12-24', location: '   ' }],
      })
    );
    assert.strictEqual(result, 'venue-unknown-both');
  });
  await t.test('text on one side and only coordinates on the other cannot be compared: not linked', () => {
    const result = evaluateStubRepeat(
      repeatInput({
        newSchedules: [{ eventStartDate: '2026-10-20', location: 'Arena Grand Paris' }],
        candidateSchedules: [{ eventStartDate: '2026-10-20', latitude: 1, longitude: 1 }],
      })
    );
    assert.strictEqual(result, 'venue-unknown-one-side');
  });
  await t.test('a one-word name ("Christmas", "Bazaar") is too generic even with the same date and venue', () => {
    assert.strictEqual(evaluateStubRepeat(repeatInput({ newEventName: 'Christmas', candidateEventName: 'Christmas' })), 'name-too-short');
    assert.strictEqual(evaluateStubRepeat(repeatInput({ newEventName: 'Bazaar 2026', candidateEventName: 'bazaar' })), 'name-too-short');
  });
  await t.test('"(Morning)" and "(Evening)" are different names', () => {
    assert.strictEqual(
      evaluateStubRepeat(repeatInput({ newEventName: 'Fun Run (Morning)', candidateEventName: 'Fun Run (Evening)' })),
      'name-differs'
    );
  });
  await t.test('the Quarterfinals event is a different name', () => {
    assert.strictEqual(
      evaluateStubRepeat(repeatInput({ newEventName: 'Yonex French Open 2026 - Quarterfinals', candidateEventName: 'Yonex French Open 2026' })),
      'name-differs'
    );
  });
  await t.test('two sessions with the same name, day and venue but different start times are two events', () => {
    const at = (eventStartTime: string): StubRepeatSchedule => ({ ...ARENA, eventStartTime });
    assert.strictEqual(
      evaluateStubRepeat(repeatInput({ newSchedules: [at('14:00:00')], candidateSchedules: [at('19:00:00')] })),
      'times-differ'
    );
  });
  await t.test('a different start date (a weekly recurrence) is not a repeat', () => {
    assert.strictEqual(
      evaluateStubRepeat(repeatInput({ newSchedules: [{ ...ARENA, eventStartDate: '2026-10-27' }] })),
      'no-same-date'
    );
  });
  await t.test('stub to full and full to stub never use the rule', () => {
    assert.strictEqual(evaluateStubRepeat(repeatInput({ candidateIsStub: false })), 'not-stub');
    assert.strictEqual(evaluateStubRepeat(repeatInput({ newIsStub: false })), 'not-stub');
  });
  await t.test('the most informative near-miss reason wins across schedule pairs', () => {
    const at = (location: string | null, eventStartTime: string | null = null): StubRepeatSchedule => ({
      eventStartDate: '2026-10-20',
      location,
      eventStartTime,
    });
    // venue-differs (rank 3) beats venue-unknown (2) regardless of order
    assert.strictEqual(
      evaluateStubRepeat(repeatInput({ newSchedules: [at(null), at('Hall A')], candidateSchedules: [at('Hall B')] })),
      'venue-differs'
    );
    // times-differ (rank 4) beats venue-differs (3)
    assert.strictEqual(
      evaluateStubRepeat(
        repeatInput({ newSchedules: [at('Hall A', '10:00'), at('Hall B')], candidateSchedules: [at('Hall A', '12:00'), at('Hall C')] })
      ),
      'times-differ'
    );
  });
});

test('decideMatchTier with stub-repeat inputs', async (t) => {
  function decide(overrides: Partial<MatchDecisionInput> = {}) {
    // The prod shape: organizer discounted (false), no links, same name, same day, venue matches.
    return decideMatchTier({
      organizerMatch: false,
      sharedLink: false,
      nameSimilarity: 1,
      minDayDiff: 0,
      newEventName: 'Yonex French Open 2026',
      candidateEventName: 'Yonex French Open 2026',
      newVenues: [ARENA],
      candidateVenues: [ARENA],
      windowDays: 2,
      newIsStub: true,
      candidateIsStub: true,
      ...overrides,
    });
  }

  await t.test('lifts a LOW (0.40: date/name 0.25 + venue 0.15) to high, attributed to stub-repeat', () => {
    const result = decide();
    assert.strictEqual(result.score, 0.4);
    assert.strictEqual(result.scoredTier, 'low');
    assert.strictEqual(result.tier, 'high');
    assert.strictEqual(result.promotedByRule, true);
    assert.strictEqual(result.promotionRule, 'stub-repeat');
    assert.strictEqual(result.stubRepeat, true);
  });
  await t.test('lifts a MID too, and names stub-repeat even when mid-to-high would also apply', () => {
    const result = decide({ organizerMatch: true, newVenues: [{ eventStartDate: '2026-10-20' }] });
    // venue unknown on one side is not a stub repeat, so the mid-to-high rule decides.
    assert.strictEqual(result.stubRepeat, false);
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.promotionRule, 'mid-to-high');
    const both = decide({ organizerMatch: true, sharedLink: true });
    assert.strictEqual(both.scoredTier, 'high');
    assert.strictEqual(both.promotedByRule, false);
    assert.strictEqual(both.promotionRule, null);
    assert.strictEqual(both.stubRepeat, true, 'a stub repeat that already scores high is still additive');
  });
  await t.test('the rule is off unless both flags are provided and true', () => {
    assert.strictEqual(decide({ newIsStub: undefined, candidateIsStub: undefined }).tier, 'low');
    assert.strictEqual(decide({ candidateIsStub: false }).tier, 'low');
    assert.strictEqual(decide({ newIsStub: false }).promotionRule, null);
  });
  await t.test('the Christmas case (different venue) stays low', () => {
    const result = decide({
      newEventName: 'Christmas Market',
      candidateEventName: 'Christmas Market',
      newVenues: [{ eventStartDate: '2026-12-24', location: 'Grand Mall Jakarta' }],
      candidateVenues: [{ eventStartDate: '2026-12-24', location: 'Tunjungan Plaza Surabaya' }],
    });
    assert.strictEqual(result.tier, 'low');
    assert.strictEqual(result.stubRepeat, false);
  });
  await t.test('the equal start date makes it in-window by construction: a stale minDayDiff cannot demote it', () => {
    assert.strictEqual(decide({ minDayDiff: Infinity }).tier, 'high');
  });
});
