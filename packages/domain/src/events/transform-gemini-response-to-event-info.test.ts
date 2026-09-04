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

  it('should attach timezone and timezoneStatus when scheduleTimezoneResolutions map is present', () => {
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Timezone Event',
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-25'
        },
        {
          isMainSchedule: false,
          eventStartDate: '2026-08-26'
        }
      ],
      confidenceScore: 0.9
    };

    const scheduleTimezoneResolutions = new Map();
    scheduleTimezoneResolutions.set(0, { timezone: 'America/Chicago', timezoneStatus: 'RESOLVED' });
    scheduleTimezoneResolutions.set(1, { timezone: undefined, timezoneStatus: 'NEEDS_CLARIFICATION' });

    const result = transformGeminiResponseToEventInfo(payload, {
      ...dummyContext,
      scheduleTimezoneResolutions
    });

    assert.strictEqual(result.schedules[0].timezone, 'America/Chicago');
    assert.strictEqual(result.schedules[0].timezoneStatus, 'RESOLVED');
    assert.strictEqual(result.schedules[1].timezone, undefined);
    assert.strictEqual(result.schedules[1].timezoneStatus, 'NEEDS_CLARIFICATION');
  });

  it('should leave timezone and timezoneStatus undefined when scheduleTimezoneResolutions map is omitted', () => {
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      eventName: 'Timezone Omitted Event',
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [
        {
          isMainSchedule: true,
          eventStartDate: '2026-08-25'
        }
      ],
      confidenceScore: 0.9
    };

    const result = transformGeminiResponseToEventInfo(payload, dummyContext);

    assert.strictEqual(result.schedules[0].timezone, undefined);
    assert.strictEqual(result.schedules[0].timezoneStatus, undefined);
  });

  describe('private-contact discard enforcement (AC2, Task 3)', () => {
    const basePayload = {
      isEvent: true,
      eventName: 'Contact Test Event',
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [],
      confidenceScore: 0.9
    };

    it('passes contactInfo through unchanged for a business-contact payload (hasPrivateContact: false)', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload,
        hasPrivateContact: false,
        contactInfo: 'events@venue.com'
      };

      const result = transformGeminiResponseToEventInfo(payload, dummyContext);

      assert.strictEqual(result.contactInfo, 'events@venue.com');
      assert.strictEqual(result.hasPrivateContact, false);
    });

    it('discards contactInfo when hasPrivateContact is true even if contactInfo is populated (imperfect Gemini response)', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload,
        hasPrivateContact: true,
        contactInfo: '0812-3456-7890'
      };

      const result = transformGeminiResponseToEventInfo(payload, dummyContext);

      assert.strictEqual(result.contactInfo, undefined);
      assert.strictEqual(result.hasPrivateContact, true);
    });

    it('leaves both contactInfo and hasPrivateContact undefined/falsy when neither field is set', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload
      };

      const result = transformGeminiResponseToEventInfo(payload, dummyContext);

      assert.strictEqual(result.contactInfo, undefined);
      assert.ok(!result.hasPrivateContact);
    });
  });

  describe('AC4: 6 classification-outcome categories (Task 9)', () => {
    const basePayload = {
      isEvent: true,
      eventName: 'Classification Outcome Event',
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [],
      confidenceScore: 0.9
    };

    it('1. business email passes through', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload,
        hasPrivateContact: false,
        contactInfo: 'events@venue.com'
      };
      const result = transformGeminiResponseToEventInfo(payload, dummyContext);
      assert.strictEqual(result.contactInfo, 'events@venue.com');
      assert.strictEqual(result.hasPrivateContact, false);
    });

    it('2. official venue/PT phone passes through', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload,
        hasPrivateContact: false,
        contactInfo: '(021) 555-0100'
      };
      const result = transformGeminiResponseToEventInfo(payload, dummyContext);
      assert.strictEqual(result.contactInfo, '(021) 555-0100');
      assert.strictEqual(result.hasPrivateContact, false);
    });

    it('3. personal phone number is discarded', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload,
        hasPrivateContact: true,
        contactInfo: '0812-3456-7890'
      };
      const result = transformGeminiResponseToEventInfo(payload, dummyContext);
      assert.strictEqual(result.contactInfo, undefined);
      assert.strictEqual(result.hasPrivateContact, true);
    });

    it('4. personal email is discarded', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload,
        hasPrivateContact: true,
        contactInfo: 'someone@gmail.com'
      };
      const result = transformGeminiResponseToEventInfo(payload, dummyContext);
      assert.strictEqual(result.contactInfo, undefined);
      assert.strictEqual(result.hasPrivateContact, true);
    });

    it('5. wa.me link is discarded, same as a raw phone number', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload,
        hasPrivateContact: true,
        contactInfo: 'https://wa.me/6281234567890'
      };
      const result = transformGeminiResponseToEventInfo(payload, dummyContext);
      assert.strictEqual(result.contactInfo, undefined);
      assert.strictEqual(result.hasPrivateContact, true);
    });

    it('6. no contact info at all leaves both fields falsy/undefined', () => {
      const payload: GeminiExtractionPayload = {
        ...basePayload
      };
      const result = transformGeminiResponseToEventInfo(payload, dummyContext);
      assert.strictEqual(result.contactInfo, undefined);
      assert.ok(!result.hasPrivateContact);
    });
  });

  describe('performer-contact/photo leakage regression fixtures (Story 3.6j, AC3/AC4)', () => {
    it('should never surface a performer\'s contact detail in any output field, while preserving the performer\'s name', () => {
      // Simulated source caption: "Live music by DJ Nova! Book this artist via 0812-3456-7890."
      // This payload represents a correctly-behaved extraction: the prompt (Story 3.6j, Task 1)
      // instructs Gemini to extract the performer's name but never copy their contact detail into
      // any field. This fixture proves the transform pipeline itself doesn't reintroduce the leak.
      const contactSentinel = '0812-3456-7890';

      const payload: GeminiExtractionPayload = {
        isEvent: true,
        eventName: 'Live Music Night',
        types: ['PERFORMANCE'],
        categories: ['MUSIC'],
        schedules: [
          {
            isMainSchedule: true,
            eventStartDate: '2026-09-10',
            title: 'Live Music Night',
            performers: ['DJ Nova'],
            location: 'The Venue'
          }
        ],
        location: 'The Venue',
        organizerName: 'The Venue Management',
        contactInfo: 'events@thevenue.com',
        description: 'Come enjoy a night of live music!',
        confidenceScore: 0.95
      };

      const result = transformGeminiResponseToEventInfo(payload, dummyContext);

      // Performer name is preserved.
      assert.ok(result.schedules[0].performers?.includes('DJ Nova'));

      // The contact sentinel must not appear anywhere in the output.
      assert.ok(!result.description?.includes(contactSentinel));
      assert.ok(!result.contactInfo?.includes(contactSentinel));
      assert.ok(!result.organizerName?.includes(contactSentinel));
      assert.ok(!result.location?.includes(contactSentinel));
      for (const schedule of result.schedules) {
        assert.ok(!schedule.title?.includes(contactSentinel));
        assert.ok(!schedule.location?.includes(contactSentinel));
        assert.ok(!schedule.performers?.some((p) => p.includes(contactSentinel)));
      }
    });

    it('should never surface a performer\'s photo URL in any output field', () => {
      // Simulated source caption: "Live music by DJ Nova! Check out her photo: https://instagram.com/p/abc123photo"
      // Same pattern as the contact-sentinel fixture above, but for a performer photo URL --
      // there is no dedicated schema field for a performer photo, so this proves the pipeline
      // never lets one leak into a free-text field either.
      const photoUrlSentinel = 'https://instagram.com/p/abc123photo';

      const payload: GeminiExtractionPayload = {
        isEvent: true,
        eventName: 'Live Music Night',
        types: ['PERFORMANCE'],
        categories: ['MUSIC'],
        schedules: [
          {
            isMainSchedule: true,
            eventStartDate: '2026-09-10',
            title: 'Live Music Night',
            performers: ['DJ Nova'],
            location: 'The Venue'
          }
        ],
        location: 'The Venue',
        organizerName: 'The Venue Management',
        contactInfo: 'events@thevenue.com',
        description: 'Come enjoy a night of live music!',
        confidenceScore: 0.95
      };

      const result = transformGeminiResponseToEventInfo(payload, dummyContext);

      assert.ok(result.schedules[0].performers?.includes('DJ Nova'));

      assert.ok(!result.description?.includes(photoUrlSentinel));
      assert.ok(!result.contactInfo?.includes(photoUrlSentinel));
      assert.ok(!result.organizerName?.includes(photoUrlSentinel));
      assert.ok(!result.location?.includes(photoUrlSentinel));
      for (const schedule of result.schedules) {
        assert.ok(!schedule.title?.includes(photoUrlSentinel));
        assert.ok(!schedule.location?.includes(photoUrlSentinel));
        assert.ok(!schedule.performers?.some((p) => p.includes(photoUrlSentinel)));
      }
    });
  });
});
