/**
 * CC-030 / Story 0.48 AC14: the real-browser gate for `GridContainer(layout="masonry")`'s
 * MEASURED phase (Phase 2: absolutely positioned items + `translateY`). Every other masonry
 * manifest renders server-side (`renderToStaticMarkup`) and therefore only ever sees Phase 1, so
 * two shipped Phase 2 defects passed every check:
 *   1. bare `gridColumn: N` (auto end line) -> column-0 items stretched to the full container
 *      width and overlapped column 1;
 *   2. absolutely positioned items ignore the grid's `row-gap`, so stacked cards touched.
 *
 * This entry mounts the real component client-side (`client-bundle` render, 412px = a phone) and
 * asserts, once Phase 2 is reached: every item shares one width (`sibling-dimension` -- clustered
 * by horizontal overlap, so a stretched item pulls the other column into its cluster and the
 * widths disagree), and stacked items in a column are exactly the `gap-4` (16px) apart
 * (`sibling-gap`, which also fails on overlap). `manifests-proof.spec.ts` adds negative canaries
 * that re-create each defect on the rendered DOM to prove both rules can fail.
 */

import { registerManifestEntry, type ManifestEntry } from '../src/manifest.js';

const ENTRY_FILE = 'manifests/client-entries/grid-container-phase2-entry.ts';

function buildEntry(variant: string, canary?: 'single-line-gridcolumn' | 'no-row-gap'): ManifestEntry {
  return {
    component: 'GridContainer',
    variant,
    viewport: { width: 412, height: 900 },
    renderScope: 'multi-instance',
    mode: 'rule',
    render: {
      kind: 'client-bundle',
      entryFile: ENTRY_FILE,
      beforeScript: canary ? `window.__GC_CANARY__ = ${JSON.stringify(canary)};` : undefined,
      waitForSelector: 'body[data-ready]',
    },
    rules: [
      { kind: 'sibling-dimension', selector: '[data-grid-container-item]', dimension: 'width' },
      { kind: 'sibling-gap', selector: '[data-grid-container-item]', expectedPx: 16 },
    ],
  };
}

export const entry: ManifestEntry = buildEntry('masonry-phase2-client-mounted');

export const PHASE2_ENTRY_NAME = 'grid-container:masonry-phase2-client-mounted:412x900';
registerManifestEntry(PHASE2_ENTRY_NAME, entry);

/** Canary builders, registered lazily by `manifests-proof.spec.ts` (never part of the real gate). */
export function buildPhase2CanaryEntry(canary: 'single-line-gridcolumn' | 'no-row-gap'): ManifestEntry {
  return buildEntry(`masonry-phase2-canary-${canary}`, canary);
}
