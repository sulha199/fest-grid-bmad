import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedQueryCondition } from './buildFeedQueryCondition.js';

describe('buildFeedQueryCondition', () => {
  it('returns base condition only when no filters are provided', () => {
    const result = buildFeedQueryCondition({
      search: '   ',
      types: [],
      categories: [],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
      ],
    });
  });

  it('combines base condition with search (single condition filter)', () => {
    const result = buildFeedQueryCondition({
      search: 'jazz',
      types: [],
      categories: [],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'jazz' },
            { field: 'performers', operator: 'contains', value: 'jazz' },
            { field: 'location', operator: 'contains', value: 'jazz' },
          ],
        },
      ],
    });
  });

  it('combines base condition with types and categories (group condition filter)', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });

  it('combines base condition with subscriptions when no other filters are provided', () => {
    const result = buildFeedQueryCondition({
      search: ' ',
      types: [],
      categories: [],
      subscriptions: ['sub-uuid-1', 'sub-uuid-2'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-uuid-1', 'sub-uuid-2'] },
      ],
    });
  });

  it('combines base condition with subscriptions and search', () => {
    const result = buildFeedQueryCondition({
      search: 'jazz',
      types: [],
      categories: [],
      subscriptions: ['sub-uuid-1'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-uuid-1'] },
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'jazz' },
            { field: 'performers', operator: 'contains', value: 'jazz' },
            { field: 'location', operator: 'contains', value: 'jazz' },
          ],
        },
      ],
    });
  });

  it('combines base condition with subscriptions, types and categories', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: ['FESTIVAL'],
      categories: ['MUSIC'],
      subscriptions: ['sub-uuid-1'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['sub-uuid-1'] },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });
});
