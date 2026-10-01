import { test, expect } from '@playwright/test';

// Story 1.i1g, Task 7.3: verify the multi-day spanning banner row's columns align
// pixel-for-pixel with the day-header and day-cell grids at a real desktop width.
// Uses the account calendar's "Ongoing Culture Fest 2026-2027" fixture
// (eventStartDate 2026-01-10 / eventEndDate 2027-12-31, packages/database/seed.ts),
// which spans every visible week for the lifetime of this test.
test.describe('Weekly calendar banner alignment', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('multi-day spanning bar columns match the day-header and day-cell grids', async ({ page }) => {
    await page.goto('/en/ig/ig_jkt_events');

    await page.getByRole('tab', { name: 'Calendar View' }).click();

    const calendarView = page.getByTestId('desktop-calendar-view');
    await expect(calendarView).toBeVisible();

    const headerGrid = calendarView.locator('> div').first();
    const headerCells = headerGrid.locator('> div');
    await expect(headerCells).toHaveCount(7);

    const banner = page.getByTestId('multi-day-spanning-banner');
    await expect(banner).toBeVisible({ timeout: 15000 });

    const dayCellGrid = banner.locator('xpath=following-sibling::div[1]');
    const dayCells = dayCellGrid.locator('> div');
    await expect(dayCells).toHaveCount(7);

    const bar = page
      .getByTestId('multi-day-spanning-bar')
      .filter({ hasText: 'Ongoing Culture Fest 2026-2027' })
      .first();
    await expect(bar).toBeVisible();

    // Derive the columns the bar actually claims to span from its own inline
    // `grid-column` styling, rather than assuming a fixed start/span, so the
    // assertion stays correct regardless of which week is "current" when this runs.
    const { startLine, colSpan } = await bar.evaluate((el) => {
      const style = getComputedStyle(el);
      const start = parseInt(style.gridColumnStart, 10);
      const rawSpan = style.gridColumnEnd; // e.g. "span 7"
      const span = /span\s+(\d+)/.exec(rawSpan)?.[1];
      return { startLine: start, colSpan: span ? parseInt(span, 10) : 1 };
    });

    const startIdx = startLine - 1;
    const endIdx = startIdx + colSpan - 1;

    const firstHeaderBox = await headerCells.nth(startIdx).boundingBox();
    const lastHeaderBox = await headerCells.nth(endIdx).boundingBox();
    const firstDayCellBox = await dayCells.nth(startIdx).boundingBox();
    const lastDayCellBox = await dayCells.nth(endIdx).boundingBox();
    const barBox = await bar.boundingBox();

    expect(firstHeaderBox).not.toBeNull();
    expect(lastHeaderBox).not.toBeNull();
    expect(firstDayCellBox).not.toBeNull();
    expect(lastDayCellBox).not.toBeNull();
    expect(barBox).not.toBeNull();

    // Sub-pixel rendering can shift edges by a fraction of a pixel across engines;
    // 1px is tight enough to catch a real misalignment while tolerating that.
    const TOLERANCE_PX = 1;

    expect(Math.abs(barBox!.x - firstHeaderBox!.x)).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(
      Math.abs(barBox!.x + barBox!.width - (lastHeaderBox!.x + lastHeaderBox!.width))
    ).toBeLessThanOrEqual(TOLERANCE_PX);

    expect(Math.abs(barBox!.x - firstDayCellBox!.x)).toBeLessThanOrEqual(TOLERANCE_PX);
    expect(
      Math.abs(barBox!.x + barBox!.width - (lastDayCellBox!.x + lastDayCellBox!.width))
    ).toBeLessThanOrEqual(TOLERANCE_PX);
  });
});
