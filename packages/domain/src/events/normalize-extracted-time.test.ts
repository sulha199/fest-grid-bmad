import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeExtractedTime, listDroppedScheduleTimes } from './normalize-extracted-time.js';

test('the observed prod strings', () => {
  assert.strictEqual(normalizeExtractedTime('20.00:00'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20.10:00'), '20:10:00');
});

test('valid values keep their meaning', () => {
  assert.strictEqual(normalizeExtractedTime('20:00:00'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('8:30'), '08:30:00');
  assert.strictEqual(normalizeExtractedTime('00:00:00'), '00:00:00');
  assert.strictEqual(normalizeExtractedTime('23:59:59'), '23:59:59');
});

test('dot separators, whole or mixed', () => {
  assert.strictEqual(normalizeExtractedTime('20.00'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('8.05'), '08:05:00');
  assert.strictEqual(normalizeExtractedTime('20.10.30'), '20:10:30');
  assert.strictEqual(normalizeExtractedTime('20:10.30'), '20:10:30');
});

test('values Postgres time accepts today keep inserting: fraction, zone suffix, AM/PM', () => {
  assert.strictEqual(normalizeExtractedTime('20:00:00.000'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00:00.5'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00:00Z'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00:00+07:00'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00:00+07'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00:00 +0700'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00:00-07'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00+07'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('20:00 z'), '20:00:00');
  assert.strictEqual(normalizeExtractedTime('8:30 PM'), '20:30:00');
  assert.strictEqual(normalizeExtractedTime('8:30pm'), '20:30:00');
  assert.strictEqual(normalizeExtractedTime('8.30 AM'), '08:30:00');
  assert.strictEqual(normalizeExtractedTime('12:00 AM'), '00:00:00');
  assert.strictEqual(normalizeExtractedTime('12:15 PM'), '12:15:00');
  assert.strictEqual(normalizeExtractedTime('11:59:59 PM'), '23:59:59');
  assert.strictEqual(normalizeExtractedTime('7.30 PM WIB'), '19:30:00');
});

test('whitespace and a trailing Indonesian zone label are stripped', () => {
  assert.strictEqual(normalizeExtractedTime('  19.30  '), '19:30:00');
  assert.strictEqual(normalizeExtractedTime('19.30 WIB'), '19:30:00');
  assert.strictEqual(normalizeExtractedTime('19:30WITA'), '19:30:00');
  assert.strictEqual(normalizeExtractedTime('19.30 wit'), '19:30:00');
});

test('24:00 stays valid as Postgres accepts it today; nothing later does', () => {
  assert.strictEqual(normalizeExtractedTime('24:00'), '24:00:00');
  assert.strictEqual(normalizeExtractedTime('24:00:00'), '24:00:00');
  assert.strictEqual(normalizeExtractedTime('24:01'), null);
  assert.strictEqual(normalizeExtractedTime('24:00:01'), null);
  assert.strictEqual(normalizeExtractedTime('25:00'), null);
});

test('out-of-range parts are null', () => {
  assert.strictEqual(normalizeExtractedTime('20:60'), null);
  assert.strictEqual(normalizeExtractedTime('20:00:60'), null);
  assert.strictEqual(normalizeExtractedTime('99.99'), null);
});

test('ranges, free text and malformed values are null, never an exception', () => {
  for (const bad of ['20:00 - 22:00', '20.00-22.00', 'selesai', 'TBA', '', '   ', '20', '2000', '20:0', '20:00 WIBB', 'WIB', '-1:00', '20:00-22:00', '10:00-11:00', '20:00 - 22:00 WIB', '20:00:00.1234567', '20:00 PM', '0:30 AM', '13:00 PM', '20:00+16', '20:00+07:60', '20:00:00-99']) {
    assert.strictEqual(normalizeExtractedTime(bad), null, bad);
  }
});

test('null, undefined and non-strings are null', () => {
  assert.strictEqual(normalizeExtractedTime(null), null);
  assert.strictEqual(normalizeExtractedTime(undefined), null);
  assert.strictEqual(normalizeExtractedTime(2000 as unknown as string), null);
});

test('listDroppedScheduleTimes reports only non-empty values that become null', () => {
  assert.deepStrictEqual(listDroppedScheduleTimes(undefined), []);
  assert.deepStrictEqual(listDroppedScheduleTimes(null), []);
  assert.deepStrictEqual(
    listDroppedScheduleTimes([
      { eventStartTime: '20.00:00', eventEndTime: null },
      { eventStartTime: 'selesai', eventEndTime: '' },
      { eventStartTime: undefined, eventEndTime: '20:00 - 22:00' },
    ]),
    [
      { scheduleIndex: 1, field: 'eventStartTime', value: 'selesai' },
      { scheduleIndex: 2, field: 'eventEndTime', value: '20:00 - 22:00' },
    ]
  );
});
