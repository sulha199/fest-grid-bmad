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
