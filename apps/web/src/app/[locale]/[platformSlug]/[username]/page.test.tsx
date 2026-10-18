import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Architecture Spine AD-35 Rules 5-6 -- the account page resolves its URL segment through the one
// shared lookup and redirects (308) any non-canonical segment to the username URL, preserving the
// query string.

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound() called');
  }),
  permanentRedirect: vi.fn((path: string) => {
    throw new Error(`permanentRedirect(${path})`);
  }),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(async () => (key: string) => key),
}));

const mockGetProfile = vi.fn();
vi.mock('@/features/accounts/get-account-profile-cached', () => ({
  getAccountProfileCached: (...args: unknown[]) => mockGetProfile(...args),
}));

vi.mock('@festgrid/ui', () => ({
  RouteLoader: () => React.createElement('div', { 'data-testid': 'route-loader' }),
}));

vi.mock('./account-content', () => ({
  default: (props: any) => React.createElement('div', { 'data-testid': 'account-content' }, JSON.stringify(props)),
}));

import { notFound, permanentRedirect } from 'next/navigation';
import AccountPage, { generateMetadata } from './page';

// 'ig' -- the real platform-registry short code for instagram.
const params = (username: string, platformSlug = 'ig') => Promise.resolve({ locale: 'en', platformSlug, username });
const noSearch = Promise.resolve({});

const PROFILE = {
  id: 'p-1',
  accountId: '2237970730',
  platform: 'instagram',
  displayName: 'Pakuwon Mall Jogja',
  username: 'pakuwonmall.jogja',
  profileImageUrl: null,
  description: null,
};

describe('AccountPage route (AD-35)', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    vi.mocked(notFound).mockClear();
    vi.mocked(permanentRedirect).mockClear();
  });

  it('renders the profile when the segment is already the canonical username', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);

    const element = await AccountPage({ params: params('pakuwonmall.jogja'), searchParams: noSearch });

    expect(permanentRedirect).not.toHaveBeenCalled();
    expect(mockGetProfile).toHaveBeenCalledWith('instagram', 'pakuwonmall.jogja');
    expect(element).toBeTruthy();
  });

  it('redirects a numeric account id to the username URL, preserving the query string', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);

    await expect(
      AccountPage({
        params: params('2237970730'),
        searchParams: Promise.resolve({ view: 'list', types: ['music', 'art'], q: undefined }),
      })
    ).rejects.toThrow('permanentRedirect(/en/ig/pakuwonmall.jogja?view=list&types=music&types=art)');
  });

  it('redirects a mixed-case segment to the lower-case username URL', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);

    await expect(
      AccountPage({ params: params('PakuwonMall.Jogja'), searchParams: noSearch })
    ).rejects.toThrow('permanentRedirect(/en/ig/pakuwonmall.jogja)');
  });

  it('does not redirect when the stored username is mixed-case but the segment is its normalized form (no loop)', async () => {
    mockGetProfile.mockResolvedValue({ ...PROFILE, username: 'Pakuwonmall.Jogja' });

    await AccountPage({ params: params('pakuwonmall.jogja'), searchParams: noSearch });

    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it('does not redirect when the profile has no username to redirect to', async () => {
    mockGetProfile.mockResolvedValue({ ...PROFILE, username: '' });

    await AccountPage({ params: params('2237970730'), searchParams: noSearch });

    expect(permanentRedirect).not.toHaveBeenCalled();
  });

  it('calls notFound() when nothing matches the segment', async () => {
    mockGetProfile.mockResolvedValue(null);

    await expect(AccountPage({ params: params('nobody'), searchParams: noSearch })).rejects.toThrow('notFound() called');
  });

  it('calls notFound() when the platformSlug does not resolve to a known platform', async () => {
    await expect(
      AccountPage({ params: params('x', 'not-a-real-platform'), searchParams: noSearch })
    ).rejects.toThrow('notFound() called');
    expect(mockGetProfile).not.toHaveBeenCalled();
  });

  it('propagates a request error so Next error boundary handles it', async () => {
    mockGetProfile.mockRejectedValue(new Error('boom'));

    await expect(AccountPage({ params: params('pakuwonmall.jogja'), searchParams: noSearch })).rejects.toThrow('boom');
  });

  it('decodes a percent-encoded segment before resolving it', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);

    await AccountPage({ params: params('pakuwonmall%2Ejogja'), searchParams: noSearch });

    expect(mockGetProfile).toHaveBeenCalledWith('instagram', 'pakuwonmall.jogja');
    expect(permanentRedirect).not.toHaveBeenCalled();
  });
});

describe('AccountPage generateMetadata (AD-35 Rule 6)', () => {
  beforeEach(() => {
    mockGetProfile.mockReset();
    vi.mocked(notFound).mockClear();
  });

  it('resolves the segment through the same shared lookup as the page', async () => {
    mockGetProfile.mockResolvedValue(PROFILE);

    await generateMetadata({ params: params('2237970730') });

    expect(mockGetProfile).toHaveBeenCalledWith('instagram', '2237970730');
  });

  it('calls notFound() when the lookup resolves to null', async () => {
    mockGetProfile.mockResolvedValue(null);

    await expect(generateMetadata({ params: params('nobody') })).rejects.toThrow('notFound() called');
  });

  it('degrades to notFound() when the lookup throws', async () => {
    mockGetProfile.mockRejectedValue(new Error('network'));

    await expect(generateMetadata({ params: params('pakuwonmall.jogja') })).rejects.toThrow('notFound() called');
  });

  it('calls notFound() for an unknown platformSlug', async () => {
    await expect(generateMetadata({ params: params('x', 'nope') })).rejects.toThrow('notFound() called');
  });
});
