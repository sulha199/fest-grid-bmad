export interface ScraperAccountRef {
  accountId: string;
  username: string;
}

export interface ScrapedPost {
  content: string;
  imageUrl?: string;
  videoUrl?: string;
  postUrl: string;
  originalPostUrl?: string;
  publishedAt: string;
  locationName?: string;
  ownerDisplayName?: string;
  ownerUsername?: string;
  /**
   * The canonical publisher's stable platform account ID (Apify's `ownerId`), distinct from
   * `ownerDisplayName`/`ownerUsername` (the publisher's name/handle, captured separately since
   * before this field existed). Populated only for Apify-sourced posts today (Story 3.13,
   * CAP-1) — Bright Data does not populate this yet (see `backlog.yaml` FIND-039).
   */
  ownerId?: string;
  /**
   * Zero or more coauthor identities read from the vendor's native coauthor field (Apify's
   * `coauthorProducers[]`), each guaranteed to carry a stable `accountId` — a malformed entry
   * (missing/empty `id`) is filtered out before this array is built and persisted separately via
   * `persistUnprocessedPayload` for observability (Story 3.13, CAP-1). No `displayName` field
   * here: Apify's `coauthorProducers[]` never supplies one — the fallback-chain `displayName`
   * resolution is Story 3.14's job (CAP-2), not this field's. Populated only for Apify-sourced
   * posts today — Bright Data does not populate this yet (see `backlog.yaml` FIND-039).
   */
  coauthors?: { accountId: string; username?: string }[];
  hashtags?: string[];
  /**
   * Image URLs of every slide in a multi-image (carousel/Sidecar) Instagram post, in slide order,
   * excluding the cover (which stays in `imageUrl`). Populated only for Apify Sidecar items
   * (`item.childPosts[].displayUrl`). Extraction-time-only: never displayed in any UI, and Story
   * 3.6l decides how many are actually sent to Gemini.
   */
  additionalImageUrls?: string[];
}

export interface AccountProfileLookupResult {
  accountId: string;
  displayName: string;
  username: string;
  profileImageUrl?: string;
}

export class ScraperCapacityExceededError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ScraperCapacityExceededError';
  }
}

export class ApifyRequestTimeoutError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'ApifyRequestTimeoutError';
  }
}

export interface ScraperAdapter {
  getNewestPosts(account: ScraperAccountRef, options?: { newerThan?: string }): Promise<ScrapedPost[]>;
  lookupAccountProfile(handleOrUrl: string): Promise<AccountProfileLookupResult | null>;
  getAccountClassificationProfile(username: string): Promise<{ biography: string; username: string; displayName: string; businessCategoryName: string | null } | null>;
  getPostByUrl(url: string): Promise<ScrapedPost | null>;
  /**
   * True when the underlying scraper actor reliably filters `getNewestPosts` server-side by
   * both `newerThan` and a result-count limit in a single call. Callers use this to decide
   * whether the new-subscribe path can fetch once with the widest lookback window, or must
   * fall back to retrying with progressively wider windows to accumulate enough posts.
   */
  supportsNewerThanAndLimitFiltering: boolean;
}
