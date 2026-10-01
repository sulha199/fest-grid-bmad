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

  it('forwards nearby into the manual-filter branch (no AI filter)', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: [],
      categories: [],
      nearby: { locationPreferenceId: 'loc-1', radiusKm: 5 },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'scheduleCoordinates', operator: 'withinRadius', value: { locationPreferenceId: 'loc-1', radiusKm: 5 } },
      ],
    });
  });

  it('forwards nearby alongside search/types/categories in the manual branch', () => {
    const result = buildFeedQueryCondition({
      search: 'jazz',
      types: ['FESTIVAL'],
      categories: [],
      nearby: { latitude: -6.2, longitude: 106.8, radiusKm: 8 },
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
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
        { field: 'scheduleCoordinates', operator: 'withinRadius', value: { latitude: -6.2, longitude: 106.8, radiusKm: 8 } },
      ],
    });
  });

  it('ignores nearby when an AI filter is set (mutual exclusivity preserved)', () => {
    const result = buildFeedQueryCondition({
      search: '',
      types: [],
      categories: [],
      nearby: { locationPreferenceId: 'loc-1', radiusKm: 5 },
      filter: { types: ['FESTIVAL'] },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'types', operator: 'in', value: ['FESTIVAL'] },
      ],
    });
  });
});
