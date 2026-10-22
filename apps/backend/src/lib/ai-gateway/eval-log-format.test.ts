import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { truncateForLog } from './eval-log-format.js';

describe('truncateForLog', () => {
  it('collapses pretty-printed JSON onto one line', () => {
    assert.equal(truncateForLog('{\n  "expression": {\n    "keyword": "jazz"\n  },\n  "caveats": []\n}', 200), '{ "expression": { "keyword": "jazz" }, "caveats": [] }');
  });

  it('leaves text at or under the limit untouched', () => {
    assert.equal(truncateForLog('abcde', 5), 'abcde');
    assert.equal(truncateForLog('  padded  ', 10), 'padded');
    assert.equal(truncateForLog('', 5), '');
  });

  it('cuts longer text at the limit and says how many characters were dropped', () => {
    assert.equal(truncateForLog('abcdefghij', 4), 'abcd... (+6 chars)');
  });

  it('measures the limit after whitespace is collapsed', () => {
    assert.equal(truncateForLog('a   b\n\n c', 5), 'a b c');
  });
});
