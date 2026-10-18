import { describe, it, expect, vi, beforeEach } from 'vitest';

// Architecture Spine AD-35 Rule 6 -- the one account-page lookup passes the raw URL segment to
// `socialMediaAccountProfileByUsername` (the backend owns username-first / digit-fallback).

const mockRequest = vi.fn();
vi.mock('@/lib/graphql-client', () => ({
  graphqlClient: {
    request: (...args: unknown[]) => mockRequest(...args),
  },
}));

import { getAccountProfileCached } from './get-account-profile-cached';

describe('getAccountProfileCached', () => {
  beforeEach(() => {
    mockRequest.mockReset();
  });

  it('sends platform and the segment as `username`', async () => {
    mockRequest.mockResolvedValue({ socialMediaAccountProfileByUsername: { id: 'p-1', username: 'jktcity.events' } });

    const profile = await getAccountProfileCached('instagram', 'seg-1');

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0][1]).toEqual({ platform: 'instagram', username: 'seg-1' });
    expect(profile).toEqual({ id: 'p-1', username: 'jktcity.events' });
  });

  it('returns null when nothing matches', async () => {
    mockRequest.mockResolvedValue({ socialMediaAccountProfileByUsername: null });

    expect(await getAccountProfileCached('instagram', 'seg-2')).toBeNull();
  });

  it('propagates request errors so each caller keeps its own policy', async () => {
    mockRequest.mockRejectedValue(new Error('boom'));

    await expect(getAccountProfileCached('instagram', 'seg-3')).rejects.toThrow('boom');
  });
});
