/**
 * BUG-047 (Event-Card family consolidation) AC-DATE-4/AC-DATE-5: masonry-scoped `EventCardDateBox`
 * sizing invariants. Added during code review of BUG-047's implementation (Blind Hunter, 2026-09-26):
 * the fix for both ACs was originally verified only via a throwaway Playwright script (deleted after
 * confirming green) plus a unit test asserting an exact class-string match -- neither is a durable,
 * repeatable regression guard the way `event-card-date-box-overflow.ts` (deleted by this same story,
 * its own motivating scenario now dead code) was for BUG-040. This manifest closes that gap with two
 * real, `sibling-dimension`-rule checks against the actual mounted components, mirroring
 * `grid-container-masonry.ts`'s own real-component-mount convention.
 *
 * - `width-consistency-1-vs-2-digit`: two real `EventCardDateBox(size="default")` instances, day="3"
 *   and day="23", placed side by side. `sibling-dimension` (dimension: 'width') clusters them by row
 *   overlap and asserts equal rendered width -- AC-DATE-4, the `tabular-nums`/`min-w-[2ch]` day-slot
 *   fix.
 * - `height-matches-thumbnail`: the real `EventCard(variant="masonry", prominentPoster=false)`
 *   composition with an image, checking `[data-event-card-date-box]` (the visible navy box) against
 *   `[data-event-card-media-slot]` (the thumbnail) for equal height -- AC-DATE-5, the `h-full` fix on
 *   `EventCardDateBox`'s root span (masonry `size='default'` only; the calendar list row's
 *   `size='compact'` box is out of scope for both ACs and is not checked here).
 */

import React from 'react';
import { EventCardDateBox } from '@festgrid/ui/event-card-media-primitives';
import { EventCard } from '@festgrid/ui/event-card';
import { registerManifestEntry, type ManifestEntry } from '../src/manifest.js';

/** 1x1 transparent GIF as a `data:` URI -- no network fetch (this harness's renders must stay
 * offline-deterministic), but still a real `<img>` with a real (1:1) intrinsic aspect ratio, so
 * `object-cover w-full h-full`'s sizing math has real content to size against -- an omitted
 * `imageUrl` would render the reserved-blank fallback instead (no `<img>` at all in the masonry
 * default composition, since `hideFavoriteBadge` is set and no `onFavoriteToggle` is passed at
 * this call site), which would trivially "pass" this check for the wrong reason (both siblings
 * collapsing to the date-box's own small natural height instead of a real thumbnail's height). */
const FIXTURE_IMAGE_DATA_URI = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

function documentTemplate(bodyHtml: string): string {
  return `
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:Inter,sans-serif; margin:0;}</style>
<div class="p-4 flex gap-4 bg-slate-100" data-testid="date-box-sizing-wrapper">${bodyHtml}</div>
`;
}

export const widthEntry: ManifestEntry = {
  component: 'EventCardDateBox',
  variant: 'width-consistency-1-vs-2-digit',
  viewport: { width: 300, height: 160 },
  renderScope: 'multi-instance',
  mode: 'rule',
  render: {
    kind: 'react-component',
    render: () =>
      React.createElement(
        React.Fragment,
        null,
        React.createElement(EventCardDateBox, { size: 'default', month: 'SEP', day: '3' }),
        React.createElement(EventCardDateBox, { size: 'default', month: 'SEP', day: '23' })
      ),
    documentTemplate,
  },
  rules: [
    {
      kind: 'sibling-dimension',
      selector: '[data-event-card-date-box]',
      dimension: 'width',
    },
  ],
};
registerManifestEntry('event-card-date-box:width-consistency-1-vs-2-digit:300x160', widthEntry);

export const heightEntry: ManifestEntry = {
  component: 'EventCard',
  variant: 'date-box-height-matches-thumbnail',
  viewport: { width: 400, height: 400 },
  renderScope: 'single-instance',
  mode: 'rule',
  render: {
    kind: 'react-component',
    render: () =>
      React.createElement(EventCard, {
        eventName: 'AC-DATE-5 Height Parity Check',
        startDate: new Date('2026-08-05T18:00:00Z'),
        imageUrl: FIXTURE_IMAGE_DATA_URI,
        variant: 'masonry',
        prominentPoster: false,
        locale: 'en-US',
      }),
  },
  rules: [
    {
      kind: 'sibling-dimension',
      selector: '[data-event-card-date-box], [data-event-card-media-slot]',
      dimension: 'height',
    },
  ],
};
registerManifestEntry('event-card-date-box:date-box-height-matches-thumbnail:400x400', heightEntry);
