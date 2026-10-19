import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertReadOnlySql, describeTarget, PACK, SENSITIVE_TABLES, STATS_ITEM, stripLiteralsAndComments } from './readonly-policy.js';

const ok = (s: string) => assert.doesNotThrow(() => assertReadOnlySql(s), s);
const bad = (s: string, why?: RegExp) => assert.throws(() => assertReadOnlySql(s), why ?? /./, s);

test('accepts SELECT, SHOW, WITH…SELECT and EXPLAIN of those', () => {
  ok('select 1');
  ok('SELECT count(*) FROM events WHERE deleted_at IS NULL;');
  ok('show jit');
  ok('with t as (select 1) select * from t');
  ok('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) select "events"."id" from "events" where "events"."deleted_at" is null');
  ok("select 'a;b' as semicolon_in_literal, \"update\" from t");
});

test('rejects every write, DDL and session-changing statement', () => {
  for (const s of ['insert into events values (1)', 'update events set slug = 1', 'delete from events', 'truncate events', 'alter table events add column x int', 'drop table events', 'create index i on events(id)', 'grant select on events to x', 'copy events to stdout', 'call p()', 'do $$ begin end $$', 'vacuum events', 'refresh materialized view m', 'lock table events', 'prepare p as select 1', 'execute p', 'reset all', 'set jit = off', 'begin', 'commit', 'listen x', 'notify x'])
    bad(s);
});

test('rejects data-modifying CTEs, SELECT INTO, FOR UPDATE, stacked statements and EXPLAIN of a write', () => {
  bad('with d as (delete from events returning id) select * from d');
  bad('select * into backup from events');
  bad('select * from events for update');
  bad('select 1; select 2');
  bad('select 1; drop table events');
  bad('explain analyze update events set slug = 1');
  bad('explain (analyze) delete from events');
});

test('rejects side-effect functions even inside a SELECT', () => {
  for (const f of ['nextval(\'s\')', 'setval(\'s\', 1)', "set_config('x','y',false)", 'pg_terminate_backend(1)', 'pg_sleep(60)', 'pg_advisory_lock(1)', "pg_read_file('/etc/passwd')", "lo_import('/x')"]) bad(`select ${f}`);
});

test('comments and literals cannot hide or fake a keyword', () => {
  bad('select 1 /* harmless */; delete from events');
  bad('select 1 -- ok\n; drop table x');
  ok("select 'drop table events' as text");
  ok('select 1 /* delete from events */');
  assert.equal(stripLiteralsAndComments("select 'it''s' -- c\n, \"Q\"\"x\" /* y */").replace(/\s+/g, ' ').trim(), "select '' , \"\"");
});

test('the pack is read-only, aggregate-only and never names a user-data table or a caption column', () => {
  const all = [...PACK, STATS_ITEM];
  assert.ok(all.length >= 9);
  for (const item of all) {
    assert.doesNotThrow(() => assertReadOnlySql(item.sql), item.title);
    const lower = stripLiteralsAndComments(item.sql).toLowerCase();
    for (const t of SENSITIVE_TABLES) assert.ok(!new RegExp(`\\b${t}\\b`).test(lower), `${item.title} mentions ${t}`);
    assert.ok(!/\bcontent\b|\bcaption\b|\bhandle\b|\busername\b|\bemail\b/.test(lower), `${item.title} reads a caption / handle / email column`);
  }
});

test('describeTarget shows host, port and database only', () => {
  assert.equal(describeTarget('postgres://festgrid_poc_ro:s3cret@db.abcd.supabase.co:5432/postgres'), 'db.abcd.supabase.co:5432/postgres');
  assert.ok(!describeTarget('postgres://u:s3cret@h:1/d').includes('s3cret'));
  assert.equal(describeTarget('garbage'), '(unparseable url)');
});
