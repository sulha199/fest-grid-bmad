/**
 * What the dedup review CLIs print when something unexpected fails. The Actions log is public, so an
 * error's own text (it can carry a host, a user name or a bound parameter) is never printed: only its
 * class, its SQLSTATE code and a fixed hint for that code.
 */

/**
 * Fixed hints for the database error codes these scripts can plausibly hit. They are keyed by the
 * SQLSTATE code only, so they never carry the error's own text.
 */
const DATABASE_ERROR_HINTS: Record<string, string> = {
  '42883': 'a database function was not found; the usual cause is pg_trgm similarity() not being resolvable for this role (the export puts the `extensions` schema on the search path, so check pg_trgm is installed and the role may use it)',
  '42501': 'the role lacks a privilege on a table or function the export reads; use a read-only role with BYPASSRLS and pg_read_all_data (docs/infrastructure/3-database.md)',
  '42P01': 'a table was not found; check DEDUP_REVIEW_READONLY_DATABASE_URL points at the production database',
  '28P01': 'authentication failed; check the DEDUP_REVIEW_READONLY_DATABASE_URL secret',
  '28000': 'the role was refused; check the DEDUP_REVIEW_READONLY_DATABASE_URL secret',
  '25006': 'the database refused a write in a read-only transaction; a read-only run must not write, so this is a bug, or a live run was pointed at a read-only credential',
  '40001': 'a concurrent change made the database refuse a statement; run it again',
};

export function describeUnexpectedFailure(err: unknown, label: string): string {
  const name = err instanceof Error ? err.name : 'Error';
  const rawCode = (err as { code?: unknown } | null)?.code;
  const code = typeof rawCode === 'string' ? rawCode : null;
  const hint = code !== null && Object.hasOwn(DATABASE_ERROR_HINTS, code) ? ` Likely cause: ${DATABASE_ERROR_HINTS[code]}.` : '';
  return `${label} failed: ${name}${code ? ` (${code})` : ''}.${hint} The error's own text is not printed because this log is public; run the same command locally to see it.`;
}
