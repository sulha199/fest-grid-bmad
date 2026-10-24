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

// Story 0.52 (AD-44 Rule 2): cardinality cap-4 + OTHER-exclusivity enforcement, applied AFTER the
// existing empty-fallback check above.

test('transformGeminiResponseToEventInfo truncates 5 valid categories to the first 4, preserving order', () => {
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
    EventCategory.SPORTS_AND_FITNESS
  ]);
});

// Review Findings patch 1/2 (Story 0.52): dedupe (preserving first occurrence and model order)
// runs BEFORE the OTHER-exclusivity drop and the cap-4 truncation, so a duplicate-only raw list
// can never collapse to [] and a repeated category can never displace a distinct one past the
// cap.

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
        EventCategory.SPORTS_AND_FITNESS
      ]
    }),
    context
  );

  assert.deepEqual(result.categories, [
    EventCategory.MUSIC,
    EventCategory.ARTS_AND_CULTURE,
    EventCategory.FOOD_AND_DRINK,
    EventCategory.SPORTS_AND_FITNESS
  ]);
});

test('transformGeminiResponseToEventInfo: 5+ distinct categories are deduped (no-op here) then capped at 4, preserving order', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [
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
    EventCategory.SPORTS_AND_FITNESS
  ]);
});

test('transformGeminiResponseToEventInfo: OTHER alongside duplicated others is deduped first, then OTHER is dropped', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [EventCategory.OTHER, EventCategory.MUSIC, EventCategory.MUSIC, EventCategory.OTHER]
    }),
    context
  );

  assert.deepEqual(result.categories, [EventCategory.MUSIC]);
});

test('transformGeminiResponseToEventInfo: order preservation keeps first-occurrence order across dedupe/drop/cap', () => {
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

test('transformGeminiResponseToEventInfo: an empty raw category list still falls back to OTHER after dedupe/drop/cap', () => {
  const result = transformGeminiResponseToEventInfo(payload({ categories: [] }), context);

  assert.deepEqual(result.categories, [EventCategory.OTHER]);
});

test('transformGeminiResponseToEventInfo drops OTHER when 2+ categories remain, keeping the others', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({ categories: [EventCategory.OTHER, EventCategory.MUSIC] }),
    context
  );

  assert.deepEqual(result.categories, [EventCategory.MUSIC]);
});

test('transformGeminiResponseToEventInfo keeps a solo OTHER (never dropped when it is the only entry)', () => {
  const result = transformGeminiResponseToEventInfo(payload({ categories: [EventCategory.OTHER] }), context);

  assert.deepEqual(result.categories, [EventCategory.OTHER]);
});

test('transformGeminiResponseToEventInfo: a 5-category list including OTHER drops OTHER before truncating, never wasting a kept slot on it', () => {
  const result = transformGeminiResponseToEventInfo(
    payload({
      categories: [
        EventCategory.OTHER,
        EventCategory.MUSIC,
        EventCategory.ARTS_AND_CULTURE,
        EventCategory.FOOD_AND_DRINK,
        EventCategory.SPORTS_AND_FITNESS
      ]
    }),
    context
  );

  assert.deepEqual(result.categories, [
    EventCategory.MUSIC,
    EventCategory.ARTS_AND_CULTURE,
    EventCategory.FOOD_AND_DRINK,
    EventCategory.SPORTS_AND_FITNESS
  ]);
});
