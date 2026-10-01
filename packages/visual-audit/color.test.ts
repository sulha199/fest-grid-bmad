import test from 'node:test';
import * as assert from 'node:assert';
import { checkColorToken } from './src/rules/color.js';

test('checkColorToken', async (t) => {
  await t.test('passes on an exact match', () => {
    const result = checkColorToken('rgb(30, 41, 59)', 'rgb(30, 41, 59)');
    assert.strictEqual(result.pass, true);
  });

  await t.test('is whitespace/case tolerant', () => {
    const result = checkColorToken('RGB(30,   41,  59)', 'rgb(30, 41, 59)');
    assert.strictEqual(result.pass, true);
  });

  await t.test('fails on any value mismatch (exact match required, not approximate)', () => {
    const result = checkColorToken('rgb(30, 41, 60)', 'rgb(30, 41, 59)');
    assert.strictEqual(result.pass, false);
  });
});
