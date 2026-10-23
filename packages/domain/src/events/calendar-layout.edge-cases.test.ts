import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compareCalendarSchedules, navigateCalendarGrid, type CalendarNavItem } from './calendar-layout.js';

const row = (id: string, start: string, end?: string | null, time?: string | null) => ({
  id,
  eventStartDate: start,
  eventEndDate: end,
  eventStartTime: time,
});

describe('compareCalendarSchedules tie-breaks', () => {
  it('orders two same-start schedules by their own end dates, earlier finish first', () => {
    assert.ok(compareCalendarSchedules(row('a', '2026-10-06', '2026-10-07'), row('b', '2026-10-06', '2026-10-09')) < 0);
    assert.ok(compareCalendarSchedules(row('a', '2026-10-06', '2026-10-09'), row('b', '2026-10-06', '2026-10-07')) > 0);
  });

  it('treats a schedule with no end date as ending on its start date when the other has one', () => {
    assert.ok(compareCalendarSchedules(row('a', '2026-10-06'), row('b', '2026-10-06', '2026-10-09')) < 0);
    assert.ok(compareCalendarSchedules(row('a', '2026-10-06', '2026-10-09'), row('b', '2026-10-06')) > 0);
  });

  it('orders same-day schedules by start time, with an untimed one last', () => {
    assert.ok(compareCalendarSchedules(row('a', '2026-10-06', null, '08:00'), row('b', '2026-10-06', null, '09:00')) < 0);
    assert.ok(compareCalendarSchedules(row('a', '2026-10-06', null, '08:00'), row('b', '2026-10-06', null, null)) < 0);
    assert.ok(compareCalendarSchedules(row('a', '2026-10-06', null, null), row('b', '2026-10-06', null, '08:00')) > 0);
  });

  it('falls back to the id for identical schedules', () => {
    assert.ok(compareCalendarSchedules(row('a', '2026-10-06'), row('b', '2026-10-06')) < 0);
  });
});

describe('navigateCalendarGrid', () => {
  const items: CalendarNavItem[] = [
    { key: 'left', band: 0, row: 0, startCol: 0, spanCount: 1 },
    { key: 'right', band: 0, row: 0, startCol: 1, spanCount: 1 },
  ];

  it('returns null when nothing above or below covers the current column', () => {
    assert.equal(navigateCalendarGrid(items, 'left', 'up'), null);
    assert.equal(navigateCalendarGrid(items, 'left', 'down'), null);
  });

  it('returns null for an unknown key and at either end of reading order', () => {
    assert.equal(navigateCalendarGrid(items, 'nope', 'right'), null);
    assert.equal(navigateCalendarGrid(items, 'left', 'left'), null);
    assert.equal(navigateCalendarGrid(items, 'right', 'right'), null);
  });
});
