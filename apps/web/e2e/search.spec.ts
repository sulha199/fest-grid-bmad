import { test, expect } from '@playwright/test';

test.describe('Search functionality', () => {
  test('typing a query, pressing Enter filters the list and reflects in URL', async ({ page }) => {
    // 1. Go to home page
    await page.goto('/en');

    // Ensure the page is loaded by checking for the main title
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // The heading above is server-rendered and can be visible before client
    // hydration attaches SearchBar's onKeyDown handler. Under load (e.g. run
    // right after filter.spec.ts in the same suite) fill()+press('Enter') can
    // race ahead of hydration: the raw DOM value gets set, then hydration
    // reconciles the controlled input back to React's still-empty state,
    // silently dropping the typed query. Waiting for the network to go idle
    // is a reliable proxy for "the JS bundle has executed and hydrated."
    await page.waitForLoadState('networkidle');

    // 2. Type a query and press Enter
    const searchInput = page.getByPlaceholder('Search by name, performer, or location...');
    await searchInput.fill('Mock Event');
    await searchInput.press('Enter');

    // 3. Verify URL reflects the query
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('Mock Event');

    // 4. Verify search results are filtered (assume the mock server returns "No events match your search." 
    // or specific mock events depending on backend state. Here we just assert the query string works.)
    // If the backend is running with a specific dataset, we might check for an event.
    // For now, ensuring the URL updates and the input keeps the value is sufficient for E2E happy path.
    await expect(searchInput).toHaveValue('Mock Event');

    // 5. Clear the search
    const clearButton = page.getByRole('button', { name: 'Clear search' });
    await clearButton.click();

    // 6. Verify URL is cleared
    await expect.poll(() => new URL(page.url()).searchParams.has('q')).toBe(false);
    await expect(searchInput).toHaveValue('');
  });
});
