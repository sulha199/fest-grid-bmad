import type { ScrapedPost } from "./types.js";

/**
 * Post scraping as a swappable adapter (Story 10.2, PRD 3.18 FR118), the twin of `profile-scraper-adapter.ts`.
 *
 * A "post scrape" turns a post URL into a `ScrapedPost`. Each vendor is one `PostScraperAdapter`; callers never name a vendor,
 * they ask the chain, and the order is configuration (`POST_SCRAPER_PROVIDER_ORDER`). The default is Bright Data first, then
 * Apify (owner decision 2026-11-11, PRD OI-1): profile lookup already prefers Apify, so posts prefer Bright Data to spare
 * Apify's free plan; the cost is Bright Data's 640 px images.
 *
 * Time-aware like the profile chain: an adapter declares the smallest budget it can finish in (`minBudgetMs`) and is skipped
 * when less is left. It can also be skipped for QUOTA, when its provider's monthly cap is known to be used up, with no call.
 * Pure: no vendor SDK and no I/O, so it is tested with fake adapters.
 */

export type PostScraperAdapterName = "apify" | "brightdata";

/**
 * Whose credential a call uses (PRD OI-3, Story 3-4b). Only the app-funded key exists today; a contributed key for its
 * owner's own subscription is a second member of this union, which is all Story 3-4b has to add.
 */
export type PostScrapeCredential = { kind: "app-funded" };

export interface PostScrapeContext {
  /** The time this adapter may spend, never more than the caller's remaining budget. */
  budgetMs: number;
  credential: PostScrapeCredential;
}

export interface PostScraperAdapter {
  readonly name: PostScraperAdapterName;
  /** The smallest budget this vendor can finish in. The chain skips the adapter below it. */
  readonly minBudgetMs: number;
  /**
   * `ScrapedPost` when the vendor found it; `null` when the vendor says the post does not exist (an answer, so the chain
   * stops). Anything that is not an answer (a timeout, a refusal, an EMPTY or unreadable result) must THROW so the chain
   * moves on to the next adapter.
   */
  fetchPost(url: string, context: PostScrapeContext): Promise<ScrapedPost | null>;
}

/**
 * A provider returned nothing usable for a post and did not say the post is gone (an empty result, an unreadable item). Each
 * vendor adapter throws its own subclass; the chain treats it like any failure (the next provider is tried) and the attempt
 * writer maps it to the outcome EMPTY without importing the vendor modules.
 */
export class PostUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostUnavailableError";
  }
}

export const DEFAULT_POST_SCRAPER_ORDER: readonly PostScraperAdapterName[] = ["brightdata", "apify"];

const KNOWN_ADAPTERS: ReadonlySet<string> = new Set<PostScraperAdapterName>(["apify", "brightdata"]);

/**
 * Reads `POST_SCRAPER_PROVIDER_ORDER` (comma separated, case-insensitive, first = first choice). Unknown names are reported in
 * `ignored` and dropped, a name given twice counts once, and an empty or all-unknown value falls back to the default order,
 * so a typo never leaves the app with no post scraper.
 */
export function parsePostScraperOrder(value: string | undefined | null): {
  order: PostScraperAdapterName[];
  ignored: string[];
} {
  const order: PostScraperAdapterName[] = [];
  const ignored: string[] = [];
  for (const raw of (value ?? "").split(",")) {
    const name = raw.trim().toLowerCase();
    if (!name) continue;
    if (!KNOWN_ADAPTERS.has(name)) {
      ignored.push(name);
      continue;
    }
    if (!order.includes(name as PostScraperAdapterName)) {
      order.push(name as PostScraperAdapterName);
    }
  }
  return { order: order.length > 0 ? order : [...DEFAULT_POST_SCRAPER_ORDER], ignored };
}

export type PostAdapterAttempt =
  | { adapter: PostScraperAdapterName; outcome: "skipped"; reason: "budget" | "quota"; detail: string; budgetMs: number }
  | { adapter: PostScraperAdapterName; outcome: "failed"; error: unknown; elapsedMs: number; budgetMs: number }
  | { adapter: PostScraperAdapterName; outcome: "not-found"; elapsedMs: number; budgetMs: number }
  | { adapter: PostScraperAdapterName; outcome: "found"; elapsedMs: number; budgetMs: number };

type SkippedPostAdapterAttempt = Extract<PostAdapterAttempt, { outcome: "skipped" }>;

/** No adapter could be tried (each was skipped for budget or quota), so nothing was asked of any vendor. */
export class PostScraperBudgetError extends Error {
  constructor(public readonly attempts: SkippedPostAdapterAttempt[], budgetMs: number) {
    super(`No post scraper can run inside a ${budgetMs}ms budget (${attempts.map((a) => `${a.adapter}: ${a.detail}`).join("; ")})`);
    this.name = "PostScraperBudgetError";
  }
}

export interface PostChainResult {
  post: ScrapedPost | null;
  /** Every adapter the chain considered, in order. */
  attempts: PostAdapterAttempt[];
}

/**
 * Tries the adapters in order within one shared budget.
 *
 * - found, or `null` (not found): the chain stops and returns it;
 * - an adapter that throws is recorded and the next one is tried; if none answers, the FIRST adapter's error is rethrown
 *   unchanged, so existing handling of its error types keeps working;
 * - an adapter whose `minBudgetMs` exceeds the remaining budget, or that `isOverQuota` reports as out of quota, is skipped
 *   without a call; if every adapter is skipped the chain throws `PostScraperBudgetError`.
 */
export async function runPostScraperChain(input: {
  adapters: readonly PostScraperAdapter[];
  url: string;
  budgetMs: number;
  credential: PostScrapeCredential;
  now?: () => number;
  /** True when the provider's cap is known to be used up (Story 10.2 AC6): the adapter is skipped, no call made. */
  isOverQuota?: (adapter: PostScraperAdapterName) => boolean | Promise<boolean>;
  /**
   * Called once per adapter considered, as soon as its outcome is known (also when the chain then throws), so a caller can
   * keep an audit trail of failures too. A hook that throws or rejects is ignored: the audit trail must never change what a
   * fetch returns.
   */
  onAttempt?: (attempt: PostAdapterAttempt) => void | Promise<void>;
}): Promise<PostChainResult> {
  const { adapters, url, budgetMs, credential, now = Date.now, isOverQuota, onAttempt } = input;
  const deadline = now() + budgetMs;
  const attempts: PostAdapterAttempt[] = [];
  let firstError: { error: unknown } | undefined;

  const record = async (attempt: PostAdapterAttempt): Promise<void> => {
    attempts.push(attempt);
    try {
      await onAttempt?.(attempt);
    } catch {
      // see `onAttempt`
    }
  };

  for (const adapter of adapters) {
    const remainingMs = deadline - now();
    if (isOverQuota && (await isOverQuota(adapter.name))) {
      await record({
        adapter: adapter.name,
        outcome: "skipped",
        reason: "quota",
        detail: "over its quota",
        budgetMs: Math.max(0, remainingMs),
      });
      continue;
    }
    if (remainingMs < adapter.minBudgetMs) {
      await record({
        adapter: adapter.name,
        outcome: "skipped",
        reason: "budget",
        detail: `needs ${adapter.minBudgetMs}ms, ${Math.max(0, remainingMs)}ms left`,
        budgetMs: Math.max(0, remainingMs),
      });
      continue;
    }

    const startedAt = now();
    try {
      const post = await adapter.fetchPost(url, { budgetMs: remainingMs, credential });
      const elapsedMs = now() - startedAt;
      if (post === null) {
        await record({ adapter: adapter.name, outcome: "not-found", elapsedMs, budgetMs: remainingMs });
        return { post: null, attempts };
      }
      await record({ adapter: adapter.name, outcome: "found", elapsedMs, budgetMs: remainingMs });
      return { post, attempts };
    } catch (error) {
      await record({ adapter: adapter.name, outcome: "failed", error, elapsedMs: now() - startedAt, budgetMs: remainingMs });
      firstError ??= { error };
    }
  }

  if (firstError) {
    throw firstError.error;
  }
  throw new PostScraperBudgetError(
    attempts.filter((a): a is SkippedPostAdapterAttempt => a.outcome === "skipped"),
    budgetMs
  );
}
