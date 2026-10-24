import { expect, test } from 'vitest';
import { isLocalConnectionString, FIXTURE_EVENTS } from './seed';
import { EventCategory } from '@festgrid/shared-types';

test('isLocalConnectionString', () => {
  expect(isLocalConnectionString('postgres://user:pass@localhost:5432/db')).toBe(true);
  expect(isLocalConnectionString('postgres://user:pass@127.0.0.1:5432/db')).toBe(true);
  expect(isLocalConnectionString('postgres://user:pass@prod-db.example.com:5432/db')).toBe(false);
  expect(isLocalConnectionString('invalid-url')).toBe(false);
});

// Story 0.53 (AD-44 Rule 6): guards against a fixture referencing a stale/typo'd category
// string that isn't (or is no longer) a real EventCategory member -- no DB needed, matches
// the rest of this file's no-DB pattern (seed.integration.test.ts covers the DB-backed cases).
test('every FIXTURE_EVENTS category is a real EventCategory member', () => {
  const validCategories = new Set<string>(Object.values(EventCategory));
  for (const event of FIXTURE_EVENTS) {
    for (const category of event.categories) {
      expect(validCategories.has(category)).toBe(true);
    }
  }
});
