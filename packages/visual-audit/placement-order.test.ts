import test from 'node:test';
import * as assert from 'node:assert';
import { checkPlacementOrder } from './src/rules/placement-order.js';

test('checkPlacementOrder', async (t) => {
  await t.test('passes when the first N items land one-per-column in left-to-right index order', () => {
    const result = checkPlacementOrder([0, 1, 2]);
    assert.strictEqual(result.pass, true);
    assert.deepStrictEqual(result.expectedLeadingIndices, [0, 1, 2]);
  });

  await t.test('fails when a leading item is out of order', () => {
    const result = checkPlacementOrder([0, 2, 1]);
    assert.strictEqual(result.pass, false);
    assert.match(result.message, /Placement order mismatch/);
  });

  await t.test('fails when a column reports no leading item (-1 sentinel)', () => {
    const result = checkPlacementOrder([0, -1, 2]);
    assert.strictEqual(result.pass, false);
  });

  await t.test('trivially passes for zero columns', () => {
    const result = checkPlacementOrder([]);
    assert.strictEqual(result.pass, true);
  });
});
