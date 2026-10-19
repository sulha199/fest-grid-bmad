import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeOvernightEndDate } from './normalize-overnight-end-date.js';

test('overnight with no end date -> next calendar day', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', null, '02:00:00'), '2026-10-20');
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', undefined, '02:00:00'), '2026-10-20');
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', '', '02:00:00'), '2026-10-20');
});

test('overnight with end date equal to start date -> next calendar day', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', '2026-10-19', '02:00:00'), '2026-10-20');
});

test('rolls over month, year and leap-day boundaries', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-31', '22:00:00', null, '01:00:00'), '2026-11-01');
  assert.strictEqual(normalizeOvernightEndDate('2026-12-31', '22:00:00', null, '01:00:00'), '2027-01-01');
  assert.strictEqual(normalizeOvernightEndDate('2028-02-28', '22:00:00', null, '01:00:00'), '2028-02-29');
  assert.strictEqual(normalizeOvernightEndDate('2028-02-29', '22:00:00', null, '01:00:00'), '2028-03-01');
});

test('accepts HH:MM as well as HH:MM:SS and compares them numerically, not as strings', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00', null, '02:00:00'), '2026-10-20');
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '9:30', null, '09:00'), '2026-10-20');
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '09:00', null, '9:30'), null);
});

test('midnight end time counts as overnight (00:00 is earlier than the start)', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '20:00:00', null, '00:00:00'), '2026-10-20');
});

test('same-day event is left alone', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '19:00:00', null, '22:00:00'), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '19:00:00', '2026-10-19', '22:00:00'), '2026-10-19');
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '19:00:00', undefined, '22:00:00'), undefined);
});

test('equal start and end time is bad data, not a 24-hour event: left alone', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '19:00:00', null, '19:00:00'), null);
});

test('an end date after the start date is never touched, whatever the times', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', '2026-10-21', '02:00:00'), '2026-10-21');
});

test('an end date before the start date is also left for validation to deal with', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', '2026-10-18', '02:00:00'), '2026-10-18');
});

test('a missing start or end time leaves the end date alone', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', null, null, '02:00:00'), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', undefined, undefined, '02:00:00'), undefined);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', null, null), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', null, undefined), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '', null, '02:00:00'), null);
});

test('unparseable times leave the end date alone', () => {
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', 'late', null, '02:00:00'), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:00', null, 'after midnight'), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '24:00:00', null, '02:00:00'), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:60:00', null, '02:00:00'), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-10-19', '21:00:60', null, '02:00:00'), null);
});

test('an unparseable or impossible start date leaves the end date alone', () => {
  assert.strictEqual(normalizeOvernightEndDate('Oct 19', '21:00:00', null, '02:00:00'), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-02-31', '21:00:00', null, '02:00:00'), null);
  assert.strictEqual(normalizeOvernightEndDate('2026-13-01', '21:00:00', null, '02:00:00'), null);
});
