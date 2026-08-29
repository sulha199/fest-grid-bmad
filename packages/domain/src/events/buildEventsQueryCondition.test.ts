import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildEventsQueryCondition, resolveDateRangeFilter } from './buildEventsQueryCondition.js';
describe('buildEventsQueryCondition', () => {
  it('returns undefined when no filters are provided', () => {
    assert.equal(buildEventsQueryCondition({ search: ' ', types: [], categories: [] }), undefined);
  });
  it('builds search', () => {
    const res = buildEventsQueryCondition({ search: 'jazz', types: [], categories: [] });
    assert.ok(res);
  });
  it('builds tags', () => {
    const res = buildEventsQueryCondition({ search: '#Jogja', types: [], categories: [] });
    assert.deepEqual(res, { operator: 'and', conditions: [{ field: 'hashtags', operator: 'in', value: ['jogja'] }] });
  });
  describe('structured filter input', () => {
    const mockDate = new Date('2026-08-29T12:00:00Z');
    it('filters by accountId, types, categories, keyword', () => {
      const res = buildEventsQueryCondition({
        filter: { accountId: 'acc-123', types: ['FESTIVAL'], categories: ['MUSIC'], keyword: 'jazz' }
      });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [
          { field: 'socialMediaAccountProfileId', operator: 'eq', value: 'acc-123' },
          { field: 'types', operator: 'in', value: ['FESTIVAL'] },
          { field: 'categories', operator: 'in', value: ['MUSIC'] },
          { operator: 'or', conditions: [
            { field: 'eventName', operator: 'contains', value: 'jazz' },
            { field: 'performers', operator: 'contains', value: 'jazz' },
            { field: 'location', operator: 'contains', value: 'jazz' }
          ] }
        ]
      });
    });
    it('filters by dateRange TODAY', () => {
      const res = buildEventsQueryCondition({
        filter: { dateRange: { anchor: 'TODAY', offsetAmount: 1, offsetUnit: 'DAY' } }, currentDate: mockDate
      });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-30', to: '2026-08-30' } }]
      });
    });
    it('composes dateRange with dayOfWeek', () => {
      const res = buildEventsQueryCondition({
        filter: { dateRange: { anchor: 'THIS_WEEK', offsetAmount: 0, offsetUnit: 'WEEK' }, dayOfWeek: 'FRI' }, currentDate: mockDate
      });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [{ field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-28', to: '2026-08-28' } }]
      });
    });
    it('composes dateRange spanning weeks with dayOfWeek', () => {
      const res = buildEventsQueryCondition({
        filter: { dateRange: { anchor: 'THIS_MONTH', offsetAmount: 0, offsetUnit: 'MONTH' }, dayOfWeek: 'FRI' }, currentDate: mockDate
      });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [{
          operator: 'or',
          conditions: [
            { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-07', to: '2026-08-07' } },
            { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-14', to: '2026-08-14' } },
            { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-21', to: '2026-08-21' } },
            { field: 'scheduleDateRange', operator: 'overlaps', value: { from: '2026-08-28', to: '2026-08-28' } }
          ]
        }]
      });
    });
    it('resolves THIS_MONTH shifted by DAY offset as a whole-month window shift, not a day-of-month slice', () => {
      const res = resolveDateRangeFilter('THIS_MONTH', 5, 'DAY', mockDate);
      assert.deepEqual(res, { from: '2026-08-06', to: '2026-09-05' });
    });
    it('resolves THIS_MONTH shifted by WEEK offset as a whole-month window shift', () => {
      const res = resolveDateRangeFilter('THIS_MONTH', 1, 'WEEK', mockDate);
      assert.deepEqual(res, { from: '2026-08-08', to: '2026-09-07' });
    });
    it('resolves THIS_MONTH shifted by MONTH offset without day-of-month overflow', () => {
      const res = resolveDateRangeFilter('THIS_MONTH', 1, 'MONTH', mockDate);
      assert.deepEqual(res, { from: '2026-09-01', to: '2026-09-30' });
    });
    it('filters by location adminArea', () => {
      const res = buildEventsQueryCondition({ filter: { location: { adminArea: 'Sleman' } } });
      assert.deepEqual(res, { operator: 'and', conditions: [{ field: 'adminArea', operator: 'eq', value: 'Sleman' }] });
    });
    it('filters by location coordinates', () => {
      const res = buildEventsQueryCondition({ filter: { location: { coordinates: { lat: -7.7, lng: 110.3 }, radiusMeters: 5000 } } });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [{ field: 'scheduleCoordinates', operator: 'withinRadius', value: { latitude: -7.7, longitude: 110.3, radiusKm: 5 } }]
      });
    });
    it('throws error when coordinates and adminArea are specified together', () => {
      assert.throws(() => {
        buildEventsQueryCondition({ filter: { location: { coordinates: { lat: -7.7, lng: 110.3 }, adminArea: 'Sleman' } } });
      }, /Cannot specify both coordinates and adminArea/);
    });
    it('filters by venueType and isFree', () => {
      const res = buildEventsQueryCondition({ filter: { venueType: 'Mall', isFree: true } });
      assert.deepEqual(res, {
        operator: 'and',
        conditions: [
          { field: 'venueType', operator: 'eq', value: 'Mall' },
          { field: 'isFree', operator: 'eq', value: true }
        ]
      });
    });
  });
});