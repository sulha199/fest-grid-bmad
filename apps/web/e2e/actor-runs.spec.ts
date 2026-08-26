import { test, expect } from '@playwright/test';

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe('Moderator actor runs', () => {
  test('moderator happy path: opens a stored run and replays it', async ({ page }) => {
    test.skip(!storageStatePath, 'Set E2E_AUTH_STORAGE_STATE to a moderator session to run the actor-runs flow.');

    await page.goto('http://localhost:3000/en');

    const profileTrigger = page.locator('nav[aria-label="Main"] button[aria-expanded]').last();
    await expect(profileTrigger).toBeVisible();
    await profileTrigger.click();

    const actorRunsLink = page.getByRole('link', { name: 'Moderator Tools' });
    await expect(actorRunsLink).toHaveAttribute('href', '/en/moderator/tools');
    await page.goto(await actorRunsLink.getAttribute('href')!);
    await expect(page).toHaveURL(/\/en\/moderator\/tools$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Moderator Tools' })).toBeVisible();

    await page.locator('select').first().selectOption('APIFY');
    await expect(page.getByText(/E2E-ACTOR-RUN-001/)).toBeVisible();

    await page.getByRole('button', { name: 'View details' }).click();
    await expect(page.getByText('Raw Input')).toBeVisible();
    await expect(page.getByText('Raw Output')).toBeVisible();

    await page.getByRole('button', { name: 'Replay' }).click();
    await expect(page.getByText(/Replay complete/)).toBeVisible();
  });
});