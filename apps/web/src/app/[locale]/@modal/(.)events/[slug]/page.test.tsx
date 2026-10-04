import { expect, test, vi, beforeEach } from 'vitest';

// Story 3.6v (AC6) — see the identical test file for the full-page route
// (events/[slug]/page.test.tsx) for why this calls the Server Component function directly
// instead of rendering it.

const redirectMock = vi.fn();
vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

const getEventBySlugCachedMock = vi.fn();
vi.mock('@/features/events/get-event-by-slug-cached', () => ({
  getEventBySlugCached: getEventBySlugCachedMock,
}));

vi.mock('@/features/events/EventDetailWrapper', () => ({
  EventDetailWrapper: () => null,
}));

vi.mock('@festgrid/ui', () => ({
  RouteLoader: () => null,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

vi.mock('@/lib/metadata', () => ({
  buildPageMetadata: (input: unknown) => input,
}));

beforeEach(() => {
  redirectMock.mockReset();
  getEventBySlugCachedMock.mockReset();
});

test('an aliased slug redirects to the canonical, non-modal path (a hard redirect is never served as an interception)', async () => {
  const { default: EventModalPage } = await import('./page');

  getEventBySlugCachedMock.mockResolvedValue({
    eventBySlug: { slug: 'canonical-slug', eventName: 'Canonical Event' },
  });

  await EventModalPage({ params: Promise.resolve({ slug: 'old-alias-slug', locale: 'en' }) });

  expect(redirectMock).toHaveBeenCalledTimes(1);
  expect(redirectMock).toHaveBeenCalledWith('/en/events/canonical-slug');
});

test('a non-aliased, direct canonical-slug hit never redirects', async () => {
  const { default: EventModalPage } = await import('./page');

  getEventBySlugCachedMock.mockResolvedValue({
    eventBySlug: { slug: 'canonical-slug', eventName: 'Canonical Event' },
  });

  await EventModalPage({ params: Promise.resolve({ slug: 'canonical-slug', locale: 'en' }) });

  expect(redirectMock).not.toHaveBeenCalled();
});

test('a genuine not-found/network error (null result) never redirects -- unaffected', async () => {
  const { default: EventModalPage } = await import('./page');

  getEventBySlugCachedMock.mockResolvedValue(null);

  await EventModalPage({ params: Promise.resolve({ slug: 'unknown-slug', locale: 'en' }) });

  expect(redirectMock).not.toHaveBeenCalled();
});
