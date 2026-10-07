import test from 'node:test';
import * as assert from 'node:assert';
import { checkSiblingGap } from './src/rules/sibling-gap.js';
import type { BoundingBox } from './src/rules/sibling-dimension.js';

const box = (y: number, height: number): BoundingBox => ({ x: 0, y, width: 100, height });

test('checkSiblingGap', async (t) => {
  await t.test('passes when every stacked pair is exactly the expected gap apart', () => {
    const r = checkSiblingGap([box(0, 100), box(116, 50), box(182, 30)], 16);
    assert.strictEqual(r.pass, true);
    assert.deepStrictEqual(r.gaps, [16, 16]);
    assert.strictEqual(r.pairCount, 2);
  });

  await t.test('sorts by top edge, so DOM order does not matter', () => {
    const r = checkSiblingGap([box(116, 50), box(0, 100)], 16);
    assert.strictEqual(r.pass, true);
  });

  await t.test('fails when the gap is missing (the CC-030 Phase 2 defect: cards touching)', () => {
    const r = checkSiblingGap([box(0, 100), box(100, 50)], 16);
    assert.strictEqual(r.pass, false);
    assert.deepStrictEqual(r.gaps, [0]);
  });

  await t.test('passes within the default 2px tolerance and fails just outside it', () => {
    assert.strictEqual(checkSiblingGap([box(0, 100), box(118, 50)], 16).pass, true);
    assert.strictEqual(checkSiblingGap([box(0, 100), box(119, 50)], 16).pass, false);
  });

  await t.test('honours an explicit tolerance', () => {
    assert.strictEqual(checkSiblingGap([box(0, 100), box(121, 50)], 16, 6).pass, true);
  });

  await t.test('a negative gap (overlapping boxes) fails even for expectedPx 0 within tolerance 20', () => {
    const r = checkSiblingGap([box(0, 100), box(40, 50)], 0, 20);
    assert.strictEqual(r.pass, false);
    assert.match(r.message, /overlapping/);
  });

  await t.test('a single box has nothing stacked: pairCount 0 (the engine treats that as a failure, not a pass)', () => {
    const r = checkSiblingGap([box(0, 100)], 16);
    assert.strictEqual(r.pairCount, 0);
    assert.strictEqual(r.pass, true);
  });
});
