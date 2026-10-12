import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compareCalendarSchedules,
  layoutCalendarBands,
  navigateCalendarGrid,
  type CalendarLayoutItem,
  type CalendarNavItem,
} from './calendar-layout.js';

const s = (id: string, start: string, end?: string | null, time?: string | null) => ({
  id,
  eventStartDate: start,
  eventEndDate: end,
  eventStartTime: time,
});

describe('compareCalendarSchedules', () => {
  it('orders by start date, then end date, then time (untimed last), then id', () => {
    const rows = [
      s('d', '2026-10-06', '2026-10-06', null),
      s('c', '2026-10-06', '2026-10-06', '09:00'),
      s('b', '2026-10-06', '2026-10-08', '08:00'),
      s('a', '2026-10-05', '2026-10-20'),
      s('e', '2026-10-06', null, '09:00'),
    ];
    const sorted = [...rows].sort(compareCalendarSchedules).map((r) => r.id);
    // a (earlier start); then 2026-10-06: ends 10-06 first (c, e tie on time -> id), untimed d, then b (ends later)
    assert.deepEqual(sorted, ['a', 'c', 'e', 'd', 'b']);
  });

  it('treats a missing end date as the start date', () => {
    assert.equal(compareCalendarSchedules(s('a', '2026-10-06', null), s('b', '2026-10-06', '2026-10-06')) < 0, true);
  });
});

const item = (key: string, startCol: number, spanCount = 1): CalendarLayoutItem => ({ key, startCol, spanCount });

describe('layoutCalendarBands', () => {
  it('puts the first K items of every column in band 0 and the next K in band 1', () => {
    const items = Array.from({ length: 5 }, (_, i) => item(`x${i}`, 0));
    const placed = layoutCalendarBands(items, 2, 7);
    assert.deepEqual(
      items.map((i) => placed.get(i.key)!.band),
      [0, 0, 1, 1, 2]
    );
  });

  it('lets a bar take one slot in every column it covers and spans them in one row', () => {
    const items = [item('bar', 1, 3), item('a', 1), item('b', 2)];
    const placed = layoutCalendarBands(items, 5, 7);
    assert.deepEqual(placed.get('bar'), { band: 0, row: 0 });
    assert.deepEqual(placed.get('a'), { band: 0, row: 1 });
    assert.deepEqual(placed.get('b'), { band: 0, row: 1 });
  });

  it('first-fit packs inside a band (a single can sit beside a bar in free columns)', () => {
    const items = [item('bar', 0, 2), item('c', 4), item('d', 2)];
    const placed = layoutCalendarBands(items, 5, 7);
    assert.equal(placed.get('c')!.row, 0);
    assert.equal(placed.get('d')!.row, 0);
  });

  it('defers a bar to the band of its deepest column rank', () => {
    // column 0 already has 2 items ahead of the bar; K=2 -> the bar's rank in col 0 is 2 -> band 1
    const items = [item('a', 0), item('b', 0), item('bar', 0, 2)];
    const placed = layoutCalendarBands(items, 2, 7);
    assert.equal(placed.get('bar')!.band, 1);
  });

  it('keeps previous placements verbatim and appends late rows below them (no row above)', () => {
    const first = [item('a', 0), item('bar', 0, 2), item('b', 1)];
    const before = layoutCalendarBands(first, 5, 7);
    // a late row sorts BEFORE everything already placed
    const second = [item('late', 0), ...first];
    const after = layoutCalendarBands(second, 5, 7, before);
    first.forEach((i) => assert.deepEqual(after.get(i.key), before.get(i.key)));
    const late = after.get('late')!;
    const lowestInCol0 = Math.max(...first.filter((i) => i.startCol === 0).map((i) => before.get(i.key)!.row));
    assert.equal(late.band >= 0, true);
    assert.equal(late.row > lowestInCol0, true);
  });

  it('moves a late row to a later band when its natural band is already behind placed items', () => {
    const first = Array.from({ length: 4 }, (_, i) => item(`x${i}`, 0)); // K=2 -> bands 0,0,1,1
    const before = layoutCalendarBands(first, 2, 7);
    const after = layoutCalendarBands([item('late', 0), ...first], 2, 7, before);
    assert.equal(after.get('late')!.band >= 1, true);
  });

  it('never leaves two items in the same cell', () => {
    const items = [item('b1', 0, 7), item('b2', 2, 3), item('s1', 0), item('s2', 2), item('s3', 6), item('s4', 3)];
    const placed = layoutCalendarBands(items, 3, 7);
    const seen = new Set<string>();
    items.forEach((i) => {
      const p = placed.get(i.key)!;
      for (let c = i.startCol; c < i.startCol + i.spanCount; c++) {
        const cell = `${p.band}:${p.row}:${c}`;
        assert.equal(seen.has(cell), false, cell);
        seen.add(cell);
      }
    });
  });

  it('re-places a kept item whose span now collides with another kept item', () => {
    const prev = new Map([
      ['a', { band: 0, row: 0 }],
      ['b', { band: 0, row: 0 }],
    ]);
    const placed = layoutCalendarBands([item('a', 0, 2), item('b', 1)], 5, 7, prev);
    assert.deepEqual(placed.get('a'), { band: 0, row: 0 });
    assert.notDeepEqual(placed.get('b'), { band: 0, row: 0 });
  });

  it('ignores previous placements for items that are no longer present', () => {
    const prev = new Map([['gone', { band: 3, row: 4 }]]);
    const placed = layoutCalendarBands([item('a', 0)], 2, 7, prev);
    assert.equal(placed.has('gone'), false);
    assert.deepEqual(placed.get('a'), { band: 0, row: 0 });
  });
});

describe('navigateCalendarGrid', () => {
  const nav: CalendarNavItem[] = [
    { key: 'bar', band: 0, row: 0, startCol: 1, spanCount: 3 },
    { key: 'a', band: 0, row: 1, startCol: 1, spanCount: 1 },
    { key: 'b', band: 0, row: 1, startCol: 2, spanCount: 1 },
    { key: 'c', band: 1, row: 0, startCol: 2, spanCount: 1 },
  ];

  it('walks reading order with left/right', () => {
    assert.equal(navigateCalendarGrid(nav, 'a', 'right'), 'b');
    assert.equal(navigateCalendarGrid(nav, 'b', 'left'), 'a');
    assert.equal(navigateCalendarGrid(nav, 'bar', 'left'), null);
    assert.equal(navigateCalendarGrid(nav, 'c', 'right'), null);
  });

  it('moves within a column across rows and bands with up/down, through bars', () => {
    assert.equal(navigateCalendarGrid(nav, 'bar', 'down'), 'a');
    assert.equal(navigateCalendarGrid(nav, 'b', 'up'), 'bar');
    assert.equal(navigateCalendarGrid(nav, 'b', 'down'), 'c');
    assert.equal(navigateCalendarGrid(nav, 'c', 'up'), 'b');
    assert.equal(navigateCalendarGrid(nav, 'c', 'down'), null);
  });

  it('returns null for an unknown key', () => {
    assert.equal(navigateCalendarGrid(nav, 'zzz', 'up'), null);
  });
});
