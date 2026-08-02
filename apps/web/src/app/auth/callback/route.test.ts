import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from './route';

// Mock the Supabase server client
const mockExchangeCodeForSession = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    })
  ),
}));

// Mock next/headers cookies
const mockCookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: mockCookieGet,
    })
  ),
}));

describe('Auth Callback Route Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exchanges code for session and redirects to localized home page', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    mockCookieGet.mockReturnValue({ value: 'en' });

    const request = new Request('http://localhost:3000/auth/callback?code=test-code');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/en/');
  });

  it('redirects to localized home page with custom next path', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: null });
    mockCookieGet.mockReturnValue({ value: 'id' });

    const request = new Request('http://localhost:3000/auth/callback?code=test-code&next=/dashboard');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/id/dashboard');
  });

  it('redirects to login with auth_failed when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: {}, error: new Error('Exchange failed') });
    mockCookieGet.mockReturnValue({ value: 'en' });

    const request = new Request('http://localhost:3000/auth/callback?code=test-code');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('test-code');
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/en/login?error=auth_failed');
  });

  it('redirects to login with auth_failed when code is missing', async () => {
    mockCookieGet.mockReturnValue({ value: 'en' });

    const request = new Request('http://localhost:3000/auth/callback');
    const response = await GET(request);

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('http://localhost:3000/en/login?error=auth_failed');
  });
});
