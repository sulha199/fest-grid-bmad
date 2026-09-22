import test from 'node:test';
import * as assert from 'node:assert';
import { enumerateContentVariants } from './src/content-variants.js';

const IF_ELSE_CHAIN_SOURCE = `
export function classify(dayDiff) {
  if (dayDiff === 0) {
    return 'Today';
  }
  if (dayDiff === 1) {
    return 'Tomorrow';
  }
  if (dayDiff >= 2 && dayDiff <= 6) {
    return 'Weekday';
  }
  return 'Upcoming';
}
`;

const SWITCH_SOURCE = `
export function label(kind) {
  switch (kind) {
    case 'a':
      return 'A';
    case 'b':
      return 'B';
    default:
      return 'Other';
  }
}
`;

test('enumerateContentVariants', async (t) => {
  await t.test('enumerates every branch of an if/else-if/fallback chain', () => {
    const variants = enumerateContentVariants(IF_ELSE_CHAIN_SOURCE, 'classify');
    // 3 explicit if-branches + 1 trailing fallback return.
    assert.strictEqual(variants.length, 4);
    assert.ok(variants.some((v) => v.returnExpressionText === "'Today'"));
    assert.ok(variants.some((v) => v.returnExpressionText === "'Tomorrow'"));
    assert.ok(variants.some((v) => v.returnExpressionText === "'Weekday'"));
    assert.ok(variants.some((v) => v.returnExpressionText === "'Upcoming'"));
  });

  await t.test('enumerates every switch/case clause including default', () => {
    const variants = enumerateContentVariants(SWITCH_SOURCE, 'label');
    assert.strictEqual(variants.length, 3);
    assert.ok(variants.some((v) => v.label === 'default' && v.returnExpressionText === "'Other'"));
  });

  await t.test('throws for a function name not found in the source', () => {
    assert.throws(() => enumerateContentVariants(IF_ELSE_CHAIN_SOURCE, 'doesNotExist'), /not found/);
  });

  await t.test('handles the repo\'s real formatEventStatus-shaped 8-branch function', () => {
    // A reduced stand-in mirroring format-event-date.ts's formatEventStatus branch shape
    // (ended / happeningNow / endsToday / inHours / tomorrow / weekday-range / inDays / upcoming)
    // without importing the real module (which has framework-shaped dependencies not needed
    // here -- this test only exercises the branch-enumeration mechanism itself).
    const source = `
      export function formatEventStatus(started, ended, endDayDiff, startDayDiff) {
        if (ended) {
          return 'Ended';
        }
        if (started) {
          if (endDayDiff > 0) {
            return 'Now';
          }
          return 'Ends Today';
        }
        if (startDayDiff === 0) {
          return 'In N hours';
        }
        if (startDayDiff === 1) {
          return 'Tomorrow';
        }
        if (startDayDiff >= 2 && startDayDiff <= 6) {
          return 'Weekday';
        }
        if (startDayDiff >= 7 && startDayDiff <= 13) {
          return 'In N days';
        }
        return 'Upcoming';
      }
    `;
    const variants = enumerateContentVariants(source, 'formatEventStatus');
    assert.ok(variants.length >= 7);
    // Review Follow-up (patch item 4, 2026-09-22): the nested `if (started) { if (endDayDiff >
    // 0) { return 'Now' } return 'Ends Today' }` shape previously lost the 'Now' branch entirely
    // -- the block-level scan only ever found the trailing `return 'Ends Today'`, since a nested
    // IfStatement isn't itself a ReturnStatement. Both branches of that nested case must now be
    // enumerated, not just one.
    assert.ok(
      variants.some((v) => v.returnExpressionText === "'Now'"),
      'expected the nested if(endDayDiff > 0) branch ("Now") to be enumerated'
    );
    assert.ok(
      variants.some((v) => v.returnExpressionText === "'Ends Today'"),
      'expected the started-but-not-endDayDiff>0 branch ("Ends Today") to still be enumerated'
    );
  });

  await t.test('walking nested if branches does not lose top-level if/else-if branches', () => {
    const variants = enumerateContentVariants(IF_ELSE_CHAIN_SOURCE, 'classify');
    assert.strictEqual(variants.length, 4);
  });
});
