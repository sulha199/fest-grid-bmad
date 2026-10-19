/**
 * Pure pieces of the read-only production check: the statement policy and the aggregate-only pack. No I/O, no imports — so they are unit-tested
 * without a database (readonly-policy.test.ts) and can be read in one sitting by whoever is asked to approve running the pack.
 */
// statement policy
const FORBIDDEN_WORDS = ['insert', 'update', 'delete', 'merge', 'truncate', 'alter', 'drop', 'create', 'grant', 'revoke', 'copy', 'call', 'do', 'vacuum', 'reindex', 'cluster', 'refresh', 'comment', 'lock', 'listen', 'notify', 'prepare', 'execute', 'discard', 'reset', 'import', 'security', 'into'];
const FORBIDDEN_FUNCTIONS = ['nextval', 'setval', 'set_config', 'pg_terminate_backend', 'pg_cancel_backend', 'pg_sleep', 'pg_reload_conf', 'pg_rotate_logfile', 'pg_read_file', 'pg_read_binary_file', 'pg_ls_dir', 'lo_import', 'lo_export', 'lo_unlink', 'dblink', 'pg_advisory_lock', 'pg_advisory_xact_lock', 'pg_switch_wal', 'pg_create_restore_point'];

/** Removes comments, string literals and quoted identifiers so keyword scans cannot be fooled by (or trip over) their contents. */
export function stripLiteralsAndComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--[^\n]*/g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""');
}

/** Throws unless the statement is a single SELECT / SHOW / WITH…SELECT / EXPLAIN of one of those, with no write keyword or side-effect function. */
export function assertReadOnlySql(sql: string): void {
  const bare = stripLiteralsAndComments(sql).trim().replace(/;\s*$/, '');
  if (!bare) throw new Error('empty statement');
  if (bare.includes(';')) throw new Error('more than one statement');
  const lower = bare.toLowerCase();
  const explain = lower.match(/^explain\s*(\([^)]*\))?\s*([\s\S]*)$/);
  const body = explain ? explain[2] : lower;
  if (!/^(select|show|with)\b/.test(body)) throw new Error(`only SELECT / SHOW / EXPLAIN are allowed (got "${body.slice(0, 20)}")`);
  const words = new Set(body.match(/[a-z_][a-z0-9_]*/g) ?? []);
  for (const w of FORBIDDEN_WORDS) if (words.has(w)) throw new Error(`forbidden keyword: ${w}`);
  for (const f of FORBIDDEN_FUNCTIONS) if (words.has(f)) throw new Error(`forbidden function: ${f}`);
}

/** host:port/database only — never the user or password. */
export function describeTarget(url: string): string {
  try { const u = new URL(url); return `${u.hostname}${u.port ? ':' + u.port : ''}${u.pathname}`; } catch { return '(unparseable url)'; }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// the pack (aggregates only; table and column names validated against the repository's migrations on a scratch database)
export const HOT_TABLES = ['events', 'schedules', 'posts', 'social_media_account_profiles', 'favorites', 'reports'];
export const SENSITIVE_TABLES = ['users', 'api_keys', 'fcm_tokens', 'user_settings', 'user_locations', 'subscriptions', 'calendar_additions'];

export interface PackItem { title: string; note?: string; sql: string }
export const PACK: PackItem[] = [
  { title: 'Server settings', sql: `select current_setting('server_version') as server_version, current_setting('jit') as jit, current_setting('jit_above_cost') as jit_above_cost, current_setting('jit_inline_above_cost') as jit_inline_above_cost, current_setting('jit_optimize_above_cost') as jit_optimize_above_cost, current_setting('max_connections') as max_connections, current_setting('shared_buffers') as shared_buffers, current_setting('work_mem') as work_mem, current_setting('max_parallel_workers_per_gather') as max_parallel_workers_per_gather, current_setting('statement_timeout') as statement_timeout` },
  { title: 'Table sizes (planner estimates)', sql: `select c.relname as table_name, c.reltuples::bigint as estimated_rows, pg_size_pretty(pg_total_relation_size(c.oid)) as total_size from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r' and c.relname in ('events','schedules','posts','social_media_account_profiles','favorites','reports') order by pg_total_relation_size(c.oid) desc` },
  { title: 'Events', note: 'events_per_event_post is the ratio the forecast assumed to be 1.0', sql: `select count(*) filter (where deleted_at is null) as events, count(*) filter (where deleted_at is not null) as soft_deleted, count(distinct post_id) filter (where deleted_at is null) as posts_with_events, round(count(*) filter (where deleted_at is null)::numeric / nullif(count(distinct post_id) filter (where deleted_at is null), 0), 2) as events_per_event_post, count(*) filter (where deleted_at is null and detail_level = 'stub') as stubs from events` },
  { title: 'Events created per month (last 13 months)', sql: `select date_trunc('month', created_at)::date as month, count(*) as events from events where deleted_at is null and created_at > now() - interval '13 months' group by 1 order by 1 desc` },
  { title: 'Open (visible) events', note: 'with something still open today — the set Discovery ranks', sql: `select count(distinct s.event_id) as open_events from schedules s join events e on e.id = s.event_id where e.deleted_at is null and coalesce(s.event_end_date, s.event_start_date) >= current_date` },
  { title: 'Schedules and locations', note: 'BUG-063: with_admin_area should be 0 if nothing writes adminArea; BUG-066: low_confidence_pins are stored pins the UI would not trust', sql: `select count(*) as schedules, round(count(*)::numeric / nullif(count(distinct event_id), 0), 2) as schedules_per_event, count(*) filter (where location_details is null) as no_location, count(*) filter (where location_details is not null and location_details->'coordinates' is null) as location_without_coordinates, count(*) filter (where location_details->>'adminArea' is not null) as with_admin_area, count(*) filter (where (location_details->>'confidence') ~ '^[0-9]+(\\.[0-9]+)?$' and (location_details->>'confidence')::float < 0.5) as low_confidence_pins from schedules` },
  { title: 'Country of stored pins', note: 'BUG-066: anything other than the expected country is a candidate wrong-country pin', sql: `select coalesce(location_details->>'countryCode', '(none)') as country_code, count(*) as schedules from schedules group by 1 order by 2 desc limit 15` },
  { title: 'Accounts by classification', note: 'the (null)/(null) row without a location is the legacy set the bulk update would change; IDEA-075', sql: `select coalesce(account_type::text, '(null)') as account_type, coalesce(account_type_status::text, '(null)') as account_type_status, count(*) as accounts, count(*) filter (where default_location is null) as without_default_location from social_media_account_profiles group by 1, 2 order by 3 desc` },
  { title: 'Index use (events, schedules, posts) — least used first', sql: `select relname as table_name, indexrelname as index_name, idx_scan as scans, pg_size_pretty(pg_relation_size(indexrelid)) as size from pg_stat_user_indexes where schemaname = 'public' and relname in ('events','schedules','posts') order by idx_scan asc, pg_relation_size(indexrelid) desc limit 15` },
];
export const STATS_ITEM: PackItem = { title: 'Heaviest statements touching events (pg_stat_statements; needs the extension and pg_read_all_stats)', sql: `select calls, round(mean_exec_time::numeric, 1) as mean_ms, round((total_exec_time / 1000)::numeric, 1) as total_s, rows, left(regexp_replace(query, '\\s+', ' ', 'g'), 110) as statement from pg_stat_statements where query ilike '%from "events"%' order by total_exec_time desc limit 8` };

