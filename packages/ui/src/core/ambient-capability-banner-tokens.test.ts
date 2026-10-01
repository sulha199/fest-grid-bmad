import { describe, it, expect } from 'vitest';
import { ambientCapabilityBannerTokens } from './ambient-capability-banner-tokens';

// Story 0.42 AC11 — a cheap, drift-detecting regression guard: these values
// must match DESIGN.md's documented `ambient_capability_banner` tokens
// verbatim. Not a rendering test — there is nothing to render here.
describe('ambientCapabilityBannerTokens (Story 0.42 AC11)', () => {
  it('matches DESIGN.md verbatim', () => {
    expect(ambientCapabilityBannerTokens).toEqual({
      base: 'w-full flex items-center justify-between gap-4 px-4 py-3 bg-violet-50 border-b border-violet-200 text-sm',
      dismissPermanent: 'py-2 px-4 rounded-md font-semibold bg-gray-200 text-gray-800',
      dismissCooldown: 'text-violet-700 underline text-xs font-medium',
    });
  });
});
