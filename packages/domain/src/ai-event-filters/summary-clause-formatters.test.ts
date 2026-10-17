import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateAnchor, DateOffsetUnit, type DayOfWeek } from '../events/buildEventsQueryCondition.js';
import type { AIFilterSummaryLabels } from './render-ai-filter-summary.js';
import {
  formatAccountIdClause,
  formatCategoriesClause,
  formatDateRangeClause,
  formatDayOfWeekClause,
  formatIsFreeClause,
  formatKeywordClause,
  formatLocationAdminAreaClause,
  formatLocationProximityClause,
  formatTemporalFilterClause,
  formatTypesClause,
  formatVenueTypeClause,
  joinCaveats,
} from './summary-clause-formatters.js';

describe('summary-clause-formatters', () => {
  const lbls: AIFilterSummaryLabels = {
    noFilter: 'All events',
    accountIdPrefix: 'acc:',
    accountIdTemplate: 'acc:{accountId}',
    types: { CONCERT: 'Concert' },
    typeSeparator: ',',
    typesPrefix: 't:',
    categories: { MUSIC: 'Music' },
    categorySeparator: ',',
    categoriesPrefix: 'c:',
    keywordPrefix: 'kw:',
    keywordTemplate: "kw:'{keyword}'",
    anchors: { TODAY: 'today' },
    units: { DAY: 'day' },
    dateRangeTemplate: '{anchor}{sign}{amount}{unit}',
    dateRangeSpanOnlyTemplate: 'next {spanAmount}{spanUnit}',
    dateRangeSpanExtensionTemplate: '{base}+{spanAmount}{spanUnit}',
    daysOfWeek: { FRI: 'Friday', SAT: 'Saturday' },
    weekends: 'weekends',
    weekdays: 'weekdays',
    or: 'or',
    adminAreaPrefix: 'in:',
    adminAreaTemplate: 'in:{adminArea}',
    nearMe: 'near me',
    nearMeWithRadiusPrefix: 'within:',
    nearMeWithRadiusTemplate: 'within:{radius}km',
    venueTypePrefix: 'at:',
    venueTypeTemplate: 'at:{venueType}',
    freeEventsOnly: 'free',
    paidEventsOnly: 'paid',
    caveatPrefix: 'cav:',
    caveatSeparator: '|',
    temporalStatus: { TODAY: 'happening now' },
  };

  it('formatAccountIdClause: template vs prefix', () => {
    assert.equal(formatAccountIdClause('123', lbls), 'acc:123');
    assert.equal(formatAccountIdClause('123', { ...lbls, accountIdTemplate: undefined }), 'acc:123');
  });

  it('formatTypesClause / formatCategoriesClause', () => {
    assert.equal(formatTypesClause(['CONCERT' as never], lbls), 't:Concert');
    assert.equal(formatTypesClause(['UNKNOWN' as never], lbls), 't:UNKNOWN');
    assert.equal(formatCategoriesClause(['MUSIC' as never], lbls), 'c:Music');
  });

  it('formatKeywordClause: template vs prefix', () => {
    assert.equal(formatKeywordClause('jazz', lbls), "kw:'jazz'");
    assert.equal(formatKeywordClause('jazz', { ...lbls, keywordTemplate: undefined }), "kw:'jazz'");
  });

  it('formatDateRangeClause: offset zero, no span', () => {
    assert.equal(
      formatDateRangeClause({ anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY }, lbls),
      'today'
    );
  });

  it('formatDateRangeClause: offset zero, with span (span-only template)', () => {
    assert.equal(
      formatDateRangeClause(
        { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY, spanAmount: 7, spanUnit: DateOffsetUnit.DAY },
        lbls
      ),
      'next 7day'
    );
    // default fallback template when not provided
    assert.equal(
      formatDateRangeClause(
        { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY, spanAmount: 7, spanUnit: DateOffsetUnit.DAY },
        { ...lbls, dateRangeSpanOnlyTemplate: undefined }
      ),
      'the next 7 day'
    );
  });

  it('formatDateRangeClause: offset nonzero, no span', () => {
    assert.equal(
      formatDateRangeClause({ anchor: DateAnchor.TODAY, offsetAmount: 2, offsetUnit: DateOffsetUnit.DAY }, lbls),
      'today+2day'
    );
    assert.equal(
      formatDateRangeClause({ anchor: DateAnchor.TODAY, offsetAmount: -1, offsetUnit: DateOffsetUnit.DAY }, lbls),
      'today-1day'
    );
    assert.equal(
      formatDateRangeClause({ anchor: DateAnchor.TODAY, offsetAmount: 2, offsetUnit: DateOffsetUnit.DAY }, { ...lbls, dateRangeTemplate: undefined }),
      'today + 2 day'
    );
  });

  it('formatDateRangeClause: offset nonzero, with span (extension template)', () => {
    assert.equal(
      formatDateRangeClause(
        { anchor: DateAnchor.TODAY, offsetAmount: 2, offsetUnit: DateOffsetUnit.DAY, spanAmount: 7, spanUnit: DateOffsetUnit.DAY },
        lbls
      ),
      'today+2day+7day'
    );
    assert.equal(
      formatDateRangeClause(
        { anchor: DateAnchor.TODAY, offsetAmount: 2, offsetUnit: DateOffsetUnit.DAY, spanAmount: 7, spanUnit: DateOffsetUnit.DAY },
        { ...lbls, dateRangeSpanExtensionTemplate: undefined }
      ),
      'today+2day, extending 7 day'
    );
  });

  it('formatDayOfWeekClause: weekend exact set', () => {
    assert.equal(formatDayOfWeekClause(['SAT', 'SUN'] as DayOfWeek[], lbls), 'weekends');
    assert.equal(formatDayOfWeekClause(['SUN', 'SAT'] as DayOfWeek[], lbls), 'weekends');
    // no weekends label -> falls through to generic join
    assert.equal(formatDayOfWeekClause(['SAT', 'SUN'] as DayOfWeek[], { ...lbls, weekends: undefined, daysOfWeek: { SAT: 'Saturday', SUN: 'Sunday' } }), 'Saturday or Sunday');
  });

  it('formatDayOfWeekClause: weekday exact set', () => {
    assert.equal(formatDayOfWeekClause(['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayOfWeek[], lbls), 'weekdays');
    assert.equal(formatDayOfWeekClause(['MON', 'TUE', 'WED', 'THU', 'FRI'] as DayOfWeek[], { ...lbls, weekdays: undefined, daysOfWeek: undefined }), 'MON, TUE, WED, THU or FRI');
  });

  it('formatDayOfWeekClause: arbitrary multi-value set uses or-word', () => {
    assert.equal(formatDayOfWeekClause(['FRI', 'SAT'] as DayOfWeek[], lbls), 'Friday or Saturday');
    assert.equal(formatDayOfWeekClause(['FRI', 'SAT'] as DayOfWeek[], { ...lbls, or: undefined }), 'Friday or Saturday');
  });

  it('formatDayOfWeekClause: single value', () => {
    assert.equal(formatDayOfWeekClause('FRI' as DayOfWeek, lbls), 'Friday');
    assert.equal(formatDayOfWeekClause('MON' as DayOfWeek, { ...lbls, daysOfWeek: undefined }), 'MON');
    assert.equal(formatDayOfWeekClause(['FRI'] as DayOfWeek[], lbls), 'Friday');
  });

  it('formatTemporalFilterClause: known and unknown values', () => {
    assert.equal(formatTemporalFilterClause('TODAY', lbls), 'happening now');
    assert.equal(formatTemporalFilterClause('UPCOMING', lbls), 'UPCOMING');
    assert.equal(formatTemporalFilterClause('UPCOMING', { ...lbls, temporalStatus: undefined }), 'UPCOMING');
  });

  it('formatLocationAdminAreaClause: template vs prefix', () => {
    assert.equal(formatLocationAdminAreaClause('Berlin', lbls), 'in:Berlin');
    assert.equal(formatLocationAdminAreaClause('Berlin', { ...lbls, adminAreaTemplate: undefined }), 'in:Berlin');
  });

  it('formatLocationProximityClause: radius vs bare near-me', () => {
    assert.equal(formatLocationProximityClause(5000, lbls), 'within:5km');
    assert.equal(formatLocationProximityClause(5000, { ...lbls, nearMeWithRadiusTemplate: undefined }), 'within:5km of me');
    assert.equal(formatLocationProximityClause(null, lbls), 'near me');
    assert.equal(formatLocationProximityClause(undefined, lbls), 'near me');
  });

  it('formatVenueTypeClause: template vs prefix', () => {
    assert.equal(formatVenueTypeClause('Club', lbls), 'at:Club');
    assert.equal(formatVenueTypeClause('Club', { ...lbls, venueTypeTemplate: undefined }), 'at:Club');
  });

  it('formatIsFreeClause: true/false/missing label', () => {
    assert.equal(formatIsFreeClause(true, lbls), 'free');
    assert.equal(formatIsFreeClause(false, lbls), 'paid');
    assert.equal(formatIsFreeClause(true, { ...lbls, freeEventsOnly: undefined }), undefined);
    assert.equal(formatIsFreeClause(false, { ...lbls, paidEventsOnly: undefined }), undefined);
  });

  it('joinCaveats: all-empty, mixed, clean, null/undefined/empty-array', () => {
    assert.equal(joinCaveats(null, lbls), undefined);
    assert.equal(joinCaveats(undefined, lbls), undefined);
    assert.equal(joinCaveats([], lbls), undefined);
    assert.equal(joinCaveats(['', '   '], lbls), undefined);
    assert.equal(joinCaveats(['', 'err1', '  ', 'err2'], lbls), 'cav:err1|cav:err2');
    assert.equal(joinCaveats(['err1', 'err2'], lbls), 'cav:err1|cav:err2');
    assert.equal(joinCaveats(['err1', 'err2'], { ...lbls, caveatPrefix: undefined, caveatSeparator: undefined }), 'err1\nerr2');
  });
});
