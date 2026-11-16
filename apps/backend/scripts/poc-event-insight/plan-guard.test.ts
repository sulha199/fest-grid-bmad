import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzePlan, checkPlan, describe, DEFAULT_PLAN_RULES, type ExplainRoot } from './plan-guard.js';

const seq = (relation: string, rows: number, actual?: number, parallel = false) => ({
  'Node Type': 'Seq Scan', 'Relation Name': relation, 'Parallel Aware': parallel, 'Plan Rows': rows, ...(actual !== undefined ? { 'Actual Rows': actual, 'Actual Loops': 1 } : {}),
});
const idx = (relation: string, actual: number, loops = 1) => ({ 'Node Type': 'Index Scan', 'Relation Name': relation, 'Index Name': `${relation}_idx`, 'Plan Rows': 1, 'Actual Rows': actual, 'Actual Loops': loops });
const limit = (rows: number, cost: number, children: unknown[], extra: Partial<ExplainRoot> = {}): ExplainRoot => ({
  Plan: { 'Node Type': 'Limit', 'Total Cost': cost, 'Actual Rows': rows, Plans: children as never }, ...extra,
});

test('a sequential scan of a big hot table is a violation; the same scan of a small table is not', () => {
  const big = analyzePlan(limit(21, 5000, [seq('events', 120_000, 120_000)]));
  assert.deepEqual(checkPlan(big).map((x) => x.rule).sort(), ['amplification', 'seq-scan']);
  const small = analyzePlan(limit(21, 100, [seq('events', 40, 40)]));
  assert.deepEqual(checkPlan(small), []);
  const other = analyzePlan(limit(21, 100, [seq('social_media_account_profiles', 5000, 5000)]));
  assert.ok(!checkPlan(other).some((x) => x.rule === 'seq-scan'), 'relations outside the list are not policed');
});

test('a parallel sequential scan counts, and is named as such', () => {
  const a = analyzePlan(limit(200, 20_000, [seq('events', 40_000, 3_000, true)]));
  const v = checkPlan(a).find((x) => x.rule === 'seq-scan');
  assert.ok(v && /Parallel Seq Scan on events/.test(v.detail));
});

test('an index-ordered plan that returns a page passes', () => {
  const a = analyzePlan(limit(21, 80, [idx('events', 21), idx('schedules', 1, 21)]));
  assert.deepEqual(checkPlan(a), []);
  assert.equal(a.scannedRows, 42);
});

test('the estimated cost ceiling guards the JIT cliff', () => {
  const a = analyzePlan(limit(21, 610_000, [idx('events', 21)]));
  assert.deepEqual(checkPlan(a).map((x) => x.rule), ['cost']);
  assert.deepEqual(checkPlan(a, { ...DEFAULT_PLAN_RULES, maxTotalCost: 1_000_000 }), []);
});

test('any JIT-compiled function is a violation when forbidden', () => {
  const a = analyzePlan(limit(21, 100, [idx('events', 21)], { JIT: { Functions: 79, Timing: { Total: 716 } } }));
  assert.deepEqual(checkPlan(a).map((x) => x.rule), ['jit']);
  assert.deepEqual(checkPlan(a, { ...DEFAULT_PLAN_RULES, forbidJit: false }), []);
});

test('work amplification: reading thousands of rows through an index to return a page is flagged', () => {
  const a = analyzePlan(limit(10, 300, [idx('events', 1, 50_000)]));
  assert.equal(a.scannedRows, 50_000);
  assert.deepEqual(checkPlan(a).map((x) => x.rule), ['amplification']);
});

test('without ANALYZE only the estimate-based rules apply', () => {
  const a = analyzePlan({ Plan: { 'Node Type': 'Limit', 'Total Cost': 450_000, Plans: [seq('events', 90_000) as never] } });
  assert.equal(a.scannedRows, undefined);
  assert.deepEqual(checkPlan(a).map((x) => x.rule).sort(), ['cost', 'seq-scan']);
});

test('describe() names the failing rule and the scans', () => {
  const a = analyzePlan(limit(21, 5000, [seq('events', 120_000, 120_000)]));
  const line = describe('today', a, checkPlan(a));
  assert.match(line, /^FAIL today/);
  assert.match(line, /Seq:events/);
  assert.match(line, /seq-scan: Seq Scan on events/);
});

test('an absolute scanned-rows budget catches a candidate query that reads its whole pool to return K rows', () => {
  const pool = analyzePlan(limit(1000, 900, [idx('events', 16_845)]));
  assert.deepEqual(checkPlan(pool, { ...DEFAULT_PLAN_RULES, maxScannedRows: 4 * 1000 + 100 }).map((x) => x.rule), ['scanned-budget']);
  const bounded = analyzePlan(limit(1000, 500, [idx('events', 1003)]));
  assert.deepEqual(checkPlan(bounded, { ...DEFAULT_PLAN_RULES, maxScannedRows: 4 * 1000 + 100 }), []);
});
