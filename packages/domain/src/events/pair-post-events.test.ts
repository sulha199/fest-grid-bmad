import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PAIRING_MIN_SCORE, assignApplyOrdinals, nameSimilarity, pairPostEventsToItems, scorePair, slugImpliedOrdinal } from './pair-post-events.js';

const ev = (id: string, eventName: string, startDates: string[], deleted = false) => ({ id, eventName, startDates, deleted });
const item = (index: number, eventName: string, startDates: string[]) => ({ index, eventName, startDates });

describe('nameSimilarity', () => {
  it('is 1 for the same name after normalizing case and punctuation, 0 when either is empty', () => {
    assert.equal(nameSimilarity('Kulon Progo Half Marathon', 'kulon  progo half-marathon!'), 1);
    assert.equal(nameSimilarity('', 'x'), 0);
    assert.equal(nameSimilarity('abc', '   '), 0);
  });

  it('ranks a close name above an unrelated one', () => {
    const close = nameSimilarity('Merapi Trail Run', 'Merapi Performance Trail Run');
    const far = nameSimilarity('Merapi Trail Run', 'RSIH Mlayu Mlayu');
    assert.ok(close > 0.6 && far < 0.3 && close > far);
  });

  it('counts repeated bigrams once per occurrence (no inflation from repeats)', () => {
    assert.ok(nameSimilarity('aaaa', 'aa') < 1);
  });
});

describe('scorePair', () => {
  it('weights name 0.6 and date 0.4: same name + shared date = 1, same name alone = 0.6', () => {
    assert.ok(Math.abs(scorePair(item(0, 'Fun Run', ['2026-09-01']), ev('a', 'Fun Run', ['2026-09-01'])) - 1) < 1e-9);
    assert.ok(Math.abs(scorePair(item(0, 'Fun Run', ['2026-09-01']), ev('a', 'Fun Run', ['2027-01-01'])) - 0.6) < 1e-9);
  });

  it('gives half the date weight within two days, and none when either side has no date', () => {
    assert.ok(Math.abs(scorePair(item(0, 'Fun Run', ['2026-09-01']), ev('a', 'Fun Run', ['2026-09-03'])) - 0.8) < 1e-9);
    assert.ok(Math.abs(scorePair(item(0, 'Fun Run', []), ev('a', 'Fun Run', ['2026-09-03'])) - 0.6) < 1e-9);
    assert.ok(Math.abs(scorePair(item(0, 'Fun Run', ['2026-09-01']), ev('a', 'Fun Run', [])) - 0.6) < 1e-9);
  });
});

describe('pairPostEventsToItems', () => {
  it('reuses the live event an item continues, creates the rest, and reports nothing orphaned', () => {
    const result = pairPostEventsToItems(
      [ev('e1', 'Kulon Progo Half Marathon', ['2026-09-01'])],
      [item(0, 'Merapi Performance Trail Run', ['2026-09-01']), item(1, 'Kulon Progo Half Marathon', ['2026-09-01'])]
    );
    assert.deepEqual(result.items, [{ index: 0, kind: 'new' }, { index: 1, kind: 'reuse', eventId: 'e1' }]);
    assert.deepEqual(result.orphanEventIds, []);
  });

  it('pairs by name and date, not by position: the old event at ordinal 0 can match the last item', () => {
    const result = pairPostEventsToItems([ev('e1', 'PLN Mobile Electric Series', ['2026-10-10'])], [item(0, 'Aaa Opening', ['2026-09-01']), item(1, 'PLN Mobile Electric Series', ['2026-10-10'])]);
    assert.equal(result.items[1].kind, 'reuse');
    assert.equal(result.items[0].kind, 'new');
  });

  it('takes the best pair first and uses each event and item once', () => {
    const result = pairPostEventsToItems(
      [ev('e1', 'City Fun Run', ['2026-09-01']), ev('e2', 'City Fun Run 5K', ['2026-09-01'])],
      [item(0, 'City Fun Run', ['2026-09-01']), item(1, 'City Fun Run 5K', ['2026-09-01'])]
    );
    assert.deepEqual(result.items, [{ index: 0, kind: 'reuse', eventId: 'e1' }, { index: 1, kind: 'reuse', eventId: 'e2' }]);
  });

  it('is deterministic on a tie: the lower item index, then the lower event id', () => {
    const result = pairPostEventsToItems([ev('b', 'Twin Event', ['2026-09-01']), ev('a', 'Twin Event', ['2026-09-01'])], [item(0, 'Twin Event', ['2026-09-01'])]);
    assert.deepEqual(result.items, [{ index: 0, kind: 'reuse', eventId: 'a' }]);
    assert.deepEqual(result.orphanEventIds, ['b']);
  });

  it('skips an item that matches a deleted event instead of recreating it (PRD 3.7)', () => {
    const result = pairPostEventsToItems([ev('d1', 'Deleted Fest', ['2026-09-01'], true)], [item(0, 'Deleted Fest', ['2026-09-01'])]);
    assert.deepEqual(result.items, [{ index: 0, kind: 'skip', eventId: 'd1' }]);
    assert.deepEqual(result.orphanEventIds, [], 'a deleted event is never an orphan');
  });

  it('leaves a live event no item matches as an orphan', () => {
    const result = pairPostEventsToItems([ev('o1', 'Totally Different', ['2027-05-05'])], [item(0, 'Merapi Trail', ['2026-09-01'])]);
    assert.deepEqual(result.items, [{ index: 0, kind: 'new' }]);
    assert.deepEqual(result.orphanEventIds, ['o1']);
  });

  it('does not pair below the minimum score', () => {
    assert.ok(PAIRING_MIN_SCORE > 0);
    const result = pairPostEventsToItems([ev('e1', 'Kopi Pagi', ['2026-09-01'])], [item(0, 'Malam Jazz Besar', ['2026-09-01'])]);
    assert.equal(result.items[0].kind, 'new');
  });

  it('handles no existing events and no items', () => {
    assert.deepEqual(pairPostEventsToItems([], [item(0, 'X', ['2026-09-01'])]), { items: [{ index: 0, kind: 'new' }], orphanEventIds: [] });
    assert.deepEqual(pairPostEventsToItems([ev('e1', 'X', [])], []), { items: [], orphanEventIds: ['e1'] });
  });
});

const newItems = (n: number) => Array.from({ length: n }, () => ({ reused: false }));

describe('slugImpliedOrdinal', () => {
  it('reads the ordinal a platform-prefixed slug was built for: none is 0, ~n is n', () => {
    assert.equal(slugImpliedOrdinal('ig_p_Cx9uWttkSN'), 0);
    assert.equal(slugImpliedOrdinal('ig_p_Cx9uWttkSN~2'), 2);
    assert.equal(slugImpliedOrdinal('ig_reel_Ab-Cd_Ef~12'), 12);
  });

  it('is null for a legacy hex slug, and for a one-underscore slug', () => {
    assert.equal(slugImpliedOrdinal('20602ac39613'), null);
    assert.equal(slugImpliedOrdinal('only_one'), null);
  });

  it('treats a non-numeric ~ suffix as no suffix', () => {
    assert.equal(slugImpliedOrdinal('ig_p_X~abc'), 0);
  });
});

describe('assignApplyOrdinals', () => {
  it('takes 0..n-1 when nothing is fixed', () => {
    assert.deepEqual(assignApplyOrdinals(newItems(3), []), [0, 1, 2]);
  });

  it('skips ordinals still held by events that do not move, and ignores null', () => {
    assert.deepEqual(assignApplyOrdinals(newItems(3), [0, 2, null]), [1, 3, 4]);
  });

  it('returns nothing for no kept items', () => {
    assert.deepEqual(assignApplyOrdinals([], [0, 1]), []);
  });

  it('keeps a NEW item off an ordinal whose slug a reused event holds, but lets the reused event take it', () => {
    // Reused event E holds slug ordinal 0. Sorted order: new, E, new. The first new item skips 0
    // (E's slug), E takes it, the last new item takes the next free one.
    assert.deepEqual(assignApplyOrdinals([{ reused: false }, { reused: true }, { reused: false }], [], [0]), [1, 0, 2]);
    // E first: it may take ordinal 0 (the slug it holds); the new items then avoid 0 anyway.
    assert.deepEqual(assignApplyOrdinals([{ reused: true }, { reused: false }, { reused: false }], [], [0]), [0, 1, 2]);
  });

  it('ignores a null slug ordinal (a legacy hex slug cannot collide)', () => {
    assert.deepEqual(assignApplyOrdinals(newItems(2), [], [null]), [0, 1]);
  });
});
