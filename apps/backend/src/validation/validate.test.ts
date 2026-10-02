import { describe, it } from 'node:test';
import assert from 'node:assert';
import { compileValidator } from './validate';
import { extractedEventSchema } from './extracted-event.schema';
import { scrapedPostSchema } from './scraped-post.schema';
import { GeminiExtractionPayload, ScrapedPost } from '@festgrid/domain';

describe('Runtime Schema Validation (AJV)', () => {
  it('should pass validation for a valid payload', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);

    // Story 3.6s — payload is now the post-level { isEvent, events[] } wrapper.
    const validPayload: GeminiExtractionPayload = {
      isEvent: true,
      events: [
        {
          eventName: 'Summer Music Festival',
          types: ['FESTIVAL', 'PERFORMANCE'],
          categories: ['MUSIC', 'FOOD_AND_DRINK'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15',
              title: 'Main Day'
            }
          ],
          confidenceScore: 0.95
        }
      ]
    };

    const isValid = validate(validPayload);
    assert.strictEqual(isValid, true);
    assert.strictEqual(validate.errors, null);
  });

  it('should fail validation for an invalid payload (missing eventName, wrong type)', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);

    const invalidPayload = {
      isEvent: true,
      events: [
        {
          // missing eventName
          types: 'Not an array', // wrong type
          categories: [],
          schedules: [],
          confidenceScore: 1.5 // invalid value (max 1)
        }
      ]
    };

    const isValid = validate(invalidPayload as any);
    assert.strictEqual(isValid, false);
    assert.notStrictEqual(validate.errors, null);

    // Check specific errors exist. Story 3.6s: eventName is now missing on a nested
    // /events/0 item, so its error carries a non-empty instancePath ('/events/0') AND
    // params.missingProperty ('eventName') -- check both explicitly rather than the old
    // flat-schema `instancePath || missingProperty` shortcut, which only worked when a missing
    // required property's instancePath was the schema root (empty string, falsy).
    const missingEventName = validate.errors?.some(
      (e) => e.keyword === 'required' && e.params.missingProperty === 'eventName' && e.instancePath === '/events/0'
    );
    assert.ok(missingEventName, 'expected a missing-required-property error for /events/0.eventName');

    const errorPaths = validate.errors?.map(e => e.instancePath);
    assert.ok(errorPaths?.includes('/events/0/types')); // wrong type
    assert.ok(errorPaths?.includes('/events/0/confidenceScore')); // invalid range
  });

  it('should fail validation for a type value outside the EventType enum', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);

    const invalidPayload = {
      isEvent: true,
      events: [
        {
          eventName: 'Invalid Type Fest',
          types: ['INVALID_TYPE'], // not in EventType enum
          categories: ['MUSIC'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-08-15'
            }
          ],
          confidenceScore: 0.8
        }
      ]
    };

    const isValid = validate(invalidPayload as any);
    assert.strictEqual(isValid, false);
    assert.notStrictEqual(validate.errors, null);
    const errorPaths = validate.errors?.map(e => e.instancePath);
    assert.ok(errorPaths?.includes('/events/0/types/0')); // invalid enum value
  });

  // Story 3.6s, Task 3.4 — AJV schema restructure unit tests.
  it('passes a valid multi-event payload (AC1/AC6)', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      groupingReason: 'separate-events',
      minEventCount: 2,
      skippedItems: [],
      events: [
        {
          eventName: 'Billiard Tournament',
          types: ['COMPETITION'],
          categories: ['SPORTS_AND_FITNESS'],
          schedules: [{ isMainSchedule: true, eventStartDate: '2026-09-26' }],
          confidenceScore: 0.95,
          organizerHandle: '@vifation'
        },
        {
          eventName: 'Futsal Tournament',
          types: ['COMPETITION'],
          categories: ['SPORTS_AND_FITNESS'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-10-24',
              applicableDaysOfWeek: ['FRI', 'SAT']
            }
          ],
          confidenceScore: 0.93
        }
      ]
    };

    const isValid = validate(payload);
    assert.strictEqual(isValid, true, JSON.stringify(validate.errors));
    assert.strictEqual(validate.errors, null);
  });

  it('fails a payload with an undeclared per-event property (additionalProperties: false, nested level)', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    const payload = {
      isEvent: true,
      events: [
        {
          eventName: 'Mystery Field Event',
          types: ['OTHER'],
          categories: ['OTHER'],
          schedules: [{ isMainSchedule: true, eventStartDate: '2026-09-26' }],
          confidenceScore: 0.9,
          thisFieldDoesNotExist: 'should fail'
        }
      ]
    };

    const isValid = validate(payload as any);
    assert.strictEqual(isValid, false);
    assert.ok(
      validate.errors?.some((e) => e.keyword === 'additionalProperties'),
      `expected an additionalProperties error, got: ${JSON.stringify(validate.errors)}`
    );
  });

  it('a payload with more than 10 events still PASSES AJV (proves the deliberate no-maxItems decision, Task 3.2)', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    const events = Array.from({ length: 15 }, (_, i) => ({
      eventName: `Roundup Item ${i + 1}`,
      types: ['OTHER'],
      categories: ['OTHER'],
      schedules: [{ isMainSchedule: true, eventStartDate: '2026-09-26' }],
      confidenceScore: 0.8
    }));
    const payload: GeminiExtractionPayload = {
      isEvent: true,
      groupingReason: 'roundup',
      events
    };

    const isValid = validate(payload);
    assert.strictEqual(isValid, true, `AJV must NOT reject an events array > 10 entries: ${JSON.stringify(validate.errors)}`);
    assert.strictEqual(payload.events.length, 15);
  });

  it('fails when a schedule.applicableDaysOfWeek value is outside the DayOfWeek enum (BUG-026)', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    const payload = {
      isEvent: true,
      events: [
        {
          eventName: 'Weekly Market',
          types: ['OTHER'],
          categories: ['OTHER'],
          schedules: [
            {
              isMainSchedule: true,
              eventStartDate: '2026-09-26',
              applicableDaysOfWeek: ['SATURDAY'] // invalid -- must be the short 'SAT' enum form
            }
          ],
          confidenceScore: 0.9
        }
      ]
    };

    const isValid = validate(payload as any);
    assert.strictEqual(isValid, false);
    const errorPaths = validate.errors?.map((e) => e.instancePath);
    assert.ok(errorPaths?.includes('/events/0/schedules/0/applicableDaysOfWeek/0'));
  });
});

describe('scrapedPostSchema (AJV) for ScrapedPost', () => {
  it('passes a Sidecar ScrapedPost carrying additionalImageUrls, and omits the field for a single-image post', () => {
    const validate = compileValidator<ScrapedPost>(scrapedPostSchema);

    const sidecar: ScrapedPost = {
      content: 'Carousel caption',
      postUrl: 'https://instagram.com/p/C_sidecar/',
      publishedAt: '2026-08-08T00:00:00Z',
      imageUrl: 'https://instagram.com/p/C_sidecar/cover.jpg',
      additionalImageUrls: [
        'https://instagram.com/p/C_sidecar/slide2.jpg',
        'https://instagram.com/p/C_sidecar/slide3.jpg',
      ],
    };
    assert.strictEqual(validate(sidecar), true);
    assert.strictEqual(validate.errors, null);

    const single: ScrapedPost = {
      content: 'Single image post',
      postUrl: 'https://instagram.com/p/C_image/',
      publishedAt: '2026-08-08T00:00:00Z',
    };
    assert.strictEqual(validate(single), true);
    assert.strictEqual(validate.errors, null);
  });

  it('rejects an undeclared property on a ScrapedPost (additionalProperties: false is load-bearing)', () => {
    const validate = compileValidator<ScrapedPost>(scrapedPostSchema);
    const withUnknown = {
      content: 'Should fail',
      postUrl: 'https://instagram.com/p/C_unknown/',
      publishedAt: '2026-08-08T00:00:00Z',
      someUnknownField: 'x',
    };
    assert.strictEqual(validate(withUnknown as any), false);
  });
});
