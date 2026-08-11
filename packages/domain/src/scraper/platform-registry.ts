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

export function detectPlatformFromUrl(url: string): SupportedPlatform | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    if (hostname === 'instagram.com' || hostname.endsWith('.instagram.com') || hostname === 'instagr.am' || hostname.endsWith('.instagr.am')) {
      return 'instagram';
    }
    
    if (hostname === 'twitter.com' || hostname.endsWith('.twitter.com') || hostname === 'x.com' || hostname.endsWith('.x.com')) {
      return 'twitter';
    }
    
    return null;
  } catch {
    return null;
  }
}
