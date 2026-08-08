import { SupportedPlatform } from "../subscriptions/platforms.js";
import { ScraperAdapter, AccountProfileLookupResult } from "./types.js";

const adapters = new Map<SupportedPlatform, ScraperAdapter>();

export function registerScraperAdapter(platform: SupportedPlatform, adapter: ScraperAdapter): void {
  adapters.set(platform, adapter);
}

export function getScraperAdapter(platform: SupportedPlatform): ScraperAdapter {
  const adapter = adapters.get(platform);
  if (!adapter) {
    throw new Error(`No scraper adapter registered for platform "${platform}"`);
  }
  return adapter;
}

export async function lookupAccountProfile(
  platform: SupportedPlatform,
  handleOrUrl: string
): Promise<AccountProfileLookupResult | null> {
  const adapter = getScraperAdapter(platform);
  return adapter.lookupAccountProfile(handleOrUrl);
}

export function clearRegisteredAdapters(): void {
  adapters.clear();
}
