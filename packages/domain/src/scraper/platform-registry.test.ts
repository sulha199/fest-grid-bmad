import test from "node:test";
import assert from "node:assert/strict";
import { SUPPORTED_PLATFORMS } from "../subscriptions/platforms.js";
import {
  PLATFORM_SLUGS,
  PLATFORM_DISPLAY_NAMES,
  getPlatformSlug,
  getPlatformByCode,
  getPlatformDisplayName,
  detectPlatformFromUrl,
} from "./platform-registry.js";

test("PLATFORM_SLUGS and PLATFORM_DISPLAY_NAMES have exactly one entry per SUPPORTED_PLATFORMS member (AC8 coverage guard)", () => {
  for (const platform of SUPPORTED_PLATFORMS) {
    assert.ok(PLATFORM_SLUGS[platform], `PLATFORM_SLUGS has entry for ${platform}`);
    assert.ok(PLATFORM_DISPLAY_NAMES[platform], `PLATFORM_DISPLAY_NAMES has entry for ${platform}`);
  }

  // Also assert they have no extra properties beyond SUPPORTED_PLATFORMS
  assert.equal(
    Object.keys(PLATFORM_SLUGS).length,
    SUPPORTED_PLATFORMS.length,
    "PLATFORM_SLUGS has exactly the same number of keys as SUPPORTED_PLATFORMS"
  );
  assert.equal(
    Object.keys(PLATFORM_DISPLAY_NAMES).length,
    SUPPORTED_PLATFORMS.length,
    "PLATFORM_DISPLAY_NAMES has exactly the same number of keys as SUPPORTED_PLATFORMS"
  );
});

test("getPlatformSlug retrieves correct slug", () => {
  assert.equal(getPlatformSlug("instagram"), "ig");
  assert.equal(getPlatformSlug("twitter"), "x");
});

test("getPlatformDisplayName retrieves correct display name", () => {
  assert.equal(getPlatformDisplayName("instagram"), "Instagram");
  assert.equal(getPlatformDisplayName("twitter"), "Twitter/X");
});

test("getPlatformByCode resolves known slugs and returns undefined for unknown", () => {
  assert.equal(getPlatformByCode("ig"), "instagram");
  assert.equal(getPlatformByCode("x"), "twitter");
  assert.equal(getPlatformByCode("unknown"), undefined);
  assert.equal(getPlatformByCode("IG"), undefined); // case-sensitive lookup
});

test("detectPlatformFromUrl detects instagram and twitter from URL and returns null for others/invalid", () => {
  assert.equal(detectPlatformFromUrl("https://instagram.com/p/abc"), "instagram");
  assert.equal(detectPlatformFromUrl("https://www.instagram.com/p/abc"), "instagram");
  assert.equal(detectPlatformFromUrl("https://instagr.am/p/abc"), "instagram");
  assert.equal(detectPlatformFromUrl("https://twitter.com/user/status/123"), "twitter");
  assert.equal(detectPlatformFromUrl("https://x.com/user/status/123"), "twitter");
  assert.equal(detectPlatformFromUrl("https://www.x.com/user/status/123"), "twitter");
  assert.equal(detectPlatformFromUrl("https://facebook.com/abc"), null);
  assert.equal(detectPlatformFromUrl("not-a-url"), null);
});
