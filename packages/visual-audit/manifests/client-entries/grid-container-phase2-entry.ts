/**
 * Browser-side entry for the `client-bundle` render of `grid-container-masonry-phase2.ts` (CC-030).
 * Bundled by esbuild (`src/render.ts`), never imported by Node. Mounts the REAL `GridContainer`
 * (`layout="masonry"`) client-side with fixed-height cards so the real measured phase (Phase 2:
 * absolutely positioned items) is reached -- the phase a server-rendered (`renderToStaticMarkup`)
 * fixture can never exercise.
 *
 * Sets `data-ready` on `<body>` once the container has switched to Phase 2 (`position: relative`).
 * `window.__GC_CANARY__` (set by the manifest's `beforeScript`) deliberately re-creates one of the
 * two CC-030 defects on the already-rendered DOM so a negative canary can prove each rule fails:
 *   - 'single-line-gridcolumn': item.style.gridColumn = "N" (auto end line -> stretches to the edge)
 *   - 'no-row-gap': removes the gap from each item's translateY (items touch)
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { GridContainer } from '@festgrid/ui/grid-container';

declare global {
  interface Window {
    __GC_CANARY__?: 'single-line-gridcolumn' | 'no-row-gap';
  }
}

const GAP_PX = 16; // `gap-4`

const CARD_HEIGHTS = [150, 90, 120, 200, 80, 140];

const cards = CARD_HEIGHTS.map((height, index) =>
  React.createElement(
    'div',
    {
      key: index,
      'data-testid': 'phase2-card',
      style: { height, background: '#e2e8f0', borderRadius: 12 },
    },
    `Card ${index}`
  )
);

const root = document.getElementById('root') as HTMLElement;
createRoot(root).render(
  React.createElement(GridContainer, { layout: 'masonry', baseCols: 2, colsStep: 1, gap: 'gap-4', className: 'p-4', children: cards })
);

function applyCanary(container: HTMLElement): void {
  const items = Array.from(container.querySelectorAll<HTMLElement>('[data-grid-container-item]'));
  if (window.__GC_CANARY__ === 'single-line-gridcolumn') {
    items.forEach((item) => {
      item.style.gridColumn = String(Number(item.getAttribute('data-grid-container-column-index')) + 1);
    });
  } else if (window.__GC_CANARY__ === 'no-row-gap') {
    const seenPerColumn = new Map<string, number>();
    items.forEach((item) => {
      const col = item.getAttribute('data-grid-container-column-index') ?? '0';
      const stackIndex = seenPerColumn.get(col) ?? 0;
      seenPerColumn.set(col, stackIndex + 1);
      const y = parseFloat(/translateY\(([-\d.]+)px\)/.exec(item.style.transform)?.[1] ?? '0');
      item.style.transform = `translateY(${y - stackIndex * GAP_PX}px)`;
    });
  }
}

function waitForPhase2(): void {
  const container = document.querySelector<HTMLElement>('[data-grid-container-layout="masonry"]');
  if (container && container.style.position === 'relative') {
    applyCanary(container);
    document.body.setAttribute('data-ready', '');
    return;
  }
  requestAnimationFrame(waitForPhase2);
}
waitForPhase2();
