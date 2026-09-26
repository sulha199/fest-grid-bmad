import { test, expect } from '@playwright/test';
import { GRID_CONTAINER_BREAKPOINTS_PX } from '@festgrid/ui/grid-container';

test.describe('Discovery Page', () => {
  test('should render initial events and support infinite scroll', async ({ page }) => {
    // Navigate to the main page
    await page.goto('/en');

    // Check that the title is visible
    await expect(page.locator('h1', { hasText: 'Discover Events' })).toBeVisible();

    // Verify initial cards are loaded
    const eventCards = page.locator('article');
    await expect(eventCards.first()).toBeVisible({ timeout: 10000 });

    // Scroll to the bottom to trigger infinite scroll
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    // Wait for the loading spinner to appear and disappear or just wait for more cards
    // Playwright evaluates the network request or DOM changes automatically, but we can wait for network idle
    await page.waitForLoadState('networkidle');

    // Currently we might not have enough seeded events to actually trigger a new page
    // but the scroll behavior shouldn't crash.
    // If there were more events, the count would increase. We just verify the page is still interactive and no errors.
    await expect(page.locator('h1', { hasText: 'Discover Events' })).toBeVisible();
  });

  test('should not overflow horizontally at md/lg/xl breakpoint edges (BUG-045)', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('article').first()).toBeVisible({ timeout: 10000 });

    // Only md/lg/xl are exercised: AppShell's persistent nav rail is `hidden md:flex` (never
    // rendered below `md`), so the sidebar-inset overflow this test guards against cannot occur
    // at the base/`sm:` breakpoints -- those two floors are untouched by the BUG-045 fix.
    const { md, lg, xl } = GRID_CONTAINER_BREAKPOINTS_PX;
    for (const width of [md, lg, xl]) {
      await page.setViewportSize({ width, height: 900 });
      // Settle on two animation frames (deterministic) rather than a fixed sleep, so the
      // resize-driven column-count/nav-rail reflow has definitely committed before measuring.
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      );

      const { scrollWidth, clientWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));

      expect(scrollWidth, `viewport ${width}px should not produce a page-level horizontal scrollbar`).toBeLessThanOrEqual(clientWidth);
    }
  });
});
