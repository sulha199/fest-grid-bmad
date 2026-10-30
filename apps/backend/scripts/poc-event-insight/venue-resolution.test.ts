import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, SAMPLE_GAZETTEER } from './area-resolver.js';
import { decideVenue, isGenericVenueName, resolveGeocoderArea, venueMemoryKey, type VenueCandidate } from './venue-resolution.js';

const ix = buildIndex(SAMPLE_GAZETTEER);
const cand = (areaKeys: string[], confidence: number, countryCode = 'id'): VenueCandidate => ({ areaKeys, confidence, countryCode });
const none = { post: [] as string[], account: [] as string[] };

test('generic names: only when every word is generic; a name with a place word is not', () => {
  for (const g of ['Alun-alun', 'Taman Budaya', 'Masjid Agung', 'Masjid Jami', 'Pasar', 'GOR', 'Balai Desa', 'Balai Warga', 'Lapangan', 'Gedung Serbaguna', 'Taman Kota', 'di Alun-Alun']) {
    assert.equal(isGenericVenueName(g), true, g);
  }
  for (const n of ['Taman Budaya Yogyakarta', 'Alun-Alun Ambarrukmo', 'Plaza Ambarrukmo', 'Masjid Agung Demak', 'Pasar Beringharjo']) {
    assert.equal(isGenericVenueName(n), false, n);
  }
  assert.equal(isGenericVenueName(''), false);
});

test('the geocoder\'s "city" is resolved as a kecamatan INSIDE its province: Plaza Ambarrukmo is Depok in Sleman, not Kota Depok', () => {
  const r = resolveGeocoderArea({ city: 'Depok', province: 'Special Region of Yogyakarta', countryCode: 'id' }, ix);
  assert.deepEqual(r, { status: 'resolved', keys: ['id-yo-sleman-depok'], level: 'district' });
  assert.deepEqual(resolveGeocoderArea({ city: 'Mlati', province: 'Yogyakarta' }, ix), { status: 'resolved', keys: ['id-yo-sleman-mlati'], level: 'district' }, 'the other province spelling');
  assert.deepEqual(resolveGeocoderArea({ city: 'Yogyakarta', province: 'Special Region of Yogyakarta' }, ix), { status: 'resolved', keys: ['id-yo-yogyakarta'], level: 'regency' }, 'the city, not the province');
});

test('an unknown kecamatan falls back to the province; a foreign or provinceless result is not resolved', () => {
  assert.deepEqual(resolveGeocoderArea({ city: 'Pisangan', province: 'Special Region of Yogyakarta' }, ix), { status: 'province-only', keys: ['id-yo'] });
  assert.deepEqual(resolveGeocoderArea({ province: 'Yogyakarta' }, ix), { status: 'province-only', keys: ['id-yo'] });
  assert.deepEqual(resolveGeocoderArea({ city: 'Montpellier', province: 'Occitania', countryCode: 'fr' }, ix), { status: 'foreign', countryCode: 'fr' });
  assert.deepEqual(resolveGeocoderArea({ city: 'Somewhere' }, ix), { status: 'unresolved' });
});

test('rejected: wrong country or below the floor (the prod cases: France at 1.0, Sabah at 0.24)', () => {
  assert.equal(decideVenue('Arena Grand Paris', [cand(['fr'], 1, 'fr')], none, ix).status, 'rejected');
  assert.equal(decideVenue('Taman Budaya Embung Giwangan', [cand(['x'], 0.24, 'my')], none, ix).status, 'rejected');
  assert.equal(decideVenue('Alun-Alun Ambarrukmo', [cand(['id-jb'], 0)], none, ix).status, 'rejected', 'Ciamis at confidence 0');
});

test('no context: an unambiguous name is accepted (EXACT); a generic or unsure name is ambiguous', () => {
  const plaza = decideVenue('Plaza Ambarrukmo', [cand(['id-yo-sleman-depok'], 1), cand(['id-jb-depok'], 0.3)], none, ix);
  assert.equal(plaza.status, 'accepted');
  assert.equal(plaza.status === 'accepted' && plaza.precision, 'EXACT');
  assert.equal(decideVenue('Taman Budaya', [cand(['id-yo-yogyakarta'], 1)], none, ix).status, 'ambiguous', 'generic name, no context');
  assert.equal(decideVenue('Gedung X', [cand(['id-yo'], 0.7), cand(['id-jt'], 0.65)], none, ix).status, 'ambiguous', 'two plausible, no context');
  assert.equal(decideVenue('Gedung X', [cand(['id-yo'], 0.8)], none, ix).status, 'ambiguous', 'a single candidate below 0.9 is not unambiguous');
});

test('post-level context: the candidate inside it is accepted EXACT, even for a generic name; several inside -> the top one stands', () => {
  const ctx = { post: ['id-yo-yogyakarta'], account: [] as string[] };
  const one = decideVenue('Taman Budaya', [cand(['id-yo-yogyakarta'], 0.8), cand(['id-jt-surakarta'], 0.8)], ctx, ix);
  assert.equal(one.status, 'accepted');
  assert.equal(one.status === 'accepted' && one.precision, 'EXACT');
  assert.equal(one.status === 'accepted' && one.contextSource, 'post');
  const many = decideVenue('Taman Budaya', [cand(['id-yo-yogyakarta'], 0.9), cand(['id-yo-yogyakarta'], 0.7)], ctx, ix);
  assert.equal(many.status === 'accepted' && many.candidate.confidence, 0.9);
  assert.equal(decideVenue('Taman Budaya', [cand(['id-jt-surakarta'], 0.9)], ctx, ix).status, 'rejected', 'nothing inside the context');
});

test('account-level context may choose between candidates but caps the pin at AREA', () => {
  const ctx = { post: [] as string[], account: ['id-yo'] };
  const d = decideVenue('Taman Budaya', [cand(['id-yo-yogyakarta'], 0.9), cand(['id-jt-surakarta'], 0.9)], ctx, ix);
  assert.equal(d.status, 'accepted');
  assert.equal(d.status === 'accepted' && d.precision, 'AREA');
  assert.equal(d.status === 'accepted' && d.contextSource, 'account');
});

test('the missing-city rule: a PROVINCE-level context accepts exactly one plausible candidate inside it, and two in different regencies are ambiguous', () => {
  const province = { post: [] as string[], account: ['id-yo'] };
  assert.equal(decideVenue('Taman Budaya', [cand(['id-yo-bantul'], 0.9)], province, ix).status, 'accepted');
  assert.equal(decideVenue('Taman Budaya', [cand(['id-yo-bantul'], 0.9), cand(['id-yo-sleman'], 0.85)], province, ix).status, 'ambiguous');
  assert.equal(decideVenue('Taman Budaya', [cand(['id-yo-sleman-depok'], 0.9), cand(['id-yo-sleman-mlati'], 0.8)], province, ix).status, 'accepted', 'two candidates in the same regency collapse to one');
  assert.equal(decideVenue('Taman Budaya', [cand(['id-jt-surakarta'], 0.95)], province, ix).status, 'rejected');
});

test('the account-scoped venue memory key carries the account and a normalized name', () => {
  assert.equal(venueMemoryKey('acc-1', 'Taman Budaya'), 'acc-1::taman budaya');
  assert.equal(venueMemoryKey('acc-1', 'di Taman  Budaya!'), 'acc-1::taman budaya');
  assert.notEqual(venueMemoryKey('acc-1', 'Taman Budaya'), venueMemoryKey('acc-2', 'Taman Budaya'));
});
