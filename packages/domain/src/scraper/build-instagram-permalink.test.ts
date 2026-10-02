import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInstagramPermalink } from "./build-instagram-permalink.js";

describe("buildInstagramPermalink", () => {
  it("builds a post permalink", () => {
    assert.equal(buildInstagramPermalink("p", "Cx9uWttkSN"), "https://www.instagram.com/p/Cx9uWttkSN/");
  });

  it("builds a reel permalink", () => {
    assert.equal(buildInstagramPermalink("reel", "Cx9uWttkSN"), "https://www.instagram.com/reel/Cx9uWttkSN/");
  });
});
