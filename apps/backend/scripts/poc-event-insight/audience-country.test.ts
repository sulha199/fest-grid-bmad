import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accountCountryOf, captionCues, cueCountry, quoteIsVerbatim, resolveAudienceCountry, resolvePostLanguage, statedClaimHolds,
} from './audience-country.js';

test('a quote must occur verbatim, case and spacing aside', () => {
  assert.equal(quoteIsVerbatim('seluruh  Indonesia', 'Terbuka untuk mahasiswa SELURUH INDONESIA!'), true);
  assert.equal(quoteIsVerbatim('seluruh Malaysia', 'Terbuka untuk mahasiswa seluruh Indonesia'), false);
  assert.equal(quoteIsVerbatim('ab', 'ab cd'), false); // too short to mean anything
});

test('a stated claim needs a verbatim quote that names the country or an international scope', () => {
  const cap = 'Lomba esai tingkat nasional untuk mahasiswa seluruh Indonesia';
  assert.equal(statedClaimHolds({ country: 'id', quote: 'seluruh Indonesia' }, cap), true);
  assert.equal(statedClaimHolds({ country: 'my', quote: 'seluruh Indonesia' }, cap), false, 'the quote names Indonesia, not Malaysia');
  assert.equal(statedClaimHolds({ country: 'id', quote: 'untuk semua orang' }, cap), false, 'not in the caption');
  assert.equal(statedClaimHolds({ country: 'international', quote: 'open to participants worldwide' }, 'Open to participants worldwide'), true);
  assert.equal(statedClaimHolds({ country: 'xx', quote: 'Atlantis' }, 'Atlantis games'), false, 'a country the table does not know cannot be verified');
});

test('strong cues are currency with an amount, a phone code, a time-zone abbreviation; a place name is not a cue', () => {
  assert.deepEqual(captionCues('Tiket Rp 50.000, 19.00 WIB').map((c) => c.country), ['id', 'id']);
  assert.equal(cueCountry('Entry RM25 · call +60 12 345 6789'), 'my');
  assert.equal(cueCountry('Kuala Lumpur this weekend'), undefined, 'a place name is weak');
  assert.equal(cueCountry('Rp 50.000 or RM25'), undefined, 'two countries disagree');
});

test('the account country comes from the account’s own posts and stays undefined when the evidence is weak', () => {
  assert.equal(accountCountryOf('a', ['Tiket Rp 50.000', 'Jam 19.00 WIB']), 'id');
  assert.equal(accountCountryOf('b', ['Entry RM25', 'Call +60 12 345 6789']), 'my');
  assert.equal(accountCountryOf('c', ['Come to the party']), undefined);
});

test('ladder step 1: a verified stated audience wins over every cue', () => {
  const r = resolveAudienceCountry({
    caption: 'Open to all students across Malaysia. Fee RM10. 7pm MYT', postLanguage: 'en', accountCountry: 'id',
    stated: { country: 'my', quote: 'across Malaysia' },
  });
  assert.deepEqual(r, { country: 'my', source: 'stated' });
});

test('ladder step 1 drops a stated audience whose quote is invented, and falls through', () => {
  const r = resolveAudienceCountry({
    caption: 'Konser di Jakarta, tiket Rp 300.000', postLanguage: 'id', accountCountry: 'id',
    stated: { country: 'sg', quote: 'for Singapore fans' },
  });
  assert.equal(r.country, 'id');
  assert.equal(r.source, 'cue');
});

test('ladder step 2: an Indonesian post about an event abroad is for Indonesia (the Denmark Open case)', () => {
  const r = resolveAudienceCountry({
    caption: 'Jadwal final Denmark Open 2026 mulai pukul 17.00 WIB. Semangat!', postLanguage: 'id', eventCountry: 'dk', accountCountry: 'id',
  });
  assert.deepEqual(r, { country: 'id', source: 'cue' });
});

test('ladder step 2: English with no cue falls back on the account, and with no account it is unclear (shared language, no second clue)', () => {
  assert.deepEqual(resolveAudienceCountry({ caption: 'Sunset yoga this Friday', postLanguage: 'en', accountCountry: 'id' }), { country: 'id', source: 'account' });
  assert.deepEqual(resolveAudienceCountry({ caption: 'Sunset yoga this Friday', postLanguage: 'en' }), { country: 'unclear', source: 'none' });
});

test('ladder step 2: the Indonesian/Malay pair is settled by the cue or the account, never by the language alone', () => {
  assert.equal(resolveAudienceCountry({ caption: 'Jom sertai bengkel ini! Penyertaan percuma', postLanguage: 'ms', accountCountry: 'my' }).country, 'my');
  assert.equal(resolveAudienceCountry({ caption: 'Jom sertai bengkel ini! Penyertaan percuma', postLanguage: 'ms' }).country, 'unclear');
});

test('ladder step 3: an online event with no stated audience and no cue is international', () => {
  assert.deepEqual(resolveAudienceCountry({ caption: 'Free webinar on Zoom', postLanguage: 'en', geoScope: 'online' }), { country: 'international', source: 'online' });
});

test('ladder step 4: the event’s place is used only when nothing else helps', () => {
  assert.deepEqual(resolveAudienceCountry({ caption: 'REM Festival tickets', postLanguage: 'en', eventCountry: 'SG' }), { country: 'sg', source: 'place', note: 'event place only' });
});

test('post language: id/ms is settled by a cue or the account, en/mixed/other pass through', () => {
  assert.deepEqual(resolvePostLanguage('id', 'Entry RM25', undefined), { language: 'ms', viaCue: true });
  assert.deepEqual(resolvePostLanguage('ms', 'Tiket Rp 50.000', undefined), { language: 'id', viaCue: true });
  assert.deepEqual(resolvePostLanguage('id', 'tanpa petunjuk', 'id'), { language: 'id', viaCue: false });
  assert.deepEqual(resolvePostLanguage('id', 'tanpa petunjuk', undefined), { language: 'id', viaCue: false });
  assert.deepEqual(resolvePostLanguage('en', 'Entry RM25', 'my'), { language: 'en', viaCue: false });
  assert.deepEqual(resolvePostLanguage('mixed', 'x', 'id'), { language: 'mixed', viaCue: false });
});
