import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORY_TABLE, categoryToVenue, eventSettings, resolveSetting, scoreVenues, validateVenues,
  type VenueExtraction, type VenueLabel,
} from './venues.js';

const ex = (over: Partial<VenueExtraction> = {}): VenueExtraction => ({ attendance: 'onsite', venues: [], evidence: [], ...over });
const label = (over: Partial<VenueLabel> = {}): VenueLabel => ({ attendance: ['onsite'], venueCount: [1, 1], expect: [{ nameAny: ['alun-alun'], setting: ['outdoor'] }], ...over });
const SRC = 'Malam Rakyat di Alun-alun Kidul, Sabtu pukul 19.00';

test('categoryToVenue: hierarchical, longest prefix wins, unknown by default', () => {
  assert.deepEqual(categoryToVenue('commercial.shopping_mall'), { kind: 'mall', setting: 'indoor' });
  assert.deepEqual(categoryToVenue('leisure.park'), { kind: 'park_open_space', setting: 'outdoor' });
  assert.equal(categoryToVenue('sport.pitch').setting, 'outdoor', 'sport.pitch beats the generic sport row');
  assert.equal(categoryToVenue('sport.sports_centre').setting, 'indoor');
  assert.equal(categoryToVenue('sport.stadium').setting, 'mixed', 'falls back to the generic sport row');
  assert.equal(categoryToVenue('catering.restaurant.indonesian').kind, 'cafe_restaurant', 'deeper categories inherit');
  assert.deepEqual(categoryToVenue('airport.international'), { kind: 'unknown', setting: 'unknown' });
  assert.deepEqual(categoryToVenue(undefined), { kind: 'unknown', setting: 'unknown' });
  assert.deepEqual(categoryToVenue(''), { kind: 'unknown', setting: 'unknown' });
});

test('categoryToVenue: a prefix must match a whole segment ("sporting" is not "sport")', () => {
  assert.equal(categoryToVenue('sporting_goods').setting, 'unknown');
  assert.equal(categoryToVenue('educational.thing').setting, 'unknown');
});

test('CATEGORY_TABLE: exactly the two IDEA-070-probed rows are marked verified, and no prefix is duplicated', () => {
  assert.deepEqual(CATEGORY_TABLE.filter((r) => r.verified).map((r) => r.prefix).sort(), ['commercial.shopping_mall', 'leisure.park']);
  const prefixes = CATEGORY_TABLE.map((r) => r.prefix);
  assert.equal(new Set(prefixes).size, prefixes.length);
});

test('resolveSetting: Geoapify first; the model only where the geocoder is silent or unknown', () => {
  assert.deepEqual(resolveSetting({ geoapifyCategory: 'leisure.park' }), { setting: 'outdoor', kind: 'park_open_space', source: 'geoapify', conflict: false });
  assert.deepEqual(resolveSetting({ geoapifyCategory: 'leisure.park', aiSetting: 'outdoor' }).conflict, false);
  assert.deepEqual(resolveSetting({ aiSetting: 'indoor', aiKind: 'hall' }), { setting: 'indoor', kind: 'hall', source: 'ai', conflict: false });
  assert.equal(resolveSetting({ geoapifyCategory: 'building', aiSetting: 'outdoor' }).source, 'ai', 'a geocoder "unknown" defers to the model');
  assert.deepEqual(resolveSetting({}), { setting: 'unknown', kind: 'unknown', source: 'none', conflict: false });
  assert.equal(resolveSetting({ aiSetting: 'unknown' }).source, 'none', 'a model "unknown" is not a claim');
});

test('resolveSetting: when both speak and disagree, Geoapify wins and the conflict is flagged', () => {
  const r = resolveSetting({ geoapifyCategory: 'commercial.shopping_mall', aiSetting: 'outdoor' });
  assert.equal(r.setting, 'indoor');
  assert.equal(r.source, 'geoapify');
  assert.equal(r.conflict, true);
});

test('eventSettings: the set of known settings across venues (EXISTS semantics), unknown ignored', () => {
  assert.deepEqual(eventSettings([{ setting: 'outdoor' }, { setting: 'indoor' }, { setting: 'outdoor' }, { setting: 'unknown' }]).sort(), ['indoor', 'outdoor']);
  assert.deepEqual(eventSettings([]), []);
  assert.deepEqual(eventSettings([{ setting: 'unknown' }]), []);
});

test('scoreVenues: a faithful extraction passes', () => {
  const s = scoreVenues(ex({ venues: [{ name: 'Alun-alun Kidul', kind: 'park_open_space', setting: 'outdoor' }] }), label(), SRC);
  assert.equal(s.pass, true, s.detail.join('; '));
});

test('scoreVenues: an online platform listed as a venue fails, and an invented venue fails', () => {
  const zoom = scoreVenues(ex({ attendance: 'online', venues: [{ name: 'Zoom', kind: 'other', setting: 'unknown' }] }), label({ attendance: ['online'], venueCount: [0, 1], expect: [] }), 'Kelas via Zoom');
  assert.deepEqual(zoom.onlineAsVenue, ['Zoom']);
  assert.equal(zoom.pass, false);
  const invented = scoreVenues(ex({ venues: [{ name: 'Gedung Wanita Mulia', kind: 'hall', setting: 'indoor' }] }), label({ expect: [] }), SRC);
  assert.deepEqual(invented.invented, ['Gedung Wanita Mulia']);
  assert.equal(invented.pass, false);
});

test('scoreVenues: "unknown" where a claim is expected is an abstention; a wrong claim is not', () => {
  const abst = scoreVenues(ex({ venues: [{ name: 'Alun-alun Kidul', kind: 'park_open_space', setting: 'unknown' }] }), label(), SRC);
  assert.equal(abst.abstained, 1);
  assert.deepEqual(abst.wrongSetting, []);
  const wrong = scoreVenues(ex({ venues: [{ name: 'Alun-alun Kidul', kind: 'park_open_space', setting: 'indoor' }] }), label(), SRC);
  assert.equal(wrong.abstained, 0);
  assert.equal(wrong.wrongSetting.length, 1);
});

test('scoreVenues: venue count and attendance are checked; several venues need several matches', () => {
  const multi = label({ venueCount: [2, 2], expect: [{ nameAny: ['alun-alun'], setting: ['outdoor'] }, { nameAny: ['societet'], setting: ['indoor'] }] });
  const src = 'Alun-alun Kidul dan Gedung Societet Militair';
  const one = scoreVenues(ex({ venues: [{ name: 'Alun-alun Kidul', kind: 'park_open_space', setting: 'outdoor' }] }), multi, src);
  assert.equal(one.count, false);
  assert.equal(one.met, 1);
  const two = scoreVenues(ex({ venues: [{ name: 'Alun-alun Kidul', kind: 'park_open_space', setting: 'outdoor' }, { name: 'Gedung Societet Militair', kind: 'hall', setting: 'indoor' }] }), multi, src);
  assert.equal(two.pass, true, two.detail.join('; '));
  assert.equal(scoreVenues(ex({ attendance: 'online' }), label({ venueCount: [0, 0], expect: [] }), SRC).attendance, false);
});

test('validateVenues rejects out-of-vocabulary values and nameless venues', () => {
  assert.equal(validateVenues(ex({ venues: [{ name: 'X', kind: 'hall', setting: 'indoor' }] })).ok, true);
  assert.equal(validateVenues({ attendance: 'telepathy', venues: [], evidence: [] }).ok, false);
  assert.equal(validateVenues({ attendance: 'onsite', venues: [{ name: '', kind: 'hall', setting: 'indoor' }], evidence: [] }).ok, false);
  assert.equal(validateVenues({ attendance: 'onsite', venues: [{ name: 'X', kind: 'castle', setting: 'indoor' }], evidence: [] }).ok, false);
  assert.equal(validateVenues(null).ok, false);
});
