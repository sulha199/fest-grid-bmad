import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideCovers } from './slide-cover.mjs';

const names = ['A', 'B', 'C'];
test('a dedicated slide is chosen; the cover that shows all events is not', () => {
  const r = decideCovers([{ slide: 1, events: ['A', 'B', 'C'] }, { slide: 2, events: ['A'] }, { slide: 3, events: ['B'] }], names);
  assert.deepEqual(r.map((x) => x.slide), [2, 3, null]);
});
test('ties go to the lowest slide number', () => {
  const r = decideCovers([{ slide: 4, events: ['A'] }, { slide: 2, events: ['A'] }], ['A']);
  assert.equal(r[0].slide, 2);
});
test('slides with no event are never chosen; unknown event names are ignored', () => {
  const r = decideCovers([{ slide: 1, events: [] }, { slide: 2, events: ['Z'] }], ['A']);
  assert.equal(r[0].slide, null);
});
test('a shared slide is refused by default and accepted when the limit is raised', () => {
  const s = [{ slide: 2, events: ['A', 'B'] }];
  assert.equal(decideCovers(s, ['A', 'B'])[0].slide, null);
  assert.equal(decideCovers(s, ['A', 'B'], { maxEventsOnSlide: 2 })[0].slide, 2);
});
test('bad slide numbers are skipped; duplicate rows for one slide are merged', () => {
  const r = decideCovers([{ slide: 0, events: ['A'] }, { slide: 'x', events: ['A'] }, { slide: 3, events: ['A'] }, { slide: 3, events: ['A'] }], ['A']);
  assert.equal(r[0].slide, 3);
  assert.equal(r[0].eventsOnSlide, 1);
});
