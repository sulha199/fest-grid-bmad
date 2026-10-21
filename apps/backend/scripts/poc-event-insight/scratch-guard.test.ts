import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLocalDatabaseUrl, scratchDatabaseUrl } from './scratch-guard.js';

test('loopback URLs are local', () => {
  for (const u of ['postgres://postgres@127.0.0.1:54330/bench', 'postgres://u:p@localhost/db', 'postgres://u@[::1]:5432/db']) assert.equal(isLocalDatabaseUrl(u), true, u);
});

test('anything else is refused: hosted databases, poolers, lookalike names, unparseable strings', () => {
  for (const u of [
    'postgres://postgres:secret@db.abcdefgh.supabase.co:5432/postgres',
    'postgres://postgres.abcd:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
    'postgres://u@localhost.evil.example/db',
    'postgres://u@127.0.0.1.nip.io/db',
    'postgres://u@10.0.0.5/db',
    'postgres://postgres@/bench?host=/tmp/pgbench',   // a unix-socket form Node cannot parse: refused (fail closed) — use 127.0.0.1
    'not a url',
    '',
  ]) assert.equal(isLocalDatabaseUrl(u), false, u);
});

test('scratchDatabaseUrl returns a local URL and throws without leaking credentials for a remote one', () => {
  const local = 'postgres://postgres@127.0.0.1:54330/bench';
  assert.equal(scratchDatabaseUrl(local, 'x'), local);
  assert.throws(() => scratchDatabaseUrl(undefined, 'x'), /no DATABASE_URL/);
  try { scratchDatabaseUrl('postgres://postgres:hunter2@db.abcdefgh.supabase.co:5432/postgres', 'perf-features.ts'); assert.fail('should throw'); } catch (e) {
    const m = (e as Error).message;
    assert.match(m, /perf-features\.ts refuses to run against db\.abcdefgh\.supabase\.co/);
    assert.ok(!m.includes('hunter2') && !m.includes('postgres:'), 'the message must not contain the password or the userinfo');
  }
});
