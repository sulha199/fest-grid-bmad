import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageIntervals, qualifies, scoreTracks, validateTracks, type TrackedAudience, type TrackLabel } from './tracks.js';

const tr = (over: Partial<TrackedAudience['tracks'][number]> = {}) => ({ lifeStages: [], genderFocus: 'all' as const, ...over });
const aud = (tracks: TrackedAudience['tracks'], allAges = false): TrackedAudience => ({ allAges, tracks, evidence: [] });

const FUN_RUN = 'Kids Dash 1K — usia 6–10 tahun\n5K Terbuka — usia 12 tahun ke atas\n10K — usia 17 tahun ke atas\nMaster 10K — usia 45 tahun ke atas';
const FUN_LABEL: TrackLabel = { trackCount: [4, 4], expect: [{ ageMin: [6], ageMax: [10] }, { ageMin: [12], ageMax: 'absent' }, { ageMin: [17], ageMax: 'absent' }, { ageMin: [45], ageMax: 'absent' }] };
const funRun = aud([tr({ ageMin: 6, ageMax: 10 }), tr({ ageMin: 12 }), tr({ ageMin: 17 }), tr({ ageMin: 45 })]);

test('qualifies: a person fits an event if ANY track fits — including the gap case where nothing fits', () => {
  assert.equal(qualifies(funRun, { age: 8 }), true, 'Kids Dash');
  assert.equal(qualifies(funRun, { age: 30 }), true, '5K Terbuka (12+)');
  assert.equal(qualifies(funRun, { age: 11 }), false, 'between Kids Dash (≤10) and 5K (≥12): no track');
  assert.equal(qualifies(funRun, { age: 4 }), false);
});

test('qualifies: criteria inside one track are ALL required (stage AND age cap AND gender)', () => {
  const debate = aud([tr({ lifeStages: ['young_adult'], ageMax: 25 })]);
  assert.equal(qualifies(debate, { age: 22, lifeStage: 'young_adult' }), true);
  assert.equal(qualifies(debate, { age: 28, lifeStage: 'young_adult' }), false, 'right stage, over the cap');
  assert.equal(qualifies(debate, { age: 22, lifeStage: 'teen' }), false, 'under the cap, wrong stage');
  const women = aud([tr({ genderFocus: 'women' })]);
  assert.equal(qualifies(women, { gender: 'men' }), false);
  assert.equal(qualifies(women, { gender: 'women' }), true);
  assert.equal(qualifies(women, {}), true, 'unknown gender is not a mismatch');
});

test('qualifies: several lifeStages in one track are alternatives; unknown facets never exclude', () => {
  const essay = aud([tr({ lifeStages: ['teen', 'young_adult'] })]);
  assert.equal(qualifies(essay, { lifeStage: 'teen' }), true);
  assert.equal(qualifies(essay, { lifeStage: 'young_adult' }), true);
  assert.equal(qualifies(essay, { lifeStage: 'senior' }), false);
  assert.equal(qualifies(essay, {}), true, 'asking about nobody in particular excludes nothing');
});

test('qualifies: allAges is true for anyone; an event with no stated audience is undefined, not false', () => {
  assert.equal(qualifies(aud([], true), { age: 90 }), true);
  assert.equal(qualifies(aud([]), { age: 8 }), undefined);
});

test('ageIntervals: the union of the tracks, never one min/max stretched across a gap', () => {
  assert.deepEqual(ageIntervals(funRun), [[6, 10], [12, Infinity]], '17+ and 45+ are inside 12+');
  assert.deepEqual(ageIntervals(aud([tr({ ageMin: 5, ageMax: 8 }), tr({ ageMin: 13, ageMax: 17 })])), [[5, 8], [13, 17]]);
  assert.deepEqual(ageIntervals(aud([tr({ ageMin: 5, ageMax: 8 }), tr({ ageMin: 9, ageMax: 12 })])), [[5, 12]], 'adjacent integer ranges merge');
  assert.deepEqual(ageIntervals(aud([tr({ lifeStages: ['adult'] })])), [], 'stage-only tracks carry no numeric interval');
});

test('scoreTracks: a faithful fun-run extraction passes with nothing fabricated', () => {
  const s = scoreTracks(funRun, FUN_LABEL, FUN_RUN);
  assert.equal(s.pass, true, s.detail.join('; '));
});

test('scoreTracks: collapsing four categories into one stretched range fails on count and expectations', () => {
  const s = scoreTracks(aud([tr({ ageMin: 6, ageMax: 45 })]), FUN_LABEL, FUN_RUN);
  assert.equal(s.pass, false);
  assert.equal(s.trackCount, false);
  assert.ok(s.expectationsMet < s.expectationsTotal);
  assert.ok(s.fabricatedNumbers.some((f) => f.includes('ageMax=45')), 'a max of 45 is not stated for a 6-year-old track… and 45 is a minimum in the text');
});

test('scoreTracks: inventing the missing bound of a one-sided statement is fabrication', () => {
  const s = scoreTracks(aud([tr({ ageMin: 12, ageMax: 99 })]), { trackCount: [1, 1], expect: [{ ageMin: [12] }] }, 'usia 12 tahun ke atas');
  assert.equal(s.pass, false);
  assert.match(s.fabricatedNumbers.join(), /ageMax=99/);
});

test('scoreTracks: numbers derived from a school level are fabrication; the lifeStage is the honest stand-in', () => {
  const src = 'Kategori B: 1 - 3 SD';
  const bad = scoreTracks(aud([tr({ ageMin: 6, ageMax: 9 })]), { trackCount: [1, 1], expect: [] }, src);
  assert.equal(bad.fabricatedNumbers.length, 2);
  const good = scoreTracks(aud([tr({ lifeStages: ['child'] })]), { trackCount: [1, 1], expect: [{ lifeStageAny: ['child'], ageMin: 'absent', ageMax: 'absent' }] }, src);
  assert.equal(good.pass, true, good.detail.join('; '));
});

test('scoreTracks: exclusive bound "di bawah 12 tahun" accepts 11 or 12', () => {
  for (const max of [11, 12]) {
    assert.equal(scoreTracks(aud([tr({ ageMax: max })]), { trackCount: [1, 1], expect: [{ ageMax: [11, 12] }] }, 'Anak di bawah 12 tahun masuk gratis').pass, true, String(max));
  }
});

test('scoreTracks: allAges is checked when the label specifies it', () => {
  const s = scoreTracks(aud([], false), { trackCount: [0, 1], allAges: true, expect: [] }, 'Semua usia');
  assert.equal(s.allAges, false);
  assert.equal(s.pass, false);
});

test('validateTracks accepts a good object and rejects out-of-vocabulary stages, genders and non-numeric ages', () => {
  assert.equal(validateTracks(funRun).ok, true);
  assert.equal(validateTracks({ allAges: false, tracks: [{ lifeStages: ['wizard'], genderFocus: 'all' }], evidence: [] }).ok, false);
  assert.equal(validateTracks({ allAges: false, tracks: [{ lifeStages: [], genderFocus: 'other' }], evidence: [] }).ok, false);
  assert.equal(validateTracks({ allAges: false, tracks: [{ lifeStages: [], genderFocus: 'all', ageMin: 'six' }], evidence: [] }).ok, false);
  assert.equal(validateTracks(null).ok, false);
});

import { repairAgeRanges } from './tracks.js';

test('repairAgeRanges: fills the dropped maximum of a closed range from the text, for each en-dash/hyphen/sampai form', () => {
  for (const src of ['Kids Dash — usia 6–10 tahun', 'Kids Dash — usia 6-10 tahun', 'usia 6 sampai 10 tahun', 'ages 6 to 10', 'Usia 6 s.d. 10 th']) {
    const r = repairAgeRanges(aud([tr({ ageMin: 6 })]), src);
    assert.equal(r.audience.tracks[0].ageMax, 10, src);
    assert.equal(r.repairs.length, 1, src);
  }
});

test('repairAgeRanges: fills a dropped minimum when only the maximum survived', () => {
  const r = repairAgeRanges(aud([tr({ ageMax: 17 })]), 'Piano Remaja (13–17 tahun)');
  assert.equal(r.audience.tracks[0].ageMin, 13);
});

test('repairAgeRanges: repairs each track from its own range when several are present', () => {
  const src = 'Piano Anak (usia 5–8 tahun)\nPiano Remaja (13–17 tahun)';
  const r = repairAgeRanges(aud([tr({ ageMin: 5 }), tr({ ageMin: 13 }), tr({ lifeStages: ['adult'] })]), src);
  assert.deepEqual(r.audience.tracks.map((t) => [t.ageMin, t.ageMax]), [[5, 8], [13, 17], [undefined, undefined]]);
});

test('repairAgeRanges: leaves one-sided statements and non-age ranges alone', () => {
  assert.equal(repairAgeRanges(aud([tr({ ageMin: 12 })]), 'usia 12 tahun ke atas').audience.tracks[0].ageMax, undefined);
  assert.equal(repairAgeRanges(aud([tr({ ageMin: 1 })]), 'Kategori B: 1 - 3 SD').audience.tracks[0].ageMax, undefined, 'a school-grade range carries no age word');
  assert.equal(repairAgeRanges(aud([tr({ ageMin: 14 })]), 'Pukul 14.00–17.00 WIB').audience.tracks[0].ageMax, undefined, 'a time range is not an age');
  assert.equal(repairAgeRanges(aud([tr({ ageMin: 100 })]), 'Rp100-250 ribu, usia berapa saja').audience.tracks[0].ageMax, undefined, 'a price range is not an age');
});

test('repairAgeRanges: ambiguous (two ranges starting at the same number) is left alone, and it never overwrites a stated bound', () => {
  const two = repairAgeRanges(aud([tr({ ageMin: 6 })]), 'usia 6–10 tahun atau usia 6–12 tahun');
  assert.equal(two.audience.tracks[0].ageMax, undefined);
  const stated = repairAgeRanges(aud([tr({ ageMin: 6, ageMax: 9 })]), 'usia 6–10 tahun');
  assert.equal(stated.audience.tracks[0].ageMax, 9, 'only fills a missing bound');
});

test('repairAgeRanges: does not mutate its input', () => {
  const input = aud([tr({ ageMin: 6 })]);
  const copy = JSON.stringify(input);
  repairAgeRanges(input, 'usia 6–10 tahun');
  assert.equal(JSON.stringify(input), copy);
});
