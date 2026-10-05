import test from 'node:test';
import * as assert from 'node:assert';
import {
  normalizeEventLinkUrl,
  hasSharedEventLink,
  haversineDistanceMeters,
  hasVenueMatch,
  minScheduleDayDifference,
  computeDateProximityScore,
  classifyMatchTier,
  computeMatchScore,
  MATCH_SCORE_WEIGHTS,
  MATCH_SCORE_THRESHOLDS,
} from './match-scoring.js';

test('normalizeEventLinkUrl', async (t) => {
  await t.test('lowercases, trims, strips trailing slash and query string', () => {
    assert.strictEqual(normalizeEventLinkUrl('  HTTPS://Example.com/Tix/ '), 'https://example.com/tix');
  });

  await t.test('strips query string without a trailing slash', () => {
    assert.strictEqual(normalizeEventLinkUrl('https://example.com/tix?utm=1'), 'https://example.com/tix');
  });

  await t.test('no trailing slash, no query string -> unchanged (aside from case/trim)', () => {
    assert.strictEqual(normalizeEventLinkUrl('https://example.com/tix'), 'https://example.com/tix');
  });

  await t.test('bare trailing slash with no path', () => {
    assert.strictEqual(normalizeEventLinkUrl('https://example.com/'), 'https://example.com');
  });
});

test('hasSharedEventLink', async (t) => {
  await t.test('shared normalized URL -> true', () => {
    assert.strictEqual(
      hasSharedEventLink([{ url: 'https://example.com/tix/' }], [{ url: 'HTTPS://EXAMPLE.COM/tix?utm=1' }]),
      true
    );
  });

  await t.test('no overlap -> false', () => {
    assert.strictEqual(hasSharedEventLink([{ url: 'https://a.com' }], [{ url: 'https://b.com' }]), false);
  });

  await t.test('null/undefined link lists -> false, never throws', () => {
    assert.strictEqual(hasSharedEventLink(null, undefined), false);
    assert.strictEqual(hasSharedEventLink(undefined, [{ url: 'https://a.com' }]), false);
    assert.strictEqual(hasSharedEventLink([{ url: 'https://a.com' }], null), false);
  });

  await t.test('empty arrays -> false', () => {
    assert.strictEqual(hasSharedEventLink([], []), false);
  });

  await t.test('entries with a null/undefined url are ignored, not matched against each other', () => {
    assert.strictEqual(hasSharedEventLink([{ url: null }], [{ url: undefined }]), false);
  });
});

test('haversineDistanceMeters', async (t) => {
  await t.test('same point -> 0', () => {
    assert.strictEqual(haversineDistanceMeters(1, 2, 1, 2), 0);
  });

  await t.test('known distance: ~1 degree of longitude at the equator is ~111.32km', () => {
    const distance = haversineDistanceMeters(0, 0, 0, 1);
    assert.ok(Math.abs(distance - 111_320) < 1000, `expected ~111320m, got ${distance}`);
  });

  await t.test('antipodal-ish large distance does not throw / NaN', () => {
    const distance = haversineDistanceMeters(10, 10, -10, -170);
    assert.ok(Number.isFinite(distance));
  });
});

test('hasVenueMatch', async (t) => {
  await t.test('matching location string (case-insensitive, trimmed) -> true', () => {
    assert.strictEqual(
      hasVenueMatch([{ location: '  Gelora Bung Karno ' }], [{ location: 'gelora bung karno' }]),
      true
    );
  });

  await t.test('coordinates within 150m -> true', () => {
    // ~0.001 degree of latitude is ~111m -- within the 150m threshold.
    assert.strictEqual(
      hasVenueMatch([{ latitude: -6.2, longitude: 106.8 }], [{ latitude: -6.201, longitude: 106.8 }]),
      true
    );
  });

  await t.test('coordinates far apart -> false', () => {
    assert.strictEqual(
      hasVenueMatch([{ latitude: -6.2, longitude: 106.8 }], [{ latitude: -6.3, longitude: 106.9 }]),
      false
    );
  });

  await t.test('no location and no coordinates on either side -> false', () => {
    assert.strictEqual(hasVenueMatch([{}], [{}]), false);
  });

  await t.test('location present on only one side -> false (no match, no throw)', () => {
    assert.strictEqual(hasVenueMatch([{ location: 'Venue A' }], [{}]), false);
  });

  await t.test('coordinates present on only one side -> false (no match, no throw)', () => {
    assert.strictEqual(hasVenueMatch([{ latitude: 1, longitude: 2 }], [{}]), false);
  });

  await t.test('multiple pairs: a later pair matches even when an earlier pair does not', () => {
    assert.strictEqual(
      hasVenueMatch(
        [{ location: 'No Match' }, { location: 'Venue A' }],
        [{ location: 'Something Else' }, { location: 'venue a' }]
      ),
      true
    );
  });

  await t.test('empty lists -> false', () => {
    assert.strictEqual(hasVenueMatch([], []), false);
  });
});

test('minScheduleDayDifference', async (t) => {
  await t.test('exact same date -> 0', () => {
    assert.strictEqual(minScheduleDayDifference([{ eventStartDate: '2026-10-04' }], [{ eventStartDate: '2026-10-04' }]), 0);
  });

  await t.test('2-day difference computed correctly', () => {
    assert.strictEqual(minScheduleDayDifference([{ eventStartDate: '2026-10-04' }], [{ eventStartDate: '2026-10-06' }]), 2);
  });

  await t.test('picks the smallest diff across multiple schedule pairs', () => {
    const minDiff = minScheduleDayDifference(
      [{ eventStartDate: '2026-10-04' }, { eventStartDate: '2026-10-10' }],
      [{ eventStartDate: '2026-10-05' }]
    );
    assert.strictEqual(minDiff, 1);
  });

  await t.test('null eventStartDate entries are skipped', () => {
    assert.strictEqual(
      minScheduleDayDifference([{ eventStartDate: null }, { eventStartDate: '2026-10-04' }], [{ eventStartDate: '2026-10-04' }]),
      0
    );
  });

  await t.test('no usable date pair -> Infinity', () => {
    assert.strictEqual(minScheduleDayDifference([], []), Infinity);
    assert.strictEqual(minScheduleDayDifference([{ eventStartDate: null }], [{ eventStartDate: null }]), Infinity);
  });

  await t.test('unparseable date strings are skipped, not NaN-propagated', () => {
    assert.strictEqual(
      minScheduleDayDifference([{ eventStartDate: 'not-a-date' }], [{ eventStartDate: '2026-10-04' }]),
      Infinity
    );
  });
});

test('computeDateProximityScore', async (t) => {
  await t.test('0-day diff -> 1', () => {
    assert.strictEqual(computeDateProximityScore(0), 1);
  });

  await t.test('1-day diff -> 0.5', () => {
    assert.strictEqual(computeDateProximityScore(1), 0.5);
  });

  await t.test('2-day diff -> 0 (clamped lower bound)', () => {
    assert.strictEqual(computeDateProximityScore(2), 0);
  });

  await t.test('diff beyond 2 days -> clamped to 0, not negative', () => {
    assert.strictEqual(computeDateProximityScore(10), 0);
  });

  await t.test('Infinity (no date pair) -> 0', () => {
    assert.strictEqual(computeDateProximityScore(Infinity), 0);
  });
});

test('classifyMatchTier', async (t) => {
  await t.test('>= high threshold -> high', () => {
    assert.strictEqual(classifyMatchTier(MATCH_SCORE_THRESHOLDS.high), 'high');
    assert.strictEqual(classifyMatchTier(1), 'high');
  });

  await t.test('>= mid threshold and < high -> mid', () => {
    assert.strictEqual(classifyMatchTier(MATCH_SCORE_THRESHOLDS.mid), 'mid');
    assert.strictEqual(classifyMatchTier(0.5), 'mid');
  });

  await t.test('< mid threshold -> low', () => {
    assert.strictEqual(classifyMatchTier(0), 'low');
    assert.strictEqual(classifyMatchTier(MATCH_SCORE_THRESHOLDS.mid - 0.01), 'low');
  });
});

test('computeMatchScore', async (t) => {
  await t.test('all signals true/1, 0-day diff -> maximal score, classified high', () => {
    const result = computeMatchScore({
      organizerMatch: true,
      sharedLink: true,
      nameSimilarity: 1,
      minDayDiff: 0,
      venueMatch: true,
    });
    assert.strictEqual(
      result.score,
      MATCH_SCORE_WEIGHTS.organizerMatch + MATCH_SCORE_WEIGHTS.sharedLink + MATCH_SCORE_WEIGHTS.dateNameSimilarity + MATCH_SCORE_WEIGHTS.venueMatch
    );
    assert.strictEqual(result.score, 1);
    assert.strictEqual(result.tier, 'high');
  });

  await t.test('all signals false/0, no date pair -> score 0, classified low', () => {
    const result = computeMatchScore({
      organizerMatch: false,
      sharedLink: false,
      nameSimilarity: 0,
      minDayDiff: Infinity,
      venueMatch: false,
    });
    assert.strictEqual(result.score, 0);
    assert.strictEqual(result.tier, 'low');
  });

  await t.test('organizer match alone (0.40) -> low (below the 0.45 mid threshold)', () => {
    const result = computeMatchScore({
      organizerMatch: true,
      sharedLink: false,
      nameSimilarity: 0,
      minDayDiff: Infinity,
      venueMatch: false,
    });
    assert.strictEqual(result.score, 0.4);
    assert.strictEqual(result.tier, 'low');
  });

  await t.test('organizer match + shared link (0.60) -> mid', () => {
    const result = computeMatchScore({
      organizerMatch: true,
      sharedLink: true,
      nameSimilarity: 0,
      minDayDiff: Infinity,
      venueMatch: false,
    });
    assert.ok(Math.abs(result.score - 0.6) < 1e-9);
    assert.strictEqual(result.tier, 'mid');
  });

  await t.test('dateNameSimilarity is the average of nameSimilarity and date-proximity', () => {
    const result = computeMatchScore({
      organizerMatch: false,
      sharedLink: false,
      nameSimilarity: 0.6,
      minDayDiff: 2, // date proximity 0
      venueMatch: false,
    });
    // average(0.6, 0) = 0.3; weighted: 0.3 * 0.25 = 0.075
    assert.strictEqual(result.score, 0.075);
    assert.strictEqual(result.tier, 'low');
  });

  await t.test('out-of-range nameSimilarity is clamped into [0,1] rather than distorting the score', () => {
    const result = computeMatchScore({
      organizerMatch: false,
      sharedLink: false,
      nameSimilarity: 5, // clamped to 1
      minDayDiff: 0, // date proximity 1
      venueMatch: false,
    });
    // average(1, 1) = 1; weighted: 1 * 0.25 = 0.25
    assert.strictEqual(result.score, 0.25);
  });
});
