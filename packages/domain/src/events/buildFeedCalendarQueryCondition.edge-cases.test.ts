import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFeedCalendarQueryCondition } from './buildFeedCalendarQueryCondition.js';

describe('buildFeedCalendarQueryCondition without a week range', () => {
  it('returns the subscription scope plus filters, with no schedule overlap condition', () => {
    const result = buildFeedCalendarQueryCondition({
      search: '',
      types: ['MUSIC'],
      categories: [],
      weekStart: '',
      weekEnd: '',
      subscriptions: ['profile-1'],
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'isFromSubscribedAccount', operator: 'eq', value: true },
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['profile-1'] },
        { field: 'types', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });
});
