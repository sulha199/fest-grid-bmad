import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPostImageUrls } from "./merge-post-image-urls.js";

// Story 10.2 AC5 (BUG-261102-4rm): the slide list never contains the cover.

const cover = "https://cdn.example/v/t51/111_n.jpg?sig=aaa&oe=1";

test("buildPostImageUrls: the cover stays in imageUrl and the slides exclude it", () => {
  const out = buildPostImageUrls(cover, ["https://cdn.example/v/t51/222_n.jpg?sig=b", "https://cdn.example/v/t51/333_n.jpg?sig=c"]);
  assert.equal(out.imageUrl, cover);
  assert.deepEqual(out.additionalImageUrls, ["https://cdn.example/v/t51/222_n.jpg?sig=b", "https://cdn.example/v/t51/333_n.jpg?sig=c"]);
});

test("buildPostImageUrls: a slide that is the cover under a different signed query is dropped (compared by file name)", () => {
  const out = buildPostImageUrls(cover, ["https://cdn.example/v/t51/111_n.jpg?sig=zzz&oe=9", "https://cdn.example/v/t51/222_n.jpg?sig=b"]);
  assert.deepEqual(out.additionalImageUrls, ["https://cdn.example/v/t51/222_n.jpg?sig=b"]);
});

test("buildPostImageUrls: duplicate slides are removed and order is kept", () => {
  const out = buildPostImageUrls(cover, ["https://cdn.example/b/2.jpg", "https://cdn.example/c/3.jpg", "https://cdn.example/x/2.jpg?sig=q"]);
  assert.deepEqual(out.additionalImageUrls, ["https://cdn.example/b/2.jpg", "https://cdn.example/c/3.jpg"]);
});

test("buildPostImageUrls: no slides, undefined or empty entries give an empty list", () => {
  assert.deepEqual(buildPostImageUrls(cover, []).additionalImageUrls, []);
  assert.deepEqual(buildPostImageUrls(cover, [undefined, null, ""]).additionalImageUrls, []);
});

test("buildPostImageUrls: without a cover the first slide becomes the cover and the rest are the slides", () => {
  const out = buildPostImageUrls(undefined, ["https://cdn.example/a/1.jpg", "https://cdn.example/a/2.jpg"]);
  assert.equal(out.imageUrl, "https://cdn.example/a/1.jpg");
  assert.deepEqual(out.additionalImageUrls, ["https://cdn.example/a/2.jpg"]);
});

test("buildPostImageUrls: nothing at all gives no cover and no slides", () => {
  assert.deepEqual(buildPostImageUrls(undefined, []), { imageUrl: undefined, additionalImageUrls: [] });
  assert.deepEqual(buildPostImageUrls(null, undefined), { imageUrl: undefined, additionalImageUrls: [] });
});
