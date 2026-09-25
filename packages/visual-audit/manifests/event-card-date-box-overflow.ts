/**
 * Story 1.i1n AC5/AC9: overflow/clipping manifest entry for `EventCardDateBox`'s day slot --
 * the tool built for exactly this defect (AD-26's own motivating bug, `BUG-040`) finally run
 * against the real component. Mounts the real, unmodified `EventCardDateBox` (not a hand-typed
 * markup replica) via `react-dom/server`'s `renderToStaticMarkup`, at the real mobile 2-col
 * masonry slot width (175px, DESIGN.md `event_card_masonry.max_width`).
 *
 * Enumerates `formatShortEventDateTimeParts`'s branches via `ts-morph` (Task 4's own
 * `ConditionalExpression`-in-return-expression fix is what makes the `hasTime` time-string
 * sub-variant enumerable here at all -- pre-Task-4, this branch silently collapsed to whichever
 * string literal `extractSampleText` found first). Per enumerated variant, `buildFixtureHtml`
 * mounts `EventCardDateBox` with the SAME `dayVariant` its real branch would produce (word
 * variants -> `'word'`, the trailing real-date fallback -> `'number'`) -- so this proves the
 * actual per-variant fix, not a single fixed guess applied uniformly.
 *
 * Selector/mechanism note: `OverflowRule.buildFixtureHtml` has signature `(variantLabel: string)
 * => string` -- synchronous, called directly by `runOverflowRule` (see `manifest.ts`'s own
 * documented contract), not routed through the entry's async `render` spec. `render.ts`'s
 * `renderReactComponentToHtml` is async (it lazily imports `react-dom/server`) and can't be
 * reused from a synchronous call site without breaking that contract, so this file imports
 * `react-dom/server` statically instead and reimplements a small, local document wrapper --
 * matching `event-card-date-box-react-mount.ts`'s own local-wrapper pattern for its
 * `documentTemplate`, not exporting/forcing an async helper into a sync call site.
 *
 * `[data-event-card-date-box-day]` selector note: a plain `display: inline` element's own
 * `clientWidth`/`scrollWidth` stay equal regardless of content length -- CSS `max-width`/
 * `overflow` have no effect on non-replaced inline boxes (confirmed empirically against real
 * Chromium before choosing this design), so the day slot could never report a real overflow
 * signal on itself without an explicit box. `EventCardMediaPrimitives.tsx`'s `dayVariant ===
 * 'word'` class pair therefore gives the slot `inline-block` + `max-w-[96px]` + `overflow-x-hidden`
 * (see that file for the full empirical derivation, including why the Y axis is left
 * unconstrained) -- this manifest entry checks exactly that real, shipped box, not a
 * fixture-only override.
 */

import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { EventCardDateBox } from '@festgrid/ui/event-card-media-primitives';
import { registerManifestEntry, type ManifestEntry } from '../src/manifest.js';

/** The set of sample texts `formatShortEventDateTimeParts`'s word/time branches can enumerate to
 * (Today/Tomorrow/Yesterday, plus `content-variants.ts`'s own `DEFAULT_SAMPLE_TEXT_FALLBACK`
 * placeholder for the `hasTime` sub-variant, which has no string literal of its own). Any other
 * enumerated sample text is the trailing real-date fallback branch (numeric day-of-month) --
 * this is how `buildFixtureHtml` recovers each variant's real `dayVariant` from only the
 * `sampleText` string `OverflowRule.buildFixtureHtml`'s signature provides (see manifest.ts). */
const WORD_VARIANT_SAMPLE_TEXTS = new Set(['Today', 'Tomorrow', 'Yesterday', 'Wednesday']);

function dayVariantForSample(sampleText: string): 'number' | 'word' {
  return WORD_VARIANT_SAMPLE_TEXTS.has(sampleText) ? 'word' : 'number';
}

/** Renders the real EventCardDateBox (size="default", matching the mobile masonry consumer) with
 * one enumerated variant's sample text, mirroring EventCard.tsx's own real composition closely
 * enough to exercise the shipped day-slot classes (no month/tillLabel content is needed -- this
 * rule only ever inspects the day slot). */
function buildFixtureHtml(variantLabel: string): string {
  const dayVariant = dayVariantForSample(variantLabel);
  const element = React.createElement(EventCardDateBox, {
    size: 'default',
    month: 'SEP',
    day: variantLabel,
    dayVariant,
  });
  const bodyHtml = ReactDOMServer.renderToStaticMarkup(element);
  return `
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:Inter,sans-serif; margin:0;}</style>
<div class="p-2 bg-slate-100" data-testid="date-box-overflow-wrapper">${bodyHtml}</div>
`;
}

export const entry: ManifestEntry = {
  component: 'EventCardDateBox',
  variant: 'overflow-word-time-content',
  viewport: { width: 175, height: 160 },
  renderScope: 'single-instance',
  mode: 'rule',
  render: {
    kind: 'react-component',
    render: () => React.createElement(EventCardDateBox, { size: 'default', month: 'SEP', day: '12' }),
  },
  rules: [
    {
      kind: 'overflow',
      selector: '[data-event-card-date-box-day]',
      formattingFunction: {
        filePath: 'packages/ui/src/features/events/format-event-date.ts',
        functionName: 'formatShortEventDateTimeParts',
      },
      buildFixtureHtml,
    },
  ],
};

registerManifestEntry('event-card-date-box:overflow-word-time-content:175x160', entry);
