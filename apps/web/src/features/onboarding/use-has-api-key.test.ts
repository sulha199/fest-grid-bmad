import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useApiKeyStatus, useHasApiKey } from './use-has-api-key';

let mockSession: any = null;
let mockGetMyApiKeysQueryResult: any = { data: { myApiKeys: [] }, isLoading: false };

vi.mock('@/components/providers/auth-session-provider', () => ({
  useAuthSession: () => ({
    session: mockSession,
  }),
}));

vi.mock('@/generated/graphql', () => ({
  useGetMyApiKeysQuery: () => mockGetMyApiKeysQueryResult,
}));

beforeEach(() => {
  mockSession = null;
  mockGetMyApiKeysQueryResult = { data: { myApiKeys: [] }, isLoading: false };
});

describe('useHasApiKey', () => {
  it('returns false while unauthenticated', () => {
    mockSession = null;
    expect(useHasApiKey()).toBe(false);
  });

  it('returns false with zero keys', () => {
    mockSession = { user: { id: 'user-1' } };
    expect(useHasApiKey()).toBe(false);
  });

  it('returns true with >=1 key', () => {
    mockSession = { user: { id: 'user-1' } };
    mockGetMyApiKeysQueryResult = { data: { myApiKeys: [{ id: 'key-1' }] }, isLoading: false };
    expect(useHasApiKey()).toBe(true);
  });
});

describe('useApiKeyStatus', () => {
  it('returns loading state and key presence separately', () => {
    mockSession = { user: { id: 'user-1' } };
    mockGetMyApiKeysQueryResult = { data: undefined, isLoading: true };
    expect(useApiKeyStatus()).toEqual({ hasApiKey: false, isLoading: true });

    mockGetMyApiKeysQueryResult = { data: { myApiKeys: [{ id: 'key-1' }] }, isLoading: false };
    expect(useApiKeyStatus()).toEqual({ hasApiKey: true, isLoading: false });
  });
});
