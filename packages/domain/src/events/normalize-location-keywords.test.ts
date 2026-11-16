import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_LOCATION_KEYWORDS, MAX_LOCATION_KEYWORD_LENGTH, normalizeCountryCode, normalizeLocationKeywords, normalizeLocationText, stripMalformedLocationKeywords } from './normalize-location-keywords.js';

test('normalizeLocationKeywords keeps a clean list as it is, most specific first', () => {
  assert.deepEqual(normalizeLocationKeywords(['Pasar Porosjayan', 'Gamping', 'Sleman']), ['Pasar Porosjayan', 'Gamping', 'Sleman']);
});

test('normalizeLocationKeywords trims, collapses inner whitespace and drops empty entries', () => {
  assert.deepEqual(normalizeLocationKeywords(['  Pasar   Porosjayan ', '', '   ', 'Sleman']), ['Pasar Porosjayan', 'Sleman']);
});

test('normalizeLocationKeywords removes case-insensitive duplicates keeping the first spelling and position', () => {
  assert.deepEqual(normalizeLocationKeywords(['Sleman', 'Gamping', 'sleman', 'GAMPING']), ['Sleman', 'Gamping']);
});

test('normalizeLocationKeywords drops generic words and summaries of several places', () => {
  assert.deepEqual(normalizeLocationKeywords(['Berbagai lokasi', 'Sleman']), ['Sleman']);
  assert.deepEqual(normalizeLocationKeywords(['Berbagai lokasi di Kabupaten Sleman', 'Sleman']), ['Sleman']);
  assert.deepEqual(normalizeLocationKeywords(['Various locations', 'Multiple venues in Jogja', 'Beberapa tempat', 'Yogyakarta']), ['Yogyakarta']);
  assert.deepEqual(normalizeLocationKeywords(['TBA', 'tbc', 'Online', 'Lokasi', '-', 'Sleman']), ['Sleman']);
});

test('normalizeLocationKeywords does not drop a real place that merely contains a generic word', () => {
  assert.deepEqual(normalizeLocationKeywords(['Pasar Tempat Wisata Kaliurang', 'Lokasi Wisata Gunung Merapi']), [
    'Pasar Tempat Wisata Kaliurang',
    'Lokasi Wisata Gunung Merapi',
  ]);
});

test('normalizeLocationKeywords keeps at most the first five and drops over-long entries', () => {
  const nine = ['A1', 'B2', 'C3', 'D4', 'E5', 'F6', 'G7', 'H8', 'I9'];
  assert.equal(MAX_LOCATION_KEYWORDS, 5);
  assert.deepEqual(normalizeLocationKeywords(nine), ['A1', 'B2', 'C3', 'D4', 'E5']);

  const tooLong = 'x'.repeat(MAX_LOCATION_KEYWORD_LENGTH + 1);
  const atLimit = 'y'.repeat(MAX_LOCATION_KEYWORD_LENGTH);
  assert.deepEqual(normalizeLocationKeywords([tooLong, atLimit, 'Sleman']), [atLimit, 'Sleman']);
});

test('normalizeLocationKeywords returns undefined, never an empty array, when nothing is left', () => {
  assert.equal(normalizeLocationKeywords(undefined), undefined);
  assert.equal(normalizeLocationKeywords(null), undefined);
  assert.equal(normalizeLocationKeywords([]), undefined);
  assert.equal(normalizeLocationKeywords(['', 'TBA', 'Berbagai lokasi']), undefined);
  assert.equal(normalizeLocationKeywords('Sleman'), undefined);
  assert.equal(normalizeLocationKeywords({ 0: 'Sleman' }), undefined);
});

test('normalizeLocationKeywords skips non-string items instead of throwing', () => {
  assert.deepEqual(normalizeLocationKeywords(['Sleman', 42, null, undefined, { a: 1 }, 'Gamping']), ['Sleman', 'Gamping']);
});

test('normalizeLocationKeywords drops online and see-caption placeholders and zero-width-only entries', () => {
  assert.deepEqual(normalizeLocationKeywords(['Zoom', 'Via Zoom', 'virtual', 'Lokasi TBA', 'see caption', 'Lihat caption', '​﻿', 'Sleman']), ['Sleman']);
});

test('normalizeLocationKeywords de-duplicates two spellings of one accented name and ignores zero-width characters inside', () => {
  const composed = 'Café Merapi';
  const decomposed = 'Café Merapi';
  assert.deepEqual(normalizeLocationKeywords([composed, decomposed, 'Sle​man']), [composed, 'Sleman']);
});

test('normalizeLocationKeywords only drops a summary that opens with a quantity word and a place noun', () => {
  assert.deepEqual(normalizeLocationKeywords(['Beberapa Lokasi di Sleman', 'Berbagai Macam Lokasi', 'Pasar Banyak Tempat Parkir']), ['Berbagai Macam Lokasi', 'Pasar Banyak Tempat Parkir']);
});

test('stripMalformedLocationKeywords filters non-string items and removes a non-array value, on events and schedules, leaving the rest alone', () => {
  const payload: { isEvent: boolean; events: Array<Record<string, unknown> & { schedules: Array<Record<string, unknown>> }> } = {
    isEvent: true,
    events: [
      {
        eventName: 'A',
        locationKeywords: ['Sleman', null, 3],
        schedules: [
          { eventStartDate: '2026-11-01', locationKeywords: 'Gamping' },
          { eventStartDate: '2026-11-02', locationKeywords: ['Gamping', undefined] },
          { eventStartDate: '2026-11-03', locationKeywords: null },
          { eventStartDate: '2026-11-04' },
        ],
      },
      { eventName: 'B', locationKeywords: { 0: 'x' }, schedules: [] },
    ],
  };
  stripMalformedLocationKeywords(payload);
  assert.deepEqual(payload.events[0].locationKeywords, ['Sleman']);
  assert.ok(!('locationKeywords' in payload.events[0].schedules[0]));
  assert.deepEqual(payload.events[0].schedules[1].locationKeywords, ['Gamping']);
  assert.equal(payload.events[0].schedules[2].locationKeywords, null, 'null is left for the validator, which allows it');
  assert.ok(!('locationKeywords' in payload.events[0].schedules[3]));
  assert.ok(!('locationKeywords' in payload.events[1]));
  assert.equal(payload.events[0].eventName, 'A');
});

test('stripMalformedLocationKeywords tolerates any shape of payload without throwing', () => {
  for (const value of [null, undefined, 'x', 3, [], {}, { events: 'no' }, { events: [null, 3, { schedules: 'no' }] }]) {
    assert.doesNotThrow(() => stripMalformedLocationKeywords(value));
  }
});

test('normalizeCountryCode accepts two letters in any case and rejects everything else', () => {
  assert.equal(normalizeCountryCode('id'), 'ID');
  assert.equal(normalizeCountryCode(' Us '), 'US');
  for (const bad of [null, undefined, 3, '', 'I', 'IDN', 'Indonesia', 'U1', '  ', {}, ['ID']]) {
    assert.equal(normalizeCountryCode(bad), undefined);
  }
});

test('normalizeCountryCode reads "UK" as GB and rejects placeholders that are not countries', () => {
  assert.equal(normalizeCountryCode('uk'), 'GB');
  assert.equal(normalizeCountryCode('GB'), 'GB');
  for (const placeholder of ['XX', 'zz', 'UN', 'eu']) {
    assert.equal(normalizeCountryCode(placeholder), undefined);
  }
});

test('normalizeLocationText ignores case, spacing and accent composition', () => {
  assert.equal(normalizeLocationText('  Pasar   Porosjayan '), normalizeLocationText('pasar porosjayan'));
  assert.equal(normalizeLocationText(null), '');
});

test('stripMalformedLocationKeywords removes a non-string locationCountryCode so the strict validator never sees it', () => {
  const payload: { events: Array<Record<string, unknown>> } = {
    events: [
      { eventName: 'A', locationCountryCode: 5, schedules: [{ locationCountryCode: { code: 'ID' } }, { locationCountryCode: 'ID' }, { locationCountryCode: null }] },
    ],
  };
  stripMalformedLocationKeywords(payload);
  const event = payload.events[0] as { locationCountryCode?: unknown; schedules: Array<{ locationCountryCode?: unknown }> };
  assert.ok(!('locationCountryCode' in event));
  assert.ok(!('locationCountryCode' in event.schedules[0]));
  assert.equal(event.schedules[1].locationCountryCode, 'ID');
  assert.equal(event.schedules[2].locationCountryCode, null);
});
