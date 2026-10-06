import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Story 3.6x (AC3, AC6) -- generateMetadata/page body both resolve `platform =
// getPlatformByCode(platformSlug)` (notFound() if unresolvable) then
// `Query.postByPlatformIdentifiers` (notFound() if it resolves to null), mirroring the Account
// route's own `generateMetadata`/`notFound()` structure.

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('notFound() called');
  }),
}));

const mockGetTranslations = vi.fn();
vi.mock('next-intl/server', () => ({
  getTranslations: (...args: unknown[]) => mockGetTranslations(...args),
}));

const mockRequest = vi.fn();
vi.mock('@/lib/graphql-client', () => ({
  graphqlClient: {
    request: (...args: unknown[]) => mockRequest(...args),
  },
}));

vi.mock('./post-events-content', () => ({
  default: (props: any) => React.createElement('div', { 'data-testid': 'post-events-content' }, JSON.stringify(props)),
}));

import { notFound } from 'next/navigation';
import PostEventsPage, { generateMetadata } from './page';

// 'ig' -- the real platform-registry short code for instagram (PLATFORM_SLUGS), not the bare
// platform name.
const PARAMS = { locale: 'en', platformSlug: 'ig', postType: 'p', platformPostId: 'abc123' };

describe('PostEventsPage route', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    mockGetTranslations.mockReset();
    (notFound as any).mockClear();
    mockGetTranslations.mockResolvedValue((key: string, vars?: Record<string, unknown>) => `${key}:${vars?.displayName ?? ''}`);
  });

  describe('generateMetadata', () => {
    it('calls notFound() when the platformSlug does not resolve to a known platform', async () => {
      await expect(generateMetadata({ params: Promise.resolve({ ...PARAMS, platformSlug: 'not-a-real-platform' }) })).rejects.toThrow('notFound() called');
      expect(notFound).toHaveBeenCalled();
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it('calls notFound() when postByPlatformIdentifiers resolves to null (post does not exist)', async () => {
      mockRequest.mockResolvedValue({ postByPlatformIdentifiers: null });

      await expect(generateMetadata({ params: Promise.resolve(PARAMS) })).rejects.toThrow('notFound() called');
      expect(notFound).toHaveBeenCalled();
    });

    it('builds title/description from the resolved post account displayName', async () => {
      mockRequest.mockResolvedValue({
        postByPlatformIdentifiers: {
          postId: 'post_1',
          account: { accountId: 'acc_1', platform: 'instagram', username: 'someacct', displayName: 'Some Account', profileImageUrl: null },
          groupingReason: 'ROUNDUP',
          extractedEventCount: 3,
        },
      });

      const metadata = await generateMetadata({ params: Promise.resolve(PARAMS) });
      expect(metadata.title).toBe('postCollectionPageTitle:Some Account');
      expect(metadata.description).toBe('postCollectionPageDescription:Some Account');
    });

    it('degrades gracefully (does not throw) when the request errors, then calls notFound()', async () => {
      mockRequest.mockRejectedValue(new Error('network error'));

      await expect(generateMetadata({ params: Promise.resolve(PARAMS) })).rejects.toThrow('notFound() called');
      expect(notFound).toHaveBeenCalled();
    });
  });

  describe('default export (page body)', () => {
    it('calls notFound() when the platformSlug does not resolve to a known platform', async () => {
      await expect(PostEventsPage({ params: Promise.resolve({ ...PARAMS, platformSlug: 'not-a-real-platform' }) })).rejects.toThrow('notFound() called');
      expect(notFound).toHaveBeenCalled();
    });

    it('calls notFound() when postByPlatformIdentifiers resolves to null', async () => {
      mockRequest.mockResolvedValue({ postByPlatformIdentifiers: null });

      await expect(PostEventsPage({ params: Promise.resolve(PARAMS) })).rejects.toThrow('notFound() called');
      expect(notFound).toHaveBeenCalled();
    });

    it('re-throws a real (non-null-result) error instead of swallowing it', async () => {
      mockRequest.mockRejectedValue(new Error('boom'));

      await expect(PostEventsPage({ params: Promise.resolve(PARAMS) })).rejects.toThrow('boom');
    });

    it('renders PostEventsContent with the resolved postId/account on a successful lookup', async () => {
      mockRequest.mockResolvedValue({
        postByPlatformIdentifiers: {
          postId: 'post_1',
          account: { accountId: 'acc_1', platform: 'instagram', username: 'someacct', displayName: 'Some Account', profileImageUrl: null },
          groupingReason: 'ROUNDUP',
          extractedEventCount: 3,
        },
      });

      const element = await PostEventsPage({ params: Promise.resolve(PARAMS) });
      expect(element).toBeTruthy();
    });
  });
});
