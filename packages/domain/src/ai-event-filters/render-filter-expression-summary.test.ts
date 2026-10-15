import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EventType, EventCategory } from '@festgrid/shared-types';
import { renderFilterExpressionSummary, type FilterExpressionSummaryLabels } from './render-filter-expression-summary.js';
import { renderAIFilterSummary } from './render-ai-filter-summary.js';
import { expressionFromFlatFilter } from './flat-filter-conversion.js';
import type { FilterNode } from './filter-node.js';
import { DateAnchor, DateOffsetUnit, type EventFilterInput } from '../events/buildEventsQueryCondition.js';

const EN_LABELS: FilterExpressionSummaryLabels = {
  noFilter: 'All events',
  accountIdPrefix: 'acc: ',
  types: { [EventType.FESTIVAL]: 'Festivals', [EventType.CONCERT]: 'Concerts' },
  typeSeparator: ', ',
  typesPrefix: '',
  categories: { [EventCategory.MUSIC]: 'Music', [EventCategory.WORKSHOP]: 'Workshops' },
  categorySeparator: ', ',
  categoriesPrefix: '',
  keywordPrefix: 'about ',
  anchors: { [DateAnchor.TODAY]: 'today', [DateAnchor.THIS_WEEK]: 'this week' },
  units: { [DateOffsetUnit.DAY]: 'day', [DateOffsetUnit.WEEK]: 'week' },
  daysOfWeek: { SAT: 'Saturday', SUN: 'Sunday', MON: 'Monday', FRI: 'Friday' },
  adminAreaPrefix: 'in ',
  nearMe: 'near me',
  venueTypePrefix: 'at ',
  freeEventsOnly: 'free events only',
  paidEventsOnly: 'paid events only',
  caveatPrefix: '',
  caveatSeparator: '\n',
  and: 'and',
  or: 'or',
  not: 'not',
  weekends: 'weekends',
  weekdays: 'weekdays',
  temporalStatus: { TODAY: 'happening now', UPCOMING: 'upcoming' },
  dateRangeSpanOnlyTemplate: 'the next {spanAmount} {spanUnit}',
  dateRangeSpanExtensionTemplate: '{base}, extending {spanAmount} {spanUnit}',
};

const ID_LABELS: FilterExpressionSummaryLabels = {
  noFilter: 'Semua acara',
  accountIdPrefix: 'akun: ',
  types: { [EventType.FESTIVAL]: 'Festival', [EventType.CONCERT]: 'Konser' },
  typeSeparator: ', ',
  typesPrefix: '',
  categories: { [EventCategory.MUSIC]: 'Musik', [EventCategory.WORKSHOP]: 'Lokakarya' },
  categorySeparator: ', ',
  categoriesPrefix: '',
  keywordPrefix: 'tentang ',
  anchors: { [DateAnchor.TODAY]: 'hari ini', [DateAnchor.THIS_WEEK]: 'minggu ini' },
  units: { [DateOffsetUnit.DAY]: 'hari', [DateOffsetUnit.WEEK]: 'minggu' },
  daysOfWeek: { SAT: 'Sabtu', SUN: 'Minggu', MON: 'Senin', FRI: 'Jumat' },
  adminAreaPrefix: 'di ',
  nearMe: 'dekat saya',
  venueTypePrefix: 'di ',
  freeEventsOnly: 'hanya acara gratis',
  paidEventsOnly: 'hanya acara berbayar',
  caveatPrefix: '',
  caveatSeparator: '\n',
  and: 'dan',
  or: 'atau',
  not: 'bukan',
  weekends: 'akhir pekan',
  weekdays: 'hari kerja',
  temporalStatus: { TODAY: 'sedang berlangsung', UPCOMING: 'akan datang' },
  dateRangeSpanOnlyTemplate: '{spanAmount} {spanUnit} ke depan',
  dateRangeSpanExtensionTemplate: '{base}, diperpanjang {spanAmount} {spanUnit}',
};

describe('renderFilterExpressionSummary', () => {
  it('null/undefined node delegates to renderAIFilterSummary(null, ...)', () => {
    const expected = renderAIFilterSummary(null, ['c1'], EN_LABELS);
    assert.deepEqual(renderFilterExpressionSummary(null, ['c1'], EN_LABELS), expected);
    assert.deepEqual(renderFilterExpressionSummary(undefined, ['c1'], EN_LABELS), expected);
  });

  it('flat-delegation parity: a bare leaf renders identically to renderAIFilterSummary', () => {
    const leaf: FilterNode = { field: 'keyword', value: 'jazz' };
    const flatEquivalent: EventFilterInput = { keyword: 'jazz' };
    assert.deepEqual(
      renderFilterExpressionSummary(leaf, null, EN_LABELS),
      renderAIFilterSummary(flatEquivalent, null, EN_LABELS)
    );
  });

  it('flat-delegation parity: a top-level AND-of-leaves (every field) renders identically to renderAIFilterSummary', () => {
    const flatFixture: EventFilterInput = {
      accountId: 'acc-1',
      types: [EventType.FESTIVAL],
      categories: [EventCategory.MUSIC],
      keyword: 'jazz',
      dateRange: { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY },
      location: { adminArea: 'Sleman' },
      venueType: 'Club',
      isFree: true,
      temporalFilter: 'UPCOMING',
    };
    const expression = expressionFromFlatFilter(flatFixture);
    assert.deepEqual(
      renderFilterExpressionSummary(expression, ['note'], EN_LABELS),
      renderAIFilterSummary(flatFixture, ['note'], EN_LABELS)
    );
  });

  it('SPEC CAP-6 worked example: explicit grouping around OR, NOT prefix, within-leaf array OR', () => {
    const expression: FilterNode = {
      op: 'AND',
      children: [
        {
          op: 'OR',
          children: [
            { field: 'locationAdminArea', value: 'Sleman' },
            { field: 'locationAdminArea', value: 'Bantul' },
          ],
        },
        { field: 'dateRange', value: { anchor: DateAnchor.THIS_WEEK, offsetAmount: 0, offsetUnit: DateOffsetUnit.WEEK } },
        { op: 'NOT', child: { field: 'category', value: [EventCategory.WORKSHOP] } },
        { field: 'type', value: [EventType.CONCERT, EventType.FESTIVAL] },
      ],
    };
    const result = renderFilterExpressionSummary(expression, null, {
      ...EN_LABELS,
      types: { [EventType.CONCERT]: 'jazz', [EventType.FESTIVAL]: 'blues' },
    });
    assert.equal(
      result.summary,
      '(in Sleman or in Bantul) and this week and not Workshops and jazz, blues'
    );
  });

  it('NOT wrapping a single leaf has no parens; NOT wrapping a group has parens', () => {
    const notLeaf: FilterNode = { op: 'NOT', child: { field: 'category', value: [EventCategory.WORKSHOP] } };
    assert.equal(renderFilterExpressionSummary(notLeaf, null, EN_LABELS).summary, 'not Workshops');

    const notGroup: FilterNode = {
      op: 'NOT',
      child: {
        op: 'OR',
        children: [
          { field: 'category', value: [EventCategory.WORKSHOP] },
          { field: 'category', value: [EventCategory.MUSIC] },
        ],
      },
    };
    assert.equal(renderFilterExpressionSummary(notGroup, null, EN_LABELS).summary, 'not (Workshops or Music)');
  });

  it('mixed AND-of-ORs: parens only around the mismatched-operator child', () => {
    const expression: FilterNode = {
      op: 'AND',
      children: [
        {
          op: 'OR',
          children: [
            { field: 'locationAdminArea', value: 'Sleman' },
            { field: 'locationAdminArea', value: 'Bantul' },
          ],
        },
        { field: 'venueType', value: 'Club' },
      ],
    };
    assert.equal(
      renderFilterExpressionSummary(expression, null, EN_LABELS).summary,
      '(in Sleman or in Bantul) and at Club'
    );
  });

  it('mixed OR-of-ANDs: parens only around the mismatched-operator child', () => {
    const expression: FilterNode = {
      op: 'OR',
      children: [
        {
          op: 'AND',
          children: [
            { field: 'locationAdminArea', value: 'Sleman' },
            { field: 'venueType', value: 'Club' },
          ],
        },
        { field: 'locationAdminArea', value: 'Bantul' },
      ],
    };
    assert.equal(
      renderFilterExpressionSummary(expression, null, EN_LABELS).summary,
      '(in Sleman and at Club) or in Bantul'
    );
  });

  it('AC2: dateRange span inside a non-flat tree', () => {
    const expression: FilterNode = {
      op: 'OR',
      children: [
        { field: 'dateRange', value: { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY, spanAmount: 7, spanUnit: DateOffsetUnit.DAY } },
        { field: 'venueType', value: 'Club' },
      ],
    };
    assert.equal(
      renderFilterExpressionSummary(expression, null, EN_LABELS).summary,
      'the next 7 day or at Club'
    );
  });

  it('AC2: dayOfWeek weekend/weekday/arbitrary sets inside a non-flat tree', () => {
    const weekendExpr: FilterNode = { op: 'OR', children: [{ field: 'dayOfWeek', value: ['SAT', 'SUN'] }, { field: 'venueType', value: 'Club' }] };
    assert.equal(renderFilterExpressionSummary(weekendExpr, null, EN_LABELS).summary, 'weekends or at Club');

    const weekdayExpr: FilterNode = { op: 'OR', children: [{ field: 'dayOfWeek', value: ['MON', 'FRI'] }, { field: 'venueType', value: 'Club' }] };
    assert.equal(renderFilterExpressionSummary(weekdayExpr, null, EN_LABELS).summary, 'Monday or Friday or at Club');
  });

  it('AC2: temporalFilter leaf inside a non-flat tree', () => {
    const expression: FilterNode = {
      op: 'OR',
      children: [
        { field: 'temporalFilter', value: 'UPCOMING' },
        { field: 'venueType', value: 'Club' },
      ],
    };
    assert.equal(renderFilterExpressionSummary(expression, null, EN_LABELS).summary, 'upcoming or at Club');
  });

  it('AC3: empty caveat strings inside a non-flat tree are dropped before joining', () => {
    const expression: FilterNode = {
      op: 'OR',
      children: [
        { field: 'venueType', value: 'Club' },
        { field: 'locationAdminArea', value: 'Sleman' },
      ],
    };
    const result = renderFilterExpressionSummary(expression, ['', 'real caveat', '   '], EN_LABELS);
    assert.equal(result.caveatsText, 'real caveat');
  });

  it('AC4: dual-locale (en/id) fixtures render their own exact, locale-correct string', () => {
    const expression: FilterNode = {
      op: 'AND',
      children: [
        {
          op: 'OR',
          children: [
            { field: 'locationAdminArea', value: 'Sleman' },
            { field: 'locationAdminArea', value: 'Bantul' },
          ],
        },
        { op: 'NOT', child: { field: 'category', value: [EventCategory.WORKSHOP] } },
      ],
    };
    const enResult = renderFilterExpressionSummary(expression, null, EN_LABELS);
    const idResult = renderFilterExpressionSummary(expression, null, ID_LABELS);
    assert.equal(enResult.summary, '(in Sleman or in Bantul) and not Workshops');
    assert.equal(idResult.summary, '(di Sleman atau di Bantul) dan bukan Lokakarya');
    assert.notEqual(enResult.summary, idResult.summary);

    const secondExpr: FilterNode = { op: 'OR', children: [{ field: 'dayOfWeek', value: ['SAT', 'SUN'] }, { field: 'venueType', value: 'Club' }] };
    assert.equal(renderFilterExpressionSummary(secondExpr, null, EN_LABELS).summary, 'weekends or at Club');
    assert.equal(renderFilterExpressionSummary(secondExpr, null, ID_LABELS).summary, 'akhir pekan atau di Club');

    const thirdExpr: FilterNode = { op: 'OR', children: [{ field: 'temporalFilter', value: 'TODAY' }, { field: 'venueType', value: 'Mall' }] };
    assert.equal(renderFilterExpressionSummary(thirdExpr, null, EN_LABELS).summary, 'happening now or at Mall');
    assert.equal(renderFilterExpressionSummary(thirdExpr, null, ID_LABELS).summary, 'sedang berlangsung atau di Mall');
  });

  it('empty-children group degraded tree does not crash (defensive fallback)', () => {
    // The top-level empty-expression case exercises the `|| labels.noFilter` fallback branch --
    // a genuinely empty group is rejected upstream by validateFilterNode and is not reachable via
    // the public API, per Task 5's note; this covers the same fallback via the reachable path.
    const result = renderFilterExpressionSummary({ op: 'AND', children: [] }, null, EN_LABELS);
    assert.equal(result.summary, 'All events');
  });
});
