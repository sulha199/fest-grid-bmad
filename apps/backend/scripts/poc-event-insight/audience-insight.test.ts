import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ageWrittenOf, guardAudienceInsight, sensitiveScreen, trackCountOf, validateAudienceInsight, type AudienceInsight,
} from './audience-insight.js';

const base = (over: Partial<AudienceInsight> = {}): AudienceInsight => ({
  isEvent: true, postLanguage: 'id', geoScope: 'city', targetAreaLevel: 'none', eligibility: 'unspecified', tracks: [], costTier: 'unspecified',
  sensitiveTopic: 'none', interests: [], evidence: [], ...over,
});

test('validation rejects values outside the enums and keeps a well-formed answer', () => {
  assert.equal(validateAudienceInsight(base()).ok, true);
  assert.deepEqual(validateAudienceInsight(base({ geoScope: 'galaxy' })).errors, ['geoScope']);
  assert.deepEqual(validateAudienceInsight({ ...base(), isEvent: 'yes' }).errors, ['isEvent']);
  assert.equal(validateAudienceInsight(null).ok, false);
  assert.deepEqual(validateAudienceInsight({ ...base(), statedAudience: { country: 5 } }).errors, ['statedAudience']);
});

test('an evidence quote that is not in the caption is dropped and counted', () => {
  const out = guardAudienceInsight(base({ evidence: ['gratis tiket masuk', 'quote the model invented'] }), 'Event ini gratis tiket masuk untuk umum');
  assert.deepEqual(out.value.evidence, ['gratis tiket masuk']);
  assert.equal(out.claims.nonVerbatimQuotes, 1);
});

test('an age survives only when a verbatim quote grounds it next to an age word', () => {
  const caption = 'Kids Dash usia 6-10 tahun, 5K untuk 12 tahun ke atas';
  const grounded = guardAudienceInsight(base({
    tracks: [{ label: 'Kids Dash', ageMin: 6, ageMax: 10 }, { label: '5K', ageMin: 12 }], evidence: ['usia 6-10 tahun', '12 tahun ke atas'],
  }), caption);
  assert.equal(ageWrittenOf(grounded.value), 'yes');
  assert.equal(trackCountOf(grounded.value), 2);
  assert.equal(grounded.claims.dropped, 0);

  const invented = guardAudienceInsight(base({ tracks: [{ label: 'Kids', ageMin: 7, ageMax: 12 }], evidence: [] }), 'Lomba untuk anak SD');
  assert.equal(ageWrittenOf(invented.value), 'no');
  assert.equal(invented.claims.dropped, 2);
});

test('national needs nationwide wording; a national-sounding venue name does not count', () => {
  const venue = guardAudienceInsight(base({ geoScope: 'national' }), 'Pameran di Galeri Nasional Jakarta, gratis untuk umum');
  assert.equal(venue.value.geoScope, 'unspecified');
  assert.equal(venue.claims.dropped, 1);
  const contest = guardAudienceInsight(base({ geoScope: 'national' }), 'Lomba esai terbuka untuk mahasiswa seluruh Indonesia');
  assert.equal(contest.value.geoScope, 'national');
  assert.equal(contest.claims.dropped, 0);
});

test('restricted needs restriction wording', () => {
  assert.equal(guardAudienceInsight(base({ eligibility: 'restricted' }), 'Daftar sekarang, kuota terbatas').value.eligibility, 'unspecified');
  assert.equal(guardAudienceInsight(base({ eligibility: 'restricted' }), 'Khusus anggota komunitas').value.eligibility, 'restricted');
});

test('a stated audience whose quote is invented is dropped and counted as an abstention', () => {
  const out = guardAudienceInsight(base({ statedAudience: { country: 'id', quote: 'seluruh Indonesia' } }), 'Konser di Jakarta');
  assert.equal(out.value.statedAudience, null);
  assert.equal(out.claims.dropped, 1);
  const ok = guardAudienceInsight(base({ statedAudience: { country: 'id', quote: 'seluruh Indonesia' } }), 'Terbuka untuk seluruh Indonesia');
  assert.deepEqual(ok.value.statedAudience, { country: 'id', quote: 'seluruh Indonesia' });
});

test('the sensitive screen reads religion, politics and health from words, and leaves ordinary posts alone', () => {
  assert.equal(sensitiveScreen('Pengajian akbar dan gema sholawat')?.topic, 'religion');
  assert.equal(sensitiveScreen('Greenpeace turned the monument into a protest platform')?.topic, 'politics_civic');
  assert.equal(sensitiveScreen('Free diabetes screening at the clinic')?.topic, 'health_condition');
  assert.equal(sensitiveScreen('Fun run di kebun binatang', ['trail running']), undefined);
  assert.equal(sensitiveScreen('Zumba night', ['prayer'])?.topic, 'religion', 'an interest tag counts too');
});
