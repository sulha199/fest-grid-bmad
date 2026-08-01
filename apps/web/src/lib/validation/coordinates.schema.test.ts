import { describe, it, expect } from 'vitest';
import { coordinatesSchema } from './coordinates.schema';

describe('Runtime Schema Validation (Zod)', () => {
  it('should pass safeParse for valid coordinates', () => {
    const validCoords = {
      latitude: 40.7128,
      longitude: -74.0060
    };

    const result = coordinatesSchema.safeParse(validCoords);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validCoords);
    }
  });

  it('should fail safeParse for out-of-range coordinates', () => {
    const invalidCoords = {
      latitude: 95.0, // max is 90
      longitude: -200.0 // min is -180
    };

    const result = coordinatesSchema.safeParse(invalidCoords);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      const errors = result.error.issues.map(e => e.path.join('.'));
      expect(errors).toContain('latitude');
      expect(errors).toContain('longitude');
    }
  });

  it('should fail safeParse for malformed input', () => {
    const malformedInput = {
      latitude: '40.7128', // should be number
      // missing longitude
    };

    const result = coordinatesSchema.safeParse(malformedInput);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      const errors = result.error.issues.map(e => e.path.join('.'));
      expect(errors).toContain('latitude');
      expect(errors).toContain('longitude');
    }
  });
});
