/**
 * The fake-auth fixture mints logins that the backend will accept, so it must be impossible to
 * point at anything but a developer's own machine. Every entry point calls these first.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export class NonLocalTargetError extends Error {}

/** Throws unless `value` is a URL whose host is loopback. `label` names the setting in the error. */
export function assertLocalUrl(label: string, value: string | undefined): URL {
  if (!value) throw new NonLocalTargetError(`${label} is not set; fake auth refuses to run without a local target.`);
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new NonLocalTargetError(`${label} is not a valid URL: "${value}".`);
  }
  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    throw new NonLocalTargetError(`${label} points at "${url.hostname}", not this machine; fake auth refuses to run.`);
  }
  return url;
}

/** Same rule for a Postgres connection string (`postgresql://user:pw@host:port/db`). */
export function assertLocalDatabase(databaseUrl: string | undefined): void {
  assertLocalUrl('DATABASE_URL', databaseUrl);
}
