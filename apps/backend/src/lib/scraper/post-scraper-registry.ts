import { parsePostScraperOrder, type PostScraperAdapter, type PostScraperAdapterName } from '@festgrid/domain';
import { loadBackendEnv } from '../../env.js';
import { brightDataPostAdapter } from './brightdata-post-adapter.js';

// Story 10.2 -- the post-scraper adapter registry, a LEAF module so that `instagram-adapter.ts` (which registers the Apify adapter
// at load) and `post-scraper.ts` (the entry point) never import each other: a cycle would read this map before it exists.
// Order is `POST_SCRAPER_PROVIDER_ORDER` (default `brightdata,apify`, owner decision 2026-11-11, PRD OI-1).
const adapters = new Map<PostScraperAdapterName, PostScraperAdapter>([['brightdata', brightDataPostAdapter]]);

export function registerPostScraperAdapter(adapter: PostScraperAdapter): void {
  adapters.set(adapter.name, adapter);
}

/**
 * The adapters in configured order; a configured name with no registered adapter is skipped with a warning. A job type that has its
 * own order (Story 10.6: the moderator re-extract tries Apify first) passes it as `orderOverride`; `POST_SCRAPER_PROVIDER_ORDER`
 * is then not read, and the default order every other caller gets is unchanged.
 */
export function getPostScraperAdapters(orderOverride?: readonly PostScraperAdapterName[]): PostScraperAdapter[] {
  let order: readonly PostScraperAdapterName[];
  if (orderOverride && orderOverride.length > 0) {
    order = orderOverride;
  } else {
    const parsed = parsePostScraperOrder(loadBackendEnv().postScraperProviderOrder);
    if (parsed.ignored.length > 0) {
      console.warn(`POST_SCRAPER_PROVIDER_ORDER names unknown provider(s) ${parsed.ignored.join(', ')}; ignored`);
    }
    order = parsed.order;
  }
  const selected: PostScraperAdapter[] = [];
  for (const name of order) {
    const adapter = adapters.get(name);
    if (adapter) {
      selected.push(adapter);
    } else {
      console.warn(`Post scraper "${name}" is configured but no adapter is registered for it; skipped`);
    }
  }
  return selected;
}
