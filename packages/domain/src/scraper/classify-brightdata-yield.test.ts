import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BRIGHT_DATA_EXPECTED_ERROR_CODES,
  BRIGHT_DATA_RETRYABLE_ERROR_CODES,
  classifyBrightDataYield,
} from "./classify-brightdata-yield.js";

test("posts and no error is complete, with a rate of 1", () => {
  assert.deepEqual(classifyBrightDataYield({ records: 12, errors: 0 }), { level: "complete", rate: 1, unknownCodes: [] });
  // A report that omits `errors` altogether reads as no error.
  assert.equal(classifyBrightDataYield({ records: 3 }).level, "complete");
});

test("posts plus a dead_page error is the expected partial seen on prod, rate records / (records + errors)", () => {
  const result = classifyBrightDataYield({ records: 11, errors: 1, errorCodes: { dead_page: 1 } });
  assert.equal(result.level, "partial-expected");
  assert.equal(result.rate, 11 / 12);
  assert.deepEqual(BRIGHT_DATA_EXPECTED_ERROR_CODES, ["dead_page"]);
});

test("no code is retryable until one is observed", () => {
  assert.deepEqual(BRIGHT_DATA_RETRYABLE_ERROR_CODES, []);
});

test("an error code the caller lists as retryable wins over the other codes", () => {
  const result = classifyBrightDataYield(
    { records: 5, errors: 2, errorCodes: { dead_page: 1, rate_limited: 1 } },
    { retryableCodes: ["rate_limited"] }
  );
  assert.equal(result.level, "partial-retryable");
  assert.equal(result.rate, 5 / 7);
});

test("an unseen code is partial-unknown and is returned for logging, alongside a known one", () => {
  const result = classifyBrightDataYield({ records: 5, errors: 2, errorCodes: { dead_page: 1, something_new: 1 } });
  assert.equal(result.level, "partial-unknown");
  assert.deepEqual(result.unknownCodes, ["something_new"]);
});

test("errors reported without any code are unknown, not expected", () => {
  assert.equal(classifyBrightDataYield({ records: 5, errors: 1 }).level, "partial-unknown");
  assert.equal(classifyBrightDataYield({ records: 5, errors: 1, errorCodes: null }).level, "partial-unknown");
  assert.equal(classifyBrightDataYield({ records: 5, errors: 1, errorCodes: {} }).level, "partial-unknown");
});

test("the expected set can be overridden by the caller", () => {
  assert.equal(
    classifyBrightDataYield({ records: 5, errors: 1, errorCodes: { dead_page: 1 } }, { expectedCodes: [] }).level,
    "partial-unknown"
  );
});

test("nothing delivered is no-records, with a rate of 0 when errors were reported and null when nothing was", () => {
  assert.deepEqual(classifyBrightDataYield({ records: 0, errors: 1, errorCodes: { dead_page: 1 } }), {
    level: "no-records",
    rate: 0,
    unknownCodes: [],
  });
  assert.deepEqual(classifyBrightDataYield({}), { level: "no-records", rate: null, unknownCodes: [] });
  assert.deepEqual(classifyBrightDataYield({ records: null, errors: null }), { level: "no-records", rate: null, unknownCodes: [] });
});
