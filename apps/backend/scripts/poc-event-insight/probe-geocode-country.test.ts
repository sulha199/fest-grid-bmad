import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DESCRIPTIONS, buildUrl, pickByConfidence } from './probe-geocode-country.js';

test('the three strategies differ exactly in the country parameter', () => {
  const base = buildUrl('Jogja', 'no-bias', 'id');
  assert.ok(!base.includes('countrycode'));
  assert.ok(buildUrl('Jogja', 'bias', 'id').endsWith('&bias=countrycode:id'));
  assert.ok(buildUrl('Jogja', 'filter', 'id').endsWith('&filter=countrycode:id'));
});

test('the production bias URL matches what geoapify-client.ts builds (limit 5, bias appended last)', () => {
  assert.equal(buildUrl('a b', 'bias', 'id', 'K'), 'https://api.geoapify.com/v1/geocode/search?text=a%20b&format=json&limit=5&apiKey=K&bias=countrycode:id');
});

test('today\'s pick is the highest confidence wherever it is (the behaviour under test)', () => {
  const best = pickByConfidence([
    { country_code: 'id', formatted: 'Yogyakarta, ID', rank: { confidence: 0.4 } },
    { country_code: 'us', formatted: 'Jogja Ave, US', rank: { confidence: 0.8 } },
  ]);
  assert.equal(best?.country_code, 'us');
  assert.equal(pickByConfidence([]), undefined);
});

test('the probe covers the curator\'s 12 descriptions plus controls', () => {
  assert.ok(DESCRIPTIONS.length >= 12);
  assert.ok(DESCRIPTIONS.includes('omah noto plankton'));
});
