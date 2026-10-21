/**
 * A hard stop for the measurement scripts. perf-features / perf-candidates / perf-scoring / perf-variants add columns, tables and indexes
 * (`ALTER TABLE events ADD COLUMN bench_*`, `CREATE INDEX`), and perf-request / plan-guard-run run `EXPLAIN (ANALYZE)` on every statement the
 * real resolver emits — which executes it, including the `INSERT … ON CONFLICT DO UPDATE` on `user_settings` that a signed-in request makes.
 * None of that may ever touch a shared or production database. They therefore refuse any DATABASE_URL whose host is not this machine.
 * There is no override. Production is only ever touched by prod-readonly-check.ts, which is SELECT/SHOW-only by construction.
 */
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/** True when the connection string points at this machine over TCP loopback. Anything Node cannot parse (including unix-socket forms) is refused: fail closed. */
export function isLocalDatabaseUrl(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Returns the URL unchanged when it is local; throws (naming only the host, never credentials) otherwise. */
export function scratchDatabaseUrl(url: string | undefined, script: string): string {
  if (!url) throw new Error(`${script}: no DATABASE_URL — it needs a scratch database on this machine.`);
  if (!isLocalDatabaseUrl(url)) {
    let host = '(unparseable)';
    try { host = new URL(url).hostname || host; } catch { /* keep the placeholder */ }
    throw new Error(`${script} refuses to run against ${host}: it creates columns, tables and indexes and executes captured statements (including writes), so it only runs against a database on this machine (127.0.0.1 / localhost). For production use prod-readonly-check.ts.`);
  }
  return url;
}
