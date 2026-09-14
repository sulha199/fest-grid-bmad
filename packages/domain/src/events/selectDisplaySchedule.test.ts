import test from 'node:test';
import * as assert from 'node:assert';
import { selectDisplaySchedule, SelectableSchedule } from './selectDisplaySchedule.js';

// Fixed "now": 2026-09-14 UTC (mirrors the UTC-day math used in the app).
const NOW = new Date(Date.UTC(2026, 8, 14, 12, 0, 0));

function sched(partial: Partial<SelectableSchedule> & Pick<SelectableSchedule, 'eventStartDate'>): SelectableSchedule {
  return { isMainSchedule: false, ...partial };
}

test('selectDisplaySchedule', async (t) => {
  await t.test('returns null for empty/missing schedules', () => {
    assert.strictEqual(selectDisplaySchedule([], NOW), null);
    assert.strictEqual(selectDisplaySchedule(null, NOW), null);
    assert.strictEqual(selectDisplaySchedule(undefined, NOW), null);
  });

  await t.test('prefers the next-upcoming schedule over a past main schedule', () => {
    const result = selectDisplaySchedule([
      sched({ isMainSchedule: true, eventStartDate: '2026-08-16', eventEndDate: '2026-08-16', ticketPrice: 50 }),
      sched({ isMainSchedule: false, eventStartDate: '2026-09-20', eventEndDate: '2026-09-22', ticketPrice: 40 }),
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.eventStartDate, '2026-09-20');
    assert.strictEqual(result.isMainSchedule, false);
    assert.strictEqual(result.ticketPrice, 40);
  });

  await t.test('among multiple upcoming schedules picks the earliest start date', () => {
    const result = selectDisplaySchedule([
      sched({ eventStartDate: '2026-10-01', eventEndDate: '2026-10-03' }),
      sched({ eventStartDate: '2026-09-30', eventEndDate: '2026-10-02' }),
      sched({ eventStartDate: '2026-10-15', eventEndDate: '2026-10-16' }),
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.eventStartDate, '2026-09-30');
  });

  await t.test('breaks a same-date upcoming tie by the earlier start time', () => {
    const result = selectDisplaySchedule([
      sched({ eventStartDate: '2026-09-20', eventStartTime: '18:00:00', eventEndDate: '2026-09-20' }),
      sched({ eventStartDate: '2026-09-20', eventStartTime: '09:00:00', eventEndDate: '2026-09-20' }),
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.eventStartTime, '09:00:00');
  });

  await t.test('sorts a schedule with no start time after a same-date one that has one (NULLs last)', () => {
    const result = selectDisplaySchedule([
      sched({ eventStartDate: '2026-09-20', eventEndDate: '2026-09-20' }), // no time
      sched({ eventStartDate: '2026-09-20', eventStartTime: '12:00:00', eventEndDate: '2026-09-20' }),
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.eventStartTime, '12:00:00');
  });

  await t.test('treats a schedule with no end date as upcoming when its start date is today or later', () => {
    const result = selectDisplaySchedule([
      sched({ isMainSchedule: true, eventStartDate: '2026-09-10', eventEndDate: null }),
      sched({ eventStartDate: '2026-09-14' }), // start == today, no end date
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.eventStartDate, '2026-09-14');
  });

  await t.test('exactly-on-today end date counts as upcoming (boundary)', () => {
    const result = selectDisplaySchedule([
      sched({ isMainSchedule: true, eventStartDate: '2026-08-16', eventEndDate: '2026-08-18' }),
      sched({ eventStartDate: '2026-09-14', eventEndDate: '2026-09-14' }),
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.eventStartDate, '2026-09-14');
  });

  await t.test('falls back to the main schedule when nothing is upcoming', () => {
    const result = selectDisplaySchedule([
      sched({ isMainSchedule: false, eventStartDate: '2026-09-01', eventEndDate: '2026-09-05' }),
      sched({ isMainSchedule: true, eventStartDate: '2026-08-16', eventEndDate: '2026-08-20' }),
      sched({ isMainSchedule: false, eventStartDate: '2026-08-10', eventEndDate: '2026-08-12' }),
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.isMainSchedule, true);
    assert.strictEqual(result.eventStartDate, '2026-08-16');
  });

  await t.test('falls back to the earliest-start schedule when nothing is upcoming and no main schedule exists', () => {
    const result = selectDisplaySchedule([
      sched({ eventStartDate: '2026-09-01', eventEndDate: '2026-09-05' }),
      sched({ eventStartDate: '2026-08-10', eventEndDate: '2026-08-12' }),
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.eventStartDate, '2026-08-10');
  });

  await t.test('returns the single past schedule as a last-resort fallback', () => {
    const result = selectDisplaySchedule([
      sched({ isMainSchedule: true, eventStartDate: '2026-08-01', eventEndDate: '2026-08-02' }),
    ], NOW);
    assert.ok(result);
    assert.strictEqual(result.eventStartDate, '2026-08-01');
  });
});
