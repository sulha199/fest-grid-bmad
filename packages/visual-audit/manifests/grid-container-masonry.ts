/**
 * Story 0.45 / Architecture Spine AD-27 AC9: the real check this story's own Definition of Done
 * runs — mounts the ACTUAL production `GridContainer(layout="masonry")` + `EventCard` components
 * (via the `react-component` `RenderSpec`, AD-26 Review Follow-up mechanism), not the earlier
 * `masonry-column-width-invariant.ts` synthetic fixture-div proof-of-concept (which stays as-is,
 * an engine proof, not this story's real check — see that file's own header).
 *
 * Render-mechanism note (shared with every other `react-component` manifest in this package):
 * `render.ts` mounts via `react-dom/server`'s `renderToStaticMarkup` — a one-shot server render,
 * no client-side React hydration. This means `GridContainer`'s masonry engine here always runs
 * its SSR/first-paint path: `useActiveColumnCount`'s viewport-resize effect never fires (there is
 * no live React instance to run it), so the active column count is always `baseCols` regardless
 * of `viewport.width` (picked directly via `baseCols`/`colsStep` below, not inferred from a
 * breakpoint); and `useMasonryLayout`'s item refs never attach (no live reconciliation), so
 * `columnAssignments` always stays the round-robin-by-index estimate. That is exactly what AC9(b)
 * needs to check: round-robin's own placement, item `i` lands in column `i % columnCount`, is a
 * deterministic, real proof of "the first N items land one-per-column in index order" — the
 * post-hydration true shortest-column reflow (AC2/AC5) is separately, thoroughly unit-tested
 * against controlled heights in `useMasonryLayout.test.ts` (AC11), where jsdom's real ref/effect
 * lifecycle actually runs.
 *
 * Column WIDTH equality (AC9(a)), by contrast, needs no client JS at all — `flex-1 min-w-0`
 * tracks are pure CSS, and column HEIGHT varying independently per card's real content is also
 * pure CSS flow (each column is its own `flex-col` box, never row-locked to its siblings) — both
 * are genuinely verified by this static render.
 */

import React from 'react';
import { GridContainer } from '@festgrid/ui/grid-container';
import { EventCard } from '@festgrid/ui/event-card';
import { registerManifestEntry, type ManifestEntry } from '../src/manifest.js';

const COLUMN_COUNT = 3;

/** Deliberately varying content lengths (title word count, location presence) so each column's
 * real rendered height genuinely differs card-to-card — the whole point of AD-27's independent
 * per-column flow, as opposed to CSS Grid's row-locked height. */
const FIXTURE_CARDS: Array<{ eventName: string; locationName?: string }> = [
  { eventName: 'Live Jazz Night', locationName: 'Blue Note Lounge' },
  { eventName: 'Art Walk' },
  { eventName: 'International Food & Wine Festival: A Full Weekend Celebration', locationName: 'Riverside Park Grounds, Downtown' },
  { eventName: 'Yoga' },
  { eventName: 'Night Market', locationName: 'Downtown Plaza' },
  { eventName: '5K Fun Run for Charity', locationName: 'City Stadium' },
];

const FIXTURE_START_DATE = new Date('2026-10-12T18:00:00Z').toISOString();

function renderFixture(): React.ReactElement {
  return React.createElement(GridContainer, {
    layout: 'masonry',
    baseCols: COLUMN_COUNT,
    colsStep: 1,
    gap: 'gap-x-2 gap-y-6',
    children: FIXTURE_CARDS.map((card, index) =>
      React.createElement(EventCard, {
        key: index,
        variant: 'masonry',
        eventName: card.eventName,
        startDate: FIXTURE_START_DATE,
        locationName: card.locationName,
      })
    ),
  });
}

export const entry: ManifestEntry = {
  component: 'GridContainer',
  variant: 'masonry-real-eventcard',
  viewport: { width: 900, height: 700 },
  renderScope: 'multi-instance',
  mode: 'rule',
  render: {
    kind: 'react-component',
    render: renderFixture,
  },
  rules: [
    // AC9(a): every column track shares one width (AD-27 Rule 1), even though the real
    // EventCards inside them independently vary in height (true masonry, not CSS Grid's
    // row-locked height). Multi-instance render scope clusters by horizontal overlap (AD-26
    // Rule 1a) — as with the earlier `masonry-column-width-invariant.ts` synthetic entry, 3
    // genuinely side-by-side (non-overlapping) column tracks each land in their OWN 1-member
    // cluster under that clustering strategy, so this specific rule instance can only ever prove
    // 3 independent column instances were found, not that their widths actually match each
    // other (a 1-member cluster trivially "passes" — see `sibling-dimension.ts`'s own clustering
    // semantics). Kept because AC9(a) names it explicitly and it matches this package's own
    // established multi-instance pattern.
    { kind: 'sibling-dimension', selector: '[data-grid-container-column]', dimension: 'width' },
    // The actual load-bearing "columns share one width" proof (able to genuinely fail, unlike
    // the trivial sibling-dimension cluster above): pairwise `intra-box-ratio` width checks
    // across the 3 real column tracks, expectedRatio 1. Transitively covers col0≈col1≈col2.
    {
      kind: 'intra-box-ratio',
      selectorA: '[data-grid-container-column-index="0"]',
      selectorB: '[data-grid-container-column-index="1"]',
      dimension: 'width',
      expectedRatio: 1,
      toleranceRelative: 0.05,
    },
    {
      kind: 'intra-box-ratio',
      selectorA: '[data-grid-container-column-index="1"]',
      selectorB: '[data-grid-container-column-index="2"]',
      dimension: 'width',
      expectedRatio: 1,
      toleranceRelative: 0.05,
    },
    // AC9(b): the first COLUMN_COUNT items land one-per-column, left to right, in index order —
    // proving placement order approximates today's row-major reading order (AD-27 Rule 1/4),
    // not CSS multi-column's rejected column-major order.
    {
      kind: 'placement-order',
      columnSelector: '[data-grid-container-column]',
      itemSelector: '[data-grid-container-item]',
      itemIndexAttribute: 'data-grid-container-item-index',
    },
  ],
};

registerManifestEntry('grid-container:masonry-real-eventcard:900x700', entry);
