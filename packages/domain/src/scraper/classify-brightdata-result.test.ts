import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyBrightDataResult } from "./classify-brightdata-result.js";

// The three signatures measured on 2026-10-22 (BUG-074 section 4).
const healthy = { status: "ready", records: 3, errors: 0, errorCodes: null, errorMessage: null };
const legitimatelyEmpty = { status: "ready", records: 0, errors: 1, errorCodes: { dead_page: 1 }, errorMessage: null };
const vendorFailure = {
  status: "ready",
  records: 0,
  errors: 0,
  errorCodes: null,
  errorMessage: "No records found. The data may not be available or has changed...",
};

test("records delivered is ok, whatever the progress report says", () => {
  assert.equal(classifyBrightDataResult({ recordCount: 3, progress: healthy }), "ok");
  assert.equal(classifyBrightDataResult({ recordCount: 1, progress: vendorFailure }), "ok");
  assert.equal(classifyBrightDataResult({ recordCount: 1, progress: null }), "ok");
});

test("zero records with a dead_page error is an empty account, not a failure", () => {
  assert.equal(classifyBrightDataResult({ recordCount: 0, progress: legitimatelyEmpty }), "empty");
});

test("zero records with no dead_page error is a vendor failure (the 2026-10-21 outage signature)", () => {
  assert.equal(classifyBrightDataResult({ recordCount: 0, progress: vendorFailure }), "vendor_failure");
});

test("zero records where the error codes hold other codes but no dead_page is a vendor failure", () => {
  assert.equal(
    classifyBrightDataResult({ recordCount: 0, progress: { status: "ready", records: 0, errors: 2, errorCodes: { crawl_failed: 2 } } }),
    "vendor_failure"
  );
});

test("a dead_page count of zero does not count as a dead page", () => {
  assert.equal(
    classifyBrightDataResult({ recordCount: 0, progress: { status: "ready", records: 0, errors: 0, errorCodes: { dead_page: 0 } } }),
    "vendor_failure"
  );
});

test("a snapshot Bright Data reports as failed is a vendor failure, even with a dead_page error", () => {
  assert.equal(classifyBrightDataResult({ recordCount: 0, progress: { status: "failed" } }), "vendor_failure");
  assert.equal(
    classifyBrightDataResult({ recordCount: 0, progress: { status: "failed", errorCodes: { dead_page: 1 } } }),
    "vendor_failure"
  );
});

test("no progress report (the lookup failed) is inconclusive and classes as empty", () => {
  assert.equal(classifyBrightDataResult({ recordCount: 0, progress: null }), "empty");
  assert.equal(classifyBrightDataResult({ recordCount: 0, progress: undefined }), "empty");
});

test("a snapshot still in flight is inconclusive and classes as empty", () => {
  for (const status of ["scheduled", "building", "running"]) {
    assert.equal(classifyBrightDataResult({ recordCount: 0, progress: { status } }), "empty");
  }
});

test("a status the classifier has never seen is inconclusive: only ready and failed are terminal", () => {
  for (const status of ["starting", "collecting", "", "READY"]) {
    assert.equal(classifyBrightDataResult({ recordCount: 0, progress: { status, errors: 0 } }), "empty");
  }
});

test("progress that reports records the delivery did not carry is not a vendor failure (a truncated or unparseable body)", () => {
  assert.equal(
    classifyBrightDataResult({ recordCount: 0, progress: { status: "ready", records: 25, errors: 0, errorCodes: null } }),
    "empty"
  );
});

test("progress that reports zero records, or none, still decides on the dead_page signature", () => {
  assert.equal(classifyBrightDataResult({ recordCount: 0, progress: { status: "ready", records: 0, errors: 0 } }), "vendor_failure");
  assert.equal(classifyBrightDataResult({ recordCount: 0, progress: { status: "ready", records: null, errors: 0 } }), "vendor_failure");
  assert.equal(classifyBrightDataResult({ recordCount: 0, progress: { status: "ready" } }), "vendor_failure");
});
