import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventsQueryCondition } from './buildEventsQueryCondition.js';

describe('buildEventsQueryCondition', () => {
  it('returns undefined when no filters are provided', () => {
    const result = buildEventsQueryCondition({
      search: '   ',
      types: [],
      categories: [],
    });

    assert.equal(result, undefined);
  });

  it('builds an OR group for search across name/performers/location', () => {
    const result = buildEventsQueryCondition({
      search: 'jazz',
      types: [],
      categories: [],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
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

  it('builds in-conditions for types and categories', () => {
    const result = buildEventsQueryCondition({
      search: '',
      types: ['FESTIVAL', 'WORKSHOP'],
      categories: ['MUSIC'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'types', operator: 'in', value: ['FESTIVAL', 'WORKSHOP'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });

  it('builds withinRadius condition for saved location nearby filter', () => {
    const result = buildEventsQueryCondition({
      search: '',
      types: [],
      categories: [],
      nearby: { locationPreferenceId: 'loc-123', radiusKm: 15 },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        {
          field: 'scheduleCoordinates',
          operator: 'withinRadius',
          value: { locationPreferenceId: 'loc-123', radiusKm: 15 },
        },
      ],
    });
  });

  it('builds withinRadius condition for ad-hoc coordinates nearby filter', () => {
    const result = buildEventsQueryCondition({
      search: '',
      types: [],
      categories: [],
      nearby: { latitude: -6.2, longitude: 106.8, radiusKm: 5 },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        {
          field: 'scheduleCoordinates',
          operator: 'withinRadius',
          value: { latitude: -6.2, longitude: 106.8, radiusKm: 5 },
        },
      ],
    });
  });

  it('combines nearby with search, types, and categories in a single and-group', () => {
    const result = buildEventsQueryCondition({
      search: 'jazz',
      types: ['CONCERT'],
      categories: ['MUSIC'],
      nearby: { locationPreferenceId: 'loc-123', radiusKm: 10 },
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        {
          operator: 'or',
          conditions: [
            { field: 'eventName', operator: 'contains', value: 'jazz' },
            { field: 'performers', operator: 'contains', value: 'jazz' },
            { field: 'location', operator: 'contains', value: 'jazz' },
          ],
        },
        { field: 'types', operator: 'in', value: ['CONCERT'] },
        { field: 'categories', operator: 'in', value: ['MUSIC'] },
        {
          field: 'scheduleCoordinates',
          operator: 'withinRadius',
          value: { locationPreferenceId: 'loc-123', radiusKm: 10 },
        },
      ],
    });
  });
});
