import test from 'node:test';
import * as assert from 'node:assert';
import {
  clusterByRowOverlap,
  clusterByColumnOverlap,
  checkSiblingDimension,
  DEFAULT_SIBLING_TOLERANCE_PX,
  type BoundingBox,
} from './src/rules/sibling-dimension.js';

test('clusterByRowOverlap', async (t) => {
  await t.test('groups two vertically-overlapping boxes into one row cluster', () => {
    const boxes: BoundingBox[] = [
      { x: 0, y: 0, width: 50, height: 20 },
      { x: 60, y: 2, width: 50, height: 18 },
    ];
    const clusters = clusterByRowOverlap(boxes);
    assert.strictEqual(clusters.length, 1);
    assert.strictEqual(clusters[0].length, 2);
  });

  await t.test('keeps non-overlapping rows separate', () => {
    const boxes: BoundingBox[] = [
      { x: 0, y: 0, width: 50, height: 20 },
      { x: 0, y: 100, width: 50, height: 20 },
    ];
    const clusters = clusterByRowOverlap(boxes);
    assert.strictEqual(clusters.length, 2);
  });
});

test('clusterByColumnOverlap', async (t) => {
  await t.test('groups masonry columns by horizontal overlap regardless of height (AC3/AC7 multi-instance)', () => {
    // Three masonry cards side by side in 3 columns, independently tall (true masonry, per AD-27).
    const boxes: BoundingBox[] = [
      { x: 0, y: 0, width: 230, height: 300 },
      { x: 240, y: 0, width: 230, height: 450 },
      { x: 480, y: 0, width: 230, height: 220 },
    ];
    const clusters = clusterByColumnOverlap(boxes);
    assert.strictEqual(clusters.length, 3);
    for (const cluster of clusters) {
      assert.strictEqual(cluster.length, 1);
    }
  });
});

test('checkSiblingDimension', async (t) => {
  await t.test('passes when all values are within the default 2px tolerance', () => {
    const result = checkSiblingDimension(
      [{ x: 0, y: 0, width: 230, height: 40 }, { x: 240, y: 0, width: 231, height: 40 }, { x: 480, y: 0, width: 229, height: 40 }],
      'width'
    );
    assert.strictEqual(result.pass, true);
    assert.strictEqual(result.toleranceAbsolutePx, DEFAULT_SIBLING_TOLERANCE_PX);
  });

  await t.test('fails when a value exceeds the default tolerance', () => {
    const result = checkSiblingDimension(
      [{ x: 0, y: 0, width: 230, height: 40 }, { x: 240, y: 0, width: 240, height: 40 }],
      'width'
    );
    assert.strictEqual(result.pass, false);
    assert.ok(result.maxDeltaPx > 2);
  });

  await t.test('respects a per-rule tolerance override', () => {
    const result = checkSiblingDimension(
      [{ x: 0, y: 0, width: 230, height: 40 }, { x: 240, y: 0, width: 236, height: 40 }],
      'width',
      10
    );
    assert.strictEqual(result.pass, true);
  });

  await t.test('trivially passes for an empty cluster', () => {
    const result = checkSiblingDimension([], 'width');
    assert.strictEqual(result.pass, true);
  });
});
