import { test } from "node:test";
import assert from "node:assert/strict";
import { ENGINE_INTERNAL_JOB_REASON_CODES, USER_SAFE_JOB_REASON_CODES, mapJobReasonCode, userSafeJobProvider } from "./job-reasons.js";

// Story 10.4 (Part A) -- the user-safe reason mapping and the vendor spelling.

test("every user-safe reason maps to itself", () => {
  for (const code of USER_SAFE_JOB_REASON_CODES) {
    assert.equal(mapJobReasonCode(code), code);
  }
});

test("every engine-internal ending and an unknown code read as GENERIC", () => {
  for (const code of [...ENGINE_INTERNAL_JOB_REASON_CODES, "SOMETHING_NEW"]) {
    assert.equal(mapJobReasonCode(code), "GENERIC", code);
  }
});

test("no reason stays no reason", () => {
  assert.equal(mapJobReasonCode(null), null);
  assert.equal(mapJobReasonCode(undefined), null);
  assert.equal(mapJobReasonCode(""), null);
});

test("the table's BRIGHTDATA is spelled BRIGHT_DATA at the boundary", () => {
  assert.equal(userSafeJobProvider("BRIGHTDATA"), "BRIGHT_DATA");
  assert.equal(userSafeJobProvider("APIFY"), "APIFY");
});
