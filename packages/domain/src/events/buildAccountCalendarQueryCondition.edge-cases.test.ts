import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildAccountCalendarQueryCondition } from './buildAccountCalendarQueryCondition.js';

describe('buildAccountCalendarQueryCondition without a week range', () => {
  it('returns the account scope plus filters, with no schedule overlap condition', () => {
    const result = buildAccountCalendarQueryCondition({
      search: '',
      types: ['MUSIC'],
      categories: [],
      weekStart: '',
      weekEnd: '',
      profileId: 'profile-1',
    });

    assert.deepEqual(result, {
      operator: 'and',
      conditions: [
        { field: 'socialMediaAccountProfileId', operator: 'in', value: ['profile-1'] },
        { field: 'types', operator: 'in', value: ['MUSIC'] },
      ],
    });
  });
});
