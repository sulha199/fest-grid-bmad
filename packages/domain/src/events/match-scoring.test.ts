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
  capTierWhenOutsideDateWindow,
  computeMatchScore,
  decideMatchTier,
  normalizeEventNameForMatch,
  areNamesAutoLinkable,
  hasVenueConflict,
  type MatchDecisionInput,
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

test('capTierWhenOutsideDateWindow (BUG-063)', async (t) => {
  await t.test('demotes high to mid when no schedule is inside the date window', () => {
    assert.strictEqual(capTierWhenOutsideDateWindow('high', 18, 2), 'mid');
    assert.strictEqual(capTierWhenOutsideDateWindow('high', Infinity, 2), 'mid');
  });
  await t.test('leaves an in-window candidate untouched, boundary included', () => {
    assert.strictEqual(capTierWhenOutsideDateWindow('high', 0, 2), 'high');
    assert.strictEqual(capTierWhenOutsideDateWindow('high', 2, 2), 'high');
  });
  await t.test('never promotes or touches mid/low', () => {
    assert.strictEqual(capTierWhenOutsideDateWindow('mid', 18, 2), 'mid');
    assert.strictEqual(capTierWhenOutsideDateWindow('low', 18, 2), 'low');
  });
});

// --- Mid -> high promotion (AD-30 Rule 7, amended 2026-10-25) ---------------------------------------

const WINDOW_DAYS = 2;

function decide(overrides: Partial<MatchDecisionInput> = {}) {
  return decideMatchTier({
    organizerMatch: true,
    sharedLink: false,
    nameSimilarity: 1,
    minDayDiff: 0,
    newEventName: 'Mall Anniversary Sale',
    candidateEventName: 'Mall Anniversary Sale',
    newVenues: [{ eventStartDate: '2026-10-10', location: null }],
    candidateVenues: [{ eventStartDate: '2026-10-10', location: null }],
    windowDays: WINDOW_DAYS,
    ...overrides,
  });
}

test('decideMatchTier: promotes a mid to high when every condition holds', async (t) => {
  await t.test('same account, same day, same name, no venue on either side', () => {
    const result = decide();
    // organizer 0.40 + date/name 0.25 = 0.65: the cap the missing venue signal causes today.
    assert.strictEqual(result.score, 0.65);
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.tier, 'high');
    assert.strictEqual(result.promotedByRule, true);
  });

  await t.test('a shared link stands in for the account', () => {
    const result = decide({ organizerMatch: false, sharedLink: true });
    assert.strictEqual(result.scoredTier, 'mid'); // link 0.20 + date/name 0.25 = 0.45
    assert.strictEqual(result.tier, 'high');
    assert.strictEqual(result.promotedByRule, true);
  });

  await t.test('names that differ only by case, punctuation, a year or a bracketed suffix are the same name', () => {
    const result = decide({
      newEventName: 'Mall Anniversary Sale 2026 (SOLD OUT)!',
      candidateEventName: 'mall   anniversary sale',
      nameSimilarity: 0.7, // the trigram score is irrelevant once the normalized names are equal
    });
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.promotedByRule, true);
  });

  await t.test('a digit inside the brackets ("(Day 1)", "(10K)") still separates the names, even though brackets are otherwise noise', () => {
    const result = decide({
      newEventName: 'Mall Anniversary Sale 2026 (Day 1)',
      candidateEventName: 'mall anniversary sale',
      nameSimilarity: 1,
    });
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.promotedByRule, false);
  });

  await t.test('trigram similarity >= 0.85 with no differing digits is the same name', () => {
    const result = decide({
      newEventName: 'Mall Anniversary Sale Weekend',
      candidateEventName: 'Mall Anniversary Sales Weekend',
      nameSimilarity: 0.86,
      minDayDiff: 1,
    });
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.promotedByRule, true);
  });

  await t.test('one side without a venue does not block, and overlapping venue text does not conflict', () => {
    assert.strictEqual(
      decide({ newVenues: [{ eventStartDate: '2026-10-10', location: 'Tenth Avenue Bandung' }] }).promotedByRule,
      true
    );
    const overlapping = decide({
      newVenues: [{ eventStartDate: '2026-10-10', location: 'Tenth Avenue' }],
      candidateVenues: [{ eventStartDate: '2026-10-10', location: 'Tenth Avenue Bandung' }],
    });
    assert.strictEqual(overlapping.venueConflict, false);
    // Not an exact string match, so the venue signal stays off and the promotion is what links it.
    assert.strictEqual(overlapping.venueMatch, false);
    assert.strictEqual(overlapping.promotedByRule, true);
  });

  await t.test('window boundary: exactly 2 days apart still promotes', () => {
    const result = decide({ minDayDiff: 2 });
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.promotedByRule, true);
  });
});

test('decideMatchTier: known negatives stay mid (manual review)', async (t) => {
  await t.test('(a) a touring event: same name, date and account, but Bandung vs Surabaya', () => {
    const result = decide({
      newEventName: 'Lomba Mata Pelajaran dan Mewarnai',
      candidateEventName: 'Lomba Mata Pelajaran dan Mewarnai',
      newVenues: [{ eventStartDate: '2026-10-10', location: 'BG Junction Surabaya' }],
      candidateVenues: [{ eventStartDate: '2026-10-10', location: 'Tenth Avenue Bandung' }],
    });
    assert.strictEqual(result.venueConflict, true);
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.tier, 'mid');
    assert.strictEqual(result.promotedByRule, false);
  });

  await t.test('(b) a daily series: "... Biggest Sale" vs "... Biggest Sale - Day 12", one day apart', () => {
    const result = decide({
      newEventName: '32 Days of C&F Biggest Sale - Day 12',
      candidateEventName: '32 Days of C&F Biggest Sale',
      nameSimilarity: 0.9,
      minDayDiff: 1,
    });
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.tier, 'mid');
    assert.strictEqual(result.promotedByRule, false);
  });

  await t.test('(c) two different store promos at the same mall on the same date (venue known on one side only)', () => {
    const result = decide({
      newEventName: 'Uniqlo Mid Year Sale at Grand Mall',
      candidateEventName: 'Zara Mid Year Sale at Grand Mall',
      nameSimilarity: 0.62,
      newVenues: [{ eventStartDate: '2026-10-10', location: 'Grand Mall' }],
    });
    assert.strictEqual(result.venueConflict, false);
    assert.strictEqual(result.scoredTier, 'mid'); // 0.40 + (0.62 + 1) / 2 * 0.25
    assert.strictEqual(result.tier, 'mid');
    assert.strictEqual(result.promotedByRule, false);
  });

  await t.test('names below 0.85 similarity and not equal when normalized stay mid', () => {
    const result = decide({ newEventName: 'Jazz Night', candidateEventName: 'Jazz Nights Special', nameSimilarity: 0.84 });
    assert.strictEqual(result.scoredTier, 'mid');
    assert.strictEqual(result.promotedByRule, false);
  });
});

test('decideMatchTier: the date window cap still holds', async (t) => {
  await t.test('a shared-link candidate 18 days away is never promoted, even with the same account, name and venue', () => {
    const result = decide({
      organizerMatch: true,
      sharedLink: true,
      minDayDiff: 18,
      newVenues: [{ eventStartDate: '2026-11-08', location: 'Gembira Loka Zoo' }],
      candidateVenues: [{ eventStartDate: '2026-10-21', location: 'Gembira Loka Zoo' }],
    });
    // organizer 0.40 + link 0.20 + (1 + 0) / 2 * 0.25 + venue 0.15 = 0.875 -> scored high, capped to mid.
    assert.strictEqual(result.scoredTier, 'high');
    assert.strictEqual(result.tier, 'mid');
    assert.strictEqual(result.promotedByRule, false);
  });

  await t.test('a mid outside the window is not promoted either', () => {
    const result = decide({ minDayDiff: 18, sharedLink: true });
    assert.strictEqual(result.scoredTier, 'mid'); // 0.40 + 0.20 + 0.125 = 0.725
    assert.strictEqual(result.tier, 'mid');
    assert.strictEqual(result.promotedByRule, false);
  });

  await t.test('no date pair at all (Infinity) is outside the window', () => {
    assert.strictEqual(decide({ minDayDiff: Infinity, sharedLink: true }).promotedByRule, false);
  });
});

test('decideMatchTier: other tiers pass through unchanged', async (t) => {
  await t.test('a scored high is high and not flagged as promoted', () => {
    const result = decide({ sharedLink: true });
    assert.strictEqual(result.scoredTier, 'high');
    assert.strictEqual(result.tier, 'high');
    assert.strictEqual(result.promotedByRule, false);
  });

  await t.test('a low is never promoted, however similar the names', () => {
    const result = decide({ organizerMatch: false, sharedLink: false });
    assert.strictEqual(result.scoredTier, 'low'); // date/name only: 0.25
    assert.strictEqual(result.tier, 'low');
    assert.strictEqual(result.promotedByRule, false);
  });
});

test('normalizeEventNameForMatch', async (t) => {
  await t.test('lowercases and collapses punctuation and whitespace', () => {
    assert.strictEqual(normalizeEventNameForMatch('  Jazz,  Night!! '), 'jazz night');
  });
  await t.test('drops year tokens and bracketed groups', () => {
    assert.strictEqual(normalizeEventNameForMatch('Jazz Night 2026 [SOLD OUT] (Day 1)'), 'jazz night');
  });
  await t.test('keeps non-year numbers', () => {
    assert.strictEqual(normalizeEventNameForMatch('Day 12 of 32'), 'day 12 of 32');
  });
});

test('areNamesAutoLinkable', async (t) => {
  await t.test('equal normalized names ignore the similarity score', () => {
    assert.strictEqual(areNamesAutoLinkable('Jazz Night 2026', 'jazz night', 0), true);
  });
  await t.test('a bracketed category or number is not noise: "(10K)" vs no number, "(5K)" vs "(10K)" (found on prod)', () => {
    assert.strictEqual(areNamesAutoLinkable('Erafone Run 2026 - Yogyakarta Series (10K)', 'erafone Run 2026 Yogyakarta Series', 0.9), false);
    assert.strictEqual(areNamesAutoLinkable('Erafone Run Series (5K)', 'Erafone Run Series (10K)', 1), false);
    assert.strictEqual(areNamesAutoLinkable('Global EduFair (GEF) 2026', 'Global EduFair 2026', 0.87), true, 'a bracketed abbreviation is still noise');
    assert.strictEqual(areNamesAutoLinkable('Perayaan Jumat Spooky (PJS)', 'Perayaan Jumat Spooky', 0.88), true);
  });
  await t.test('similar names need >= 0.85 and the same digit tokens in order', () => {
    assert.strictEqual(areNamesAutoLinkable('Fun Run 5K Jakarta', 'Fun Run 5K Jakarta Edition', 0.86), true);
    assert.strictEqual(areNamesAutoLinkable('Fun Run 5K Jakarta', 'Fun Run 5K Jakarta Edition', 0.849), false);
    assert.strictEqual(areNamesAutoLinkable('Fun Run 5K Jakarta', 'Fun Run 10K Jakarta', 0.9), false);
    assert.strictEqual(areNamesAutoLinkable('Part 1 of 2 Show', 'Part 2 of 1 Show', 0.95), false);
  });
});

test('hasVenueConflict', async (t) => {
  const surabaya = { eventStartDate: '2026-10-10', location: 'BG Junction Surabaya', latitude: -7.26, longitude: 112.74 };
  const bandung = { eventStartDate: '2026-10-10', location: 'Tenth Avenue Bandung', latitude: -6.9, longitude: 107.6 };

  await t.test('clearly different venues conflict', () => {
    assert.strictEqual(hasVenueConflict([surabaya], [bandung], WINDOW_DAYS), true);
  });
  await t.test('coordinates within a few km are the same place even if the text differs', () => {
    assert.strictEqual(
      hasVenueConflict(
        [{ eventStartDate: '2026-10-10', location: 'Gelora Bung Karno', latitude: -6.2183, longitude: 106.8018 }],
        [{ eventStartDate: '2026-10-10', location: 'GBK Senayan', latitude: -6.2196, longitude: 106.8023 }],
        WINDOW_DAYS
      ),
      false
    );
  });
  await t.test('a side with no venue never conflicts', () => {
    assert.strictEqual(hasVenueConflict([surabaya], [{ eventStartDate: '2026-10-10' }], WINDOW_DAYS), false);
    assert.strictEqual(hasVenueConflict([], [bandung], WINDOW_DAYS), false);
  });
  await t.test('a tour: venues are compared only between schedules inside the date window', () => {
    const tourCandidate = [
      { eventStartDate: '2026-10-10', location: 'Tenth Avenue Bandung' },
      { eventStartDate: '2026-10-17', location: 'BG Junction Surabaya' },
    ];
    // The new item is the Surabaya date: its in-window partner is the Surabaya schedule.
    assert.strictEqual(
      hasVenueConflict([{ eventStartDate: '2026-10-17', location: 'BG Junction Surabaya' }], tourCandidate, WINDOW_DAYS),
      false
    );
    // The new item is a third city on the Bandung date: Bandung is its only in-window partner.
    assert.strictEqual(
      hasVenueConflict([{ eventStartDate: '2026-10-11', location: 'Paris Van Java Mall' }], tourCandidate, WINDOW_DAYS),
      true
    );
  });
});
