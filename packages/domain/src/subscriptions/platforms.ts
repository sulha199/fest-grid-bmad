export const SUPPORTED_PLATFORMS = ['instagram'] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

// For legacy/scraping purposes (existing subscriptions)
export type ScrapablePlatform = SupportedPlatform | 'twitter';
