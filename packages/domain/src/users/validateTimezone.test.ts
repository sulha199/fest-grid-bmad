import test from 'node:test';
import * as assert from 'node:assert';
import { isValidIanaTimezone } from './validateTimezone.js';

test('isValidIanaTimezone', async (t) => {
  await t.test('valid IANA zones return true', () => {
    assert.strictEqual(isValidIanaTimezone('America/New_York'), true);
    assert.strictEqual(isValidIanaTimezone('Asia/Jakarta'), true);
    assert.strictEqual(isValidIanaTimezone('UTC'), true);
    assert.strictEqual(isValidIanaTimezone('Etc/UTC'), true);
  });

  await t.test('invalid strings return false', () => {
    assert.strictEqual(isValidIanaTimezone(''), false);
    assert.strictEqual(isValidIanaTimezone('garbage'), false);
    assert.strictEqual(isValidIanaTimezone('Not/AZone'), false);
    assert.strictEqual(isValidIanaTimezone('invalid/timezone'), false);
  });

  await t.test('non-string values return false', () => {
    assert.strictEqual(isValidIanaTimezone(null as any), false);
    assert.strictEqual(isValidIanaTimezone(undefined as any), false);
    assert.strictEqual(isValidIanaTimezone(123 as any), false);
    assert.strictEqual(isValidIanaTimezone({} as any), false);
  });
});
