import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePlatformPrefixedEventSlug } from "./parse-platform-prefixed-event-slug.js";

describe("parsePlatformPrefixedEventSlug", () => {
  it("parses a basic Instagram post slug", () => {
    assert.deepEqual(parsePlatformPrefixedEventSlug("ig_p_Cx9uWttkSN"), {
      platform: "instagram",
      platformPostType: "p",
      platformPostId: "Cx9uWttkSN",
    });
  });

  it("preserves the post type verbatim (not normalized)", () => {
    assert.deepEqual(parsePlatformPrefixedEventSlug("ig_reel_Cx9uWttkSN"), {
      platform: "instagram",
      platformPostType: "reel",
      platformPostId: "Cx9uWttkSN",
    });
  });

  it("strips and discards a synthetic ordinal suffix", () => {
    assert.deepEqual(parsePlatformPrefixedEventSlug("ig_p_Ddi9wU6RCRQ~2"), {
      platform: "instagram",
      platformPostType: "p",
      platformPostId: "Ddi9wU6RCRQ",
    });
  });

  it("parses correctly when platformPostId itself contains underscores/hyphens", () => {
    assert.deepEqual(parsePlatformPrefixedEventSlug("ig_p_abc_123-x"), {
      platform: "instagram",
      platformPostType: "p",
      platformPostId: "abc_123-x",
    });
  });

  it("returns null for a legacy 12-char hex slug", () => {
    assert.equal(parsePlatformPrefixedEventSlug("a1b2c3d4e5f6"), null);
  });

  it("returns null for an unrecognized platform segment", () => {
    assert.equal(parsePlatformPrefixedEventSlug("tiktok_p_abc123"), null);
  });

  it("parses a recognized non-Instagram platform (rejection is the caller's concern)", () => {
    assert.deepEqual(parsePlatformPrefixedEventSlug("x_status_123"), {
      platform: "twitter",
      platformPostType: "status",
      platformPostId: "123",
    });
  });

  it("returns null for a slug with only one underscore", () => {
    assert.equal(parsePlatformPrefixedEventSlug("ig_p"), null);
  });
});
