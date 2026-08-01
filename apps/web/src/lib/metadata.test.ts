import { describe, it, expect } from 'vitest';
import { buildPageMetadata } from './metadata';

describe('buildPageMetadata', () => {
  it('builds a Next.js Metadata object with title, description, and openGraph fields', () => {
    const title = 'Test Title';
    const description = 'Test Description';
    
    const result = buildPageMetadata({ title, description });
    
    expect(result).toEqual({
      title,
      description,
      openGraph: {
        title,
        description,
      },
    });
  });
});
