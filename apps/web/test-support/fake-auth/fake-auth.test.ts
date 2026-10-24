// @vitest-environment node
import { generateKeyPairSync, verify } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertLocalDatabase, assertLocalSupabaseEnv, assertLocalUrl, NonLocalTargetError } from './local-guard';
import { buildSessionCookie, sessionCookieName, startFakeSupabase, toStorageState } from './fake-supabase';
import { assertFakeAuthPreconditions, startFakeAuth } from './index';

describe('local guard', () => {
  it.each(['http://localhost:3000', 'http://127.0.0.1:54321', 'http://[::1]:3000'])('accepts %s', (url) => {
    expect(() => assertLocalUrl('x', url)).not.toThrow();
  });

  it.each(['https://abc.supabase.co', 'http://festgrid.app', 'http://localhost.evil.com'])('rejects %s', (url) => {
    expect(() => assertLocalUrl('x', url)).toThrow(NonLocalTargetError);
  });

  it('rejects missing and malformed values', () => {
    expect(() => assertLocalUrl('SUPABASE_URL', undefined)).toThrow(/not set/);
    expect(() => assertLocalUrl('SUPABASE_URL', 'not a url')).toThrow(/not a valid URL/);
  });

  it('treats all of 127.0.0.0/8 as loopback but not 0.0.0.0', () => {
    expect(() => assertLocalUrl('x', 'http://127.0.0.2:3000')).not.toThrow();
    expect(() => assertLocalUrl('x', 'http://0.0.0.0:3000')).toThrow(NonLocalTargetError);
  });

  it('rejects a DATABASE_URL whose ?host= override points off-machine, but allows a socket directory', () => {
    expect(() => assertLocalDatabase('postgresql://u:p@localhost/festgrid?host=db.prod.example.com')).toThrow(/\?host=/);
    expect(() => assertLocalDatabase('postgresql://u:p@localhost/festgrid?host=/var/run/postgresql')).not.toThrow();
  });

  it('rejects a configured hosted Supabase URL (a reused server would keep trusting it)', () => {
    expect(() => assertLocalSupabaseEnv({ SUPABASE_URL: 'https://abc.supabase.co' } as NodeJS.ProcessEnv)).toThrow(NonLocalTargetError);
    expect(() => assertLocalSupabaseEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' } as NodeJS.ProcessEnv)).toThrow(NonLocalTargetError);
    expect(() => assertLocalSupabaseEnv({ SUPABASE_URL: 'http://127.0.0.1:54321' } as NodeJS.ProcessEnv)).not.toThrow();
    expect(() => assertLocalSupabaseEnv({} as NodeJS.ProcessEnv)).not.toThrow();
  });

  it('applies the same rule to DATABASE_URL', () => {
    expect(() => assertLocalDatabase('postgresql://u:p@localhost:5432/festgrid')).not.toThrow();
    expect(() => assertLocalDatabase('postgresql://u:p@db.prod.example.com:5432/festgrid')).toThrow(NonLocalTargetError);
  });
});

describe('session cookie', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const user = { id: '8d01845c-dc75-4e71-890d-49893bfa366e', email: 'mod@local.test', name: 'Mod' };
  const cookie = buildSessionCookie('http://localhost:54321', privateKey, user, 1_700_000_000);

  it('uses the cookie name @supabase/ssr derives from the project host', () => {
    expect(sessionCookieName('http://localhost:54321')).toBe('sb-localhost-auth-token');
    expect(sessionCookieName('https://abcdef.supabase.co')).toBe('sb-abcdef-auth-token');
    expect(cookie.name).toBe('sb-localhost-auth-token');
  });

  it('carries a base64url session whose access token is signed by the stub key', () => {
    expect(cookie.value.startsWith('base64-')).toBe(true);
    const session = JSON.parse(Buffer.from(cookie.value.slice('base64-'.length), 'base64url').toString('utf8'));
    expect(session.user.id).toBe(user.id);
    const [header, body, signature] = session.access_token.split('.');
    const ok = verify('RSA-SHA256', Buffer.from(`${header}.${body}`), publicKey, Buffer.from(signature, 'base64url'));
    expect(ok).toBe(true);
    expect(JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))).toMatchObject({ sub: user.id, aud: 'authenticated', exp: 1_700_000_000 + 60 * 60 * 24 * 30 });
  });

  it('is rejected when verified against a different key', () => {
    const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey;
    const session = JSON.parse(Buffer.from(cookie.value.slice('base64-'.length), 'base64url').toString('utf8'));
    const [header, body, signature] = session.access_token.split('.');
    expect(verify('RSA-SHA256', Buffer.from(`${header}.${body}`), other, Buffer.from(signature, 'base64url'))).toBe(false);
  });

  it('becomes a Playwright storage state scoped to the given host', () => {
    const state = toStorageState(cookie, 'localhost');
    expect(state.cookies).toHaveLength(1);
    expect(state.cookies[0]).toMatchObject({ name: cookie.name, domain: 'localhost', path: '/', secure: false });
    expect(state.origins).toEqual([]);
  });
});


describe('startFakeAuth preconditions', () => {
  afterEach(() => vi.unstubAllEnvs());

  const portIsFree = () =>
    new Promise<boolean>((resolve) => {
      const probe = createServer();
      probe.once('error', () => resolve(false));
      probe.listen(54321, '127.0.0.1', () => probe.close(() => resolve(true)));
    });

  it('throws before opening any port when DATABASE_URL is not local', async () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@db.prod.example.com:5432/festgrid');
    await expect(startFakeAuth({ authDir: tmpdir(), baseUrl: 'http://localhost:3000' })).rejects.toThrow(NonLocalTargetError);
    expect(await portIsFree()).toBe(true);
  });

  it('throws when a hosted SUPABASE_URL is configured, even with a local database', () => {
    expect(() =>
      assertFakeAuthPreconditions({ baseUrl: 'http://localhost:3000' }, { DATABASE_URL: 'postgresql://u:p@localhost/db', SUPABASE_URL: 'https://abc.supabase.co' } as NodeJS.ProcessEnv)
    ).toThrow(NonLocalTargetError);
  });
});

describe('startFakeSupabase', () => {
  const dirs: string[] = [];
  const tempKeyFile = () => {
    const dir = mkdtempSync(join(tmpdir(), 'fake-supabase-'));
    dirs.push(dir);
    return join(dir, 'key.json');
  };
  afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('serves the JWKS (ignoring a query string) and 404s everything else', async () => {
    const stub = await startFakeSupabase({ keyFile: tempKeyFile() });
    try {
      const ok = await fetch(`${stub.url}/auth/v1/.well-known/jwks.json?cache=0`);
      expect(ok.status).toBe(200);
      expect((await ok.json()).keys[0]).toMatchObject({ kty: 'RSA', alg: 'RS256', kid: 'local-dev' });
      expect((await fetch(`${stub.url}/auth/v1/user`)).status).toBe(404);
    } finally {
      await stub.close();
    }
  });

  it('regenerates a corrupt key file instead of crashing every later run', async () => {
    const keyFile = tempKeyFile();
    writeFileSync(keyFile, '{"kty": "RSA", "d"');
    const stub = await startFakeSupabase({ keyFile });
    try {
      expect(() => JSON.parse(readFileSync(keyFile, 'utf8'))).not.toThrow();
    } finally {
      await stub.close();
    }
  });

  it('explains a port clash (e.g. a local Supabase CLI) instead of surfacing EADDRINUSE', async () => {
    const first = await startFakeSupabase({ keyFile: tempKeyFile() });
    try {
      await expect(startFakeSupabase({ keyFile: tempKeyFile() })).rejects.toThrow(/already in use/);
    } finally {
      await first.close();
    }
  });
});
