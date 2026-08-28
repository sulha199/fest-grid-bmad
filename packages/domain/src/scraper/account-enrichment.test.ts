import test from "node:test";
import assert from "node:assert/strict";
import {
  computeProfileBackfillPatch,
  buildLocationInferenceRequest,
  parseLocationInferenceResponse,
  locationInferenceResponseSchema
} from "./account-enrichment.js";

test("computeProfileBackfillPatch: returns patch when both fields differ and are scraped", () => {
  const current = { displayName: "Old Name", username: "old_user" };
  const scraped = { ownerDisplayName: "New Name", ownerUsername: "new_user" };
  const patch = computeProfileBackfillPatch(current, scraped);

  assert.deepEqual(patch, { displayName: "New Name", username: "new_user" });
});

test("computeProfileBackfillPatch: returns patch when only displayName differs", () => {
  const current = { displayName: "Old Name", username: "old_user" };
  const scraped = { ownerDisplayName: "New Name", ownerUsername: "old_user" };
  const patch = computeProfileBackfillPatch(current, scraped);

  assert.deepEqual(patch, { displayName: "New Name" });
});

test("computeProfileBackfillPatch: returns patch when only username differs", () => {
  const current = { displayName: "Old Name", username: "old_user" };
  const scraped = { ownerDisplayName: "Old Name", ownerUsername: "new_user" };
  const patch = computeProfileBackfillPatch(current, scraped);

  assert.deepEqual(patch, { username: "new_user" });
});

test("computeProfileBackfillPatch: returns null when fields are identical", () => {
  const current = { displayName: "Old Name", username: "old_user" };
  const scraped = { ownerDisplayName: "Old Name", ownerUsername: "old_user" };
  const patch = computeProfileBackfillPatch(current, scraped);

  assert.equal(patch, null);
});

test("computeProfileBackfillPatch: returns null when scraped fields are missing or whitespace-only", () => {
  const current = { displayName: "Old Name", username: "old_user" };
  const scraped = { ownerDisplayName: "   ", ownerUsername: "" };
  const patch = computeProfileBackfillPatch(current, scraped);

  assert.equal(patch, null);
});

test("buildLocationInferenceRequest: returns request when both locationName and content are present", () => {
  const post = { locationName: "Central Park", content: "Great concert today!" };
  const req = buildLocationInferenceRequest(post);

  assert.ok(req);
  assert.equal(req.responseMimeType, "application/json");
  assert.equal(req.responseSchema, locationInferenceResponseSchema);
  assert.match(req.contents, /Central Park/);
  assert.match(req.contents, /Great concert today!/);
});

test("buildLocationInferenceRequest: returns request when only locationName is present", () => {
  const post = { locationName: "Central Park" };
  const req = buildLocationInferenceRequest(post);

  assert.ok(req);
  assert.match(req.contents, /Central Park/);
});

test("buildLocationInferenceRequest: returns request when only content is present", () => {
  const post = { content: "Great concert today!" };
  const req = buildLocationInferenceRequest(post);

  assert.ok(req);
  assert.match(req.contents, /Great concert today!/);
});

test("buildLocationInferenceRequest: returns null when both are empty", () => {
  const req1 = buildLocationInferenceRequest({});
  const req2 = buildLocationInferenceRequest({ locationName: "  ", content: "" });

  assert.equal(req1, null);
  assert.equal(req2, null);
});

test("parseLocationInferenceResponse: returns trimmed description and confidence when locationFound is true and description is non-empty", () => {
  const rawText = JSON.stringify({ locationFound: true, placeDescription: "  Madison Square Garden  ", confidence: 0.85 });
  const result = parseLocationInferenceResponse(rawText);

  assert.deepEqual(result, { placeDescription: "Madison Square Garden", confidence: 0.85 });
});

test("parseLocationInferenceResponse: defaults confidence to 0 when the model omits it", () => {
  const rawText = JSON.stringify({ locationFound: true, placeDescription: "Madison Square Garden" });
  const result = parseLocationInferenceResponse(rawText);

  assert.deepEqual(result, { placeDescription: "Madison Square Garden", confidence: 0 });
});

test("parseLocationInferenceResponse: clamps an out-of-range confidence to [0, 1]", () => {
  const over = parseLocationInferenceResponse(JSON.stringify({ locationFound: true, placeDescription: "X", confidence: 1.5 }));
  const under = parseLocationInferenceResponse(JSON.stringify({ locationFound: true, placeDescription: "X", confidence: -0.2 }));

  assert.equal(over?.confidence, 1);
  assert.equal(under?.confidence, 0);
});

test("parseLocationInferenceResponse: returns null when locationFound is false", () => {
  const rawText = JSON.stringify({ locationFound: false, placeDescription: "Madison Square Garden" });
  const place = parseLocationInferenceResponse(rawText);

  assert.equal(place, null);
});

test("parseLocationInferenceResponse: returns null on malformed JSON", () => {
  const place = parseLocationInferenceResponse("{ locationFound: true ");

  assert.equal(place, null);
});

test("parseLocationInferenceResponse: returns null when placeDescription is missing or empty", () => {
  const rawText1 = JSON.stringify({ locationFound: true });
  const rawText2 = JSON.stringify({ locationFound: true, placeDescription: "  " });

  assert.equal(parseLocationInferenceResponse(rawText1), null);
  assert.equal(parseLocationInferenceResponse(rawText2), null);
});
