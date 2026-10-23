import test from 'node:test';
import assert from 'node:assert/strict';
import { computeMatchScore, minScheduleDayDifference } from './match-scoring.js';

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
