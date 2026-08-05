import test from 'node:test';
import assert from 'node:assert/strict';
import { meetsAutocompleteInputThreshold, MIN_AUTOCOMPLETE_INPUT_LENGTH } from './validate-autocomplete-input.js';

test('MIN_AUTOCOMPLETE_INPUT_LENGTH is 3', () => {
  assert.equal(MIN_AUTOCOMPLETE_INPUT_LENGTH, 3);
});

test('meetsAutocompleteInputThreshold returns false below threshold', () => {
  assert.equal(meetsAutocompleteInputThreshold(''), false);
  assert.equal(meetsAutocompleteInputThreshold('a'), false);
  assert.equal(meetsAutocompleteInputThreshold('ab'), false);
});

test('meetsAutocompleteInputThreshold returns true at or above threshold', () => {
  assert.equal(meetsAutocompleteInputThreshold('abc'), true);
  assert.equal(meetsAutocompleteInputThreshold('abcd'), true);
});

test('meetsAutocompleteInputThreshold trims whitespace before measuring', () => {
  assert.equal(meetsAutocompleteInputThreshold('  ab  '), false);
  assert.equal(meetsAutocompleteInputThreshold('  abc  '), true);
});
