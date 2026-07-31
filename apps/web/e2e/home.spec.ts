import { test, expect } from '@playwright/test';

test('has title and heading', async ({ page }) => {
  await page.goto('/');

  // Expect the page to render by finding the main heading.
  await expect(page.locator('h1', { hasText: 'FestGrid Design System Verification' })).toBeVisible();
});
