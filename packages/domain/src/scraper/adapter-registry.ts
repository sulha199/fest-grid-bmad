import { ScrapablePlatform } from "../subscriptions/platforms.js";
import { ScraperAdapter, AccountProfileLookupResult } from "./types.js";

const adapters = new Map<ScrapablePlatform, ScraperAdapter>();

export function registerScraperAdapter(platform: ScrapablePlatform, adapter: ScraperAdapter): void {
  adapters.set(platform, adapter);
}

export function getScraperAdapter(platform: ScrapablePlatform): ScraperAdapter {
  const adapter = adapters.get(platform);
  if (!adapter) {
    throw new Error(`No scraper adapter registered for platform "${platform}"`);
  }
  return adapter;
}

export async function lookupAccountProfile(
  platform: ScrapablePlatform,
  handleOrUrl: string
): Promise<AccountProfileLookupResult | null> {
  const adapter = getScraperAdapter(platform);
  return adapter.lookupAccountProfile(handleOrUrl);
}

export function clearRegisteredAdapters(): void {
  adapters.clear();
}

export function isAdapterRegistered(platform: string): boolean {
  return adapters.has(platform as ScrapablePlatform);
}
