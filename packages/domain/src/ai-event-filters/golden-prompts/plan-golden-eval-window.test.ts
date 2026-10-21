import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GOLDEN_PROMPT_FIXTURES, type GoldenPromptCategory, type GoldenPromptFixture } from './golden-prompt-fixtures.js';
import { parseGoldenEvalLedger, planGoldenEvalWindow, type GoldenEvalLedger } from './plan-golden-eval-window.js';

function fixture(id: string, category: GoldenPromptCategory = 'AND'): GoldenPromptFixture {
  return {
    id,
    lang: 'en',
    category,
    prompt: `prompt ${id}`,
    geminiResponse: {},
    expected: { expression: { field: 'isFree', value: true }, caveats: [] },
  };
}

const ids = (window: ReturnType<typeof planGoldenEvalWindow>) => window.map((item) => item.fixture.id);
const at = (day: number, drifted = false) => ({ lastEvaluatedAt: `2026-10-${String(day).padStart(2, '0')}T19:17:00.000Z`, drifted });

describe('planGoldenEvalWindow', () => {
  it('plans nothing for a zero, negative or NaN budget', () => {
    const fixtures = [fixture('a')];
    for (const budget of [0, -3, Number.NaN]) {
      assert.deepEqual(planGoldenEvalWindow(fixtures, {}, { budget, withVariants: false }), []);
    }
  });

  it('plans the whole suite when the budget is Infinity', () => {
    const fixtures = [fixture('a'), fixture('b', 'OR'), fixture('c', 'NOT')];
    const window = planGoldenEvalWindow(fixtures, {}, { budget: Infinity, withVariants: true });
    assert.deepEqual(ids(window), ['a', 'b', 'c']);
    assert.ok(window.every((item) => item.withVariant));
  });

  it('on a first run rotates across categories instead of draining one at a time', () => {
    const fixtures = [fixture('and-1'), fixture('and-2'), fixture('or-1', 'OR'), fixture('or-2', 'OR'), fixture('not-1', 'NOT')];
    const window = planGoldenEvalWindow(fixtures, {}, { budget: 5, withVariants: false });
    assert.deepEqual(ids(window), ['and-1', 'or-1', 'not-1', 'and-2', 'or-2']);
    assert.ok(window.every((item) => item.reason === 'never-evaluated'));
  });

  it('keeps the position of each fixture in the input array', () => {
    const fixtures = [fixture('a'), fixture('b', 'OR')];
    const window = planGoldenEvalWindow(fixtures, { a: at(1) }, { budget: 2, withVariants: false });
    assert.deepEqual(window.map((item) => [item.fixture.id, item.index]), [['b', 1], ['a', 0]]);
  });

  it('puts never-evaluated fixtures ahead of everything, then drift rechecks, then the stalest', () => {
    const fixtures = [fixture('old'), fixture('recent'), fixture('drifted'), fixture('new')];
    const ledger: GoldenEvalLedger = { old: at(1), recent: at(9), drifted: at(5, true) };
    const window = planGoldenEvalWindow(fixtures, ledger, { budget: 4, withVariants: false });
    assert.deepEqual(
      window.map((item) => [item.fixture.id, item.reason]),
      [
        ['new', 'never-evaluated'],
        ['drifted', 'drift-recheck'],
        ['old', 'stalest'],
        ['recent', 'stalest'],
      ]
    );
  });

  it('orders the stalest tier by last-evaluated time and breaks a same-run tie by category rotation', () => {
    const fixtures = [fixture('and-1'), fixture('and-2'), fixture('or-1', 'OR'), fixture('not-1', 'NOT')];
    const ledger: GoldenEvalLedger = { 'and-1': at(3), 'and-2': at(3), 'or-1': at(2), 'not-1': at(3) };
    const window = planGoldenEvalWindow(fixtures, ledger, { budget: 4, withVariants: false });
    assert.deepEqual(ids(window), ['or-1', 'and-1', 'not-1', 'and-2']);
  });

  it('caps drift rechecks at a quarter of the budget; the overflow rejoins the stalest queue', () => {
    const fixtures = ['a', 'b', 'c', 'd'].map((id) => fixture(id));
    const ledger: GoldenEvalLedger = { a: at(1, true), b: at(2, true), c: at(3, true), d: at(9) };
    // budget 4 -> recheck budget floor(4 * 0.25) = 1 call -> only the longest-drifted fixture ('a') claims a recheck slot.
    const window = planGoldenEvalWindow(fixtures, ledger, { budget: 4, withVariants: false });
    assert.deepEqual(
      window.map((item) => [item.fixture.id, item.reason]),
      [
        ['a', 'drift-recheck'],
        ['b', 'stalest'],
        ['c', 'stalest'],
        ['d', 'stalest'],
      ]
    );
  });

  it('skips a drifted fixture that does not fit the recheck budget but still admits a cheaper later one', () => {
    const fixtures = [fixture('with-variant', 'AND'), fixture('no-variant', 'off-topic')];
    const ledger: GoldenEvalLedger = { 'with-variant': at(1, true), 'no-variant': at(2, true) };
    // recheck budget = floor(5 * 0.25) = 1: the 2-call fixture cannot fit, the 1-call one can.
    const window = planGoldenEvalWindow(fixtures, ledger, { budget: 5, withVariants: true });
    assert.deepEqual(
      window.map((item) => [item.fixture.id, item.reason]),
      [
        ['no-variant', 'drift-recheck'],
        ['with-variant', 'stalest'],
      ]
    );
  });

  it('spends two calls on a variant-eligible fixture and one on a category variants skip', () => {
    const fixtures = [fixture('and-1'), fixture('off-1', 'off-topic'), fixture('over-1', 'over-limit'), fixture('or-1', 'OR')];
    const window = planGoldenEvalWindow(fixtures, {}, { budget: Infinity, withVariants: true });
    assert.deepEqual(
      window.map((item) => [item.fixture.id, item.withVariant]),
      [
        ['and-1', true],
        ['off-1', false],
        ['over-1', false],
        ['or-1', true],
      ]
    );
  });

  it('never plans a variant when variants are off', () => {
    const window = planGoldenEvalWindow([fixture('a'), fixture('b', 'OR')], {}, { budget: Infinity, withVariants: false });
    assert.ok(window.every((item) => !item.withVariant));
  });

  it('fits the window to the budget and drops only the last variant when a single call is left', () => {
    const fixtures = [fixture('a'), fixture('b', 'OR'), fixture('c', 'NOT'), fixture('d', 'NOT')];
    // 5 calls: a (2) + b (2) + c base-only (1); d stays pending.
    const window = planGoldenEvalWindow(fixtures, {}, { budget: 5, withVariants: true });
    assert.deepEqual(
      window.map((item) => [item.fixture.id, item.withVariant]),
      [
        ['a', true],
        ['b', true],
        ['c', false],
      ]
    );
  });

  it('covers the real suite within ceil(cost / budget) nightly runs when each run records its window', () => {
    const budget = 20;
    let ledger: GoldenEvalLedger = {};
    const seen = new Set<string>();
    let nights = 0;
    while (seen.size < GOLDEN_PROMPT_FIXTURES.length) {
      const window = planGoldenEvalWindow(GOLDEN_PROMPT_FIXTURES as unknown as GoldenPromptFixture[], ledger, { budget, withVariants: true });
      assert.ok(window.length > 0);
      const runAt = new Date(Date.UTC(2026, 9, 1 + nights, 19, 17)).toISOString();
      for (const item of window) {
        seen.add(item.fixture.id);
        ledger = { ...ledger, [item.fixture.id]: { lastEvaluatedAt: runAt, drifted: false } };
      }
      nights++;
      assert.ok(nights < 20, 'suite should be covered well within 20 nights');
    }
    // 49 fixtures + 39 variants = 88 calls at 20/night.
    assert.equal(nights, 5);
  });
});

describe('parseGoldenEvalLedger', () => {
  const known = ['a', 'b', 'c'];

  it('keeps well-formed entries of known fixtures only', () => {
    const raw = { a: at(1), b: at(2, true), gone: at(3) };
    assert.deepEqual(parseGoldenEvalLedger(raw, known), { a: at(1), b: at(2, true) });
  });

  it('drops malformed entries instead of throwing', () => {
    const raw = {
      a: null,
      b: { lastEvaluatedAt: 'not a date', drifted: false },
      c: { lastEvaluatedAt: at(1).lastEvaluatedAt, drifted: 'yes' },
    };
    assert.deepEqual(parseGoldenEvalLedger(raw, known), {});
    assert.deepEqual(parseGoldenEvalLedger({ a: { lastEvaluatedAt: 5, drifted: false }, b: 'x' }, known), {});
  });

  it('returns an empty ledger for anything that is not a plain object', () => {
    for (const raw of [null, undefined, 'ledger', 42, [at(1)]]) {
      assert.deepEqual(parseGoldenEvalLedger(raw, known), {});
    }
  });

  it('copies only the two ledger fields', () => {
    const parsed = parseGoldenEvalLedger({ a: { ...at(1), extra: 'x' } }, known);
    assert.deepEqual(Object.keys(parsed.a), ['lastEvaluatedAt', 'drifted']);
  });
});
