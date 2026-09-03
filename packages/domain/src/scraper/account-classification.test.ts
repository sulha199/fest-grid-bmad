import test from "node:test";
import assert from "node:assert/strict";
import {
  buildAccountClassificationRequest,
  parseAccountClassificationResponse,
  accountClassificationResponseSchema
} from "./account-classification.js";

test("buildAccountClassificationRequest: builds classification prompt request correctly", () => {
  const profile = {
    biography: "Organizer of local music festivals",
    username: "festival_hub",
    displayName: "Festival Hub",
    businessCategoryName: "Event Planner"
  };

  const req = buildAccountClassificationRequest(profile);

  assert.ok(req);
  assert.equal(req.responseMimeType, "application/json");
  assert.equal(req.responseSchema, accountClassificationResponseSchema);
  assert.match(req.contents, /festival_hub/);
  assert.match(req.contents, /Festival Hub/);
  assert.match(req.contents, /Organizer of local music festivals/);
  assert.match(req.contents, /Event Planner/);
  assert.match(req.systemInstruction, /ORGANIZER_VENUE_EVENT/);
  assert.match(req.systemInstruction, /PERSONAL/);
  assert.match(req.systemInstruction, /CURATOR_GUIDE/);
});

test("buildAccountClassificationRequest: handles null businessCategoryName gracefully", () => {
  const profile = {
    biography: "A simple person blogging",
    username: "john_doe",
    displayName: "John Doe",
    businessCategoryName: null
  };

  const req = buildAccountClassificationRequest(profile);

  assert.ok(req);
  assert.match(req.contents, /john_doe/);
  assert.match(req.contents, /Business Category Name: "N\/A"/);
});

test("parseAccountClassificationResponse: parses a valid response with ORGANIZER_VENUE_EVENT type", () => {
  const rawText = JSON.stringify({
    accountType: "ORGANIZER_VENUE_EVENT",
    confidenceScore: 0.95
  });

  const parsed = parseAccountClassificationResponse(rawText);

  assert.ok(parsed);
  assert.equal(parsed.accountType, "ORGANIZER_VENUE_EVENT");
  assert.equal(parsed.confidenceScore, 0.95);
});

test("parseAccountClassificationResponse: parses a valid response with PERSONAL type", () => {
  const rawText = JSON.stringify({
    accountType: "PERSONAL",
    confidenceScore: 0.8
  });

  const parsed = parseAccountClassificationResponse(rawText);

  assert.ok(parsed);
  assert.equal(parsed.accountType, "PERSONAL");
  assert.equal(parsed.confidenceScore, 0.8);
});

test("parseAccountClassificationResponse: parses a valid response with CURATOR_GUIDE type", () => {
  const rawText = JSON.stringify({
    accountType: "CURATOR_GUIDE",
    confidenceScore: 0.4
  });

  const parsed = parseAccountClassificationResponse(rawText);

  assert.ok(parsed);
  assert.equal(parsed.accountType, "CURATOR_GUIDE");
  assert.equal(parsed.confidenceScore, 0.4);
});

test("parseAccountClassificationResponse: returns null on malformed JSON", () => {
  const parsed = parseAccountClassificationResponse("{ invalid json }");
  assert.equal(parsed, null);
});

test("parseAccountClassificationResponse: returns null on missing required properties", () => {
  const missingType = JSON.stringify({
    confidenceScore: 0.9
  });
  const missingScore = JSON.stringify({
    accountType: "PERSONAL"
  });

  assert.equal(parseAccountClassificationResponse(missingType), null);
  assert.equal(parseAccountClassificationResponse(missingScore), null);
});

test("parseAccountClassificationResponse: returns null on invalid accountType enum value", () => {
  const rawText = JSON.stringify({
    accountType: "INVALID_TYPE",
    confidenceScore: 0.9
  });

  const parsed = parseAccountClassificationResponse(rawText);
  assert.equal(parsed, null);
});

test("parseAccountClassificationResponse: clamps confidenceScore to [0, 1]", () => {
  const rawTextOver = JSON.stringify({
    accountType: "PERSONAL",
    confidenceScore: 1.5
  });
  const rawTextUnder = JSON.stringify({
    accountType: "PERSONAL",
    confidenceScore: -0.5
  });

  const parsedOver = parseAccountClassificationResponse(rawTextOver);
  const parsedUnder = parseAccountClassificationResponse(rawTextUnder);

  assert.ok(parsedOver);
  assert.equal(parsedOver.confidenceScore, 1.0);

  assert.ok(parsedUnder);
  assert.equal(parsedUnder.confidenceScore, 0.0);
});
