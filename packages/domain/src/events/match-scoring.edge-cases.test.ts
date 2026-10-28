import test from 'node:test';
import assert from 'node:assert/strict';
import { areNamesAutoLinkable, computeMatchScore, decideMatchTier, hasVenueConflict, minScheduleDayDifference } from './match-scoring.js';

test('minScheduleDayDifference ignores candidate schedules with a missing or unparseable date', () => {
  assert.equal(
    minScheduleDayDifference(
      [{ eventStartDate: '2026-09-10' }],
      [{ eventStartDate: null }, { eventStartDate: 'not-a-date' }, { eventStartDate: '2026-09-12' }]
    ),
    2
  );
});

test('minScheduleDayDifference is Infinity when no usable date pair exists', () => {
  assert.equal(
    minScheduleDayDifference([{ eventStartDate: '2026-09-10' }], [{ eventStartDate: null }, { eventStartDate: 'garbage' }]),
    Infinity
  );
});

test('computeMatchScore treats a NaN name similarity as no similarity', () => {
  const withNaN = computeMatchScore({
    organizerMatch: false,
    sharedLink: false,
    nameSimilarity: Number.NaN,
    minDayDiff: Infinity,
    venueMatch: false,
  });

  assert.equal(withNaN.score, 0);
  assert.equal(withNaN.tier, 'low');
});

// --- Mid -> high promotion edge cases (AD-30 Rule 7, amended 2026-10-25) ---------------------------

test('areNamesAutoLinkable never links a name that normalizes to nothing', () => {
  assert.equal(areNamesAutoLinkable('2026', '2026', 1), false);
  assert.equal(areNamesAutoLinkable('!!!', 'Jazz Night', 1), false);
  assert.equal(areNamesAutoLinkable('Jazz Night', '(only a bracket)', 1), false);
});

test('areNamesAutoLinkable treats a NaN similarity as below the floor', () => {
  assert.equal(areNamesAutoLinkable('Jazz Night', 'Jazz Nights', Number.NaN), false);
});

test('areNamesAutoLinkable keeps letters from non-Latin scripts and accents', () => {
  assert.equal(areNamesAutoLinkable('Festival Musik Kota', 'festival musik kota!', 0), true);
  assert.equal(areNamesAutoLinkable('Cafe Concert', 'Café Concert', 0.7), false);
  assert.equal(areNamesAutoLinkable('音楽祭 東京', '音楽祭、東京', 0), true);
});

test('areNamesAutoLinkable compares digit tokens by value and count', () => {
  assert.equal(areNamesAutoLinkable('Run 5 Series', 'Run 5 Series Final', 0.9), true);
  assert.equal(areNamesAutoLinkable('Run 5 Series', 'Run 5 Series 2', 0.9), false);
  assert.equal(areNamesAutoLinkable('Run 5 Series 2', 'Run 5 Series', 0.9), false);
});

test('hasVenueConflict: text containment needs at least 3 characters on the shorter side', () => {
  const at = (location: string) => ({ eventStartDate: '2026-10-10', location });
  assert.equal(hasVenueConflict([at('ab')], [at('abc hall bandung')], 2), true);
  assert.equal(hasVenueConflict([at('abc')], [at('abc hall bandung')], 2), false);
});

test('hasVenueConflict: punctuation and case do not make equal venues differ', () => {
  const at = (location: string) => ({ eventStartDate: '2026-10-10', location });
  assert.equal(hasVenueConflict([at('Tenth Avenue, Bandung!')], [at('tenth avenue bandung')], 2), false);
});

test('hasVenueConflict: whitespace-only or null locations count as unknown', () => {
  const at = (location: string | null) => ({ eventStartDate: '2026-10-10', location });
  assert.equal(hasVenueConflict([at('   ')], [at('Tenth Avenue Bandung')], 2), false);
  assert.equal(hasVenueConflict([at(null)], [at('Tenth Avenue Bandung')], 2), false);
});

test('hasVenueConflict: far coordinates alone conflict, one-sided coordinates do not', () => {
  const jakarta = { eventStartDate: '2026-10-10', latitude: -6.2, longitude: 106.8 };
  const bandung = { eventStartDate: '2026-10-10', latitude: -6.9, longitude: 107.6 };
  assert.equal(hasVenueConflict([jakarta], [bandung], 2), true);
  assert.equal(hasVenueConflict([jakarta], [{ eventStartDate: '2026-10-10', latitude: -6.9, longitude: null }], 2), false);
});

test('hasVenueConflict: text that overlaps wins over far coordinates (geocode glitch)', () => {
  assert.equal(
    hasVenueConflict(
      [{ eventStartDate: '2026-10-10', location: 'Grand Mall', latitude: -6.2, longitude: 106.8 }],
      [{ eventStartDate: '2026-10-10', location: 'Grand Mall', latitude: -6.9, longitude: 107.6 }],
      2
    ),
    false
  );
});

test('hasVenueConflict: text that differs does not conflict when the coordinates are close', () => {
  assert.equal(
    hasVenueConflict(
      [{ eventStartDate: '2026-10-10', location: 'Hall A', latitude: -6.2, longitude: 106.8 }],
      [{ eventStartDate: '2026-10-10', location: 'Hall B', latitude: -6.2001, longitude: 106.8001 }],
      2
    ),
    false
  );
});

test('hasVenueConflict: with no pair inside the window, every pair is compared', () => {
  const far = (location: string, eventStartDate: string | null) => ({ eventStartDate, location });
  assert.equal(hasVenueConflict([far('BG Junction Surabaya', '2026-11-08')], [far('Tenth Avenue Bandung', '2026-10-21')], 2), true);
  assert.equal(hasVenueConflict([far('BG Junction Surabaya', null)], [far('Tenth Avenue Bandung', null)], 2), true);
  assert.equal(hasVenueConflict([far('Tenth Avenue', '2026-11-08')], [far('Tenth Avenue Bandung', '2026-10-21')], 2), false);
});

test('decideMatchTier reports venueMatch for an exact venue and still promotes only a mid', () => {
  const result = decideMatchTier({
    organizerMatch: true,
    sharedLink: false,
    nameSimilarity: 1,
    minDayDiff: 0,
    newEventName: 'Jazz Night',
    candidateEventName: 'Jazz Night',
    newVenues: [{ eventStartDate: '2026-10-10', location: 'Blue Note' }],
    candidateVenues: [{ eventStartDate: '2026-10-10', location: 'blue note' }],
    windowDays: 2,
  });
  // organizer 0.40 + date/name 0.25 + venue 0.15 = 0.80: already high on score alone.
  assert.equal(result.venueMatch, true);
  assert.equal(result.scoredTier, 'high');
  assert.equal(result.promotedByRule, false);
});
