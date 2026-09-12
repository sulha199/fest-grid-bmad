import { describe, it } from 'node:test';
import assert from 'node:assert';
import { compileValidator } from './validate';
import { extractedEventSchema } from './extracted-event.schema';
import { scrapedPostSchema } from './scraped-post.schema';
import { GeminiExtractionPayload, ScrapedPost } from '@festgrid/domain';

describe('Runtime Schema Validation (AJV)', () => {
  it('should pass validation for a valid payload', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    
    const validPayload: GeminiExtractionPayload = {
      isEvent: true,
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
    };

    const isValid = validate(validPayload);
    assert.strictEqual(isValid, true);
    assert.strictEqual(validate.errors, null);
  });

  it('should fail validation for an invalid payload (missing eventName, wrong type)', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    
    const invalidPayload = {
      isEvent: true,
      // missing eventName
      types: 'Not an array', // wrong type
      categories: [],
      schedules: [],
      confidenceScore: 1.5 // invalid value (max 1)
    };

    const isValid = validate(invalidPayload as any);
    assert.strictEqual(isValid, false);
    assert.notStrictEqual(validate.errors, null);
    
    // Check specific errors exist
    const errorPaths = validate.errors?.map(e => e.instancePath || e.params.missingProperty);
    assert.ok(errorPaths?.includes('eventName')); // missing required property
    assert.ok(errorPaths?.includes('/types')); // wrong type
    assert.ok(errorPaths?.includes('/confidenceScore')); // invalid range
  });

  it('should fail validation for a type value outside the EventType enum', () => {
    const validate = compileValidator<GeminiExtractionPayload>(extractedEventSchema);
    
    const invalidPayload = {
      isEvent: true,
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
    };

    const isValid = validate(invalidPayload as any);
    assert.strictEqual(isValid, false);
    assert.notStrictEqual(validate.errors, null);
    const errorPaths = validate.errors?.map(e => e.instancePath);
    assert.ok(errorPaths?.includes('/types/0')); // invalid enum value
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
