'use client';

import posthog from 'posthog-js';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { getPostHogEnv } from './env';

const PostHogContext = createContext<typeof posthog | null>(null);

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [client, setClient] = useState<typeof posthog | null>(null);

  useEffect(() => {
    const { key, host, defaults } = getPostHogEnv();

    if (key && host && defaults) {
      posthog.init(key, {
        api_host: host,
        defaults,
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
      });
      setClient(posthog);
      setIsInitialized(true);
    } else {
      console.warn('PostHog environment variables missing or invalid. Analytics disabled.');
      setClient(null);
      setIsInitialized(true);
    }
  }, []);

  if (!isInitialized) {
    return <>{children}</>;
  }

  return <PostHogContext.Provider value={client}>{children}</PostHogContext.Provider>;
}

export function usePostHog() {
  const context = useContext(PostHogContext);
  return context ?? posthog;
}
