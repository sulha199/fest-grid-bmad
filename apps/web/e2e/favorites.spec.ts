import { test, expect } from '@playwright/test';

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe('Favorites page', () => {
  test('authenticated happy path: undo then commit unfavorite on navigate-away', async ({ page }) => {
    test.skip(!storageStatePath, 'Set E2E_AUTH_STORAGE_STATE to run authenticated favorites flow.');

    await page.goto('/en/favorites');

    await expect(page.getByRole('heading', { level: 1, name: 'My Favorites' })).toBeVisible();

    const firstCard = page.locator('article').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });

    const removeButton = firstCard.getByRole('button', { name: 'Remove from Favorites' });
    await removeButton.click();

    const undoButton = page.getByRole('button', { name: 'Undo' });
    await expect(undoButton).toBeVisible();
    await undoButton.click();

    // Undo restores the card: the pending-removal dimming (opacity-50) is gone.
    await expect(firstCard).not.toHaveClass(/opacity-50/);

    await removeButton.click();
    await page.goto('/en');
    await page.goto('/en/favorites');

    await expect(page.getByRole('heading', { level: 1, name: 'My Favorites' })).toBeVisible();
  });
});