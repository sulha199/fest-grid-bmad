import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { EventInsight } from './insight-schema.js';
import { applyGuards } from './guards.js';

const base = (over: Partial<EventInsight> = {}): EventInsight => ({
  geoScope: 'city', targetAreas: [], eligibility: 'open_to_public', segments: [], genderFocus: 'all', interests: [],
  participationModes: ['attend'], costTier: 'unspecified', languages: [], inferredFields: [], evidence: [], confidence: 0.9, ...over,
});

test('keeps a stated age range backed by an age-qualified verbatim quote', () => {
  const src = 'Dibuka untuk UMUM, Usia 7–16 Tahun. Biaya Rp300.000';
  const r = applyGuards(base({ ageMin: 7, ageMax: 16, evidence: ['Usia 7–16 Tahun'] }), src);
  assert.equal(r.insight.ageMin, 7);
  assert.equal(r.insight.ageMax, 16);
  assert.deepEqual(r.actions, []);
});

test('drops an invented upper bound for "60 and above" but keeps the stated lower bound', () => {
  const src = 'Gratis untuk seluruh lansia usia 60 tahun ke atas!';
  const r = applyGuards(base({ ageMin: 60, ageMax: 120, evidence: ['lansia usia 60 tahun ke atas'] }), src);
  assert.equal(r.insight.ageMin, 60);
  assert.equal(r.insight.ageMax, undefined);
  assert.match(r.actions.join('\n'), /ageMax=120/);
});

test('accepts a derived exclusive bound: "di bawah 12 tahun" -> ageMax 11 or 12; "over 17" -> ageMin 18', () => {
  assert.equal(applyGuards(base({ ageMax: 11, evidence: ['Anak di bawah 12 tahun masuk GRATIS'] }), 'Anak di bawah 12 tahun masuk GRATIS').insight.ageMax, 11);
  assert.equal(applyGuards(base({ ageMax: 12, evidence: ['Anak di bawah 12 tahun masuk GRATIS'] }), 'Anak di bawah 12 tahun masuk GRATIS').insight.ageMax, 12);
  assert.equal(applyGuards(base({ ageMin: 18, evidence: ['open to those over 17 years old'] }), 'open to those over 17 years old').insight.ageMin, 18);
});

test('n±1 is NOT accepted without an exclusive-bound cue, or in the wrong direction', () => {
  assert.equal(applyGuards(base({ ageMax: 11, evidence: ['Usia 12 tahun'] }), 'Usia 12 tahun').insight.ageMax, undefined);
  assert.equal(applyGuards(base({ ageMin: 13, evidence: ['Anak di bawah 12 tahun'] }), 'Anak di bawah 12 tahun').insight.ageMin, undefined, 'a lower bound next to an upper-bound cue');
});

test('drops ages inferred from school levels ("1 - 3 SD") even when the digit appears in a quote', () => {
  const src = 'Kategori A: Paud /TK\nKategori B: 1 - 3 SD';
  const r = applyGuards(base({ ageMin: 3, ageMax: 10, evidence: ['Kategori B: 1 - 3 SD'] }), src);
  assert.equal(r.insight.ageMin, undefined);
  assert.equal(r.insight.ageMax, undefined);
});

test('does not mistake a digit inside a longer number or price for an age', () => {
  const src = 'Usia 12 tahun ke bawah, Rp120.000';
  const r = applyGuards(base({ ageMax: 120, evidence: ['Rp120.000'] }), src);
  assert.equal(r.insight.ageMax, undefined);
});

test('drops an age whose only support is a quote that is not in the source', () => {
  const r = applyGuards(base({ ageMin: 8, evidence: ['usia 8 tahun'] }), 'Lomba menggambar untuk anak-anak');
  assert.equal(r.insight.ageMin, undefined);
  assert.equal(r.insight.evidence.length, 0);
  assert.match(r.actions.join('\n'), /non-verbatim/);
});

test('drops an inconsistent range (min > max)', () => {
  const src = 'usia 16 tahun dan usia 7 tahun';
  const r = applyGuards(base({ ageMin: 16, ageMax: 7, evidence: ['usia 16 tahun', 'usia 7 tahun'] }), src);
  assert.equal(r.insight.ageMin, undefined);
  assert.equal(r.insight.ageMax, undefined);
});

test('restricted survives when the post has restriction wording, in Indonesian or English', () => {
  for (const src of ['Hanya untuk mahasiswa baru. Tidak terbuka untuk umum.', 'Members only. RSVP required.', 'Khusus karyawan PT Maju Jaya', 'Invite-only dinner', 'Wajib membawa KTM']) {
    assert.equal(applyGuards(base({ eligibility: 'restricted' }), src).insight.eligibility, 'restricted', src);
  }
});

test('restricted without any restriction wording degrades to unspecified (never hides an event on a hunch)', () => {
  for (const src of ['Terbuka untuk seluruh mahasiswa tingkat akhir & fresh graduate', 'Reservasi terbatas melalui sekretariat panitia', 'Free admission. Register via QR code.']) {
    const r = applyGuards(base({ eligibility: 'restricted' }), src);
    assert.equal(r.insight.eligibility, 'unspecified', src);
    assert.match(r.actions.join('\n'), /restricted -> unspecified/);
  }
});

test('a verified age band keeps "restricted" even without restriction wording', () => {
  const src = 'Gratis untuk seluruh lansia usia 60 tahun ke atas!';
  const r = applyGuards(base({ eligibility: 'restricted', ageMin: 60, evidence: ['lansia usia 60 tahun ke atas'] }), src);
  assert.equal(r.insight.eligibility, 'restricted');
  const noBand = applyGuards(base({ eligibility: 'restricted', ageMin: 60, evidence: [] }), src);
  assert.equal(noBand.insight.ageMin, undefined);
  assert.equal(noBand.insight.eligibility, 'unspecified', 'once the age is dropped there is no band left to justify restricted');
});

test('open_to_public / unspecified are never changed by the eligibility guard', () => {
  assert.equal(applyGuards(base({ eligibility: 'open_to_public' }), 'x').insight.eligibility, 'open_to_public');
  assert.equal(applyGuards(base({ eligibility: 'unspecified' }), 'x').insight.eligibility, 'unspecified');
});

test('gender focus survives with explicit wording and is reset to all without it', () => {
  for (const src of ['Khusus perempuan!', 'Lari khusus perempuan', 'Ladies only night', 'women-only meetup']) {
    assert.equal(applyGuards(base({ genderFocus: 'women', eligibility: 'restricted' }), src).insight.genderFocus, 'women', src);
  }
  const r = applyGuards(base({ genderFocus: 'men' }), 'BASKET PUTRA 3x3 dan Ganda Campuran');
  assert.equal(r.insight.genderFocus, 'all');
});

test('a women-only cue also satisfies the restricted guard (gender restriction is a restriction)', () => {
  const r = applyGuards(base({ eligibility: 'restricted', genderFocus: 'women' }), 'Lari khusus perempuan');
  assert.equal(r.insight.eligibility, 'restricted');
});

test('a verified gender restriction forces eligibility to restricted (model said open_to_public)', () => {
  const r = applyGuards(base({ genderFocus: 'women', eligibility: 'open_to_public' }), 'Lari khusus perempuan! Semua usia.');
  assert.equal(r.insight.eligibility, 'restricted');
  assert.match(r.actions.join('\n'), /verified gender restriction/);
});

test('an UNverified gender restriction is reset to all first, and does not force restricted', () => {
  const r = applyGuards(base({ genderFocus: 'women', eligibility: 'open_to_public' }), 'Basket putra dan ganda campuran');
  assert.equal(r.insight.genderFocus, 'all');
  assert.equal(r.insight.eligibility, 'open_to_public');
});

test('does not mutate its input', () => {
  const input = base({ ageMax: 99, evidence: ['nothing'] });
  const copy = JSON.stringify(input);
  applyGuards(input, 'src');
  assert.equal(JSON.stringify(input), copy);
});
