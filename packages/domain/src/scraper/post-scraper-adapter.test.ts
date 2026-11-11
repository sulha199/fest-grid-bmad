import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_POST_SCRAPER_ORDER,
  PostScraperBudgetError,
  PostUnavailableError,
  parsePostScraperOrder,
  runPostScraperChain,
  type PostAdapterAttempt,
  type PostScrapeCredential,
  type PostScraperAdapter,
  type PostScraperAdapterName,
} from "./post-scraper-adapter.js";
import type { ScrapedPost } from "./types.js";

// Story 10.2 -- the pure post-scraper provider chain (PRD 3.18 FR118). Fake adapters only: nothing here calls a vendor.

const post: ScrapedPost = { content: "caption", postUrl: "https://www.instagram.com/p/AAA/", publishedAt: "2026-11-11T00:00:00.000Z" };
const credential: PostScrapeCredential = { kind: "app-funded" };
const URL_ = "https://www.instagram.com/p/AAA/";

function adapter(
  name: PostScraperAdapterName,
  minBudgetMs: number,
  fetchPost: PostScraperAdapter["fetchPost"]
): PostScraperAdapter & { calls: number[] } {
  const calls: number[] = [];
  return {
    name,
    minBudgetMs,
    calls,
    fetchPost: async (url, context) => {
      calls.push(context.budgetMs);
      return fetchPost(url, context);
    },
  };
}

test("the default order prefers Bright Data, then Apify (owner decision 2026-11-11, OI-1)", () => {
  assert.deepEqual([...DEFAULT_POST_SCRAPER_ORDER], ["brightdata", "apify"]);
  assert.deepEqual(parsePostScraperOrder(undefined).order, ["brightdata", "apify"]);
  assert.deepEqual(parsePostScraperOrder("").order, ["brightdata", "apify"]);
});

test("parsePostScraperOrder: first name is the first choice, case and spaces are ignored", () => {
  assert.deepEqual(parsePostScraperOrder(" Apify , BrightData ").order, ["apify", "brightdata"]);
  assert.deepEqual(parsePostScraperOrder("apify").order, ["apify"]);
});

test("parsePostScraperOrder: unknown names are reported and dropped, repeats count once, all-unknown falls back", () => {
  const parsed = parsePostScraperOrder("apify,scrapingbee,apify,brightdata");
  assert.deepEqual(parsed.order, ["apify", "brightdata"]);
  assert.deepEqual(parsed.ignored, ["scrapingbee"]);
  const fallback = parsePostScraperOrder("nope");
  assert.deepEqual(fallback.order, ["brightdata", "apify"]);
  assert.deepEqual(fallback.ignored, ["nope"]);
  assert.deepEqual(parsePostScraperOrder(null).order, ["brightdata", "apify"]);
});

test("runPostScraperChain: the first adapter that finds the post wins and the rest are not called", async () => {
  const first = adapter("brightdata", 0, async () => post);
  const second = adapter("apify", 0, async () => post);
  const result = await runPostScraperChain({ adapters: [first, second], url: URL_, budgetMs: 1000, credential });
  assert.equal(result.post, post);
  assert.equal(second.calls.length, 0);
  assert.deepEqual(result.attempts.map((a) => [a.adapter, a.outcome]), [["brightdata", "found"]]);
});

test("runPostScraperChain: the adapter gets the url, the credential and the remaining budget", async () => {
  let seen: { url: string; budgetMs: number; credential: PostScrapeCredential } | undefined;
  const only = adapter("apify", 0, async (url, context) => {
    seen = { url, budgetMs: context.budgetMs, credential: context.credential };
    return post;
  });
  let clock = 0;
  await runPostScraperChain({ adapters: [only], url: URL_, budgetMs: 500, credential, now: () => clock });
  assert.deepEqual(seen, { url: URL_, budgetMs: 500, credential });
  clock = 0;
});

test("runPostScraperChain: null is an answer (the vendor says the post is gone) and stops the chain", async () => {
  const first = adapter("brightdata", 0, async () => null);
  const second = adapter("apify", 0, async () => post);
  const result = await runPostScraperChain({ adapters: [first, second], url: URL_, budgetMs: 1000, credential });
  assert.equal(result.post, null);
  assert.equal(second.calls.length, 0);
  assert.equal(result.attempts[0].outcome, "not-found");
});

test("runPostScraperChain: a throwing adapter hands over to the next one and the failure is recorded", async () => {
  const boom = new Error("vendor down");
  const first = adapter("brightdata", 0, async () => {
    throw boom;
  });
  const second = adapter("apify", 0, async () => post);
  const result = await runPostScraperChain({ adapters: [first, second], url: URL_, budgetMs: 1000, credential });
  assert.equal(result.post, post);
  assert.equal(result.attempts[0].outcome, "failed");
  assert.equal((result.attempts[0] as Extract<PostAdapterAttempt, { outcome: "failed" }>).error, boom);
  assert.equal(result.attempts[1].outcome, "found");
});

test("runPostScraperChain: when every adapter fails the FIRST adapter's error is rethrown unchanged", async () => {
  const e1 = new Error("first");
  const e2 = new Error("second");
  const first = adapter("brightdata", 0, async () => {
    throw e1;
  });
  const second = adapter("apify", 0, async () => {
    throw e2;
  });
  await assert.rejects(runPostScraperChain({ adapters: [first, second], url: URL_, budgetMs: 1000, credential }), (error) => error === e1);
});

test("runPostScraperChain: an adapter needing more than the time left is skipped for budget, never called", async () => {
  const slow = adapter("brightdata", 90_000, async () => post);
  const fast = adapter("apify", 0, async () => post);
  const result = await runPostScraperChain({ adapters: [slow, fast], url: URL_, budgetMs: 20_000, credential });
  assert.equal(slow.calls.length, 0);
  assert.equal(result.post, post);
  const skipped = result.attempts[0] as Extract<PostAdapterAttempt, { outcome: "skipped" }>;
  assert.equal(skipped.outcome, "skipped");
  assert.equal(skipped.reason, "budget");
  assert.equal(skipped.budgetMs, 20_000);
});

test("runPostScraperChain: a known-over-quota adapter is skipped for quota with no call", async () => {
  const first = adapter("apify", 0, async () => post);
  const second = adapter("brightdata", 0, async () => post);
  const result = await runPostScraperChain({
    adapters: [first, second],
    url: URL_,
    budgetMs: 1000,
    credential,
    isOverQuota: async (name) => name === "apify",
  });
  assert.equal(first.calls.length, 0);
  assert.equal(result.post, post);
  const skipped = result.attempts[0] as Extract<PostAdapterAttempt, { outcome: "skipped" }>;
  assert.deepEqual([skipped.adapter, skipped.reason], ["apify", "quota"]);
});

test("runPostScraperChain: a synchronous isOverQuota answer works too", async () => {
  const only = adapter("brightdata", 0, async () => post);
  const other = adapter("apify", 0, async () => post);
  const result = await runPostScraperChain({ adapters: [only, other], url: URL_, budgetMs: 1000, credential, isOverQuota: (name) => name === "brightdata" });
  assert.equal(only.calls.length, 0);
  assert.equal(other.calls.length, 1);
  assert.equal(result.attempts[0].outcome, "skipped");
});

test("runPostScraperChain: when every adapter is skipped it throws PostScraperBudgetError naming each reason", async () => {
  const a = adapter("brightdata", 90_000, async () => post);
  const b = adapter("apify", 0, async () => post);
  await assert.rejects(
    runPostScraperChain({ adapters: [a, b], url: URL_, budgetMs: 1000, credential, isOverQuota: (name) => name === "apify" }),
    (error) => {
      assert.ok(error instanceof PostScraperBudgetError);
      assert.equal(error.attempts.length, 2);
      assert.match(error.message, /brightdata: needs 90000ms/);
      assert.match(error.message, /apify: over its quota/);
      return true;
    }
  );
});

test("runPostScraperChain: no adapters at all is the same all-skipped error", async () => {
  await assert.rejects(runPostScraperChain({ adapters: [], url: URL_, budgetMs: 1000, credential }), PostScraperBudgetError);
});

test("runPostScraperChain: budget is shared: a slow failure leaves less time, so the next adapter is skipped and the first error surfaces", async () => {
  let clock = 0;
  const slowError = new Error("timed out");
  const first = adapter("brightdata", 0, async () => {
    clock += 60_000;
    throw slowError;
  });
  const second = adapter("apify", 30_000, async () => post);
  const seen: PostAdapterAttempt[] = [];
  await assert.rejects(
    runPostScraperChain({
      adapters: [first, second],
      url: URL_,
      budgetMs: 70_000,
      credential,
      now: () => clock,
      onAttempt: (attempt) => {
        seen.push(attempt);
      },
    }),
    (error) => error === slowError
  );
  assert.equal(second.calls.length, 0, "10s left is below the 30s minimum");
  assert.deepEqual(seen.map((a) => [a.adapter, a.outcome]), [["brightdata", "failed"], ["apify", "skipped"]]);
  assert.equal((seen[0] as Extract<PostAdapterAttempt, { outcome: "failed" }>).elapsedMs, 60_000);
  assert.equal((seen[1] as Extract<PostAdapterAttempt, { outcome: "skipped" }>).budgetMs, 10_000);
});

test("runPostScraperChain: onAttempt sees every adapter considered, also the failures, and a throwing hook is ignored", async () => {
  const seen: string[] = [];
  const first = adapter("brightdata", 0, async () => {
    throw new Error("x");
  });
  const second = adapter("apify", 0, async () => post);
  const result = await runPostScraperChain({
    adapters: [first, second],
    url: URL_,
    budgetMs: 1000,
    credential,
    onAttempt: async (attempt) => {
      seen.push(`${attempt.adapter}:${attempt.outcome}`);
      throw new Error("audit write failed");
    },
  });
  assert.equal(result.post, post);
  assert.deepEqual(seen, ["brightdata:failed", "apify:found"]);
});

test("runPostScraperChain: a hook that throws synchronously is ignored as well", async () => {
  const only = adapter("apify", 0, async () => post);
  const result = await runPostScraperChain({
    adapters: [only],
    url: URL_,
    budgetMs: 1000,
    credential,
    onAttempt: () => {
      throw new Error("sync");
    },
  });
  assert.equal(result.post, post);
});

test("PostUnavailableError is an Error that vendor adapters subclass; the chain treats it as an ordinary failure", async () => {
  class VendorUnavailable extends PostUnavailableError {}
  const empty = new VendorUnavailable("an empty result");
  assert.ok(empty instanceof PostUnavailableError && empty instanceof Error);
  assert.equal(new PostUnavailableError("x").name, "PostUnavailableError");
  const first = adapter("brightdata", 0, async () => {
    throw empty;
  });
  const second = adapter("apify", 0, async () => post);
  const result = await runPostScraperChain({ adapters: [first, second], url: URL_, budgetMs: 1000, credential });
  assert.equal(result.post, post);
  assert.equal(result.attempts[0].outcome, "failed");
});
