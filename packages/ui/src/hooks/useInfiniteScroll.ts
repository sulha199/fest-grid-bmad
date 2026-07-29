import { useEffect, useRef, useState } from 'react';

export interface UseInfiniteScrollOptions {
  enabled?: boolean;
  onLoadMore: () => void | Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
}

export function useInfiniteScroll({ enabled = true, onLoadMore, hasMore, isLoading }: UseInfiniteScrollOptions) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [isTriggered, setIsTriggered] = useState(false);

  useEffect(() => {
    if (!enabled || !hasMore || isLoading || !sentinelRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && !isTriggered) {
          setIsTriggered(true);
          void onLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [enabled, hasMore, isLoading, isTriggered, onLoadMore]);

  useEffect(() => {
    if (!isLoading && isTriggered) {
      setIsTriggered(false);
    }
  }, [isLoading, isTriggered]);

  return { sentinelRef };
}
