import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFallbackLocationQueries, buildKeywordQueries, planLocationLookups } from './build-location-queries.js';

test('keywords ladder: all keywords, then without the most specific', () => {
  assert.deepEqual(buildKeywordQueries(['Pasar Porosjayan', 'Gamping', 'Sleman']), [
    { step: 'kw1', query: 'Pasar Porosjayan, Gamping, Sleman' },
    { step: 'kw2', query: 'Gamping, Sleman' },
  ]);
});

test('keywords ladder: one keyword is one step, blanks are dropped, nothing usable is nothing', () => {
  assert.deepEqual(buildKeywordQueries(['Sleman']), [{ step: 'kw1', query: 'Sleman' }]);
  assert.deepEqual(buildKeywordQueries(['  ', 'Kuta ', '']), [{ step: 'kw1', query: 'Kuta' }]);
  assert.deepEqual(buildKeywordQueries([]), []);
  assert.deepEqual(buildKeywordQueries([' ']), []);
});

test('fallback ladder strips parentheticals, floor and unit noise, street numbers and the hint country', () => {
  assert.deepEqual(buildFallbackLocationQueries('Prau Function Room (Lt. 3), Grand Mercure Yogyakarta, Indonesia', 'ID'), [
    { step: 'fb1', query: 'Prau Function Room, Grand Mercure Yogyakarta' },
  ]);
  assert.deepEqual(buildFallbackLocationQueries('Titik Seduh, Jl. KSR Dadi Kusmayadi No. 12, RT 03 RW 04, Cibinong, Bogor'), [
    { step: 'fb1', query: 'Titik Seduh, Jl. KSR Dadi Kusmayadi, Cibinong, Bogor' },
    { step: 'fb2', query: 'Cibinong, Bogor' },
  ]);
});

test('fallback ladder: a country code segment, bare numbers and blanks are dropped; at most 5 segments', () => {
  assert.deepEqual(buildFallbackLocationQueries('Hall A; 54; id; Yogyakarta; a', 'id'), [{ step: 'fb1', query: 'Hall A, Yogyakarta' }]);
  assert.deepEqual(buildFallbackLocationQueries('s1x, s2x, s3x, s4x, s5x, s6x, s7x')?.[0].query, 's1x, s2x, s3x, s4x, s5x');
  assert.deepEqual(buildFallbackLocationQueries('12, 34 56'), []);
  assert.deepEqual(buildFallbackLocationQueries(''), []);
});

test('fallback ladder: the country name is only stripped for the hint country, and a bad code is harmless', () => {
  assert.deepEqual(buildFallbackLocationQueries('Kumamoto Prefectural Gymnasium, Japan', 'JP'), [{ step: 'fb1', query: 'Kumamoto Prefectural Gymnasium' }]);
  assert.deepEqual(buildFallbackLocationQueries('Hall, Japan'), [{ step: 'fb1', query: 'Hall, Japan' }]);
  assert.deepEqual(buildFallbackLocationQueries('Hall, Japan', '12'), [{ step: 'fb1', query: 'Hall, Japan' }]);
});

const STEPS = [
  { step: 'kw1' as const, query: 'A, B, C' },
  { step: 'kw2' as const, query: 'B, C' },
];

test('plan: a string code is a hard filter with no unfiltered pass', () => {
  assert.deepEqual(planLocationLookups(STEPS, { code: 'US', source: 'string' }), [
    { step: 'kw1', query: 'A, B, C', countryFilter: 'US' },
    { step: 'kw2', query: 'B, C', countryFilter: 'US' },
  ]);
});

test('plan: the platform default filters first, then one unfiltered pass', () => {
  assert.deepEqual(planLocationLookups(STEPS, { code: 'ID', source: 'platform' }), [
    { step: 'kw1', query: 'A, B, C', countryFilter: 'ID' },
    { step: 'kw2', query: 'B, C', countryFilter: 'ID' },
    { step: 'kw1', query: 'A, B, C' },
    { step: 'kw2', query: 'B, C' },
  ]);
});

test('plan: no hint is the unfiltered pass only, and no steps is no lookups', () => {
  assert.deepEqual(planLocationLookups(STEPS, { source: 'none' }), [
    { step: 'kw1', query: 'A, B, C' },
    { step: 'kw2', query: 'B, C' },
  ]);
  assert.deepEqual(planLocationLookups([], { code: 'ID', source: 'platform' }), []);
});
