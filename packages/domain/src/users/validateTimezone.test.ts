import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { isValidIanaTimezone } from './validateTimezone.js';

describe('isValidIanaTimezone', () => {
  it('returns true for valid IANA timezones', () => {
    assert.equal(isValidIanaTimezone('America/New_York'), true);
    assert.equal(isValidIanaTimezone('Asia/Jakarta'), true);
    assert.equal(isValidIanaTimezone('UTC'), true);
    assert.equal(isValidIanaTimezone('Etc/UTC'), true);
  });

  it('returns false for invalid or empty strings', () => {
    assert.equal(isValidIanaTimezone(''), false);
    assert.equal(isValidIanaTimezone('garbage'), false);
    assert.equal(isValidIanaTimezone('Not/AZone'), false);
  });

  it('returns false for non-string inputs', () => {
    assert.equal(isValidIanaTimezone(null as any), false);
    assert.equal(isValidIanaTimezone(undefined as any), false);
    assert.equal(isValidIanaTimezone(123 as any), false);
  });
});
