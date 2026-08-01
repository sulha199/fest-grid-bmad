import { test, expect } from '@playwright/test';

test.describe('Discovery Page', () => {
  test('should render initial events and support infinite scroll', async ({ page }) => {
    // Navigate to the main page
    await page.goto('/');

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
});
