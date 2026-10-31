import test from 'node:test';
import * as assert from 'node:assert';
import { PgDialect, pgTable, text } from 'drizzle-orm/pg-core';
import { buildPastCutoffDateSql, readPastCutoff } from './past-cutoff-sql.js';

const scheduleTestTable = pgTable('schedule_test_table', {
  timezone: text('timezone'),
  timezoneStatus: text('timezone_status'),
});

test('readPastCutoff', async (t) => {
  await t.test('accepts an ISO instant with an integer day count', () => {
    assert.deepStrictEqual(
      readPastCutoff({ instant: '2026-10-31T00:55:00.000Z', hidePastEventsAfterDays: 0 }),
      { instant: '2026-10-31T00:55:00.000Z', hidePastEventsAfterDays: 0 }
    );
  });

  await t.test('drops any extra keys a client smuggled in', () => {
    assert.deepStrictEqual(
      readPastCutoff({ instant: '2026-10-31T00:55:00.000Z', hidePastEventsAfterDays: 7, sql: 'x' }),
      { instant: '2026-10-31T00:55:00.000Z', hidePastEventsAfterDays: 7 }
    );
  });

  await t.test('rejects anything that is not exactly a parseable instant plus an integer', () => {
    assert.strictEqual(readPastCutoff(undefined), undefined);
    assert.strictEqual(readPastCutoff(null), undefined);
    assert.strictEqual(readPastCutoff('2026-10-31'), undefined);
    assert.strictEqual(readPastCutoff({ instant: 'nope', hidePastEventsAfterDays: 0 }), undefined);
    assert.strictEqual(readPastCutoff({ instant: '2026-10-31T00:00:00Z', hidePastEventsAfterDays: '0' }), undefined);
    assert.strictEqual(readPastCutoff({ instant: '2026-10-31T00:00:00Z', hidePastEventsAfterDays: 0.5 }), undefined);
    assert.strictEqual(readPastCutoff({ instant: '2026-10-31T00:00:00Z' }), undefined);
  });
});

test('buildPastCutoffDateSql', async (t) => {
  await t.test('binds the instant and the day count and casts the status enum to text', () => {
    const query = new PgDialect().sqlToQuery(
      buildPastCutoffDateSql(
        { instant: '2026-10-31T00:55:00.000Z', hidePastEventsAfterDays: 14 },
        scheduleTestTable.timezone,
        scheduleTestTable.timezoneStatus
      )
    );
    assert.strictEqual(
      query.sql,
      'schedule_past_cutoff_date($1::timestamptz, "schedule_test_table"."timezone", "schedule_test_table"."timezone_status"::text, $2::integer)'
    );
    assert.deepStrictEqual(query.params, ['2026-10-31T00:55:00.000Z', 14]);
  });
});
