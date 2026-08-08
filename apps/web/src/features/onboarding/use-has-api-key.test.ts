import { describe, it, expect, vi } from 'vitest';
import { useHasApiKey } from './use-has-api-key';

let mockSession: any = null;
let mockMyApiKeys: any[] = [];

vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
  }),
}));

vi.mock('@/generated/graphql', () => ({
  useGetMyApiKeysQuery: () => ({
    data: {
      myApiKeys: mockMyApiKeys,
    },
  }),
}));

describe('useHasApiKey', () => {
  it('returns false while unauthenticated', () => {
    mockSession = null;
    mockMyApiKeys = [];
    expect(useHasApiKey()).toBe(false);
  });

  it('returns false with zero keys', () => {
    mockSession = { user: { id: 'user-1' } };
    mockMyApiKeys = [];
    expect(useHasApiKey()).toBe(false);
  });

  it('returns true with >=1 key', () => {
    mockSession = { user: { id: 'user-1' } };
    mockMyApiKeys = [{ id: 'key-1' }];
    expect(useHasApiKey()).toBe(true);
  });
});
