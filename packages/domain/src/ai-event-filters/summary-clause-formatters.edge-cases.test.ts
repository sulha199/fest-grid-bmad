import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { EventCategory, EventType } from '@festgrid/shared-types';
import { DateAnchor, DateOffsetUnit, type DayOfWeek } from '../events/buildEventsQueryCondition.js';
import type { AIFilterSummaryLabels } from './render-ai-filter-summary.js';
import {
  formatAccountIdClause,
  formatCategoriesClause,
  formatDateRangeClause,
  formatDayOfWeekClause,
  formatKeywordClause,
  formatLocationAdminAreaClause,
  formatLocationProximityClause,
  formatTemporalFilterClause,
  formatTypesClause,
  formatVenueTypeClause,
} from './summary-clause-formatters.js';

// Every label is optional: these cover the built-in English fallbacks used when a locale supplies
// none of them, and the "label map exists but lacks this key" path.
const bare: AIFilterSummaryLabels = { noFilter: '' };

describe('summary-clause-formatters built-in fallbacks', () => {
  it('account id: no prefix, no template', () => {
    assert.equal(formatAccountIdClause(' acc-1 ', bare), 'acc-1');
  });

  it('types: untranslated names joined by ", "; translated where the map has the key', () => {
    assert.equal(formatTypesClause(['FESTIVAL', 'CONCERT'] as EventType[], bare), 'FESTIVAL, CONCERT');
    assert.equal(
      formatTypesClause(['FESTIVAL', 'CONCERT'] as EventType[], { ...bare, types: { FESTIVAL: 'Festivals' } }),
      'Festivals, CONCERT'
    );
  });

  it('categories: untranslated names joined by ", "; translated where the map has the key', () => {
    assert.equal(formatCategoriesClause(['MUSIC', 'ART'] as EventCategory[], bare), 'MUSIC, ART');
    assert.equal(
      formatCategoriesClause(['MUSIC', 'ART'] as EventCategory[], { ...bare, categories: { MUSIC: 'Music' } }),
      'Music, ART'
    );
  });

  it('keyword: defaults to "about \'…\'"', () => {
    assert.equal(formatKeywordClause(' jazz ', bare), "about 'jazz'");
  });

  it('admin area: prefix default, custom prefix, template', () => {
    assert.equal(formatLocationAdminAreaClause(' Bali ', bare), 'in Bali');
    assert.equal(formatLocationAdminAreaClause('Bali', { ...bare, adminAreaPrefix: 'di ' }), 'di Bali');
    assert.equal(formatLocationAdminAreaClause('Bali', { ...bare, adminAreaTemplate: 'around {adminArea}' }), 'around Bali');
  });

  it('proximity: with and without a radius, default and custom wording', () => {
    assert.equal(formatLocationProximityClause(undefined, bare), 'near me');
    assert.equal(formatLocationProximityClause(null, { ...bare, nearMe: 'dekat saya' }), 'dekat saya');
    assert.equal(formatLocationProximityClause(5000, bare), 'within 5km of me');
    assert.equal(formatLocationProximityClause(5000, { ...bare, nearMeWithRadiusPrefix: 'dalam ' }), 'dalam 5km of me');
    assert.equal(formatLocationProximityClause(5000, { ...bare, nearMeWithRadiusTemplate: '{radius} km away' }), '5 km away');
  });

  it('venue type: prefix default, custom prefix, template', () => {
    assert.equal(formatVenueTypeClause(' bar ', bare), 'at bar');
    assert.equal(formatVenueTypeClause('bar', { ...bare, venueTypePrefix: 'di ' }), 'di bar');
    assert.equal(formatVenueTypeClause('bar', { ...bare, venueTypeTemplate: 'held at a {venueType}' }), 'held at a bar');
  });

  it('temporal filter: the raw value when there is no translation for it', () => {
    assert.equal(formatTemporalFilterClause('TODAY', bare), 'TODAY');
    assert.equal(formatTemporalFilterClause('TODAY', { ...bare, temporalStatus: { UPCOMING: 'Upcoming' } }), 'TODAY');
    assert.equal(formatTemporalFilterClause('TODAY', { ...bare, temporalStatus: { TODAY: 'Today' } }), 'Today');
  });
});

describe('formatDateRangeClause fallbacks', () => {
  const range = (offsetAmount: number, extra: object = {}) => ({
    anchor: DateAnchor.TODAY,
    offsetAmount,
    offsetUnit: DateOffsetUnit.DAY,
    ...extra,
  });

  it('shows the raw anchor when no label is defined for it', () => {
    assert.equal(formatDateRangeClause(range(0), bare), 'TODAY');
    assert.equal(formatDateRangeClause(range(0), { ...bare, anchors: { THIS_WEEK: 'this week' } }), 'TODAY');
  });

  it('describes a span-only range, translating the span unit when the label map has it', () => {
    const spanOnly = range(0, { spanAmount: 2, spanUnit: DateOffsetUnit.WEEK });
    assert.equal(formatDateRangeClause(spanOnly, bare), 'the next 2 WEEK');
    assert.equal(formatDateRangeClause(spanOnly, { ...bare, units: { DAY: 'day' } }), 'the next 2 WEEK');
    assert.equal(formatDateRangeClause(spanOnly, { ...bare, units: { WEEK: 'weeks' } }), 'the next 2 weeks');
  });

  it('describes an offset range with the raw or translated unit and the right sign', () => {
    assert.equal(formatDateRangeClause(range(2), bare), 'TODAY + 2 DAY');
    assert.equal(formatDateRangeClause(range(-1), bare), 'TODAY - 1 DAY');
    assert.equal(formatDateRangeClause(range(2), { ...bare, units: { DAY: 'days' } }), 'TODAY + 2 days');
    assert.equal(formatDateRangeClause(range(2), { ...bare, units: { WEEK: 'weeks' } }), 'TODAY + 2 DAY');
  });

  it('extends an offset range with its span', () => {
    const withSpan = range(1, { spanAmount: 3, spanUnit: DateOffsetUnit.WEEK });
    assert.equal(formatDateRangeClause(withSpan, bare), 'TODAY + 1 DAY, extending 3 WEEK');
  });
});

describe('formatDayOfWeekClause fallbacks', () => {
  const days = (...names: Array<`${DayOfWeek}`>) => names as DayOfWeek[];

  it('lists weekend and weekday sets plainly when the locale has no collective label', () => {
    assert.equal(formatDayOfWeekClause(days('SAT', 'SUN'), bare), 'SAT or SUN');
    assert.equal(formatDayOfWeekClause(days('MON', 'TUE', 'WED', 'THU', 'FRI'), bare), 'MON, TUE, WED, THU or FRI');
  });

  it('uses the collective label only for the exact weekend / weekday set', () => {
    const labels = { ...bare, weekends: 'weekends', weekdays: 'weekdays' };
    assert.equal(formatDayOfWeekClause(days('SAT', 'SUN'), labels), 'weekends');
    assert.equal(formatDayOfWeekClause(days('MON', 'TUE', 'WED', 'THU', 'FRI'), labels), 'weekdays');
    assert.equal(formatDayOfWeekClause(days('SAT'), labels), 'SAT');
  });

  it('translates day names where the map has them and falls back to the raw name otherwise', () => {
    assert.equal(formatDayOfWeekClause('MON', { ...bare, daysOfWeek: { MON: 'Monday' } }), 'Monday');
    assert.equal(formatDayOfWeekClause(days('MON', 'TUE'), { ...bare, daysOfWeek: { MON: 'Monday' } }), 'Monday or TUE');
    assert.equal(formatDayOfWeekClause(days('MON', 'TUE'), { ...bare, or: 'atau' }), 'MON atau TUE');
  });
});
