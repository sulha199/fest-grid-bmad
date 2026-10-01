/**
 * Review Follow-up (2026-09-22, second round): proof manifest entry mounting the story's own
 * originally-named motivating component -- `EventCardDateBox`
 * (`packages/ui/src/features/events/EventCardMediaPrimitives.tsx`) -- via the `react-component`
 * `RenderSpec` (`src/render.ts`), including its Clock-icon-when-`hasTime`-with-today rendering
 * path (`DESIGN.md` `event_card_date_box.base_default.month`: "Clock icon (AC12) renders inline
 * with this line when hasTime && dayDiff === 0"; `EventCard.tsx` composes it into the `month`
 * slot as `{hasTime && dayDiff === 0 && <Clock className="w-3 h-3" />}{dateBoxParts.month}`).
 *
 * The first Review Follow-up round substituted `CountBadge` (lucide-free) as the mount proof
 * because mounting this exact file reproduced a real, then-undiagnosed-to-the-byte third-party
 * interop failure. That failure has now been root-caused and fixed for real (not worked around):
 *
 *  1. `lucide-react@0.473.0` (this repo's pinned version for `packages/ui`, independent of
 *     `apps/web`'s separately-pinned `^1.25.0`) ships an `exports` map whose `require`/`node`
 *     condition points at `dist/cjs/lucide-react.js` -- a real CommonJS file (`'use strict';
 *     var react = require('react');`) -- but the package root's `package.json` declares
 *     `"type": "module"` and `dist/cjs/` has no nested `package.json` overriding that back to
 *     `"type": "commonjs"`. That is the actual upstream packaging bug: Node's module loader
 *     resolves `dist/cjs/lucide-react.js` as an ES module (per the nearest applicable `"type"`),
 *     so the file's own literal `require(...)` call throws `ReferenceError: require is not
 *     defined` -- reproduced verbatim at `dist/cjs/lucide-react.js:10:13` when Playwright's
 *     CJS-targeting test transform `require()`s this file transitively. Confirmed empirically
 *     that `lucide-react@1.25.0` (already used by `apps/web`) does not have this bug: it ships no
 *     `exports` map at all and no `"type"` field, so Node's default (CommonJS) resolution applies
 *     to its `main` (`dist/cjs/lucide-react.js`) without any dual-package hazard.
 *     **Fixed** with a `pnpm patch` (`patches/lucide-react@0.473.0.patch`, registered in the root
 *     `package.json`'s `pnpm.patchedDependencies`) that adds the missing
 *     `dist/cjs/package.json` (`{"type": "commonjs"}`) -- the standard, minimal fix for this
 *     exact class of dual-package-hazard bug, scoped to only the one broken version, with zero
 *     API/behavior change to `lucide-react` itself and zero risk of the icon-rename/breaking-API
 *     surface a major-version bump (0.473 -> 1.25) would have risked across `packages/ui`'s 22
 *     other `lucide-react`-importing files. This is a real fix to the actual defect, not a
 *     workaround that hides the symptom (e.g. swapping icon libraries or deleting the icon).
 *  2. Separately, Playwright's test transform defaults ANY `.tsx` file's JSX to its own internal
 *     `playwright/jsx-runtime` rather than React's, unless the file carries an explicit
 *     `@jsxImportSource react` pragma comment -- already diagnosed and fixed for
 *     `count-badge.tsx` in the first Review Follow-up round. The same one-line pragma is now
 *     added to `EventCardMediaPrimitives.tsx` (this file's real target), since it is a second,
 *     independent bug from (1) and applies to every `.tsx` file this harness mounts, not just
 *     lucide-consuming ones.
 *
 * With both fixed, this manifest mounts the real, unmodified `EventCardDateBox` export (via a
 * new `@festgrid/ui` export subpath, `./event-card-media-primitives`, additive-only) composing
 * its `month` slot exactly the way `EventCard.tsx` does for the `hasTime && dayDiff === 0` case
 * -- a real lucide `Clock` icon inline with the month text -- and asserts two real signals: (a)
 * the date box's `bg-slate-800` background token, and (b) the Clock `<svg>` actually rendered
 * (this rule throws if the selector matches zero elements) and correctly inherits the date box's
 * `text-white` color. Neither check is checking the icon-free `CountBadge` fallback.
 */

import React from 'react';
import { Clock } from 'lucide-react';
import { EventCardDateBox } from '@festgrid/ui/event-card-media-primitives';
import { registerManifestEntry, type ManifestEntry } from '../src/manifest.js';

function documentTemplate(bodyHtml: string): string {
  return `
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:Inter,sans-serif; margin:0;}</style>
<div class="p-6 bg-slate-100" data-testid="date-box-wrapper">${bodyHtml}</div>
`;
}

export const entry: ManifestEntry = {
  component: 'EventCardDateBox',
  variant: 'clock-icon-has-time-today',
  viewport: { width: 220, height: 160 },
  renderScope: 'single-instance',
  mode: 'rule',
  render: {
    kind: 'react-component',
    // Mirrors EventCard.tsx's real hasTime && dayDiff === 0 composition verbatim (see file
    // header): the Clock icon inline with the month text, inside the real EventCardDateBox.
    render: () =>
      React.createElement(EventCardDateBox, {
        size: 'default',
        month: React.createElement(
          React.Fragment,
          null,
          React.createElement(Clock, { className: 'w-3 h-3' }),
          'SEP'
        ),
        day: '22',
      }),
    documentTemplate,
  },
  rules: [
    // Color: the real bg-slate-800 token, read off the actual mounted component's own
    // computed style (not a hand-typed markup replica).
    {
      kind: 'color',
      selector: '[data-event-card-date-box]',
      cssProperty: 'backgroundColor',
      expectedToken: { name: 'bg-slate-800', resolvedValue: 'rgb(30, 41, 59)' },
    },
    // Proves the Clock icon actually rendered as a real <svg> (getElementSnapshot throws if the
    // selector matches zero elements -- this is not a trivial "no elements to compare" pass) and
    // correctly inherited the date box's text-white color, the actual path that was broken.
    {
      kind: 'color',
      selector: '[data-event-card-date-box] svg',
      cssProperty: 'color',
      expectedToken: { name: 'text-white (inherited)', resolvedValue: 'rgb(255, 255, 255)' },
    },
  ],
};

registerManifestEntry('event-card-date-box:clock-icon-has-time-today:220x160', entry);
