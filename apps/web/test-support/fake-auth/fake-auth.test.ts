// @vitest-environment node
import { generateKeyPairSync, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { assertLocalDatabase, assertLocalUrl, NonLocalTargetError } from './local-guard';
import { buildSessionCookie, sessionCookieName, toStorageState } from './fake-supabase';

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
