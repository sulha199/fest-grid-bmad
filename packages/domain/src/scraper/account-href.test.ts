import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildAccountHref, normalizeUsername } from "./account-href.js";

describe("normalizeUsername", () => {
  it("lower-cases, trims and strips a leading @", () => {
    assert.equal(normalizeUsername("  @JktCity.Events "), "jktcity.events");
  });

  it("returns an empty string for blank input", () => {
    assert.equal(normalizeUsername("   "), "");
  });
});

describe("buildAccountHref", () => {
  it("builds /<slug>/<username> for instagram", () => {
    assert.equal(buildAccountHref("instagram", "jktcity.events"), "/ig/jktcity.events");
  });

  it("uses the x slug for twitter", () => {
    assert.equal(buildAccountHref("twitter", "someone"), "/x/someone");
  });

  it("normalizes the username so a stored mixed-case value yields the canonical path", () => {
    assert.equal(buildAccountHref("instagram", "JktCity.Events"), "/ig/jktcity.events");
  });

  it("percent-encodes characters that are not URL-safe", () => {
    assert.equal(buildAccountHref("instagram", "a/b"), "/ig/a%2Fb");
  });

  it("returns null for an empty, blank, null or undefined username (no numeric fallback)", () => {
    assert.equal(buildAccountHref("instagram", ""), null);
    assert.equal(buildAccountHref("instagram", "  @ "), null);
    assert.equal(buildAccountHref("instagram", null), null);
    assert.equal(buildAccountHref("instagram", undefined), null);
  });
});
