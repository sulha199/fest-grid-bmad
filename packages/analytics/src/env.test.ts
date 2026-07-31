import { expect, test } from 'vitest';
import { parsePostHogDefaults } from './env';

test('parsePostHogDefaults', () => {
  expect(parsePostHogDefaults('2026-05-30')).toBe('2026-05-30');
  expect(parsePostHogDefaults('invalid')).toBeUndefined();
  expect(parsePostHogDefaults(undefined)).toBeUndefined();
});
