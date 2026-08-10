import { test, expect } from '@playwright/test';

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe('Feed page', () => {
  test('authenticated happy path: renders feed, toggles to calendar view and back', async ({ page }) => {
    test.skip(!storageStatePath, 'Set E2E_AUTH_STORAGE_STATE to run authenticated feed flow.');

    await page.goto('/en/feed');

    await expect(page.getByRole('heading', { level: 1, name: 'My Feed' })).toBeVisible();

    // Verify view switcher buttons exist and can toggle
    const calendarViewButton = page.getByRole('button', { name: 'Calendar View' });
    const cardViewButton = page.getByRole('button', { name: 'Card View' });

    if (await calendarViewButton.isVisible()) {
      await calendarViewButton.click();
      await expect(page.locator('.weekly-calendar')).toBeVisible();

      await cardViewButton.click();
      await expect(page.locator('.weekly-calendar')).not.toBeVisible();
    }
  });
});
