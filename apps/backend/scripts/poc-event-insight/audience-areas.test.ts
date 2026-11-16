import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guardAudienceAreas, hasNationwideWording, scoreAreas, textMentions, validateAudienceAreas, type AreaLabel, type AudienceAreas } from './audience-areas.js';

const out = (over: Partial<AudienceAreas> = {}): AudienceAreas => ({ geoScope: 'city', areas: [], evidence: [], ...over });
const label = (over: Partial<AreaLabel> = {}): AreaLabel => ({ geoScope: ['city'], expect: [{ aliases: ['bantul'], basis: ['stated'] }], ...over });
const SRC = 'Hanya untuk guru di Kabupaten Bantul. Bertempat di Hotel Mercure, Kota Yogyakarta.';

test('a faithful extraction passes', () => {
  const s = scoreAreas(out({ areas: [{ name: 'Kabupaten Bantul', level: 'regency', basis: 'stated' }] }), label(), SRC);
  assert.equal(s.pass, true, s.detail.join('; '));
});

test('basis matters: the right place with the wrong basis does not satisfy a "stated" expectation', () => {
  const s = scoreAreas(out({ areas: [{ name: 'Bantul', level: 'regency', basis: 'venue' }] }), label(), SRC);
  assert.equal(s.pass, false);
  assert.equal(s.expectationsMet, 0);
});

test('the discussion\'s core failure: a venue-derived area on a nationwide event is flagged', () => {
  const national = label({ geoScope: ['national'], expect: [], forbid: ['yogyakarta'] });
  const bad = scoreAreas(out({ geoScope: 'national', areas: [{ name: 'Yogyakarta', level: 'city', basis: 'venue' }] }), national, 'Terbuka untuk seluruh Indonesia. Di UGM, Yogyakarta.');
  assert.equal(bad.venueAreaOnNationwide, true);
  assert.deepEqual(bad.forbiddenHit, ['yogyakarta']);
  assert.equal(bad.pass, false);
  assert.equal(scoreAreas(out({ geoScope: 'national' }), national, 'x').pass, true, 'no areas at all is right for a nationwide event');
  assert.equal(scoreAreas(out({ geoScope: 'international', areas: [{ name: 'Asia', level: 'continent', basis: 'stated' }] }), label({ geoScope: ['international'], expect: [{ aliases: ['asia'], basis: ['stated'] }] }), 'delegates from across Asia').pass, true);
});

test('venue areas next to a stated audience area are flagged (stated wins outright)', () => {
  const s = scoreAreas(out({ areas: [{ name: 'Bantul', level: 'regency', basis: 'stated' }, { name: 'Yogyakarta', level: 'city', basis: 'venue' }] }), label(), SRC);
  assert.equal(s.venueWithStated, true);
  assert.equal(s.pass, false);
});

test('forbidden areas are caught in any basis, including a city leaked from the account name', () => {
  const l = label({ geoScope: ['unspecified'], expect: [], noAreas: true, forbid: ['yogyakarta'] });
  const s = scoreAreas(out({ geoScope: 'unspecified', areas: [{ name: 'Jogja', level: 'city', basis: 'venue' }] }), l, 'LOMBA FOTOGRAFI. Pendaftaran via link di bio.');
  assert.deepEqual(s.forbiddenHit, ['yogyakarta']);
  assert.equal(s.pass, false);
  assert.equal(scoreAreas(out({ geoScope: 'unspecified' }), l, 'LOMBA FOTOGRAFI').pass, true);
});

test('a "stated" area whose place is not in the post is an invented audience', () => {
  const s = scoreAreas(out({ areas: [{ name: 'Bantul', level: 'regency', basis: 'stated' }, { name: 'Magelang', level: 'city', basis: 'stated' }] }), label(), SRC);
  assert.deepEqual(s.ungroundedStated, ['Magelang']);
  assert.equal(s.pass, false);
});

test('textMentions: matches the name, an alias of the same known area, or a distinctive token — and nothing else', () => {
  assert.equal(textMentions('Khusus mahasiswa se-DIY', 'Daerah Istimewa Yogyakarta'), true, 'DIY and Yogyakarta are the same known area');
  assert.equal(textMentions('Untuk warga Jabodetabek', 'Jakarta'), true);
  assert.equal(textMentions('Untuk warga Surabaya', 'Sidoarjo'), false);
  assert.equal(textMentions('Di Kota Yogyakarta', 'Bantul'), false);
});

test('textMentions: a shared generic word ("Kabupaten") does not make a different place count as mentioned', () => {
  assert.equal(textMentions('Hanya untuk guru di Kabupaten Bantul', 'Kabupaten Magelang'), false);
  assert.equal(textMentions('Hanya untuk guru di Kabupaten Bantul', 'Kabupaten Bantul'), true);
  assert.equal(textMentions('Untuk warga Kota Surabaya', 'Kota Malang'), false);
});

test('scope is checked against the accept set', () => {
  const s = scoreAreas(out({ geoScope: 'national', areas: [{ name: 'Bantul', level: 'regency', basis: 'stated' }] }), label(), SRC);
  assert.equal(s.scope, false);
});

test('validateAudienceAreas rejects unknown scopes, levels and bases and nameless areas', () => {
  assert.equal(validateAudienceAreas(out({ areas: [{ name: 'X', level: 'city', basis: 'stated' }] })).ok, true);
  assert.equal(validateAudienceAreas({ geoScope: 'galaxy', areas: [], evidence: [] }).ok, false);
  assert.equal(validateAudienceAreas({ geoScope: 'city', areas: [{ name: 'X', level: 'planet', basis: 'stated' }], evidence: [] }).ok, false);
  assert.equal(validateAudienceAreas({ geoScope: 'city', areas: [{ name: 'X', level: 'city', basis: 'guess' }], evidence: [] }).ok, false);
  assert.equal(validateAudienceAreas({ geoScope: 'city', areas: [{ name: ' ', level: 'city', basis: 'stated' }], evidence: [] }).ok, false);
  assert.equal(validateAudienceAreas(null).ok, false);
});

test('guard: "national" without nationwide wording becomes unspecified (it would otherwise block every location fallback)', () => {
  const g = guardAudienceAreas(out({ geoScope: 'national' }), 'INFO LOMBA MENULIS CERPEN. Tema bebas. Daftar lewat link di bio.');
  assert.equal(g.out.geoScope, 'unspecified');
  assert.equal(g.actions.length, 1);
});

test('guard: nationwide wording keeps "national" (seluruh Indonesia, tingkat nasional, nationwide, se-Indonesia)', () => {
  for (const src of ['Terbuka untuk seluruh Indonesia', 'KEJUARAAN TINGKAT NASIONAL', 'open nationwide', 'lomba se-Indonesia', 'Lomba se Indonesia', 'peserta dari berbagai kota']) {
    assert.equal(hasNationwideWording(src), true, src);
    assert.equal(guardAudienceAreas(out({ geoScope: 'national' }), src).out.geoScope, 'national', src);
  }
});

test('guard: a national-sounding VENUE name is not nationwide wording', () => {
  assert.equal(hasNationwideWording('Pameran di Galeri Nasional Indonesia, Jakarta'), false);
  assert.equal(hasNationwideWording('Pameran di Galeri Nasional Indonesia, Jakarta. Terbuka untuk seluruh Indonesia'), true);
  assert.equal(guardAudienceAreas(out({ geoScope: 'national' }), 'Pameran di Museum Nasional, gratis').out.geoScope, 'unspecified');
});

test('guard: drops an ungrounded stated area, and venue areas next to a stated area or on a nationwide/online event', () => {
  const g1 = guardAudienceAreas(out({ areas: [{ name: 'Surabaya', level: 'city', basis: 'stated' }] }), 'Khusus warga Bantul');
  assert.deepEqual(g1.out.areas, []);
  const g2 = guardAudienceAreas(out({ areas: [{ name: 'Bantul', level: 'regency', basis: 'stated' }, { name: 'Yogyakarta', level: 'city', basis: 'venue' }] }), SRC);
  assert.deepEqual(g2.out.areas.map((a) => a.name), ['Bantul']);
  const g3 = guardAudienceAreas(out({ geoScope: 'international', areas: [{ name: 'Yogyakarta', level: 'city', basis: 'venue' }] }), 'delegates from across Asia, Yogyakarta');
  assert.deepEqual(g3.out.areas, []);
  const g4 = guardAudienceAreas(out({ geoScope: 'online', areas: [{ name: 'Yogyakarta', level: 'city', basis: 'venue' }] }), 'Zoom, Yogyakarta');
  assert.deepEqual(g4.out.areas, []);
});

test('guard: leaves a correct extraction untouched and does not mutate its input', () => {
  const input = out({ areas: [{ name: 'Kabupaten Bantul', level: 'regency', basis: 'stated' }], evidence: ['guru di Kabupaten Bantul'] });
  const before = JSON.stringify(input);
  const g = guardAudienceAreas(input, SRC);
  assert.deepEqual(g.out, input);
  assert.deepEqual(g.actions, []);
  assert.equal(JSON.stringify(input), before);
});
