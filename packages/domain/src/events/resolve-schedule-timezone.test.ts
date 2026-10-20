import { test } from 'node:test';
import assert from 'node:assert';
import { resolveScheduleTimezone } from './resolve-schedule-timezone.js';

test('returns the timezone of a RESOLVED schedule', () => {
  assert.strictEqual(resolveScheduleTimezone({ timezone: 'Asia/Jakarta', timezoneStatus: 'RESOLVED' }), 'Asia/Jakarta');
});

test('trims surrounding whitespace', () => {
  assert.strictEqual(resolveScheduleTimezone({ timezone: '  Asia/Jakarta ', timezoneStatus: 'RESOLVED' }), 'Asia/Jakarta');
});

test('ignores a timezone that still needs clarification (it is a guess)', () => {
  assert.strictEqual(resolveScheduleTimezone({ timezone: 'Europe/Paris', timezoneStatus: 'NEEDS_CLARIFICATION' }), undefined);
});

test('ignores a timezone with no status, or a null status', () => {
  assert.strictEqual(resolveScheduleTimezone({ timezone: 'Asia/Jakarta' }), undefined);
  assert.strictEqual(resolveScheduleTimezone({ timezone: 'Asia/Jakarta', timezoneStatus: null }), undefined);
});

test('ignores a missing, null or blank timezone even when RESOLVED', () => {
  assert.strictEqual(resolveScheduleTimezone({ timezoneStatus: 'RESOLVED' }), undefined);
  assert.strictEqual(resolveScheduleTimezone({ timezone: null, timezoneStatus: 'RESOLVED' }), undefined);
  assert.strictEqual(resolveScheduleTimezone({ timezone: '   ', timezoneStatus: 'RESOLVED' }), undefined);
});

test('drops a RESOLVED value Intl rejects, so it can never reach a formatter', () => {
  assert.strictEqual(resolveScheduleTimezone({ timezone: 'Not/A_Zone', timezoneStatus: 'RESOLVED' }), undefined);
});

test('a missing schedule resolves to undefined', () => {
  assert.strictEqual(resolveScheduleTimezone(null), undefined);
  assert.strictEqual(resolveScheduleTimezone(undefined), undefined);
});
