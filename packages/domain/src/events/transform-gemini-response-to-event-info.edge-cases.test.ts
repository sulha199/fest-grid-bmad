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
