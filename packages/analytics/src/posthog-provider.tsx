'use client';

import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import { ReactNode, useEffect, useState } from 'react';
import { getPostHogEnv } from './env';

export function PostHogProvider({ children }: { children: ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const { key, host, defaults } = getPostHogEnv();

    if (key && host && defaults) {
      posthog.init(key, {
        api_host: host,
        defaults,
        person_profiles: 'identified_only', // or 'always' to create profiles for anonymous users as well
        capture_pageview: false, // Disable automatic pageview capture, as we capture manually
        capture_pageleave: true,
      });
      setIsInitialized(true);
    } else {
      console.warn('PostHog environment variables missing or invalid. Analytics disabled.');
    }
  }, []);

  if (!isInitialized) {
    return <>{children}</>;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
