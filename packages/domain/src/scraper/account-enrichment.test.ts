import test from "node:test";
import assert from "node:assert/strict";
import {
  computeProfileBackfillPatch,
  normalizeHandle,
  isNumericAccountId,
  isPostOwnedByProfile,
  selectOwnPostForBackfill,
  resolveScrapeHandle,
  buildLocationInferenceRequest,
  parseLocationInferenceResponse,
  locationInferenceResponseSchema,
  resolveDiscoveredIdentityNames
} from "./account-enrichment.js";

test("computeProfileBackfillPatch: updates displayName and corrects a case-only username difference", () => {
  const current = { accountId: "old_user", displayName: "Old Name", username: "Old_User" };
  const scraped = { ownerDisplayName: "New Name", ownerUsername: "old_user" };
  const patch = computeProfileBackfillPatch(current, scraped);

  assert.deepEqual(patch, { displayName: "New Name", username: "old_user" });
});

test("computeProfileBackfillPatch: returns patch when only displayName differs", () => {
  const current = { accountId: "old_user", displayName: "Old Name", username: "old_user" };
  const scraped = { ownerDisplayName: "New Name", ownerUsername: "old_user" };
  const patch = computeProfileBackfillPatch(current, scraped);

  assert.deepEqual(patch, { displayName: "New Name" });
});

test("computeProfileBackfillPatch: never overwrites a set username with a different handle (BUG-081)", () => {
  const current = { accountId: "laridijogja", displayName: "Old Name", username: "laridijogja" };
  const scraped = { ownerDisplayName: "Old Name", ownerUsername: "kulonprogohalfmarathon" };

  assert.equal(computeProfileBackfillPatch(current, scraped), null);
});

test("computeProfileBackfillPatch: fills an empty username", () => {
  const current = { accountId: "laridijogja", displayName: "Old Name", username: "  " };
  const scraped = { ownerDisplayName: "Old Name", ownerUsername: " laridijogja " };

  assert.deepEqual(computeProfileBackfillPatch(current, scraped), { username: "laridijogja" });
});

test("computeProfileBackfillPatch: fills the numeric-ID placeholder username of a numeric-keyed row", () => {
  const current = { accountId: "68892898447", displayName: "68892898447", username: "68892898447" };
  const scraped = { ownerDisplayName: "Lari di Jogja", ownerUsername: "laridijogja" };

  assert.deepEqual(computeProfileBackfillPatch(current, scraped), {
    displayName: "Lari di Jogja",
    username: "laridijogja",
  });
});

test("computeProfileBackfillPatch: a handle-keyed row whose username equals its account_id is not a placeholder", () => {
  const current = { accountId: "laridijogja", displayName: "x", username: "laridijogja" };
  const scraped = { ownerDisplayName: "x", ownerUsername: "someoneelse" };

  assert.equal(computeProfileBackfillPatch(current, scraped), null);
});

test("computeProfileBackfillPatch: returns null when fields are identical", () => {
  const current = { accountId: "old_user", displayName: "Old Name", username: "old_user" };
  const scraped = { ownerDisplayName: "Old Name", ownerUsername: "old_user" };
  const patch = computeProfileBackfillPatch(current, scraped);

  assert.equal(patch, null);
});

test("computeProfileBackfillPatch: returns null when scraped fields are missing or whitespace-only", () => {
  const current = { accountId: "old_user", displayName: "Old Name", username: "old_user" };
  const blank = { ownerDisplayName: "   ", ownerUsername: "" };
  const absent = {};

  assert.equal(computeProfileBackfillPatch(current, blank), null);
  assert.equal(computeProfileBackfillPatch(current, absent), null);
  assert.equal(computeProfileBackfillPatch(current, { ownerUsername: "   " }), null);
});

test("normalizeHandle: trims, strips leading @ and lower-cases; blank and absent give ''", () => {
  assert.equal(normalizeHandle("  @@LariDiJogja "), "laridijogja");
  assert.equal(normalizeHandle("jogjacoffeeweek.id"), "jogjacoffeeweek.id");
  assert.equal(normalizeHandle(""), "");
  assert.equal(normalizeHandle("   "), "");
  assert.equal(normalizeHandle(undefined), "");
  assert.equal(normalizeHandle(null), "");
});

test("isNumericAccountId: true only for an all-digit id", () => {
  assert.equal(isNumericAccountId("4842911995"), true);
  assert.equal(isNumericAccountId(" 4842911995 "), true);
  assert.equal(isNumericAccountId("laridijogja"), false);
  assert.equal(isNumericAccountId("jogja2026"), false);
  assert.equal(isNumericAccountId(""), false);
});

test("isPostOwnedByProfile: handle-keyed row matches the owner username case-insensitively", () => {
  const profile = { accountId: "LariDiJogja", username: "kulonprogohalfmarathon" };

  assert.equal(isPostOwnedByProfile(profile, { ownerUsername: "laridijogja" }), true);
  assert.equal(isPostOwnedByProfile(profile, { ownerUsername: "@LARIDIJOGJA " }), true);
});

test("isPostOwnedByProfile: handle-keyed row rejects a collab/repost owner, a blank owner and an ownerId-only post", () => {
  const profile = { accountId: "laridijogja", username: "laridijogja" };

  assert.equal(isPostOwnedByProfile(profile, { ownerUsername: "kulonprogohalfmarathon" }), false);
  assert.equal(isPostOwnedByProfile(profile, { ownerUsername: "  " }), false);
  assert.equal(isPostOwnedByProfile(profile, {}), false);
  assert.equal(isPostOwnedByProfile(profile, { ownerId: "123" }), false);
});

test("isPostOwnedByProfile: a handle-keyed row's own (relabelled) username never proves ownership", () => {
  const relabelled = { accountId: "laridijogja", username: "kulonprogohalfmarathon" };

  assert.equal(isPostOwnedByProfile(relabelled, { ownerUsername: "kulonprogohalfmarathon" }), false);
});

test("isPostOwnedByProfile: numeric-keyed row requires ownerId to equal account_id", () => {
  const profile = { accountId: "68892898447", username: "laridijogja" };

  assert.equal(isPostOwnedByProfile(profile, { ownerId: "68892898447", ownerUsername: "laridijogja" }), true);
  assert.equal(isPostOwnedByProfile(profile, { ownerId: " 68892898447 " }), true);
  assert.equal(isPostOwnedByProfile(profile, { ownerId: "999", ownerUsername: "laridijogja" }), false);
  assert.equal(isPostOwnedByProfile(profile, { ownerUsername: "laridijogja" }), false);
});

test("isPostOwnedByProfile: numeric-keyed row with a matching ownerId but a disagreeing owner handle is a conflict", () => {
  const relabelled = { accountId: "4842911995", username: "masjidmuhajirinnitikan" };

  assert.equal(isPostOwnedByProfile(relabelled, { ownerId: "4842911995", ownerUsername: "jogjakajian" }), false);
});

test("isPostOwnedByProfile: numeric-keyed row with a blank or placeholder username accepts the owner's handle", () => {
  const placeholder = { accountId: "4842911995", username: "4842911995" };
  const blank = { accountId: "4842911995", username: " " };

  assert.equal(isPostOwnedByProfile(placeholder, { ownerId: "4842911995", ownerUsername: "jogjakajian" }), true);
  assert.equal(isPostOwnedByProfile(blank, { ownerId: "4842911995", ownerUsername: "jogjakajian" }), true);
});

test("selectOwnPostForBackfill: picks the first matching post, not the first post with an owner (collab/repost first)", () => {
  const profile = { accountId: "laridijogja", username: "laridijogja" };
  const posts = [
    { ownerUsername: "kulonprogohalfmarathon", ownerDisplayName: "Kulonprogo Half Marathon" },
    { postUrl: "no owner at all" },
    { ownerUsername: "laridijogja", ownerDisplayName: "Lari di Jogja" },
    { ownerUsername: "laridijogja", ownerDisplayName: "Later Name" },
  ];

  assert.equal(selectOwnPostForBackfill(profile, posts), posts[2]);
});

test("selectOwnPostForBackfill: a matching post with only a display name or only a username still counts", () => {
  const numeric = { accountId: "4842911995", username: "4842911995" };

  assert.deepEqual(selectOwnPostForBackfill(numeric, [{ ownerId: "4842911995", ownerDisplayName: "Info Kajian" }]), {
    ownerId: "4842911995",
    ownerDisplayName: "Info Kajian",
  });
  assert.deepEqual(selectOwnPostForBackfill(numeric, [{ ownerId: "4842911995", ownerUsername: "jogjakajian" }]), {
    ownerId: "4842911995",
    ownerUsername: "jogjakajian",
  });
});

test("selectOwnPostForBackfill: null when no post is the profile's own, when owner data is missing, and for an empty batch", () => {
  const profile = { accountId: "laridijogja", username: "laridijogja" };

  assert.equal(selectOwnPostForBackfill(profile, [{ ownerUsername: "someoneelse", ownerDisplayName: "X" }]), null);
  assert.equal(selectOwnPostForBackfill(profile, [{ ownerId: "123" }]), null);
  assert.equal(selectOwnPostForBackfill(profile, []), null);
});

test("resolveScrapeHandle: a handle-keyed row is scraped by account_id, whatever its username says (BUG-081)", () => {
  assert.equal(resolveScrapeHandle({ accountId: "laridijogja", username: "kulonprogohalfmarathon" }), "laridijogja");
  assert.equal(resolveScrapeHandle({ accountId: " @laridijogja ", username: "kulonprogohalfmarathon" }), "laridijogja");
  assert.equal(resolveScrapeHandle({ accountId: "jogjacoffeeweek.id", username: "mors.roastery" }), "jogjacoffeeweek.id");
});

test("resolveScrapeHandle: a numeric-keyed or blank-keyed row has only its username to scrape by", () => {
  assert.equal(resolveScrapeHandle({ accountId: "4842911995", username: "jogjakajian" }), "jogjakajian");
  assert.equal(resolveScrapeHandle({ accountId: "  ", username: "jogjakajian" }), "jogjakajian");
});

test("buildLocationInferenceRequest: returns request when both locationName and content are present", () => {
  const post = { locationName: "Central Park", content: "Great concert today!" };
  const req = buildLocationInferenceRequest(post);

  assert.ok(req);
  assert.equal(req.responseMimeType, "application/json");
  assert.equal(req.responseSchema, locationInferenceResponseSchema);
  assert.match(req.contents, /Account Name Metadata: ""/);
  assert.match(req.contents, /Central Park/);
  assert.match(req.contents, /Great concert today!/);
  assert.match(req.systemInstruction, /6\. Use the provided account name metadata/);
  assert.match(req.systemInstruction, /7\. Return the result/);
});

test("buildLocationInferenceRequest: returns request with ownerDisplayName as account name metadata", () => {
  const post = { locationName: "Central Park", content: "Great concert today!", ownerDisplayName: "Park Admin", ownerUsername: "park_admin" };
  const req = buildLocationInferenceRequest(post);

  assert.ok(req);
  assert.match(req.contents, /Account Name Metadata: "Park Admin"/);
  assert.match(req.contents, /Central Park/);
});

test("buildLocationInferenceRequest: returns request with ownerUsername as fallback account name metadata", () => {
  const post = { locationName: "Central Park", content: "Great concert today!", ownerUsername: "park_admin" };
  const req = buildLocationInferenceRequest(post);

  assert.ok(req);
  assert.match(req.contents, /Account Name Metadata: "park_admin"/);
  assert.match(req.contents, /Central Park/);
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

test("resolveDiscoveredIdentityNames: full name and username present -> both returned as-is (trimmed)", () => {
  const result = resolveDiscoveredIdentityNames({ accountId: "123", username: "  jdoe  ", displayName: "  John Doe  " });

  assert.deepEqual(result, { displayName: "John Doe", username: "jdoe" });
});

test("resolveDiscoveredIdentityNames: only username present -> displayName falls back to username, username returned as-is", () => {
  const result = resolveDiscoveredIdentityNames({ accountId: "123", username: "jdoe" });

  assert.deepEqual(result, { displayName: "jdoe", username: "jdoe" });
});

test("resolveDiscoveredIdentityNames: neither username nor displayName present -> both fall back to accountId", () => {
  const result = resolveDiscoveredIdentityNames({ accountId: "123" });

  assert.deepEqual(result, { displayName: "123", username: "123" });
});

test("resolveDiscoveredIdentityNames: whitespace-only username/displayName treated as absent", () => {
  const result = resolveDiscoveredIdentityNames({ accountId: "123", username: "   ", displayName: "   " });

  assert.deepEqual(result, { displayName: "123", username: "123" });
});

test("resolveDiscoveredIdentityNames: whitespace-only displayName falls through to trimmed username", () => {
  const result = resolveDiscoveredIdentityNames({ accountId: "123", username: "  jdoe  ", displayName: "   " });

  assert.deepEqual(result, { displayName: "jdoe", username: "jdoe" });
});
