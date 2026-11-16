import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, SAMPLE_GAZETTEER } from './area-resolver.js';
import { classifyVenueType, implicitAreaKey, LARGE_VENUE_CLASSES, SMALL_PROVINCE_KEYS } from './implicit-level-policy.js';

const ix = buildIndex(SAMPLE_GAZETTEER);

test('venue category -> class; unknown or missing is "other"', () => {
  assert.equal(classifyVenueType('commercial.shopping_mall'), 'mall');
  assert.equal(classifyVenueType('Plaza Ambarrukmo'), 'mall');
  assert.equal(classifyVenueType('sport.stadium'), 'stadium');
  assert.equal(classifyVenueType('building.convention_centre'), 'convention_centre');
  assert.equal(classifyVenueType('education.university'), 'university');
  assert.equal(classifyVenueType('catering.cafe'), 'other');
  assert.equal(classifyVenueType(undefined), 'other');
  assert.equal(classifyVenueType(null), 'other');
});

test('a mall in DIY or DKI Jakarta resolves to the PROVINCE (owner decision, 2026-10-27)', () => {
  assert.equal(implicitAreaKey('id-yo-sleman-depok', 'mall', ix), 'id-yo', 'Plaza Ambarrukmo: the geocoder says Depok, the kecamatan of Sleman');
  assert.equal(implicitAreaKey('id-yo-sleman', 'mall', ix), 'id-yo');
  assert.equal(implicitAreaKey('id-yo-yogyakarta', 'mall', ix), 'id-yo');
  assert.equal(implicitAreaKey('id-jk', 'mall', ix), 'id-jk');
});

test('stadium, convention centre and university follow the same exception', () => {
  for (const cls of LARGE_VENUE_CLASSES) assert.equal(implicitAreaKey('id-yo-bantul-banguntapan', cls, ix), 'id-yo', cls);
});

test('a mall elsewhere resolves to its city or regency, not the province', () => {
  assert.equal(implicitAreaKey('id-ji-surabaya', 'mall', ix), 'id-ji-surabaya');
  assert.equal(implicitAreaKey('id-jb-bandung-kota', 'mall', ix), 'id-jb-bandung-kota');
  assert.equal(implicitAreaKey('id-ba-badung-canggu', 'mall', ix), 'id-ba-badung', 'a locality rolls up to its regency');
});

test('Batam is a city inside Kepulauan Riau, not a small province: it is NOT in the exception list', () => {
  assert.ok(!SMALL_PROVINCE_KEYS.includes('id-kr'));
  assert.deepEqual([...SMALL_PROVINCE_KEYS].sort(), ['id-jk', 'id-yo']);
});

test('any other venue keeps the city or regency level, even in a small province', () => {
  assert.equal(implicitAreaKey('id-yo-sleman-depok', 'other', ix), 'id-yo-sleman');
  assert.equal(implicitAreaKey('id-yo-yogyakarta', 'other', ix), 'id-yo-yogyakarta');
});

test('a venue known only to the province stays at the province; an unknown key is returned unchanged', () => {
  assert.equal(implicitAreaKey('id-jt', 'other', ix), 'id-jt');
  assert.equal(implicitAreaKey('not-a-key', 'mall', ix), 'not-a-key');
});
