/**
 * Review Follow-up (decision-needed item 1, RULING: extend the harness now, 2026-09-22): proof
 * manifest entry demonstrating the new `react-component` `RenderSpec` variant (`src/render.ts`)
 * actually mounts a real production React component from `@festgrid/ui` -- `CountBadge`
 * (`packages/ui/src/core/count-badge.tsx`) -- via that package's new `./count-badge` export
 * subpath, server-rendered with `react-dom/server` and loaded the same isolated way every other
 * fixture in this package is.
 *
 * Judgment call, documented: the story's own motivating examples were `EventCard`/
 * `EventCardDateBox` (`packages/ui/src/features/events/EventCardMediaPrimitives.tsx`). Mounting
 * that file specifically was attempted first and hit a real, reproduced, and fully diagnosed
 * third-party interop bug -- Playwright's test-file transform treats that file as CommonJS
 * (`packages/ui` declares no `"type": "module"`, so Node/Playwright default to CJS for it), but
 * its `import { Heart, Navigation } from 'lucide-react'` resolves to `lucide-react`'s `require`
 * export condition, which points at a `dist/cjs/*.js` file that -- because `lucide-react`'s own
 * `package.json` declares `"type": "module"` package-wide -- Node treats as an ES module despite
 * its CommonJS syntax, so the file's own internal `require(...)` calls throw `ReferenceError:
 * require is not defined`. Confirmed directly: `npx playwright test` importing
 * `EventCardMediaPrimitives.tsx` reproduces it every time; plain `tsx` execution of the exact
 * same component (outside Playwright's transform) does not -- so this is Playwright's transform
 * + `lucide-react`'s dual CJS/ESM packaging, not a bug in this engine's render harness. Fixing it
 * properly (e.g. marking `packages/ui` `"type": "module"`) is a change with monorepo-wide build
 * blast radius, out of this story's safe scope. `CountBadge` is real, production, icon-free
 * `@festgrid/ui` code that mounts cleanly and proves the `react-component` RenderSpec mechanism
 * end-to-end; a future story mounting an icon-bearing component (e.g. BUG-040's fix) should
 * expect to hit this same interop gap and will need to resolve it then (package-level `"type"`
 * change, an icon-library swap, or a Playwright-version fix -- whichever is current at that time).
 */

import React from 'react';
import { CountBadge } from '@festgrid/ui/count-badge';
import { registerManifestEntry, type ManifestEntry } from '../src/manifest.js';

function documentTemplate(bodyHtml: string): string {
  return `
<script src="https://cdn.tailwindcss.com"></script>
<style>body{font-family:Inter,sans-serif; margin:0;}</style>
<div class="p-6 bg-slate-100" data-testid="count-badge-wrapper">${bodyHtml}</div>
`;
}

export const entry: ManifestEntry = {
  component: 'CountBadge',
  variant: 'react-mount-overflow',
  viewport: { width: 200, height: 100 },
  renderScope: 'single-instance',
  mode: 'rule',
  render: {
    kind: 'react-component',
    // count > max renders the capped "{max}+" display -- a real, non-trivial branch of the
    // actual production component, not just its simplest path.
    render: () => React.createElement(CountBadge, { count: 12, max: 9 }),
    documentTemplate,
  },
  rules: [
    // Color: the real bg-destructive/text-destructive-foreground tokens, read off the actual
    // mounted component's computed style.
    // hsl(0 84% 60%) -> rgb(239, 67, 67) (exact HSL->RGB conversion; not the #EF4444 approximation
    // the design token's own CSS comment uses).
    { kind: 'color', selector: '[data-testid="count-badge-wrapper"] span', cssProperty: 'backgroundColor', expectedToken: { name: 'bg-destructive', resolvedValue: 'rgb(239, 67, 67)' } },
    // Overflow: the badge must not clip its "9+" capped text at its fixed min-w/h footprint.
    {
      kind: 'sibling-dimension',
      selector: '[data-testid="count-badge-wrapper"] span',
      dimension: 'height',
    },
  ],
};

registerManifestEntry('count-badge:react-mount-overflow:200x100', entry);
