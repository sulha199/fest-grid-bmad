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
 * Story 0.48 (FIND-052) update — this manifest, by construction (no hydration ever runs here,
 * per the note above), ONLY EVER exercises AC2's Phase 1 (`!hasMeasured`) render: every item is a
 * normal in-flow CSS Grid item (`display:grid; grid-template-columns: repeat(N,1fr)` on the one
 * flat parent, each item's own explicit `gridColumn`), never Phase 2's absolute-positioned state
 * (AC10's own real-browser proof of this — the Phase-1-only non-collapsed-height assertion below
 * — lives in `manifests-proof.spec.ts`, since it needs a real computed layout jsdom cannot give).
 * Story 0.48 also removed the per-column wrapper `<div data-grid-container-column>` this manifest
 * used to select — `data-grid-container-column-index` now lives directly on each item wrapper
 * (`[data-grid-container-item]`) instead, so every rule below is reworked against that:
 *   - `sibling-dimension` (AC9(a), column WIDTH equality): selecting `[data-grid-container-item]`
 *     directly and letting `clusterByColumnOverlap` group them by horizontal position needs no
 *     wrapper at all — items assigned to the same column share the same grid-track x-range (CSS
 *     Grid's default `stretch` self-alignment fills an unconstrained item to its track's full
 *     width), so they cluster into the same group exactly as the old per-column wrappers did.
 *   - `intra-box-ratio` (the actual load-bearing width-equality proof): rather than measuring a
 *     wrapper per column (removed), these compare the one specific item SSR/round-robin placement
 *     deterministically puts in each column — item `i` lands in column `i % COLUMN_COUNT` (per
 *     this file's own header above), so item 0 (col 0) vs. item 1 (col 1), and item 1 (col 1) vs.
 *     item 2 (col 2), each via a single, unambiguous `data-grid-container-item-index` selector.
 *   - `placement-order` (AC9(b)): the generic rule kind needs a distinct per-column CONTAINER
 *     element to `querySelector` an item inside of (`engine.ts`'s `col.querySelector(itemSelector)`)
 *     — there is no longer one. AC9(b)'s actual claim ("first N items land one-per-column, left
 *     to right, in index order") is instead verified directly in `manifests-proof.spec.ts` by
 *     grouping items client-side by their own `data-grid-container-column-index` value and reusing
 *     `checkPlacementOrder` (`rules/placement-order.ts`) as a pure function against that grouping
 *     — same underlying check, no `rules` array entry needed for it here.
 *
 * Column HEIGHT varying independently per card's real content is pure CSS flow (CSS Grid's
 * auto-placement stacks same-`gridColumn` items into sequential rows, each column's own stack
 * height following its own items, never row-locked to its siblings) — genuinely verified by this
 * static render (see `manifests-proof.spec.ts`'s height-independence test).
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
    // row-locked height). Story 0.48: selects items directly (no more per-column wrapper) —
    // multi-instance render scope clusters by horizontal overlap (AD-26 Rule 1a), and items
    // sharing a column share that column's x-range (CSS Grid's default `stretch` fills an
    // unconstrained item to its track's full width) — as with the earlier
    // `masonry-column-width-invariant.ts` synthetic entry, 3 genuinely side-by-side
    // (non-overlapping) column clusters each land in their OWN cluster under that clustering
    // strategy, so this specific rule instance can only ever prove 3 independent column clusters
    // were found, not that their widths actually match each other (a cluster with >1 member
    // still only checks internal agreement — see `sibling-dimension.ts`'s own clustering
    // semantics). Kept because AC9(a) names it explicitly and it matches this package's own
    // established multi-instance pattern.
    { kind: 'sibling-dimension', selector: '[data-grid-container-item]', dimension: 'width' },
    // The actual load-bearing "columns share one width" proof (able to genuinely fail, unlike
    // the sibling-dimension cluster above): pairwise `intra-box-ratio` width checks, expectedRatio
    // 1. Story 0.48: there is no longer one wrapper element per column to measure directly, so
    // these instead compare the ONE specific item the SSR/round-robin estimate (this file's own
    // header) deterministically places in each column — item `i` lands in column `i %
    // COLUMN_COUNT`, so item 0 is column 0's item, item 1 is column 1's, item 2 is column 2's.
    // Transitively covers col0≈col1≈col2.
    {
      kind: 'intra-box-ratio',
      selectorA: '[data-grid-container-item-index="0"]',
      selectorB: '[data-grid-container-item-index="1"]',
      dimension: 'width',
      expectedRatio: 1,
      toleranceRelative: 0.05,
    },
    {
      kind: 'intra-box-ratio',
      selectorA: '[data-grid-container-item-index="1"]',
      selectorB: '[data-grid-container-item-index="2"]',
      dimension: 'width',
      expectedRatio: 1,
      toleranceRelative: 0.05,
    },
    // AC9(b)'s "first COLUMN_COUNT items land one-per-column, left to right, in index order"
    // claim is verified directly in `manifests-proof.spec.ts` instead of as a `placement-order`
    // rule entry here — Story 0.48 removed the per-column wrapper the generic rule kind's
    // `columnSelector`/`col.querySelector(itemSelector)` mechanism (`engine.ts`) needs to scope
    // an item search inside; see this file's own header for the full reasoning.
  ],
};

registerManifestEntry('grid-container:masonry-real-eventcard:900x700', entry);
