import { describe, expect, it } from 'vitest';
import { CORE_SCAFFOLD_VERSION } from './index.js';

describe('Scaffold', () => {
  it('has a core version', () => {
    expect(CORE_SCAFFOLD_VERSION).toBe('0.1.0');
  });
});
