import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedCalendarQueryCondition } from './buildFeedCalendarQueryCondition.js';

describe('buildFeedCalendarQueryCondition', () => {
  it('returns base condition only when no filters or date range are provided', () => {
    const result = buildFeedCalendarQueryCondition({
      search: '   ',
      types: [],
      categories: [],
      weekStart: '',
      weekEnd: '',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
      ],
    });
  });

  it('combines base condition with date range overlaps (no filters)', () => {
    const result = buildFeedCalendarQueryCondition({
      search: '',
      types: [],
      categories: [],
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-10', to: '2026-08-16' },
        },
      ],
    });
  });

  it('combines base condition, filter, and date range overlaps', () => {
    const result = buildFeedCalendarQueryCondition({
      search: '',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-10', to: '2026-08-16' },
        },
      ],
    });
  });

  it('combines base condition with subscriptions (no date range or filters)', () => {
    const result = buildFeedCalendarQueryCondition({
      search: ' ',
      types: [],
      categories: [],
      weekStart: '',
      weekEnd: '',
      subscriptions: ['sub-id-1'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-id-1'] },
      ],
    });
  });

  it('combines base condition, subscriptions, and date range overlaps', () => {
    const result = buildFeedCalendarQueryCondition({
      search: '',
      types: [],
      categories: [],
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
      subscriptions: ['sub-id-1', 'sub-id-2'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-id-1', 'sub-id-2'] },
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-10', to: '2026-08-16' },
        },
      ],
    });
  });

  it('combines base condition, subscriptions, filter, and date range overlaps', () => {
    const result = buildFeedCalendarQueryCondition({
      search: '',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
      weekStart: '2026-08-10',
      weekEnd: '2026-08-16',
      subscriptions: ['sub-id-3'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-id-3'] },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
        {
          field: 'scheduleDateRange',
          operator: 'overlaps',
          value: { from: '2026-08-10', to: '2026-08-16' },
        },
      ],
    });
  });
});
