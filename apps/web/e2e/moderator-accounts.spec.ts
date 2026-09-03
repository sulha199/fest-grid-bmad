import { test, expect } from '@playwright/test';

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe('Moderator account profiles', () => {
  test('moderator happy path: opens accounts tools and toggles opt-in', async ({ page }) => {
    test.skip(!storageStatePath, 'Set E2E_AUTH_STORAGE_STATE to a moderator session to run the accounts flow.');

    await page.goto('http://localhost:3000/en');

    const profileTrigger = page.locator('nav[aria-label="Main"] button[aria-expanded]').last();
    await expect(profileTrigger).toBeVisible();
    await profileTrigger.click();

    const toolsLink = page.getByRole('link', { name: 'Moderator Tools' });
    await expect(toolsLink).toHaveAttribute('href', '/en/moderator/tools');
    await page.goto(await toolsLink.getAttribute('href')!);
    await expect(page).toHaveURL(/\/en\/moderator\/tools$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Moderator Tools' })).toBeVisible();

    await page.getByRole('button', { name: 'Accounts' }).click();

    await page.getByPlaceholder('Search by display name, username, or platform...').fill('jakarta');
    await page.keyboard.press('Enter');

    const checkbox = page.getByRole('checkbox').first();
    await expect(checkbox).toBeVisible();

    const isChecked = await checkbox.isChecked();
    await checkbox.click();

    if (isChecked) {
      await expect(page.getByText(/Successfully opted out/)).toBeVisible();
    } else {
      await expect(page.getByText(/Successfully opted in/)).toBeVisible();
    }
  });
});