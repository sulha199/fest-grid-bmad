export const SUPPORTED_PLATFORMS = ['instagram', 'twitter'] as const;
export type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];
