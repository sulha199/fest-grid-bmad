import { expect, test } from 'vitest';
import { cn } from './utils';

test('cn merges classes', () => {
  expect(cn('a', 'b')).toBe('a b');
  expect(cn('a', { b: true, c: false })).toBe('a b');
});
