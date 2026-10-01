/**
 * BUG-050 (AC-GRID-1) real-browser geometry proof. Code-review follow-up (Blind Hunter,
 * 2026-09-26): the fix's own load-bearing claim -- "GridColumnGuides' 7 markers land
 * pixel-identical to the day-header row's 7 cells" -- is a real-layout (bounding-box) fact that
 * jsdom cannot check (jsdom does no layout), so `WeeklyCalendarView.test.tsx`'s jsdom coverage can
 * only prove markup shape (right classes/testid/child count), not the actual visual defect this
 * bug was about. This file closes that gap with a real Playwright/Chromium render, committed and
 * repeatable (`pnpm test:manifests`), instead of the throwaway ad hoc script the fix was
 * originally verified with.
 *
 * Reuses this package's own `mountManifestEntry`/`getElementSnapshots` helpers directly (same
 * relative-import style `manifests-proof.spec.ts` already uses for `./src/*`) rather than
 * registering a new manifest entry: no existing `Rule` kind (`sibling-dimension`,
 * `intra-box-ratio`, `overflow`, `color`, `placement-order`) checks pairwise x-position parity
 * between two different selector sets across two different rows, and adding one is out of scope
 * for a single bugfix's proof (see spec-bug-050-calendar-desktop-gridlines.md's Design Notes).
 */

import { test, expect } from '@playwright/test';
import React from 'react';
import { mountManifestEntry } from './src/render.js';
import { getElementSnapshots } from './src/compare/computed-style.js';
import type { ManifestEntry } from './src/manifest.js';
import type { WeeklyCalendarViewScheduleShape } from '../ui/src/features/events/WeeklyCalendarView.types.js';
// Raw relative filesystem import, not `@festgrid/ui`'s package exports map -- no subpath is
// declared for `WeeklyCalendarView` there. Safe here: this test only reads the real component's
// rendered DOM/computed styles, the same "mount the actual production component" mechanism every
// other manifest in this package already uses for its own package's components.
// `.js` extension (not `.tsx`) is deliberate: this repo's `NodeNext` TypeScript convention maps a
// relative specifier's *output* extension back to the real `.ts`/`.tsx` source file for
// type-checking (same pattern `manifests-proof.spec.ts` already uses for `./src/engine.js`, a real
// `.ts` file) -- writing the literal `.tsx` extension instead is a hard `tsc` error
// (`allowImportingTsExtensions` is not enabled in this package's `tsconfig.json`).
import { WeeklyCalendarView } from '../ui/src/features/events/WeeklyCalendarView.js';

const noop = () => {};

const baseProps = {
  weekStart: '2026-08-03', // Monday
  onToday: noop,
  onPrevWeek: noop,
  onNextWeek: noop,
  onScheduleClick: noop,
  status: 'success' as const,
  locale: 'en-US',
  maxEventsPerDay: -1,
};

function buildEntry(schedules: WeeklyCalendarViewScheduleShape[], variant: string): ManifestEntry {
  return {
    component: 'WeeklyCalendarView',
    variant,
    viewport: { width: 1100, height: 500 },
    renderScope: 'single-instance',
    mode: 'rule',
    rules: [],
    render: {
      kind: 'react-component',
      render: () => React.createElement(WeeklyCalendarView, { ...baseProps, schedules }),
    },
  };
}

const HEADER_CELL_SELECTOR = '[data-testid="desktop-calendar-view"] > div:first-child > div';
const GUIDE_MARKER_SELECTOR = '[data-testid="grid-column-guides"] > div';

test.describe('BUG-050 (AC-GRID-1): spanning-banner gridlines align pixel-exact with the day-header row', () => {
  test('one multi-day schedule spanning columns 2-4: all 7 column boundaries match within 1px', async ({ page }) => {
    const schedules = [
      {
        id: 'md-1',
        eventSlug: 'multi-fest',
        eventName: 'Multi-Day Fest',
        isMainSchedule: true,
        eventStartDate: '2026-08-04', // Tue
        eventEndDate: '2026-08-06', // Thu -> columns 2-4 (0-idx 1-3)
        eventStartTime: '10:00:00',
      },
      {
        id: 'single-1',
        eventSlug: 'single-show',
        eventName: 'Single Day Show',
        isMainSchedule: true,
        eventStartDate: '2026-08-07', // Fri
        eventEndDate: '2026-08-07',
        eventStartTime: '19:00:00',
      },
    ];

    await mountManifestEntry(page, buildEntry(schedules, 'with-multiday'));
    await page.waitForSelector('[data-testid="desktop-calendar-view"]');

    await expect(page.locator('[data-testid="multi-day-spanning-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="grid-column-guides"]')).toHaveCount(1);

    const headers = await getElementSnapshots(page, HEADER_CELL_SELECTOR);
    const guides = await getElementSnapshots(page, GUIDE_MARKER_SELECTOR);

    expect(headers).toHaveLength(7);
    expect(guides).toHaveLength(7);

    for (let i = 0; i < 7; i++) {
      const delta = Math.abs(headers[i].boundingBox.x - guides[i].boundingBox.x);
      expect(delta, `column ${i} x-position delta`).toBeLessThanOrEqual(1);
    }
  });

  test('two stacked overlapping multi-day schedules: single guide overlay spans the full stacked-banner height', async ({ page }) => {
    const schedules = [
      {
        id: 'md-late',
        eventSlug: 'late-fest',
        eventName: 'Late Fest',
        isMainSchedule: false,
        eventStartDate: '2026-08-06',
        eventEndDate: '2026-08-08',
        eventStartTime: '10:00:00',
      },
      {
        id: 'md-early',
        eventSlug: 'early-fest',
        eventName: 'Early Fest',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-07',
        eventStartTime: '09:00:00',
      },
    ];

    await mountManifestEntry(page, buildEntry(schedules, 'stacked-multiday'));
    await page.waitForSelector('[data-testid="desktop-calendar-view"]');

    const banner = page.locator('[data-testid="multi-day-spanning-banner"]');
    const guide = page.locator('[data-testid="grid-column-guides"]');
    await expect(guide).toHaveCount(1);

    const [bannerSnap] = await getElementSnapshots(page, '[data-testid="multi-day-spanning-banner"]');
    const [guideSnap] = await getElementSnapshots(page, '[data-testid="grid-column-guides"]');

    // BUG-050 review finding (Blind Hunter): the riskiest case for the "one overlay, `inset-0`"
    // design is exactly this one -- 2+ schedules stacked into separate grid-row tracks inside the
    // same banner. The overlay must cover the WHOLE stacked banner's height, not just one sub-row.
    expect(guideSnap.boundingBox.height).toBeGreaterThanOrEqual(bannerSnap.boundingBox.height - 1);

    const headers = await getElementSnapshots(page, HEADER_CELL_SELECTOR);
    const guides = await getElementSnapshots(page, GUIDE_MARKER_SELECTOR);
    for (let i = 0; i < 7; i++) {
      const delta = Math.abs(headers[i].boundingBox.x - guides[i].boundingBox.x);
      expect(delta, `column ${i} x-position delta`).toBeLessThanOrEqual(1);
    }

    void banner; // presence already asserted via bannerSnap above
  });

  test('no multi-day schedules: banner/guide overlay absent, header/day-cell rows unaffected', async ({ page }) => {
    const schedules = [
      {
        id: 'single-2',
        eventSlug: 'single-show-2',
        eventName: 'Another Single Day Show',
        isMainSchedule: true,
        eventStartDate: '2026-08-05',
        eventEndDate: '2026-08-05',
        eventStartTime: '12:00:00',
      },
    ];

    await mountManifestEntry(page, buildEntry(schedules, 'without-multiday'));
    await page.waitForSelector('[data-testid="desktop-calendar-view"]');

    await expect(page.locator('[data-testid="multi-day-spanning-banner"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="grid-column-guides"]')).toHaveCount(0);

    const headers = await getElementSnapshots(page, HEADER_CELL_SELECTOR);
    expect(headers).toHaveLength(7);
  });
});
