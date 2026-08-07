import { describe, it, expect } from 'vitest';
import { isSafeRedirectPath } from './is-safe-redirect-path';

describe('isSafeRedirectPath', () => {
  it('identifies valid relative paths as safe', () => {
    expect(isSafeRedirectPath('/settings/subscriptions')).toBe(true);
    expect(isSafeRedirectPath('/events')).toBe(true);
    expect(isSafeRedirectPath('/')).toBe(true);
  });

  it('rejects null, undefined, and empty string', () => {
    expect(isSafeRedirectPath(null)).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
    expect(isSafeRedirectPath('')).toBe(false);
  });

  it('rejects protocol-relative paths (e.g. //evil.com)', () => {
    expect(isSafeRedirectPath('//evil.com')).toBe(false);
    expect(isSafeRedirectPath('//google.com/foo')).toBe(false);
  });

  it('rejects absolute URLs with protocol (e.g. https://evil.com)', () => {
    expect(isSafeRedirectPath('https://evil.com')).toBe(false);
    expect(isSafeRedirectPath('http://localhost:3000/settings')).toBe(false);
    expect(isSafeRedirectPath('ftp://some-server')).toBe(false);
    expect(isSafeRedirectPath('javascript:alert(1)')).toBe(false);
  });
});
