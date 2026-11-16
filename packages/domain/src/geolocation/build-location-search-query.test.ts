import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLocationSearchQuery } from './build-location-search-query.js';

test('joins keywords with a space', () => {
  assert.equal(buildLocationSearchQuery({ keywords: ['Pasar Porosjayan', 'Gamping', 'Sleman'], name: 'Pasar' }), 'Pasar Porosjayan Gamping Sleman');
});

test('drops blank keywords and trims', () => {
  assert.equal(buildLocationSearchQuery({ keywords: [' A ', '', '  ', 'B'], name: 'x' }), 'A B');
});

test('falls back to the display name for empty or missing keywords', () => {
  assert.equal(buildLocationSearchQuery({ keywords: [], name: ' Central Park ' }), 'Central Park');
  assert.equal(buildLocationSearchQuery({ keywords: null, name: 'Central Park' }), 'Central Park');
  assert.equal(buildLocationSearchQuery({ name: 'Central Park' }), 'Central Park');
});

test('appends the city to the name for an account default location', () => {
  assert.equal(buildLocationSearchQuery({ name: 'Pakuwon Mall', city: 'Yogyakarta' }), 'Pakuwon Mall Yogyakarta');
});

test('does not repeat a city the name already contains', () => {
  assert.equal(buildLocationSearchQuery({ name: 'Yogyakarta City Hall', city: 'yogyakarta' }), 'Yogyakarta City Hall');
});

test('ignores a blank city', () => {
  assert.equal(buildLocationSearchQuery({ name: 'Pakuwon Mall', city: '  ' }), 'Pakuwon Mall');
});

test('uses the city alone when there is no name', () => {
  assert.equal(buildLocationSearchQuery({ city: 'Yogyakarta' }), 'Yogyakarta');
});

test('returns an empty string when there is nothing to search', () => {
  assert.equal(buildLocationSearchQuery({}), '');
  assert.equal(buildLocationSearchQuery({ keywords: [], name: ' ', city: null }), '');
});
