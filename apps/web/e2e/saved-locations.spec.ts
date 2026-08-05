import { test, expect } from '@playwright/test';

const storageStatePath = process.env.E2E_AUTH_STORAGE_STATE;
if (storageStatePath) {
  test.use({ storageState: storageStatePath });
}

test.describe('My Locations page', () => {
  test('authenticated happy path: add, edit, soft delete, undo, hard delete on navigate-away', async ({ page }) => {
    test.skip(!storageStatePath, 'Set E2E_AUTH_STORAGE_STATE to run authenticated locations flow.');

    await page.goto('/en/settings/locations');

    await expect(page.getByRole('heading', { level: 1, name: 'My Locations' })).toBeVisible();

    // 1. Click "Add a New Location"
    const addButton = page.getByRole('button', { name: 'Add a New Location' }).first();
    await addButton.click();

    // 2. Type Name
    await page.getByLabel('Name').fill('Home');

    // 3. Type Address and select autocomplete
    await page.getByLabel('Address').fill('Springfield');
    const suggestion = page.locator('button:has-text("Springfield")').first();
    await expect(suggestion).toBeVisible({ timeout: 10000 });
    await suggestion.click();

    // 4. Save
    await page.getByRole('button', { name: 'Save' }).click();

    // 5. Verify it appears in the list
    await expect(page.getByText('Home')).toBeVisible();

    // 6. Edit its radius
    const editButton = page.getByLabel('Edit').first();
    await editButton.click();

    await page.getByLabel('Radius').fill('15'); // 15 km
    await page.getByRole('button', { name: 'Save' }).click();

    // Verify updated radius
    await expect(page.getByText('15 km')).toBeVisible();

    // 7. Delete with Undo
    const deleteButton = page.getByLabel('Delete').first();
    await deleteButton.click();

    const undoButton = page.getByRole('button', { name: 'Undo' });
    await expect(undoButton).toBeVisible();
    await undoButton.click();

    // Still present
    await expect(page.getByText('Home')).toBeVisible();

    // 8. Delete again and navigate away
    await deleteButton.click();
    await page.goto('/en');

    // Revisit the page -> gone
    await page.goto('/en/settings/locations');
    await expect(page.getByText('Home')).not.toBeVisible();
  });
});
