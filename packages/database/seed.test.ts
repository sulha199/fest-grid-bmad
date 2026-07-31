import { expect, test } from 'vitest';
import { isLocalConnectionString } from './seed';

test('isLocalConnectionString', () => {
  expect(isLocalConnectionString('postgres://user:pass@localhost:5432/db')).toBe(true);
  expect(isLocalConnectionString('postgres://user:pass@127.0.0.1:5432/db')).toBe(true);
  expect(isLocalConnectionString('postgres://user:pass@prod-db.example.com:5432/db')).toBe(false);
  expect(isLocalConnectionString('invalid-url')).toBe(false);
});
