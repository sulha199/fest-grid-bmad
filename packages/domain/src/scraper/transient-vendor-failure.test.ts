import { test } from "node:test";
import assert from "node:assert/strict";
import { isTransientVendorFailure } from "./transient-vendor-failure.js";

// Story 10.2 AC8 (FIND-082): one shared transient classifier for the Apify, Bright Data and Gemini clients.

test("a 5xx status is transient, any other status is not", () => {
  for (const statusCode of [500, 502, 503, 599]) {
    assert.equal(isTransientVendorFailure({ statusCode }), true, String(statusCode));
  }
  for (const statusCode of [400, 401, 402, 403, 404, 429, 499, 600]) {
    assert.equal(isTransientVendorFailure({ statusCode }), false, String(statusCode));
  }
});

test("a network-level error code is transient", () => {
  for (const code of ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN"]) {
    assert.equal(isTransientVendorFailure({ code }), true, code);
  }
  assert.equal(isTransientVendorFailure({ code: "ENOENT" }), false);
});

test("anything else is not transient, never a default-transient fallback", () => {
  assert.equal(isTransientVendorFailure({}), false);
  assert.equal(isTransientVendorFailure({ statusCode: undefined, code: undefined }), false);
  assert.equal(isTransientVendorFailure({ statusCode: "500" as unknown as number }), false);
  assert.equal(isTransientVendorFailure({ code: 500 as unknown as string }), false);
});

test("a 5xx status wins over an unknown code, and a known code wins over a non-5xx status", () => {
  assert.equal(isTransientVendorFailure({ statusCode: 503, code: "ENOENT" }), true);
  assert.equal(isTransientVendorFailure({ statusCode: 404, code: "ECONNRESET" }), true);
});
