import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventType, EventCategory, LocationDetails } from '@festgrid/shared-types';
import { transformGeminiResponseToEventInfo } from './transform-gemini-response-to-event-info.js';
import { GeminiExtractionPayload } from './types.js';

describe('transformGeminiResponseToEventInfo', () => {
  const dummyContext = {
    postId: 'post-123',
    sourceSocialMediaAccountId: 'account-abc',
    resolvedScheduleLocations: new Map<number, LocationDetails>()
  };

  it('should map values correctly on happy path', () => {
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Rock Concert',
      types: ['PERFORMANCE'],
      categories: ['MUSIC'],
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-20',
          title: 'Main Show'
        }
      ],
      location: 'Stadium',
      confidenceScore: 0.99
    };

    const result = transformGeminiResponseToEventInfo(payload, dummyContext);

    assert.strictEqual(result.postId, 'post-123');
    assert.strictEqual(result.sourceSocialMediaAccountId, 'account-abc');
    assert.strictEqual(result.eventName, 'Rock Concert');
    assert.deepStrictEqual(result.types, [EventType.PERFORMANCE]);
    assert.deepStrictEqual(result.categories, [EventCategory.MUSIC]);
    assert.strictEqual(result.location, 'Stadium');
    assert.strictEqual(result.schedules[0].isMainSchedule, true);
    assert.strictEqual(result.schedules[0].title, 'Main Show');
  });

  it('should filter invalid enum values and fallback to OTHER if empty', () => {
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Weird Festival',
      types: ['INVALID_TYPE', 'FESTIVAL'], // one invalid, one valid
      categories: ['HALLUCINATED_CATEGORY'], // all invalid
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-21'
        }
      ],
      confidenceScore: 0.8
    };

    const result = transformGeminiResponseToEventInfo(payload, dummyContext);

    // INVALID_TYPE should be filtered out, leaving only FESTIVAL
    assert.deepStrictEqual(result.types, [EventType.FESTIVAL]);
    // Since categories was completely invalid/empty, it should fallback to OTHER
    assert.deepStrictEqual(result.categories, [EventCategory.OTHER]);
  });

  it('should resolve location: explicit wins over defaultLocation', () => {
    const defaultLocation: LocationDetails = {
      coordinates: { latitude: 10, longitude: 20 },
      formattedAddress: 'Default Address',
      placeName: 'Default Place'
    };

    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Event With Explicit Location',
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [],
      location: 'Explicit Location',
      confidenceScore: 0.9
    };

    const result = transformGeminiResponseToEventInfo(payload, {
      ...dummyContext,
      defaultLocation
    });

    assert.strictEqual(result.location, 'Explicit Location');
  });

  it('should resolve location: fallback to defaultLocation address or place name if no explicit location', () => {
    const defaultLocation: LocationDetails = {
      coordinates: { latitude: 10, longitude: 20 },
      formattedAddress: 'Default Address',
      placeName: 'Default Place'
    };

    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Event Without Explicit Location',
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [],
      confidenceScore: 0.9
    };

    const result = transformGeminiResponseToEventInfo(payload, {
      ...dummyContext,
      defaultLocation
    });

    assert.strictEqual(result.location, 'Default Address');

    // If formattedAddress is missing, fall back to placeName
    const defaultLocationNoAddress: LocationDetails = {
      coordinates: { latitude: 10, longitude: 20 },
      placeName: 'Default Place Only'
    };

    const resultNoAddress = transformGeminiResponseToEventInfo(payload, {
      ...dummyContext,
      defaultLocation: defaultLocationNoAddress
    });

    assert.strictEqual(resultNoAddress.location, 'Default Place Only');
  });

  it('should resolve location: undefined when neither exists', () => {
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'No Location Event',
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [],
      confidenceScore: 0.9
    };

    const result = transformGeminiResponseToEventInfo(payload, dummyContext);

    assert.strictEqual(result.location, undefined);
  });

  it('should attach schedule locationDetails from resolvedScheduleLocations map', () => {
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Multi-Schedule Event',
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-25',
          location: 'Main Gym'
        },
        {
          isMainSchedule: false,
          eventStartDate: '2026-08-26',
          location: 'Annex'
        }
      ],
      confidenceScore: 0.9
    };

    const resolvedScheduleLocations = new Map<number, LocationDetails>();
    const annexLocationDetails: LocationDetails = {
      coordinates: { latitude: 1.23, longitude: 4.56 },
      formattedAddress: 'Resolved Annex Address'
    };
    resolvedScheduleLocations.set(1, annexLocationDetails);

    const result = transformGeminiResponseToEventInfo(payload, {
      ...dummyContext,
      resolvedScheduleLocations
    });

    assert.strictEqual(result.schedules[0].locationDetails, undefined);
    assert.deepStrictEqual(result.schedules[1].locationDetails, annexLocationDetails);
  });
});
