/**
 * Rule-based example manifest entry (AC2, AC11): a hand-encoded structural invariant with no
 * golden HTML/PNG reference -- "masonry columns share one width; cards within a column vary
 * height independently" (AD-27 Rule 1/3), the invariant AD-27's own future masonry-engine story
 * will eventually verify for real. This story only needs a *synthetic* proof that the rule-based
 * mode + multi-instance render scope work end-to-end (AC2/AC3/AC11 explicitly do not require
 * AD-27's real masonry engine to exist yet -- Out of Scope).
 *
 * Multi-instance render scope (AD-26 Rule 1a, AC3): mounts three independently-tall synthetic
 * "cards" as three side-by-side columns, so `Rule 5`'s sibling-dimension clustering operates
 * across instances (column-overlap clustering) rather than within one card's own children.
 */

import { registerManifestEntry, type ManifestEntry } from '../src/manifest.js';

const SYNTHETIC_MASONRY_HTML = `
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:Inter,sans-serif; margin:0;}</style>
<div class="p-4 flex items-start gap-2 bg-slate-100" data-testid="masonry-row">
  <div class="w-[230px] h-[300px] bg-white rounded-lg shadow" data-testid="masonry-col"></div>
  <div class="w-[230px] h-[450px] bg-white rounded-lg shadow" data-testid="masonry-col"></div>
  <div class="w-[230px] h-[220px] bg-white rounded-lg shadow" data-testid="masonry-col"></div>
</div>
`;

export const entry: ManifestEntry = {
  component: 'GridContainer',
  variant: 'masonry-columns-synthetic',
  viewport: { width: 800, height: 600 },
  renderScope: 'multi-instance',
  mode: 'rule',
  render: { kind: 'isolated-html', html: SYNTHETIC_MASONRY_HTML },
  rules: [
    // Hand-encoded expected value, no golden reference: columns must share exactly one width
    // (AD-27 Rule 1) even though their heights independently vary (true masonry, not CSS Grid's
    // row-locked height). Default <=2px absolute tolerance (AC7).
    { kind: 'sibling-dimension', selector: '[data-testid="masonry-col"]', dimension: 'width' },
  ],
};

registerManifestEntry('grid-container:masonry-columns-synthetic:800x600', entry);
