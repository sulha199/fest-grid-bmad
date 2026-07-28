type PostHogDefaults = '2026-05-30';

export interface PostHogEnv {
  key?: string;
  host?: string;
  defaults?: PostHogDefaults;
}

const SUPPORTED_POSTHOG_DEFAULTS: PostHogDefaults = '2026-05-30';

function parsePostHogDefaults(value: string | undefined): PostHogDefaults | undefined {
  if (!value) {
    return undefined;
  }

  return value === SUPPORTED_POSTHOG_DEFAULTS ? value : undefined;
}

export function getPostHogEnv(): PostHogEnv {
  return {
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    defaults: parsePostHogDefaults(process.env.NEXT_PUBLIC_POSTHOG_DEFAULTS),
  };
}
