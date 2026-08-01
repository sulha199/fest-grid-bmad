import { test, expect } from '@playwright/test';

test.describe('Filter Hub', () => {
  test('should allow selecting type and category, update URL, and clear filters', async ({ page }) => {
    // Navigate to the main page
    await page.goto('/en');

    // Wait for the page to load
    await expect(page.locator('h1', { hasText: 'Discover Events' })).toBeVisible();

    // Select a Type filter (e.g. Festival)
    const festivalButton = page.locator('button', { hasText: 'Festival' });
    await expect(festivalButton).toBeVisible();
    await festivalButton.click();

    // Verify URL updated with types=FESTIVAL
    await expect(page).toHaveURL(/types=FESTIVAL/);

    // Select a Category filter (e.g. Music)
    const musicButton = page.locator('button', { hasText: 'Music' });
    await expect(musicButton).toBeVisible();
    await musicButton.click();

    // Verify URL updated with categories=MUSIC
    await expect(page).toHaveURL(/categories=MUSIC/);

    // Verify grid is updated (we might not have data matching exactly, but we verify it's interactive)
    // Wait for network idle to ensure query finished
    await page.waitForLoadState('networkidle');

    // Clear filters
    const clearButton = page.locator('button', { hasText: 'Clear filters' });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Verify URL is cleared
    await expect(page).not.toHaveURL(/types=/);
    await expect(page).not.toHaveURL(/categories=/);
  });
});
