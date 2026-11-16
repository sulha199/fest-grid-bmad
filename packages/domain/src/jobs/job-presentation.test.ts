import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JOB_GRAPHQL_TYPES,
  getJobTypePresentation,
  listEngineTypesForGraphqlType,
  listRegisteredPresentationTypes,
  registerJobTypePresentation,
} from "./job-presentation.js";
import { REEXTRACT_POST_JOB_TYPE } from "./reextract-post.js";

// Story 10.4 (Part A) -- the type presentation registry.

test("the re-extract type is registered at import with its two phases, a POST subject and a preview outcome", () => {
  const p = getJobTypePresentation(REEXTRACT_POST_JOB_TYPE);
  assert.equal(p.graphqlType, "REEXTRACT_REFRESH");
  assert.deepEqual([...p.phases], ["refresh", "preview"]);
  assert.equal(p.subjectKind, "POST");
  assert.equal(p.outcomeKind, "PREVIEW");
  assert.deepEqual(p.skippedPhases?.({ refreshOutcome: "NOT_NEEDED" }), ["refresh"]);
  assert.deepEqual(p.skippedPhases?.({ refreshOutcome: "REFRESHED" }), []);
  assert.deepEqual(p.skippedPhases?.({ refreshOutcome: null }), []);
});

test("an unknown engine type reads as OTHER with no steps, no subject and no outcome", () => {
  const p = getJobTypePresentation("never-registered-type");
  assert.equal(p.engineType, "never-registered-type");
  assert.equal(p.graphqlType, "OTHER");
  assert.deepEqual([...p.phases], []);
  assert.equal(p.subjectKind, "NONE");
  assert.equal(p.outcomeKind, "NONE");
  assert.ok(JOB_GRAPHQL_TYPES.includes(p.graphqlType));
});

test("registering is idempotent: a second registration of a type is a no-op and keeps the first", () => {
  const first = { engineType: "presentation-test-a", graphqlType: "SUBSCRIBE", phases: ["one"], subjectKind: "ACCOUNT", outcomeKind: "ACCOUNT" } as const;
  assert.equal(registerJobTypePresentation(first), true);
  assert.equal(registerJobTypePresentation({ ...first, graphqlType: "CORRECTION" }), false);
  assert.equal(getJobTypePresentation("presentation-test-a").graphqlType, "SUBSCRIBE");
});

test("a presentation needs a non-empty engine type", () => {
  assert.throws(() => registerJobTypePresentation({ engineType: " ", graphqlType: "OTHER", phases: [], subjectKind: "NONE", outcomeKind: "NONE" }), /non-empty engineType/);
});

test("the reverse lookups list the registered engine types", () => {
  assert.ok(listEngineTypesForGraphqlType("REEXTRACT_REFRESH").includes(REEXTRACT_POST_JOB_TYPE));
  assert.deepEqual(listEngineTypesForGraphqlType("ADMIN_OPERATION"), []);
  assert.ok(listRegisteredPresentationTypes().includes(REEXTRACT_POST_JOB_TYPE));
});
