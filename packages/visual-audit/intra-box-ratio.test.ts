import test from 'node:test';
import * as assert from 'node:assert';
import { checkIntraBoxRatio, deriveRatioFromReference, DEFAULT_RATIO_TOLERANCE_RELATIVE } from './src/rules/intra-box-ratio.js';

test('deriveRatioFromReference', async (t) => {
  await t.test('computes a simple ratio', () => {
    assert.strictEqual(deriveRatioFromReference(12, 24), 0.5);
  });

  await t.test('throws on a zero denominator', () => {
    assert.throws(() => deriveRatioFromReference(12, 0), /denominator/);
  });
});

test('checkIntraBoxRatio', async (t) => {
  await t.test('passes when within the default ~9% tolerance', () => {
    const result = checkIntraBoxRatio(11, 20, 0.5); // actual 0.55, ~10% off 0.5
    assert.strictEqual(result.toleranceRelative, DEFAULT_RATIO_TOLERANCE_RELATIVE);
    assert.strictEqual(result.pass, false); // 10% > 9% default -- exercises the boundary
  });

  await t.test('passes comfortably within tolerance', () => {
    const result = checkIntraBoxRatio(10.2, 20, 0.5); // actual 0.51, 2% off
    assert.strictEqual(result.pass, true);
  });

  await t.test('respects a per-rule tolerance override', () => {
    const result = checkIntraBoxRatio(11, 20, 0.5, 0.15);
    assert.strictEqual(result.pass, true);
  });

  await t.test('fails clearly outside tolerance', () => {
    const result = checkIntraBoxRatio(18, 20, 0.5);
    assert.strictEqual(result.pass, false);
  });
});
