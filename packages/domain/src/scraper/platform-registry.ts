import { SupportedPlatform } from "../subscriptions/platforms.js";

export const PLATFORM_SLUGS: Record<SupportedPlatform, string> = {
  instagram: "ig",
  twitter: "x",
};

export const PLATFORM_DISPLAY_NAMES: Record<SupportedPlatform, string> = {
  instagram: "Instagram",
  twitter: "Twitter/X",
};

export function getPlatformSlug(platform: SupportedPlatform): string {
  return PLATFORM_SLUGS[platform];
}

export function getPlatformByCode(slug: string): SupportedPlatform | undefined {
  const entry = Object.entries(PLATFORM_SLUGS).find(([, value]) => value === slug);
  return entry ? (entry[0] as SupportedPlatform) : undefined;
}

export function getPlatformDisplayName(platform: SupportedPlatform): string {
  return PLATFORM_DISPLAY_NAMES[platform];
}
