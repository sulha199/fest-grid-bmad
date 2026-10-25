import test from 'node:test';
import * as assert from 'node:assert';
import { isUnfilledValue, LOCATION_NOT_SPECIFIED } from './unfilled.js';

test('isUnfilledValue', async (t) => {
  await t.test('null, undefined, blank strings and empty arrays are unfilled', () => {
    for (const value of [null, undefined, '', '   ', []]) {
      assert.strictEqual(isUnfilledValue(value), true, JSON.stringify(value));
    }
  });
  await t.test('real values are filled, including falsy non-empty ones', () => {
    for (const value of ['x', ['a'], 0, false, { a: 1 }, 5]) {
      assert.strictEqual(isUnfilledValue(value), false, JSON.stringify(value));
    }
  });
  await t.test('a listed placeholder (the NOT NULL events.location default) counts as unfilled, trimmed', () => {
    assert.strictEqual(isUnfilledValue(LOCATION_NOT_SPECIFIED, [LOCATION_NOT_SPECIFIED]), true);
    assert.strictEqual(isUnfilledValue(`  ${LOCATION_NOT_SPECIFIED} `, [LOCATION_NOT_SPECIFIED]), true);
    assert.strictEqual(isUnfilledValue(LOCATION_NOT_SPECIFIED), false, 'only when the caller lists it');
    assert.strictEqual(isUnfilledValue('Arena Grand Paris', [LOCATION_NOT_SPECIFIED]), false);
  });
  await t.test('the placeholder matches what buildEventInsertValues stores', () => {
    assert.strictEqual(LOCATION_NOT_SPECIFIED, 'Location not specified');
  });
});
