import { describe, it } from 'node:test';
import assert from 'node:assert';
import { compileValidator } from './validate';
import { extractedEventSchema, ExtractedEventPayload } from './extracted-event.schema';

describe('Runtime Schema Validation (AJV)', () => {
  it('should pass validation for a valid payload', () => {
    const validate = compileValidator<ExtractedEventPayload>(extractedEventSchema);
    
    const validPayload = {
      isEvent: true,
      eventName: 'Summer Music Festival',
      types: ['Music'],
      categories: ['Festival', 'Outdoor']
    };

    const isValid = validate(validPayload);
    assert.strictEqual(isValid, true);
    assert.strictEqual(validate.errors, null);
  });

  it('should fail validation for an invalid payload (missing eventName, wrong type)', () => {
    const validate = compileValidator<ExtractedEventPayload>(extractedEventSchema);
    
    const invalidPayload = {
      isEvent: true,
      // missing eventName
      types: 'Not an array', // wrong type
      categories: []
    };

    const isValid = validate(invalidPayload);
    assert.strictEqual(isValid, false);
    assert.notStrictEqual(validate.errors, null);
    
    // Check specific errors exist
    const errorPaths = validate.errors?.map(e => e.instancePath || e.params.missingProperty);
    assert.ok(errorPaths?.includes('eventName')); // missing required property
    assert.ok(errorPaths?.includes('/types')); // wrong type
  });
});
