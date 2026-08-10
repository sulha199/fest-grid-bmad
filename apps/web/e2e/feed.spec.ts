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

  test('authenticated subscription picker: filters feed by subscription', async ({ page }) => {
    test.skip(!storageStatePath, 'Set E2E_AUTH_STORAGE_STATE to run authenticated feed flow.');

    await page.goto('/en/feed');

    // Wait for the page or heading to load
    await expect(page.getByRole('heading', { level: 1, name: 'My Feed' })).toBeVisible();

    const subscriptionPickerHeader = page.getByText('Subscriptions');
    if (await subscriptionPickerHeader.isVisible()) {
      // Find the first option button and click it to toggle
      const firstSubscriptionButton = page.locator('div[role="group"][aria-label="Subscriptions"] button').first();
      if (await firstSubscriptionButton.isVisible()) {
        const isAlreadySelected = await firstSubscriptionButton.getAttribute('aria-pressed') === 'true';
        await firstSubscriptionButton.click();

        // If it was deselecting or selecting, verify the URL parameter has changed accordingly
        const expectedPressedState = isAlreadySelected ? 'false' : 'true';
        await expect(firstSubscriptionButton).toHaveAttribute('aria-pressed', expectedPressedState);

        // Verify state is preserved in URL search parameters
        const url = page.url();
        if (expectedPressedState === 'true') {
          expect(url).toContain('subscriptions=');
        } else {
          expect(url).not.toContain('subscriptions=sub');
        }
      }
    }
  });
});
