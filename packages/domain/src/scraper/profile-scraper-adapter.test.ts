import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PROFILE_SCRAPER_ORDER,
  ProfileScraperBudgetError,
  parseProfileScraperOrder,
  runProfileScraperChain,
  type ProfileScraperAdapter,
  type ProfileScraperAdapterName,
  type ScrapedProfile,
} from "./profile-scraper-adapter.js";

const profile: ScrapedProfile = { accountId: "1", username: "someone", displayName: "Some One" };

function adapter(
  name: ProfileScraperAdapterName,
  minBudgetMs: number,
  fetchProfile: ProfileScraperAdapter["fetchProfile"]
): ProfileScraperAdapter & { calls: number[] } {
  const calls: number[] = [];
  return {
    name,
    minBudgetMs,
    calls,
    fetchProfile: async (handle, context) => {
      calls.push(context.budgetMs);
      return fetchProfile(handle, context);
    },
  };
}

test("parseProfileScraperOrder: first name is the first choice, case and spaces are ignored", () => {
  assert.deepEqual(parseProfileScraperOrder(" BrightData , apify ").order, ["brightdata", "apify"]);
  assert.deepEqual(parseProfileScraperOrder("brightdata").order, ["brightdata"]);
});

test("parseProfileScraperOrder: unknown names are reported and dropped, repeats count once", () => {
  const parsed = parseProfileScraperOrder("apify,scrapingbee,apify,brightdata");
  assert.deepEqual(parsed.order, ["apify", "brightdata"]);
  assert.deepEqual(parsed.ignored, ["scrapingbee"]);
});

test("parseProfileScraperOrder: empty, missing or all-unknown falls back to the default order", () => {
  for (const value of [undefined, null, "", " , ", "nonsense"]) {
    assert.deepEqual(parseProfileScraperOrder(value).order, [...DEFAULT_PROFILE_SCRAPER_ORDER]);
  }
  assert.deepEqual(parseProfileScraperOrder("nonsense").ignored, ["nonsense"]);
});

test("the first adapter that finds the profile answers; later adapters are never asked", async () => {
  const first = adapter("apify", 0, async () => profile);
  const second = adapter("brightdata", 0, async () => assert.fail("must not be called"));

  const result = await runProfileScraperChain({ adapters: [first, second], handle: "someone", purpose: "lookup", budgetMs: 25_000 });

  assert.equal(result.profile, profile);
  assert.deepEqual(result.attempts.map((a) => [a.adapter, a.outcome]), [["apify", "found"]]);
  assert.equal(second.calls.length, 0);
});

test("a adapter that throws hands over to the next one", async () => {
  const first = adapter("apify", 0, async () => { throw new Error("Monthly usage hard limit exceeded"); });
  const second = adapter("brightdata", 0, async () => profile);

  const result = await runProfileScraperChain({ adapters: [first, second], handle: "someone", purpose: "classification", budgetMs: 100_000 });

  assert.equal(result.profile, profile);
  assert.deepEqual(result.attempts.map((a) => [a.adapter, a.outcome]), [["apify", "failed"], ["brightdata", "found"]]);
});

test("null from a adapter means 'does not exist': the chain stops and does not ask another vendor", async () => {
  const first = adapter("apify", 0, async () => null);
  const second = adapter("brightdata", 0, async () => profile);

  const result = await runProfileScraperChain({ adapters: [first, second], handle: "ghost", purpose: "lookup", budgetMs: 100_000 });

  assert.equal(result.profile, null);
  assert.equal(second.calls.length, 0);
  assert.deepEqual(result.attempts.map((a) => a.outcome), ["not-found"]);
});

test("when every adapter fails, the FIRST adapter's own error is rethrown unchanged", async () => {
  class FirstError extends Error {}
  const firstError = new FirstError("apify failed");
  const first = adapter("apify", 0, async () => { throw firstError; });
  const second = adapter("brightdata", 0, async () => { throw new Error("brightdata failed"); });

  await assert.rejects(
    () => runProfileScraperChain({ adapters: [first, second], handle: "x", purpose: "lookup", budgetMs: 100_000 }),
    (err: unknown) => err === firstError
  );
});

test("a adapter whose minimum budget exceeds what is left is skipped, not tried", async () => {
  const apify = adapter("apify", 0, async () => { throw new Error("blocked"); });
  const brightdata = adapter("brightdata", 90_000, async () => profile);

  // The API Lambda case: 25 s is far below Bright Data's ~80 s, so it is never started.
  await assert.rejects(
    () => runProfileScraperChain({ adapters: [apify, brightdata], handle: "x", purpose: "lookup", budgetMs: 25_000 }),
    /blocked/
  );
  assert.equal(brightdata.calls.length, 0);
});

test("a long budget reaches the slower adapter, and each adapter gets what is left of the shared budget", async () => {
  let clock = 0;
  const apify = adapter("apify", 0, async () => { clock += 20_000; throw new Error("timed out"); });
  const brightdata = adapter("brightdata", 90_000, async () => profile);

  const result = await runProfileScraperChain({
    adapters: [apify, brightdata],
    handle: "x",
    purpose: "classification",
    budgetMs: 200_000,
    now: () => clock,
  });

  assert.equal(result.profile, profile);
  assert.deepEqual(apify.calls, [200_000]);
  assert.deepEqual(brightdata.calls, [180_000]);
});

test("time spent by an earlier adapter can leave too little for a slow one", async () => {
  let clock = 0;
  const apify = adapter("apify", 0, async () => { clock += 30_000; throw new Error("slow failure"); });
  const brightdata = adapter("brightdata", 90_000, async () => profile);

  await assert.rejects(
    () => runProfileScraperChain({ adapters: [apify, brightdata], handle: "x", purpose: "lookup", budgetMs: 100_000, now: () => clock }),
    /slow failure/
  );
  assert.equal(brightdata.calls.length, 0);
});

test("when nothing fits the budget at all, it throws ProfileScraperBudgetError and asks no vendor", async () => {
  const brightdata = adapter("brightdata", 90_000, async () => profile);

  await assert.rejects(
    () => runProfileScraperChain({ adapters: [brightdata], handle: "x", purpose: "lookup", budgetMs: 25_000 }),
    (err: unknown) => err instanceof ProfileScraperBudgetError && /25000ms/.test(err.message) && /brightdata/.test(err.message)
  );
  assert.equal(brightdata.calls.length, 0);
});
