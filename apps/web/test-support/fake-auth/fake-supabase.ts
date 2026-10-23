/**
 * Stand-in for the one Supabase surface this app's auth depends on: the backend verifies a
 * `Bearer` JWT against `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` (no issuer/audience check),
 * and the web app reads its session from the `sb-<host>-auth-token` cookie. So a local JWKS plus a
 * session cookie signed by it is a complete login, with no network access to a real project.
 *
 * Test tooling only: never imported by the app, and every entry point is localhost-guarded.
 */

import { createServer, type Server } from 'node:http';
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, type JsonWebKey, type KeyObject } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { assertLocalUrl } from './local-guard';

export const FAKE_SUPABASE_PORT = 54321;
export const FAKE_ANON_KEY = 'local-fake-anon-key';
const KEY_ID = 'local-dev';
/** `@supabase/ssr` splits cookies above this encoded length into `.0`, `.1`...; our sessions never reach it. */
const MAX_COOKIE_VALUE_LENGTH = 3180;
const SESSION_LIFETIME_SECONDS = 60 * 60 * 24 * 30;

export interface FakeUser {
  id: string;
  email: string;
  name: string;
}

export interface SessionCookie {
  name: string;
  value: string;
}

export interface StorageStateCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
}

export interface FakeSupabase {
  readonly url: string;
  issueSession(user: FakeUser): SessionCookie;
  close(): Promise<void>;
}

const base64Url = (input: string | Buffer) => Buffer.from(input).toString('base64url');

/** `@supabase/ssr` derives the cookie name from the project host: `sb-<first label>-auth-token`. */
export function sessionCookieName(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

export function signJwt(privateKey: KeyObject, claims: Record<string, unknown>): string {
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: KEY_ID }));
  const body = base64Url(JSON.stringify(claims));
  const signature = sign('RSA-SHA256', Buffer.from(`${header}.${body}`), privateKey).toString('base64url');
  return `${header}.${body}.${signature}`;
}

/** Builds the exact cookie shape `@supabase/ssr` reads back: `base64-` + base64url(session JSON). */
export function buildSessionCookie(supabaseUrl: string, privateKey: KeyObject, user: FakeUser, nowSeconds = Math.floor(Date.now() / 1000)): SessionCookie {
  const expiresAt = nowSeconds + SESSION_LIFETIME_SECONDS;
  const userMetadata = { name: user.name, full_name: user.name };
  const accessToken = signJwt(privateKey, {
    sub: user.id,
    email: user.email,
    aud: 'authenticated',
    role: 'authenticated',
    iat: nowSeconds,
    exp: expiresAt,
    user_metadata: userMetadata,
  });
  const session = {
    access_token: accessToken,
    token_type: 'bearer',
    expires_in: SESSION_LIFETIME_SECONDS,
    expires_at: expiresAt,
    refresh_token: 'local-fake-refresh-token',
    user: {
      id: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      user_metadata: userMetadata,
      app_metadata: {},
      created_at: new Date(nowSeconds * 1000).toISOString(),
    },
  };
  const value = `base64-${base64Url(JSON.stringify(session))}`;
  if (value.length > MAX_COOKIE_VALUE_LENGTH) {
    throw new Error(`Fake session cookie is ${value.length} chars; @supabase/ssr would chunk it, which this fixture does not emulate.`);
  }
  return { name: sessionCookieName(supabaseUrl), value };
}

export function toStorageState(cookie: SessionCookie, hostname = 'localhost') {
  const stateCookie: StorageStateCookie = {
    ...cookie,
    domain: hostname,
    path: '/',
    expires: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  };
  return { cookies: [stateCookie], origins: [] };
}

/**
 * The backend caches the JWKS it fetched, so a fresh key on every run would make a reused backend
 * reject new tokens. Persisting the (throwaway, localhost-only) key keeps runs compatible.
 */
function loadOrCreateKeyPair(keyFile: string): { privateKey: KeyObject; publicJwk: JsonWebKey } {
  if (existsSync(keyFile)) {
    const privateKey = createPrivateKey({ key: JSON.parse(readFileSync(keyFile, 'utf8')) as JsonWebKey, format: 'jwk' });
    return { privateKey, publicJwk: createPublicKey(privateKey).export({ format: 'jwk' }) };
  }
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  mkdirSync(dirname(keyFile), { recursive: true });
  writeFileSync(keyFile, JSON.stringify(privateKey.export({ format: 'jwk' })), { mode: 0o600 });
  return { privateKey, publicJwk: publicKey.export({ format: 'jwk' }) };
}

export async function startFakeSupabase(options: { keyFile: string; port?: number; supabaseUrl?: string }): Promise<FakeSupabase> {
  const port = options.port ?? FAKE_SUPABASE_PORT;
  const supabaseUrl = options.supabaseUrl ?? `http://localhost:${port}`;
  assertLocalUrl('SUPABASE_URL', supabaseUrl);

  const { privateKey, publicJwk } = loadOrCreateKeyPair(options.keyFile);
  const jwks = JSON.stringify({ keys: [{ ...publicJwk, kid: KEY_ID, alg: 'RS256', use: 'sig' }] });

  const server: Server = createServer((req, res) => {
    if (req.url === '/auth/v1/.well-known/jwks.json') {
      res.setHeader('content-type', 'application/json');
      res.end(jwks);
      return;
    }
    res.statusCode = 404;
    res.end('{}');
  });
  // 127.0.0.1 only: the stub must not be reachable from other machines.
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });

  return {
    url: supabaseUrl,
    issueSession: (user) => buildSessionCookie(supabaseUrl, privateKey, user),
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
