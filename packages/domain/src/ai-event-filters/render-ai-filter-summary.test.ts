import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DateAnchor, DateOffsetUnit, DayOfWeek } from '../events/buildEventsQueryCondition.js';
import { renderAIFilterSummary, AIFilterSummaryLabels } from './render-ai-filter-summary.js';

describe('renderAIFilterSummary', () => {
  const lbls: AIFilterSummaryLabels = {
    noFilter: 'All events',
    accountIdPrefix: 'acc:',
    accountIdTemplate: 'acc:{accountId}',
    types: { C: 'Concerts' },
    typeSeparator: ',',
    typesPrefix: 't:',
    categories: { M: 'Music' },
    categorySeparator: ',',
    categoriesPrefix: 'c:',
    keywordPrefix: 'kw:',
    keywordTemplate: "kw:'{keyword}'",
    anchors: { TODAY: 'today' },
    units: { DAY: 'day' },
    dateRangeTemplate: '{anchor}{sign}{amount}{unit}',
    daysOfWeek: { FRI: 'Friday' },
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
    caveatSeparator: '|'
  };

  it('handles empty/null cases', () => {
    assert.equal(renderAIFilterSummary(null, null, lbls).summary, 'All events');
    assert.equal(renderAIFilterSummary({}, [], lbls).summary, 'All events');
  });

  it('renders accountId', () => {
    assert.equal(renderAIFilterSummary({ accountId: '123' }, null, lbls).summary, 'acc:123');
    assert.equal(renderAIFilterSummary({ accountId: '123' }, null, { ...lbls, accountIdTemplate: undefined }).summary, 'acc:123');
  });

  it('renders types and categories', () => {
    assert.equal(renderAIFilterSummary({ types: ['C'], categories: ['M'] }, null, lbls).summary, 't:Concerts c:Music');
    assert.equal(renderAIFilterSummary({ types: ['X'], categories: ['Y'] }, null, lbls).summary, 't:X c:Y');
  });

  it('renders keyword', () => {
    assert.equal(renderAIFilterSummary({ keyword: 'jazz' }, null, lbls).summary, "kw:'jazz'");
    assert.equal(renderAIFilterSummary({ keyword: 'jazz' }, null, { ...lbls, keywordTemplate: undefined }).summary, "kw:'jazz'");
  });

  it('renders dateRange', () => {
    assert.equal(renderAIFilterSummary({ dateRange: { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY } }, null, lbls).summary, 'today');
    assert.equal(renderAIFilterSummary({ dateRange: { anchor: DateAnchor.TODAY, offsetAmount: 2, offsetUnit: DateOffsetUnit.DAY } }, null, lbls).summary, 'today+2day');
    assert.equal(renderAIFilterSummary({ dateRange: { anchor: DateAnchor.TODAY, offsetAmount: -1, offsetUnit: DateOffsetUnit.DAY } }, null, lbls).summary, 'today-1day');
    assert.equal(renderAIFilterSummary({ dateRange: { anchor: DateAnchor.TODAY, offsetAmount: 2, offsetUnit: DateOffsetUnit.DAY } }, null, { ...lbls, dateRangeTemplate: undefined }).summary, 'today + 2 day');
  });

  it('renders dayOfWeek', () => {
    assert.equal(renderAIFilterSummary({ dayOfWeek: 'FRI' }, null, lbls).summary, 'Friday');
    assert.equal(renderAIFilterSummary({ dayOfWeek: 'MON' as DayOfWeek }, null, { ...lbls, daysOfWeek: undefined }).summary, 'MON');
  });

  it('renders location', () => {
    assert.equal(renderAIFilterSummary({ location: { adminArea: 'Berlin' } }, null, lbls).summary, 'in:Berlin');
    assert.equal(renderAIFilterSummary({ location: { adminArea: 'Berlin' } }, null, { ...lbls, adminAreaTemplate: undefined }).summary, 'in:Berlin');
    assert.equal(renderAIFilterSummary({ location: { coordinates: { lat: 1, lng: 2 } } }, null, lbls).summary, 'near me');
    assert.equal(renderAIFilterSummary({ location: { coordinates: { lat: 1, lng: 2 }, radiusMeters: 5000 } }, null, lbls).summary, 'within:5km');
    assert.equal(renderAIFilterSummary({ location: { coordinates: { lat: 1, lng: 2 }, radiusMeters: 5000 } }, null, { ...lbls, nearMeWithRadiusTemplate: undefined }).summary, 'within:5km of me');
  });

  it('renders venueType', () => {
    assert.equal(renderAIFilterSummary({ venueType: 'Club' }, null, lbls).summary, 'at:Club');
    assert.equal(renderAIFilterSummary({ venueType: 'Club' }, null, { ...lbls, venueTypeTemplate: undefined }).summary, 'at:Club');
  });

  it('renders free and paid flags', () => {
    assert.equal(renderAIFilterSummary({ isFree: true }, null, lbls).summary, 'free');
    assert.equal(renderAIFilterSummary({ isFree: false }, null, lbls).summary, 'paid');
  });

  it('renders all fields in order', () => {
    const res = renderAIFilterSummary({
      accountId: '123',
      types: ['C'],
      categories: ['M'],
      keyword: 'jazz',
      dateRange: { anchor: DateAnchor.TODAY, offsetAmount: 0, offsetUnit: DateOffsetUnit.DAY },
      location: { adminArea: 'Berlin' },
      venueType: 'Club',
      isFree: true
    }, null, lbls);
    assert.equal(res.summary, "acc:123 t:Concerts c:Music kw:'jazz' today in:Berlin at:Club free");
  });

  it('renders caveats', () => {
    const res = renderAIFilterSummary({ keyword: 'jazz' }, ['err1', 'err2'], lbls);
    assert.equal(res.summary, "kw:'jazz'");
    assert.equal(res.caveatsText, 'cav:err1|cav:err2');

    const resDef = renderAIFilterSummary({ keyword: 'jazz' }, ['err1', 'err2'], { ...lbls, caveatPrefix: undefined, caveatSeparator: undefined });
    assert.equal(resDef.caveatsText, 'err1\nerr2');
  });
});

