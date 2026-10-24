import test from 'node:test';
import assert from 'node:assert/strict';
import { EventCategory, EventType } from '@festgrid/shared-types';
import { transformGeminiResponseToEventInfo } from './transform-gemini-response-to-event-info.js';
import type { GeminiEventPayload } from './types.js';

const context = { postId: 'post-1', sourceSocialMediaAccountId: 'account-1', resolvedScheduleLocations: new Map() };

function payload(overrides: Partial<GeminiEventPayload>): GeminiEventPayload {
  return { eventName: 'Gig', types: [], categories: [], schedules: [], confidenceScore: 0.9, ...overrides };
}

test('transformGeminiResponseToEventInfo keeps recognised types and categories', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({ types: [EventType.FESTIVAL, 'NOT_A_TYPE'], categories: [EventCategory.MUSIC, 'NOT_A_CATEGORY'] }),
    context
  );

  assert.deepEqual(result.types, [EventType.FESTIVAL]);
  assert.deepEqual(result.categories, [EventCategory.MUSIC]);
});

test('transformGeminiResponseToEventInfo falls back to OTHER when nothing recognisable is left', () => {
  const result = transformGeminiResponseToEventInfo(payload({ types: ['NOT_A_TYPE'], categories: [] }), context);

  assert.deepEqual(result.types, [EventType.OTHER]);
  assert.deepEqual(result.categories, [EventCategory.OTHER]);
});

// Story 0.52 (AD-44 Rule 2), amended by Story 0.54 (AD-44 Rule 2, [AMENDED 2026-10-24]):
// cardinality safety-cap-6 (real categories only) + non-exclusive OTHER (kept, moved last, never
// dropped) enforcement, applied AFTER the existing empty-fallback check above. This supersedes
// Story 0.52's cap-4/OTHER-exclusive test suite.

test('transformGeminiResponseToEventInfo truncates 7 real categories to the first 6, preserving order', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [
        EventCategory.MUSIC,
        EventCategory.ARTS_AND_CULTURE,
        EventCategory.FOOD_AND_DRINK,
        EventCategory.SPORTS_AND_FITNESS,
        EventCategory.FAMILY_AND_KIDS,
        EventCategory.HOBBIES_AND_INTERESTS,
        EventCategory.BUSINESS_AND_NETWORKING
      ]
    }),
    context
  );

  assert.deepEqual(result.categories, [
    EventCategory.MUSIC,
    EventCategory.ARTS_AND_CULTURE,
    EventCategory.FOOD_AND_DRINK,
    EventCategory.SPORTS_AND_FITNESS,
    EventCategory.FAMILY_AND_KIDS,
    EventCategory.HOBBIES_AND_INTERESTS
  ]);
});

test('transformGeminiResponseToEventInfo: 5 distinct real categories, being <= 6, are all kept unchanged', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [
        EventCategory.MUSIC,
        EventCategory.ARTS_AND_CULTURE,
        EventCategory.FOOD_AND_DRINK,
        EventCategory.SPORTS_AND_FITNESS,
        EventCategory.FAMILY_AND_KIDS
      ]
    }),
    context
  );

  assert.deepEqual(result.categories, [
    EventCategory.MUSIC,
    EventCategory.ARTS_AND_CULTURE,
    EventCategory.FOOD_AND_DRINK,
    EventCategory.SPORTS_AND_FITNESS,
    EventCategory.FAMILY_AND_KIDS
  ]);
});

// Review Findings patch 1/2 (Story 0.52), reconfirmed unaffected by Story 0.54's cap-4->6 and
// OTHER-exclusive->non-exclusive changes: dedupe (preserving first occurrence and model order)
// runs BEFORE the real/OTHER split and the cap-6 truncation, so a duplicate-only raw list can
// never collapse to [] and a repeated category can never displace a distinct one past the cap.

test('transformGeminiResponseToEventInfo: a duplicate-OTHER-only raw list collapses to a single OTHER, never to []', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({ categories: [EventCategory.OTHER, EventCategory.OTHER] }),
    context
  );

  assert.deepEqual(result.categories, [EventCategory.OTHER]);
});

test('transformGeminiResponseToEventInfo: duplicates are deduped before the cap, so a distinct category is never displaced by a repeat', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [
        EventCategory.MUSIC,
        EventCategory.MUSIC,
        EventCategory.ARTS_AND_CULTURE,
        EventCategory.FOOD_AND_DRINK,
        EventCategory.SPORTS_AND_FITNESS,
        EventCategory.FAMILY_AND_KIDS,
        EventCategory.HOBBIES_AND_INTERESTS
      ]
    }),
    context
  );

  assert.deepEqual(result.categories, [
    EventCategory.MUSIC,
    EventCategory.ARTS_AND_CULTURE,
    EventCategory.FOOD_AND_DRINK,
    EventCategory.SPORTS_AND_FITNESS,
    EventCategory.FAMILY_AND_KIDS,
    EventCategory.HOBBIES_AND_INTERESTS
  ]);
});

test('transformGeminiResponseToEventInfo: 7+ distinct real categories are deduped (no-op here) then capped at 6, preserving order', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [
        EventCategory.MUSIC,
        EventCategory.ARTS_AND_CULTURE,
        EventCategory.FOOD_AND_DRINK,
        EventCategory.SPORTS_AND_FITNESS,
        EventCategory.FAMILY_AND_KIDS,
        EventCategory.HOBBIES_AND_INTERESTS,
        EventCategory.BUSINESS_AND_NETWORKING
      ]
    }),
    context
  );

  assert.deepEqual(result.categories, [
    EventCategory.MUSIC,
    EventCategory.ARTS_AND_CULTURE,
    EventCategory.FOOD_AND_DRINK,
    EventCategory.SPORTS_AND_FITNESS,
    EventCategory.FAMILY_AND_KIDS,
    EventCategory.HOBBIES_AND_INTERESTS
  ]);
});

// Story 0.54 (AD-44 Rule 2, [AMENDED 2026-10-24]): these cases REPLACE Story 0.52's "drops OTHER"
// tests -- their asserted behavior (dropping OTHER) directly contradicts the new non-exclusive
// rule. OTHER is now deduped first (like any other category), then kept and moved to the end,
// never counted against the cap of 6.

test('transformGeminiResponseToEventInfo: OTHER alongside duplicated others is deduped first, then kept and moved to the end', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [EventCategory.OTHER, EventCategory.MUSIC, EventCategory.MUSIC, EventCategory.OTHER]
    }),
    context
  );

  assert.deepEqual(result.categories, [EventCategory.MUSIC, EventCategory.OTHER]);
});

test('transformGeminiResponseToEventInfo: order preservation keeps first-occurrence order across dedupe/split/cap', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [
        EventCategory.SPORTS_AND_FITNESS,
        EventCategory.MUSIC,
        EventCategory.SPORTS_AND_FITNESS,
        EventCategory.ARTS_AND_CULTURE
      ]
    }),
    context
  );

  assert.deepEqual(result.categories, [
    EventCategory.SPORTS_AND_FITNESS,
    EventCategory.MUSIC,
    EventCategory.ARTS_AND_CULTURE
  ]);
});

test('transformGeminiResponseToEventInfo: an empty raw category list still falls back to OTHER after dedupe/split/cap', () => {
  const result = transformGeminiResponseToEventInfo(payload({ categories: [] }), context);

  assert.deepEqual(result.categories, [EventCategory.OTHER]);
});

test('transformGeminiResponseToEventInfo keeps OTHER and moves it to the end when 1+ real categories remain', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({ categories: [EventCategory.OTHER, EventCategory.MUSIC] }),
    context
  );

  assert.deepEqual(result.categories, [EventCategory.MUSIC, EventCategory.OTHER]);
});

test('transformGeminiResponseToEventInfo keeps a solo OTHER (never dropped when it is the only entry)', () => {
  const result = transformGeminiResponseToEventInfo(payload({ categories: [EventCategory.OTHER] }), context);

  assert.deepEqual(result.categories, [EventCategory.OTHER]);
});

test('transformGeminiResponseToEventInfo: 7 real categories plus OTHER truncate real to 6 and append OTHER last (7 total) -- OTHER never counts against the cap', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [
        EventCategory.OTHER,
        EventCategory.MUSIC,
        EventCategory.ARTS_AND_CULTURE,
        EventCategory.FOOD_AND_DRINK,
        EventCategory.SPORTS_AND_FITNESS,
        EventCategory.FAMILY_AND_KIDS,
        EventCategory.HOBBIES_AND_INTERESTS,
        EventCategory.BUSINESS_AND_NETWORKING
      ]
    }),
    context
  );

  assert.deepEqual(result.categories, [
    EventCategory.MUSIC,
    EventCategory.ARTS_AND_CULTURE,
    EventCategory.FOOD_AND_DRINK,
    EventCategory.SPORTS_AND_FITNESS,
    EventCategory.FAMILY_AND_KIDS,
    EventCategory.HOBBIES_AND_INTERESTS,
    EventCategory.OTHER
  ]);
});
