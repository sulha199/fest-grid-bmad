import test from "node:test";
import assert from "node:assert/strict";
import {
  registerScraperAdapter,
  getScraperAdapter,
  lookupAccountProfile,
  clearRegisteredAdapters,
} from "./adapter-registry.js";
import { ScraperAdapter, ScraperAccountRef, ScrapedPost, AccountProfileLookupResult } from "./types.js";

class FakeScraperAdapter implements ScraperAdapter {
  constructor(
    private profileResult: AccountProfileLookupResult | null = null,
    private postsResult: ScrapedPost[] = []
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getNewestPosts(_account: ScraperAccountRef): Promise<ScrapedPost[]> {
    return this.postsResult;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async lookupAccountProfile(_handleOrUrl: string): Promise<AccountProfileLookupResult | null> {
    return this.profileResult;
  }
}

test("getScraperAdapter throws for an unregistered platform", () => {
  clearRegisteredAdapters();
  assert.throws(() => {
    getScraperAdapter("instagram");
  }, /No scraper adapter registered for platform "instagram"/);
});

test("registerScraperAdapter and getScraperAdapter round-trip with a fake adapter", () => {
  clearRegisteredAdapters();
  const fakeAdapter = new FakeScraperAdapter();
  registerScraperAdapter("instagram", fakeAdapter);

  const retrieved = getScraperAdapter("instagram");
  assert.equal(retrieved, fakeAdapter);
});

test("lookupAccountProfile delegates to the registered adapter and propagates results correctly", async () => {
  clearRegisteredAdapters();
  const expectedProfile: AccountProfileLookupResult = {
    accountId: "12345",
    displayName: "My Test Page",
    username: "testpage",
    profileImageUrl: "https://example.com/image.jpg",
  };
  const fakeAdapter = new FakeScraperAdapter(expectedProfile);
  registerScraperAdapter("twitter", fakeAdapter);

  const result = await lookupAccountProfile("twitter", "testpage");
  assert.deepEqual(result, expectedProfile);

  // Also test propagation of null
  const fakeAdapterNull = new FakeScraperAdapter(null);
  registerScraperAdapter("instagram", fakeAdapterNull);
  const resultNull = await lookupAccountProfile("instagram", "nonexistent");
  assert.equal(resultNull, null);
});

test("lookupAccountProfile throws the same not registered error when nothing is registered for the platform", async () => {
  clearRegisteredAdapters();
  await assert.rejects(async () => {
    await lookupAccountProfile("instagram", "testpage");
  }, /No scraper adapter registered for platform "instagram"/);
});
