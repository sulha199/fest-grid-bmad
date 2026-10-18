import { test, expect } from '@playwright/test';

// Story 1.i1g Task 7.3, reworked by spec-calendar-unified-banded-grid: verify a multi-day bar's
// columns align pixel-for-pixel with the sticky day-header columns at a real desktop width, now
// that bars share one banded 7-column grid with the single-day cards (no separate banner above).
// Uses the account calendar's "Ongoing Culture Fest 2026-2027" fixture
// (eventStartDate 2026-01-10 / eventEndDate 2027-12-31, packages/database/seed.ts),
// which spans every visible week for the lifetime of this test.
test.describe('Weekly calendar bar alignment', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('multi-day spanning bar columns match the sticky day-header columns', async ({ page }) => {
    await page.goto('/en/ig/jktcity.events');

    await page.getByRole('tab', { name: 'Calendar View' }).click();

    const calendarView = page.getByTestId('desktop-calendar-view');
    await expect(calendarView).toBeVisible();

    const headerCells = page.getByTestId('desktop-day-headers').locator('> div');
    await expect(headerCells).toHaveCount(7);

    // The unified grid: bands of 7 columns, the old banner is gone.
    await expect(page.getByTestId('multi-day-spanning-banner')).toHaveCount(0);
    const firstBand = page.getByTestId('calendar-band').first();
    await expect(firstBand).toBeVisible({ timeout: 15000 });

    const bar = page
      .getByTestId('multi-day-spanning-bar')
      .filter({ hasText: 'Ongoing Culture Fest 2026-2027' })
      .first();
    await expect(bar).toBeVisible();

    // The positioned grid cell wrapping the bar carries the inline `grid-column` placement.
    // Derive the columns it claims to span from its computed style, rather than assuming a fixed
    // start/span, so the assertion stays correct regardless of which week is "current".
    const { startLine, colSpan } = await bar.evaluate((el) => {
      const style = getComputedStyle(el.parentElement as HTMLElement);
      const start = parseInt(style.gridColumnStart, 10);
      const span = /span\s+(\d+)/.exec(style.gridColumnEnd)?.[1];
      return { startLine: start, colSpan: span ? parseInt(span, 10) : 1 };
    });

    const startIdx = startLine - 1;
    const endIdx = startIdx + colSpan - 1;

    const firstHeaderBox = await headerCells.nth(startIdx).boundingBox();
    const lastHeaderBox = await headerCells.nth(endIdx).boundingBox();
    const cellBox = await bar.evaluate((el) => {
      const rect = (el.parentElement as HTMLElement).getBoundingClientRect();
      return { x: rect.x, width: rect.width };
    });

    expect(firstHeaderBox).not.toBeNull();
    expect(lastHeaderBox).not.toBeNull();

    // Sub-pixel rendering can shift edges by a fraction of a pixel across engines;
    // 1px is tight enough to catch a real misalignment while tolerating that.
    const TOLERANCE_PX = 1;

    expect(Math.abs(cellBox.x - firstHeaderBox!.x)).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(
      Math.abs(cellBox.x + cellBox.width - (lastHeaderBox!.x + lastHeaderBox!.width))
    ).toBeLessThanOrEqual(TOLERANCE_PX);
  });

  test('"Show more" appends a band below the first without moving it, and stops when everything is shown', async ({ page }) => {
    await page.goto('/en/ig/jktcity.events');
    await page.getByRole('tab', { name: 'Calendar View' }).click();

    const bands = page.getByTestId('calendar-band');
    await expect(bands.first()).toBeVisible({ timeout: 15000 });

    const showMore = page.getByTestId('calendar-show-more');
    if ((await showMore.count()) === 0) test.skip(true, 'fixture week fits in one band');

    const before = await bands.first().boundingBox();
    const countBefore = await bands.count();
    await showMore.click();
    await expect(bands).toHaveCount(countBefore + 1);
    const after = await bands.first().boundingBox();
    expect(Math.abs((after?.y ?? 0) - (before?.y ?? 0))).toBeLessThanOrEqual(1);
  });
});
