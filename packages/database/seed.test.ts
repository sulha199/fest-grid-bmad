import { expect, test } from 'vitest';
import {
  isLocalConnectionString,
  FIXTURE_EVENTS,
  FIXTURE_POSTS,
  FIXTURE_POST_ACCOUNT_ASSOCIATIONS,
  FIXTURE_SCHEDULES,
  FIXTURE_REPORTS,
  FIXTURE_USERS,
} from './seed';
import { isScheduleLocationConsistent } from '@festgrid/domain/events';
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

// Story 3.18: account-filtered event queries match only through post_account_associations, so a
// seeded post without a PUBLISHER row would silently vanish from its account page and calendar.
test('every FIXTURE_POSTS entry has exactly one PUBLISHER association to its own account', () => {
  expect(FIXTURE_POST_ACCOUNT_ASSOCIATIONS).toHaveLength(FIXTURE_POSTS.length);
  for (const post of FIXTURE_POSTS) {
    const rows = FIXTURE_POST_ACCOUNT_ASSOCIATIONS.filter((a) => a.postId === post.id);
    expect(rows).toEqual([{ postId: post.id, accountId: post.accountId, role: 'PUBLISHER' }]);
  }
});

// The correction form validates a submission with isScheduleLocationConsistent, so a fixture that
// breaks the rule can be displayed but never saved back unchanged (the Correct Data E2E flow).
test('every FIXTURE_SCHEDULES location contains its event location', () => {
  for (const schedule of FIXTURE_SCHEDULES) {
    const event = FIXTURE_EVENTS.find((e) => e.id === schedule.eventId);
    expect(event, `schedule ${schedule.id} has no event fixture`).toBeDefined();
    if (!event?.location || !schedule.location) continue;
    expect(isScheduleLocationConsistent(event.location, schedule.location), schedule.id).toBe(true);
  }
});

// The cancellation threshold counts distinct reporters and fake auth signs in as the first moderator and
// the first plain user, so the seeded reports must not already use up either of them -- otherwise no
// signed-in account can be the "third reporter" the cancellation E2E flow needs.
test('seeded reports on the cancellation fixture leave both sign-in accounts free to be the next reporter', () => {
  const signInIds = new Set([
    FIXTURE_USERS.find((u) => u.role === 'moderator')?.id,
    FIXTURE_USERS.find((u) => u.role === 'user')?.id,
  ]);
  const seededReporters = FIXTURE_REPORTS.filter((r) => r.eventId === '40000000-0000-0000-0000-000000000004').map(
    (r) => r.reporterUserId,
  );
  expect(new Set(seededReporters).size).toBe(2);
  for (const reporter of seededReporters) expect(signInIds.has(reporter)).toBe(false);
});
