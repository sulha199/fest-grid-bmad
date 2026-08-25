import { SupportedPlatform, ScrapablePlatform } from "../subscriptions/platforms.js";

export const PLATFORM_SLUGS: Record<SupportedPlatform, string> = {
  instagram: "ig",
};

export const PLATFORM_DISPLAY_NAMES: Record<SupportedPlatform, string> = {
  instagram: "Instagram",
};

export function getPlatformSlug(platform: ScrapablePlatform): string {
  if (platform === "twitter") return "x";
  return PLATFORM_SLUGS[platform as SupportedPlatform];
}

export function getPlatformByCode(slug: string): ScrapablePlatform | undefined {
  if (slug === "x") return "twitter";
  const entry = Object.entries(PLATFORM_SLUGS).find(([, value]) => value === slug);
  return entry ? (entry[0] as SupportedPlatform) : undefined;
}

export function getPlatformDisplayName(platform: ScrapablePlatform): string {
  if (platform === "twitter") return "Twitter/X";
  return PLATFORM_DISPLAY_NAMES[platform as SupportedPlatform];
}

export function detectPlatformFromUrl(url: string): ScrapablePlatform | null {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    
    if (hostname === "instagram.com" || hostname.endsWith(".instagram.com") || hostname === "instagr.am" || hostname.endsWith(".instagr.am")) {
      return "instagram";
    }
    
    if (hostname === "twitter.com" || hostname.endsWith(".twitter.com") || hostname === "x.com" || hostname.endsWith(".x.com")) {
      return "twitter";
    }
    
    return null;
  } catch {
    return null;
  }
}
