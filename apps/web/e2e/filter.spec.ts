import { test, expect } from '@playwright/test';

test.describe('Filter Hub', () => {
  test('should allow selecting type and category, update URL, and clear filters', async ({ page }) => {
    // Navigate to the main page
    await page.goto('/en');

    // Wait for the page to load
    await expect(page.locator('h1', { hasText: 'Discover Events' })).toBeVisible();

    // Open the Type facet and select Festival from its popover.
    await page.getByRole('button', { name: 'Type', exact: true }).click();
    const festivalButton = page.getByRole('button', { name: 'Festival', exact: true });
    await expect(festivalButton).toBeVisible();
    await festivalButton.click();

    // Verify URL updated with types=FESTIVAL
    await expect(page).toHaveURL(/types=FESTIVAL/);

    // Open the Category facet and select Music from its popover.
    await page.getByRole('button', { name: 'Category', exact: true }).click();
    const musicButton = page.getByRole('button', { name: 'Music', exact: true });
    await expect(musicButton).toBeVisible();
    await musicButton.click();

    // Verify URL updated with categories=MUSIC
    await expect(page).toHaveURL(/categories=MUSIC/);

    // Verify grid is updated (we might not have data matching exactly, but we verify it's interactive)
    // Wait for network idle to ensure query finished
    await page.waitForLoadState('networkidle');

    // Close the open popover (an outside click) so the row-level clear action is unambiguous.
    await page.locator('h1', { hasText: 'Discover Events' }).click();
    const clearButton = page.getByRole('main').getByRole('button', { name: 'Clear filters', exact: true });
    await expect(clearButton).toBeVisible();
    await clearButton.click();

    // Verify URL is cleared
    await expect(page).not.toHaveURL(/types=/);
    await expect(page).not.toHaveURL(/categories=/);
  });
});
