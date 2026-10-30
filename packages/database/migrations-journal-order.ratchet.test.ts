import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, test, expect } from 'vitest';

// BUG-094 -- drizzle's migrator applies a migration only when its journal `when` is newer than
// the newest migration already recorded in __drizzle_migrations (drizzle-orm pg-core
// dialect.migrate: `lastDbMigration.created_at < migration.folderMillis`). An entry whose `when`
// is not newer than an earlier entry is therefore skipped, silently and for good, on any database
// that already ran the earlier one -- a fresh database (local, CI) applies everything in one pass
// and never shows it. 0056_wide_chimera was skipped on prod this way (its `when` is older than
// 0055's, which had been hand-set to a later time), so the column default and the backfill it
// carried never ran.
//
// The rule: every entry's `when` must be strictly greater than the largest `when` before it. The
// one existing violation is already applied and cannot be edited away, so it is the single named
// exception below. Any other entry out of order (including a future one) fails the test.

interface JournalEntry {
  idx: number;
  tag: string;
  when: number;
}

interface JournalOrderException {
  idx: number;
  tag: string;
}

// The only tolerated violation: 0056 was skipped on prod and is repaired by 0086 (BUG-094).
// Do not add to this list -- fix the new entry's `when` instead. Delete it if 0056 is ever
// brought back in order.
const KNOWN_OUT_OF_ORDER: JournalOrderException = { idx: 56, tag: '0056_wide_chimera' };

function findJournalOrderViolations(
  entries: JournalEntry[],
  exception: JournalOrderException,
): string[] {
  const violations: string[] = [];
  let exceptionUsed = false;
  let newestSoFar = -Infinity;

  for (const entry of entries) {
    if (entry.when <= newestSoFar) {
      if (entry.idx === exception.idx && entry.tag === exception.tag) {
        exceptionUsed = true;
      } else {
        violations.push(
          `${entry.tag} (idx ${entry.idx}): when ${entry.when} is not newer than ${newestSoFar}`,
        );
      }
    }
    newestSoFar = Math.max(newestSoFar, entry.when);
  }

  if (!exceptionUsed) {
    violations.push(
      `known exception ${exception.tag} (idx ${exception.idx}) is not an out-of-order entry ` +
        'in this journal -- it is no longer needed or points at the wrong entry; remove or fix it',
    );
  }

  return violations;
}

function readJournalEntries(): JournalEntry[] {
  const journalPath = resolve(__dirname, 'migrations', 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: JournalEntry[] };
  return journal.entries;
}

describe('migrations/meta/_journal.json order (BUG-094)', () => {
  test('every `when` is strictly newer than all earlier entries, bar the one known exception', () => {
    expect(findJournalOrderViolations(readJournalEntries(), KNOWN_OUT_OF_ORDER)).toEqual([]);
  });
});

describe('findJournalOrderViolations', () => {
  const exception: JournalOrderException = { idx: 2, tag: '0002_c' };
  const journal = (...whens: number[]): JournalEntry[] =>
    whens.map((when, idx) => ({ idx, tag: `000${idx}_${'abcdef'[idx]}`, when }));

  test('accepts increasing entries with the exception out of order', () => {
    // 0002_c is older than 0001_b but the newest-so-far (200) still bounds 0003_d.
    expect(findJournalOrderViolations(journal(100, 200, 150, 300), exception)).toEqual([]);
  });

  test('flags a new entry that is not newer than an earlier one', () => {
    const violations = findJournalOrderViolations(journal(100, 200, 150, 300, 250), exception);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('0004_e');
  });

  test('flags an entry equal to an earlier one (strictly increasing)', () => {
    const violations = findJournalOrderViolations(journal(100, 200, 150, 200), exception);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('0003_d');
  });

  test('flags an entry older than a non-adjacent earlier entry', () => {
    // 0003_d beats its neighbour 0002_c (150) but not 0001_b (200): drizzle would skip it.
    const violations = findJournalOrderViolations(journal(100, 200, 150, 180), exception);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('0003_d');
  });

  test('fails when the exception is no longer out of order', () => {
    const violations = findJournalOrderViolations(journal(100, 200, 250, 300), exception);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toContain('no longer needed');
  });

  test('fails when the exception names the wrong tag for its idx', () => {
    const violations = findJournalOrderViolations(journal(100, 200, 150, 300), {
      idx: 2,
      tag: '0002_wrong',
    });
    expect(violations.some((v) => v.includes('0002_c'))).toBe(true);
    expect(violations.some((v) => v.includes('0002_wrong'))).toBe(true);
  });
});
