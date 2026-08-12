import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRequireModerator } from './use-require-moderator';
import { useAuthSession } from '@/components/providers/auth-session-provider';
import { useMeQuery } from '@/generated/graphql';

// Mock useRouter
const mockPush = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock useAuthSession
vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: vi.fn(),
}));

// Mock useMeQuery
vi.mock('@/generated/graphql', () => ({
  useMeQuery: vi.fn(),
}));

describe('useRequireModerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles auth loading', () => {
    vi.mocked(useAuthSession).mockReturnValue({
      session: null,
      user: null,
      isLoading: true,
      signOut: vi.fn(),
    });
    vi.mocked(useMeQuery).mockReturnValue({
      data: undefined,
      status: 'pending',
    } as any);

    const { result } = renderHook(() => useRequireModerator());

    expect(result.current.status).toBe('loading');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles session present, but me query pending', () => {
    vi.mocked(useAuthSession).mockReturnValue({
      session: { user: { id: 'user-1' } } as any,
      user: { id: 'user-1' } as any,
      isLoading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useMeQuery).mockReturnValue({
      data: undefined,
      status: 'pending',
    } as any);

    const { result } = renderHook(() => useRequireModerator());

    expect(result.current.status).toBe('loading');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('handles no session, auth settled', () => {
    vi.mocked(useAuthSession).mockReturnValue({
      session: null,
      user: null,
      isLoading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useMeQuery).mockReturnValue({
      data: undefined,
      status: 'pending',
    } as any);

    const { result } = renderHook(() => useRequireModerator());

    expect(result.current.status).toBe('unauthenticated');
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('handles session present, me role is user (unauthorized)', () => {
    vi.mocked(useAuthSession).mockReturnValue({
      session: { user: { id: 'user-1' } } as any,
      user: { id: 'user-1' } as any,
      isLoading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useMeQuery).mockReturnValue({
      data: { me: { id: 'user-1', email: 'test@user.com', role: 'user' } },
      status: 'success',
    } as any);

    const { result } = renderHook(() => useRequireModerator());

    expect(result.current.status).toBe('unauthorized');
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('handles session present, me query error (fail-closed)', () => {
    vi.mocked(useAuthSession).mockReturnValue({
      session: { user: { id: 'user-1' } } as any,
      user: { id: 'user-1' } as any,
      isLoading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useMeQuery).mockReturnValue({
      data: undefined,
      status: 'error',
    } as any);

    const { result } = renderHook(() => useRequireModerator());

    expect(result.current.status).toBe('unauthorized');
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('handles session present, me role is moderator (authorized)', () => {
    vi.mocked(useAuthSession).mockReturnValue({
      session: { user: { id: 'user-1' } } as any,
      user: { id: 'user-1' } as any,
      isLoading: false,
      signOut: vi.fn(),
    });
    vi.mocked(useMeQuery).mockReturnValue({
      data: { me: { id: 'user-1', email: 'test@moderator.com', role: 'moderator' } },
      status: 'success',
    } as any);

    const { result } = renderHook(() => useRequireModerator());

    expect(result.current.status).toBe('authorized');
    expect(mockPush).not.toHaveBeenCalled();
  });
});
