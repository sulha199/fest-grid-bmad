import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { FilterLeaf, FilterNode } from '@festgrid/domain/ai-event-filters';
import { dateGrade, isCloseMatch, ladderGrade, matchScore, proximityGrade, type Grade } from './partial-match.js';

// "free music in Sleman this week"
const cat: FilterNode = { field: 'category', value: ['MUSIC'] as never };
const area: FilterNode = { field: 'locationAdminArea', value: 'Sleman' };
const free: FilterNode = { field: 'isFree', value: true };
const date: FilterNode = { field: 'dateRange', value: { anchor: 'TODAY', offsetAmount: 0, offsetUnit: 'DAY' } as never };
const tree: FilterNode = { op: 'AND', children: [cat, area, free, date] };
const grader = (over: Partial<Record<FilterLeaf['field'], Grade>> = {}) => (l: FilterLeaf): Grade => (l.field in over ? (over[l.field] as Grade) : 1);

test('an exact match scores 1 and is not a "close" match', () => {
  const r = matchScore(tree, grader());
  assert.equal(r.score, 1); assert.deepEqual(r.unmet, []); assert.equal(isCloseMatch(r), false);
});

test('one binary miss lowers the score by that leaf\'s share of the weight (isFree = 1 of 9) and names the leaf', () => {
  const r = matchScore(tree, grader({ isFree: 0 }));
  assert.ok(Math.abs(r.score - 8 / 9) < 1e-9);
  assert.deepEqual(r.unmet.map((l) => l.field), ['isFree']);
  assert.equal(isCloseMatch(r), true);
});

test('a GRADED miss gives partial credit: the neighbouring area (0.6) beats a missed category', () => {
  const sibling = matchScore(tree, grader({ locationAdminArea: ladderGrade('sibling') }));
  const wrongCategory = matchScore(tree, grader({ category: 0 }));
  assert.ok(Math.abs(sibling.score - (2 + 1.8 + 1 + 3) / 9) < 1e-9);
  assert.ok(sibling.score > wrongCategory.score, 'a near area ranks above a wrong category (weights 3 x 0.6 vs 2 x 0)');
});

test('two misses are not a close match under the default maxMisses of 1, but are under 2', () => {
  const r = matchScore(tree, grader({ isFree: 0, category: 0 }));
  assert.equal(r.unmet.length, 2);
  assert.equal(isCloseMatch(r), false);
  assert.equal(isCloseMatch(r, { maxMisses: 2, minScore: 0.5 }), true);
});

test('a HARD leaf (an account, a keyword) is never relaxed: a mismatch removes the event', () => {
  const t: FilterNode = { op: 'AND', children: [cat, { field: 'accountId', value: 'acct-1' }] };
  const r = matchScore(t, (l) => (l.field === 'accountId' ? 0 : 1));
  assert.equal(r.removed, true); assert.equal(r.score, 0); assert.equal(isCloseMatch(r), false);
});

test('NOT is strict: an excluded thing that matches removes the event; one that does not leaves the score untouched', () => {
  const t: FilterNode = { op: 'AND', children: [cat, { op: 'NOT', child: { field: 'type', value: ['WORKSHOP'] as never } }] };
  assert.equal(matchScore(t, (l) => (l.field === 'type' ? 1 : 1)).removed, true, 'it IS a workshop');
  const ok = matchScore(t, (l) => (l.field === 'type' ? 0 : 1));
  assert.equal(ok.removed, false); assert.equal(ok.score, 1);
});

test('NOT keeps events whose data is unknown — the same null semantics the strict filter has today', () => {
  const t: FilterNode = { op: 'AND', children: [cat, { op: 'NOT', child: { field: 'venueType', value: 'Mall' } }] };
  const r = matchScore(t, (l) => (l.field === 'venueType' ? 'unknown' : 1));
  assert.equal(r.removed, false); assert.equal(r.score, 1);
});

test('OR takes the best child, so one satisfied branch is an exact match', () => {
  const t: FilterNode = { op: 'OR', children: [cat, area] };
  assert.equal(matchScore(t, grader({ category: 0 })).score, 1);
  assert.ok(Math.abs(matchScore(t, grader({ category: 0, locationAdminArea: 0.6 })).score - 0.6) < 1e-9);
});

test('UNKNOWN data earns half credit and is reported, so missing data degrades a result instead of erasing it', () => {
  const r = matchScore(tree, grader({ locationAdminArea: 'unknown' }));
  assert.ok(Math.abs(r.score - (2 + 1.5 + 1 + 3) / 9) < 1e-9);
  assert.deepEqual(r.unknown.map((l) => l.field), ['locationAdminArea']);
  assert.equal(isCloseMatch(r), true);
});

test('graders: date distance, location ladder, proximity', () => {
  assert.equal(dateGrade(0), 1); assert.equal(dateGrade(-2), 1);
  assert.ok(Math.abs(dateGrade(1) - 2 / 3) < 1e-9); assert.equal(dateGrade(3), 0); assert.equal(dateGrade(9), 0);
  assert.equal(ladderGrade('same'), 1); assert.equal(ladderGrade('other'), 0);
  assert.equal(proximityGrade(500, 1000), 1); assert.equal(proximityGrade(1500, 1000), 0.5); assert.equal(proximityGrade(2500, 1000), 0);
});

test('ordering: more of the filter satisfied ranks higher; a date two days off costs more than not being free, and two misses cost most', () => {
  const notFree = matchScore(tree, grader({ isFree: 0 })).score;
  const twoDaysLate = matchScore(tree, grader({ dateRange: dateGrade(2) })).score; // 3 x (1 - 1/3) = 2 points lost
  const twoOff = matchScore(tree, grader({ isFree: 0, category: 0 })).score;       // 1 + 2 = 3 points lost
  assert.ok(notFree > twoDaysLate && twoDaysLate > twoOff);
  assert.ok(Math.abs(matchScore(tree, grader({ dateRange: dateGrade(1) })).score - notFree) < 1e-9, 'a date ONE day off costs exactly what a missed "free" costs (1 point) — a tuning fact, not a law');
});
