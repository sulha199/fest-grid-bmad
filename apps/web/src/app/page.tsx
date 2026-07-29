"use client";

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { EventInfo } from '@festgrid/shared-types';
import { EventGrid, useInfiniteScroll } from '@festgrid/ui';
import { usePostHog } from '@festgrid/analytics';
import { LoaderCircle } from 'lucide-react';

const PAGE_SIZE = 6;

export default function HomePage() {
  const t = useTranslations('home');
  const posthog = usePostHog();
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    posthog?.capture('Main Page Viewed');
    // Only fire once per mount; the analytics client instance is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadInitialPage = async () => {
      try {
        const response = await fetch(`/api/events?page=1&pageSize=${PAGE_SIZE}`);
        if (!response.ok) {
          throw new Error('Failed to load events');
        }

        const data = (await response.json()) as { items: EventInfo[]; hasMore: boolean };
        if (isActive) {
          setEvents(data.items);
          setHasMore(data.hasMore);
          setHasError(false);
        }
      } catch (error) {
        console.error(error);
        if (isActive) {
          setEvents([]);
          setHasMore(false);
          setHasError(true);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialPage();

    return () => {
      isActive = false;
    };
  }, [reloadToken]);

  const loadMore = async () => {
    if (isLoadingMore || !hasMore) {
      return;
    }

    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const response = await fetch(`/api/events?page=${nextPage}&pageSize=${PAGE_SIZE}`);
      if (!response.ok) {
        throw new Error('Failed to load more events');
      }

      const data = (await response.json()) as { items: EventInfo[]; hasMore: boolean };
      setEvents((prev) => [...prev, ...data.items]);
      setPage(nextPage);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error(error);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const { sentinelRef } = useInfiniteScroll({
    enabled: !isLoading,
    hasMore,
    isLoading: isLoadingMore,
    onLoadMore: loadMore,
  });

  const retryInitialLoad = () => {
    setIsLoading(true);
    setHasError(false);
    setPage(1);
    setHasMore(true);
    setEvents([]);
    setReloadToken((token) => token + 1);
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: PAGE_SIZE }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <div className="h-32 animate-pulse rounded-lg bg-muted" />
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>

      {hasError ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          <p>{t('error')}</p>
          <button
            type="button"
            onClick={retryInitialLoad}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            {t('retry')}
          </button>
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
          {t('empty')}
        </div>
      ) : (
        <>
          <EventGrid events={events} />
          {isLoadingMore ? (
            <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              {t('loadingMore')}
            </div>
          ) : null}
          <div ref={sentinelRef} className="h-1" />
        </>
      )}
    </div>
  );
}
