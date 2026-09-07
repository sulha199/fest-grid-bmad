import test from 'node:test';
import * as assert from 'node:assert';
import {
  matchesChildrensDataKeywordFilter,
  CHILDRENS_DATA_KEYWORDS,
} from './matches-childrens-data-keyword-filter.js';

test('matchesChildrensDataKeywordFilter', async (t) => {
  for (const keyword of CHILDRENS_DATA_KEYWORDS) {
    await t.test(`matches "${keyword}" case-insensitively (lowercase)`, () => {
      assert.strictEqual(
        matchesChildrensDataKeywordFilter(`Come join our ${keyword} event this weekend!`),
        true
      );
    });

    await t.test(`matches "${keyword}" case-insensitively (uppercase)`, () => {
      assert.strictEqual(
        matchesChildrensDataKeywordFilter(`Come join our ${keyword.toUpperCase()} event this weekend!`),
        true
      );
    });
  }

  await t.test('matches "Anak" with mixed case', () => {
    assert.strictEqual(matchesChildrensDataKeywordFilter('Festival Anak Ceria 2026'), true);
  });

  await t.test('matches "CILIK" fully uppercase', () => {
    assert.strictEqual(matchesChildrensDataKeywordFilter('Lomba Nyanyi CILIK Tingkat Kota'), true);
  });

  await t.test('does not false-match "SD" inside "USD"', () => {
    assert.strictEqual(matchesChildrensDataKeywordFilter('Tickets are priced at 50 USD per person'), false);
  });

  await t.test('does not false-match "TK" inside "Saturday"', () => {
    assert.strictEqual(matchesChildrensDataKeywordFilter('Doors open every Saturday at noon'), false);
  });

  await t.test('does not false-match "TK" inside "TKO"', () => {
    assert.strictEqual(matchesChildrensDataKeywordFilter('The boxer won by TKO in round two'), false);
  });

  await t.test('returns false for whole text with no keyword present', () => {
    assert.strictEqual(
      matchesChildrensDataKeywordFilter('Live jazz night at the downtown lounge, doors at 8pm'),
      false
    );
  });

  await t.test('returns false for undefined input', () => {
    assert.strictEqual(matchesChildrensDataKeywordFilter(undefined), false);
  });

  await t.test('returns false for null input', () => {
    assert.strictEqual(matchesChildrensDataKeywordFilter(null), false);
  });

  await t.test('returns false for empty-string input', () => {
    assert.strictEqual(matchesChildrensDataKeywordFilter(''), false);
  });
});
