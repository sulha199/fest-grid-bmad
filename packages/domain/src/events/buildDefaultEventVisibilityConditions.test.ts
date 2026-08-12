import test from 'node:test';
import * as assert from 'node:assert';
import {
  buildDefaultEventVisibilityConditions,
  DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS,
} from './buildDefaultEventVisibilityConditions.js';
import { TerminalCondition } from '../query/queryDsl.js';

test('buildDefaultEventVisibilityConditions', async (t) => {
  await t.test('uses default threshold math with N=7 against injected fixed now', () => {
    // 2026-08-15 UTC midnight -> threshold should be 2026-08-08
    const now = new Date(Date.UTC(2026, 7, 15, 12, 34, 56)); // Aug is 7 in JS Date (0-indexed)
    const res = buildDefaultEventVisibilityConditions({
      hidePastEventsAfterDays: DEFAULT_HIDE_PAST_EVENTS_AFTER_DAYS,
      now,
    });

    assert.strictEqual(res.length, 1);
    const cond = res[0] as TerminalCondition;
    assert.strictEqual(cond.field, 'scheduleDateRange');
    assert.strictEqual(cond.operator, 'overlaps');
    assert.deepStrictEqual(cond.value, { from: '2026-08-08', to: null });
  });

  await t.test('uses custom N threshold math (e.g. N=14) against injected fixed now', () => {
    const now = new Date(Date.UTC(2026, 7, 15, 0, 0, 0));
    const res = buildDefaultEventVisibilityConditions({
      hidePastEventsAfterDays: 14,
      now,
    });

    assert.strictEqual(res.length, 1);
    const cond = res[0] as TerminalCondition;
    assert.deepStrictEqual(cond.value, { from: '2026-08-01', to: null });
  });

  await t.test('handles boundary N=0 correctly (threshold is UTC-today)', () => {
    const now = new Date(Date.UTC(2026, 7, 15, 23, 59, 59));
    const res = buildDefaultEventVisibilityConditions({
      hidePastEventsAfterDays: 0,
      now,
    });

    assert.strictEqual(res.length, 1);
    const cond = res[0] as TerminalCondition;
    assert.deepStrictEqual(cond.value, { from: '2026-08-15', to: null });
  });

  await t.test('uses system current date if now is omitted', () => {
    const res = buildDefaultEventVisibilityConditions({
      hidePastEventsAfterDays: 7,
    });
    assert.strictEqual(res.length, 1);
    const cond = res[0] as TerminalCondition;
    assert.strictEqual(cond.field, 'scheduleDateRange');
    assert.strictEqual(cond.operator, 'overlaps');
    assert.strictEqual(cond.value.to, null);
    assert.ok(typeof cond.value.from === 'string');
    assert.match(cond.value.from, /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test('returns 1 condition if userId is omitted or null', () => {
    const now = new Date(Date.UTC(2026, 7, 15, 0, 0, 0));
    const res1 = buildDefaultEventVisibilityConditions({
      hidePastEventsAfterDays: 7,
      now,
    });
    assert.strictEqual(res1.length, 1);

    const res2 = buildDefaultEventVisibilityConditions({
      hidePastEventsAfterDays: 7,
      now,
      userId: null,
    });
    assert.strictEqual(res2.length, 1);
  });

  await t.test('returns 2 conditions if userId is a real string', () => {
    const now = new Date(Date.UTC(2026, 7, 15, 0, 0, 0));
    const res = buildDefaultEventVisibilityConditions({
      hidePastEventsAfterDays: 7,
      now,
      userId: 'user_123',
    });
    assert.strictEqual(res.length, 2);
    const cond1 = res[0] as TerminalCondition;
    assert.strictEqual(cond1.field, 'scheduleDateRange');

    const cond2 = res[1] as TerminalCondition;
    assert.strictEqual(cond2.field, 'isReportedByCurrentUser');
    assert.strictEqual(cond2.operator, 'eq');
    assert.strictEqual(cond2.value, false);
  });
});
