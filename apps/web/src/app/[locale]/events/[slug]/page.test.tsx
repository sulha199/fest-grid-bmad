import { expect, test, vi, beforeEach } from 'vitest';

// Story 3.6v (AC6) — the redirect-on-alias-hit behavior added to this route. These tests call
// the exported Server Component function directly (not `render()`): the thing under test is
// which branch of control flow runs (does `redirect()` get called, with what path), not any
// rendered markup, so a full React render of `EventDetailWrapper`'s subtree would be pure
// unrelated overhead/mocking burden.

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

test('an aliased slug (returned event.slug differs from the requested slug) redirects to the canonical path', async () => {
  const { default: EventPage } = await import('./page');

  getEventBySlugCachedMock.mockResolvedValue({
    eventBySlug: { slug: 'canonical-slug', eventName: 'Canonical Event' },
  });

  await EventPage({ params: Promise.resolve({ slug: 'old-alias-slug', locale: 'en' }) });

  expect(redirectMock).toHaveBeenCalledTimes(1);
  expect(redirectMock).toHaveBeenCalledWith('/en/events/canonical-slug');
});

test('a non-aliased, direct canonical-slug hit never redirects', async () => {
  const { default: EventPage } = await import('./page');

  getEventBySlugCachedMock.mockResolvedValue({
    eventBySlug: { slug: 'canonical-slug', eventName: 'Canonical Event' },
  });

  await EventPage({ params: Promise.resolve({ slug: 'canonical-slug', locale: 'en' }) });

  expect(redirectMock).not.toHaveBeenCalled();
});

test('a genuine not-found/network error (null result) never redirects -- falls through to the existing not-found UI, unaffected', async () => {
  const { default: EventPage } = await import('./page');

  getEventBySlugCachedMock.mockResolvedValue(null);

  await EventPage({ params: Promise.resolve({ slug: 'unknown-slug', locale: 'en' }) });

  expect(redirectMock).not.toHaveBeenCalled();
});
