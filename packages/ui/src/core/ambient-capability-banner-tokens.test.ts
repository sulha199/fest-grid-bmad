import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ambientCapabilityBannerTokens } from './ambient-capability-banner-tokens';

// Story 0.42 AC11 — a cheap, drift-detecting regression guard: these values
// must match DESIGN.md's documented `ambient_capability_banner` tokens
// verbatim. Not a rendering test — there is nothing to render here.
describe('ambientCapabilityBannerTokens (Story 0.42 AC11)', () => {
  it('matches DESIGN.md verbatim', () => {
    expect(ambientCapabilityBannerTokens).toEqual({
      base: 'w-full flex flex-col items-start gap-3 px-4 py-3 bg-violet-50 border-b border-violet-200 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4',
      actions: 'flex flex-wrap items-center gap-2 sm:shrink-0',
      dismissPermanent: 'py-2 px-4 rounded-md font-semibold bg-gray-200 text-gray-800',
      dismissCooldown: 'text-violet-700 underline text-xs font-medium',
    });
  });

  it('is the literal DESIGN.md documents (read from the file, not copied here)', () => {
    const design = readFileSync(resolve(__dirname, '../../../../design-artifacts/UX-festgrid-run-1/DESIGN.md'), 'utf8');
    expect(design).toContain(`base: "${ambientCapabilityBannerTokens.base}"`);
    expect(design).toContain(`actions: "${ambientCapabilityBannerTokens.actions}"`);
    expect(design).toContain(`dismiss_cooldown: "${ambientCapabilityBannerTokens.dismissCooldown}"`);
  });
});
