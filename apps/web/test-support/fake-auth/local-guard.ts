/**
 * The fake-auth fixture mints logins that the backend will accept, so it must be impossible to
 * point at anything but a developer's own machine. Every entry point calls these first.
 */

const LOCAL_HOSTNAMES = new Set(['localhost', '[::1]']);
/** The whole 127.0.0.0/8 block is loopback. */
const LOOPBACK_IPV4 = /^127(?:\.\d{1,3}){3}$/;

function isLoopbackHost(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname) || LOOPBACK_IPV4.test(hostname);
}

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
  if (!isLoopbackHost(url.hostname)) {
    throw new NonLocalTargetError(`${label} points at "${url.hostname}", not this machine; fake auth refuses to run.`);
  }
  return url;
}

/**
 * Same rule for a Postgres connection string (`postgresql://user:pw@host:port/db`). libpq also lets a
 * `?host=` query parameter override the URL's host, so that has to be local (or a socket directory) too.
 */
export function assertLocalDatabase(databaseUrl: string | undefined): void {
  const url = assertLocalUrl('DATABASE_URL', databaseUrl);
  const hostOverride = url.searchParams.get('host');
  if (hostOverride && !hostOverride.startsWith('/') && !isLoopbackHost(hostOverride)) {
    throw new NonLocalTargetError(`DATABASE_URL's ?host= points at "${hostOverride}", not this machine; fake auth refuses to run.`);
  }
}

/** Every variable that tells a server which Supabase project to trust must be unset or loopback. */
export function assertLocalSupabaseEnv(env: NodeJS.ProcessEnv = process.env): void {
  for (const name of ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL'] as const) {
    if (env[name]) assertLocalUrl(name, env[name]);
  }
}
