import { test, expect } from '@playwright/test';

// Proves the full layout.tsx -> ScopedLocaleProvider -> AppShell -> next-intl
// translation-namespace chain actually works end-to-end in the real app when
// switching locale, not just in unit tests against the locale JSON files.
//
// Note: the story that authored this spec originally called for reading a
// rendered EventCard's category/type label on Discovery. That's not
// currently possible: Discovery's cards always use EventCard's "masonry"
// variant, which renders no category/type badges (only the "standard"
// variant does, and no page in the app uses it). The Filter Hub's
// Category/Type facet popovers on the same Discovery page DO render
// translated EventCategory/EventType labels and are already proven testable
// by filter.spec.ts's existing pattern, so this spec targets those instead --
// it still exercises the identical translation-resolution chain.
test.describe('Locale switching', () => {
  test('category facet label re-translates when switching locale', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('h1', { hasText: 'Discover Events' })).toBeVisible();

    await page.getByRole('button', { name: 'Category', exact: true }).click();
    const musicButtonEn = page.getByRole('button', { name: 'Music', exact: true });
    await expect(musicButtonEn).toBeVisible();

    await page.goto('/id');
    await expect(page.locator('h1')).toBeVisible();

    await page.getByRole('button', { name: 'Kategori', exact: true }).click();
    const musicButtonId = page.getByRole('button', { name: 'Musik', exact: true });
    await expect(musicButtonId).toBeVisible();
  });
});
