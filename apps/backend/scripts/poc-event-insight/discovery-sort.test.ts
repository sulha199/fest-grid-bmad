import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SORT_PARAMS, freshBoost, rank, seenPenalty, sortDays, windowDays, windowedPage, type SortEvent, type SortParams } from './discovery-sort.js';

const ev = (over: Partial<SortEvent> = {}): SortEvent => ({ id: 'e', tier: 0, daysUntil: 10, publishedAgeDays: 100, seen: false, ...over });

test('freshBoost: bounded to [0, freshMaxDays], decays linearly, and an old post gets nothing', () => {
  assert.equal(freshBoost(0), 7);
  assert.equal(freshBoost(1.5), 3.5);
  assert.equal(freshBoost(3), 0);
  assert.equal(freshBoost(40), 0, 'a backlog of old posts ingested today is not fresh');
  assert.equal(freshBoost(-1), 0, 'a future-dated post gets no boost rather than a bigger one');
  assert.equal(freshBoost(Number.NaN), 0);
  for (let a = 0; a <= 10; a += 0.25) { const b = freshBoost(a); assert.ok(b >= 0 && b <= 7); }
});

test('freshBoost: monotonically non-increasing in age', () => {
  let prev = Infinity;
  for (let a = 0; a <= 6; a += 0.1) { const b = freshBoost(a); assert.ok(b <= prev + 1e-12); prev = b; }
});

test('seenPenalty: applies to a seen event, never to an unseen one, and never to one that starts within the urgent window', () => {
  assert.equal(seenPenalty(ev({ seen: true, daysUntil: 10 })), 14);
  assert.equal(seenPenalty(ev({ seen: false, daysUntil: 10 })), 0);
  assert.equal(seenPenalty(ev({ seen: true, daysUntil: 3 })), 0, 'tomorrow-ish is never buried');
  assert.equal(seenPenalty(ev({ seen: true, daysUntil: 4 })), 14);
  assert.equal(seenPenalty(ev({ seen: true, daysUntil: -2 })), 0, 'an ongoing event is urgent too');
});

test('sortDays: a fresh event moves up to 7 days earlier, a seen one 14 later, and they can offset', () => {
  assert.equal(sortDays(ev({ daysUntil: 20, publishedAgeDays: 0 })), 13);
  assert.equal(sortDays(ev({ daysUntil: 20, seen: true })), 34);
  assert.equal(sortDays(ev({ daysUntil: 20, publishedAgeDays: 0, seen: true })), 27);
});

test('rank: tier first, then sortDays, then id; a fresh far-future event does not jump the tier or the near events', () => {
  const r = rank([
    ev({ id: 'c', tier: 1, daysUntil: 1 }),
    ev({ id: 'b', tier: 0, daysUntil: 30, publishedAgeDays: 0 }), // fresh: 23
    ev({ id: 'a', tier: 0, daysUntil: 5 }),
    ev({ id: 'd', tier: 0, daysUntil: 5 }), // ties with a: id decides
    ev({ id: 'e', tier: 0, daysUntil: 12, seen: true }), // 26
  ]);
  assert.deepEqual(r.map((e) => e.id), ['a', 'd', 'b', 'e', 'c']);
});

test('a scrape cycle changes the list: new, fresh events enter near the top, and an unchanged pool gives the same list', () => {
  const pool = Array.from({ length: 60 }, (_, i) => ev({ id: `old-${String(i).padStart(2, '0')}`, daysUntil: i + 1, publishedAgeDays: 20 }));
  const before = rank(pool).slice(0, 10).map((e) => e.id);
  assert.deepEqual(rank(pool).slice(0, 10).map((e) => e.id), before, 'deterministic');
  const next = [...pool, ev({ id: 'new-1', daysUntil: 12, publishedAgeDays: 0.2 }), ev({ id: 'new-2', daysUntil: 40, publishedAgeDays: 0.2 })];
  const after = rank(next).slice(0, 10).map((e) => e.id);
  assert.ok(after.includes('new-1'), 'a fresh event 12 days out surfaces in the top 10 (sortDays 5.3)');
  assert.ok(!after.includes('new-2'), 'a fresh event 40 days out does not (sortDays 33): freshness is a bounded nudge');
});

// ---- the window rule, checked against the full ranking on random data ----
function mulberry(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function randomEvents(seed: number, n: number): SortEvent[] {
  const r = mulberry(seed);
  return Array.from({ length: n }, (_, i) => ({
    id: `ev-${String(i).padStart(4, '0')}`, tier: Math.floor(r() * 3), daysUntil: Math.floor(r() * 95) - 5,
    publishedAgeDays: r() < 0.3 ? r() * 4 : 5 + r() * 60, seen: r() < 0.12,
  }));
}

test('WINDOW RULE: the windowed page equals the full ranking on 300 random pools, for several offsets (default parameters)', () => {
  assert.equal(windowDays(), 21);
  for (let seed = 1; seed <= 300; seed++) {
    const events = randomEvents(seed, 80 + (seed % 5) * 60);
    for (const offset of [0, 20, 60, 140]) {
      const full = rank(events).slice(offset, offset + 20).map((e) => e.id);
      const win = windowedPage(events, offset, 20).map((e) => e.id);
      assert.deepEqual(win, full, `seed ${seed} offset ${offset}`);
    }
  }
});

test('WINDOW RULE holds for other parameters, and the window really is the sum of the two bounds', () => {
  const params: SortParams[] = [
    { freshMaxDays: 3, freshWindowDays: 2, seenPenaltyDays: 30, urgentDays: 2 },
    { freshMaxDays: 14, freshWindowDays: 7, seenPenaltyDays: 5, urgentDays: 7 },
    { freshMaxDays: 0, freshWindowDays: 3, seenPenaltyDays: 0, urgentDays: 3 },
  ];
  for (const p of params) {
    assert.equal(windowDays(p), p.freshMaxDays + p.seenPenaltyDays);
    for (let seed = 1; seed <= 80; seed++) {
      const events = randomEvents(seed * 7, 150);
      for (const offset of [0, 40]) {
        assert.deepEqual(windowedPage(events, offset, 20, p).map((e) => e.id), rank(events, p).slice(offset, offset + 20).map((e) => e.id), `${JSON.stringify(p)} seed ${seed} offset ${offset}`);
      }
    }
  }
});

test('a window that is too small is NOT exact — the rule needs the full sum (so the test is not vacuous)', () => {
  const p = DEFAULT_SORT_PARAMS;
  let differs = 0;
  for (let seed = 1; seed <= 300 && differs === 0; seed++) {
    const events = randomEvents(seed, 200);
    const need = 20;
    // same procedure but with only the freshness half of the window
    const merged: SortEvent[] = [];
    for (const tier of [0, 1, 2]) {
      const inTier = events.filter((e) => e.tier === tier);
      const c = [...inTier].sort((a, b) => a.daysUntil - b.daysUntil || a.id.localeCompare(b.id))[need - 1]?.daysUntil ?? Infinity;
      merged.push(...rank(inTier.filter((e) => e.daysUntil <= c + p.freshMaxDays), p).slice(0, need));
    }
    if (rank(merged, p).slice(0, need).map((e) => e.id).join() !== rank(events, p).slice(0, need).map((e) => e.id).join()) differs++;
  }
  assert.ok(differs > 0, 'shrinking the window to the freshness bound alone changes some page');
});

test('a snapshot keeps the order stable within a session: the same inputs rank the same however many times, only a changed seen-set moves things', () => {
  const events = randomEvents(11, 120);
  const a = rank(events).map((e) => e.id).join();
  assert.equal(rank(events).map((e) => e.id).join(), a);
  const seenMore = events.map((e, i) => (i % 7 === 0 ? { ...e, seen: true } : e));
  assert.notEqual(rank(seenMore).map((e) => e.id).join(), a);
});
