// Story 0.i7z ratchet — AD-14 Rule 2 / Story 0.i7z AC 2 (re-ranking beats position).
// Pure-function unit coverage of `selectBestCandidate`'s confidence-primary /
// matchType-tiebreak / position-fallback selection. Fails if the ADDRESS branch of
// `resolveLocation` ever reverts to `candidates[0]`.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectBestCandidate } from './select-best-candidate.js';
import { LocationDetails } from '@festgrid/shared-types';

function candidate(overrides: Partial<LocationDetails> = {}, index: number = 0): LocationDetails {
  return {
    coordinates: { latitude: -7.78 + index * 0.01, longitude: 110.38 + index * 0.01 },
    formattedAddress: `Candidate ${index}`,
    placeId: `place-${index}`,
    provider: 'GEOAPIFY',
    ...overrides,
  };
}

test('selectBestCandidate returns a single candidate unchanged', () => {
  const only = candidate({ placeId: 'only', confidence: 0.5, matchType: 'full_match' });
  assert.deepEqual(selectBestCandidate([only]), only);
});

test('selectBestCandidate picks a higher-confidence later candidate over a lower-confidence first one (BUG-017)', () => {
  const lowFirst = candidate({ placeId: 'generic-top', confidence: 0.4, matchType: 'match_by_city_or_district' }, 0);
  const highLater = candidate({ placeId: 'correct-subvenue', confidence: 0.9, matchType: 'match_by_building' }, 1);
  const result = selectBestCandidate([lowFirst, highLater]);
  assert.equal(result.placeId, 'correct-subvenue');
  assert.equal(result.confidence, 0.9);
});

test('selectBestCandidate never prefers an undefined-confidence candidate over a defined one, even low', () => {
  const undefinedConfidence = candidate({ placeId: 'no-signal', confidence: undefined, matchType: 'full_match' }, 0);
  const lowDefined = candidate({ placeId: 'low-signal', confidence: 0.1, matchType: 'match_by_postcode' }, 1);
  const result = selectBestCandidate([undefinedConfidence, lowDefined]);
  assert.equal(result.placeId, 'low-signal');
  assert.equal(result.confidence, 0.1);
});

test('selectBestCandidate breaks an exact-confidence tie by matchType priority', () => {
  const postcode = candidate({ placeId: 'postcode', confidence: 0.8, matchType: 'match_by_postcode' }, 0);
  const fullMatch = candidate({ placeId: 'full', confidence: 0.8, matchType: 'full_match' }, 1);
  const result = selectBestCandidate([postcode, fullMatch]);
  // full_match is more specific than match_by_postcode, so it wins despite being later.
  assert.equal(result.placeId, 'full');
});

test('selectBestCandidate: unrecognized matchType loses a tie to any recognized matchType', () => {
  const unrecognized = candidate({ placeId: 'unrecognized', confidence: 0.8, matchType: 'area_unknown' }, 0);
  const recognized = candidate({ placeId: 'recognized', confidence: 0.8, matchType: 'inner_part' }, 1);
  const result = selectBestCandidate([unrecognized, recognized]);
  // inner_part is the lowest recognized tier, but any recognized value beats an unrecognized one.
  assert.equal(result.placeId, 'recognized');
});

test('selectBestCandidate: two unrecognized matchTypes at an exact tie fall through to array position', () => {
  const firstUnknown = candidate({ placeId: 'unknown-a', confidence: 0.7, matchType: 'some_new_value' }, 0);
  const secondUnknown = candidate({ placeId: 'unknown-b', confidence: 0.7, matchType: 'another_new_value' }, 1);
  const result = selectBestCandidate([firstUnknown, secondUnknown]);
  assert.equal(result.placeId, 'unknown-a');
});

test('selectBestCandidate: all candidates missing confidence and matchType — first wins by position', () => {
  const a = candidate({ placeId: 'a', confidence: undefined, matchType: undefined }, 0);
  const b = candidate({ placeId: 'b', confidence: undefined, matchType: undefined }, 1);
  const c = candidate({ placeId: 'c', confidence: undefined, matchType: undefined }, 2);
  const result = selectBestCandidate([a, b, c]);
  assert.equal(result.placeId, 'a');
});

test('selectBestCandidate: equal confidence and equal recognized matchType — first wins by position', () => {
  const a = candidate({ placeId: 'a', confidence: 0.6, matchType: 'match_by_street' }, 0);
  const b = candidate({ placeId: 'b', confidence: 0.6, matchType: 'match_by_street' }, 1);
  assert.equal(selectBestCandidate([a, b]).placeId, 'a');
});

test('selectBestCandidate throws on an empty array', () => {
  assert.throws(() => selectBestCandidate([]), /must not be empty/);
});
