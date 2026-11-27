import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Accessibility ratchet in a real browser (project-context.md "Accessibility", rule 8): axe-core with the WCAG 2.0,
 * 2.1 and 2.2 A and AA rules, run on the pages the commitment covers (the event list, the event detail, the navbar and
 * the filter popups), at desktop and phone width, in the light and the dark theme. Unlike the jsdom suites in
 * `packages/ui/src/a11y`, a browser has layout, so this is where colour contrast and target size (WCAG 2.2, 2.5.8) are
 * judged on the painted page.
 *
 * It is a ratchet with two parts. (1) Every rule that is not in `a11y-baseline.json` must report zero elements in every
 * scenario: names, roles, ARIA validity, label in name, nested controls and the like cannot regress. (2) The rules that
 * are listed there are known, open findings (colour contrast of a few colours, and the favorite button that sits inside the
 * card's own button when a poster image fails to load); each may flag at most that many elements in one scenario. The caps are upper
 * bounds because the count moves with the clock (the "happening now" badge) and with the viewer-location banner, so a
 * per-scenario count would be flaky. Lower a cap when the finding is fixed. It does not prove WCAG conformance: axe
 * finds only part of the failures, and focus order and screen-reader output still need a person.
 */

const BASELINE_PATH = resolve(__dirname, 'a11y-baseline.json');
/** rule id -> the most elements one scenario may still flag for it (absent means zero). */
const baseline: Record<string, number> = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {};

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  phone: { width: 375, height: 812 },
} as const;
const THEMES = ['light', 'dark'] as const;

/**
 * next-themes reads the `theme` key from localStorage before the first paint and rewrites the <html> class on hydration,
 * so a class added after load is lost. Set the key before any navigation instead.
 */
async function useTheme(page: Page, theme: (typeof THEMES)[number]) {
  await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
}

async function audit(page: Page, scenario: string, include?: string) {
  let builder = new AxeBuilder({ page }).withTags(TAGS);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  const problems: string[] = [];
  for (const v of violations) {
    const max = baseline[v.id] ?? 0;
    if (v.nodes.length > max) {
      problems.push(
        `${v.id} (${v.impact}): ${v.nodes.length} element(s), ${max} allowed. ${v.help}\n` +
          v.nodes.slice(0, 6).map((n) => `    - ${n.target.join(' ')}: ${n.html.slice(0, 140)}`).join('\n'),
      );
    }
  }
  expect(problems, `\n${scenario}\n${problems.join('\n')}`).toEqual([]);
}

for (const [vpName, viewport] of Object.entries(VIEWPORTS)) {
  for (const theme of THEMES) {
    test.describe(`${vpName}, ${theme} theme`, () => {
      test.use({ viewport });

      test('event list (discovery page, navbar included)', async ({ page }) => {
        await useTheme(page, theme);
        await page.goto('/en');
        await expect(page.locator('article').first()).toBeVisible({ timeout: 15000 });
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^((?!dark).)*$/);
        await audit(page, `list ${vpName} ${theme}`);
      });

      test('event detail (modal)', async ({ page }) => {
        await useTheme(page, theme);
        await page.goto('/en');
        const firstCard = page.locator('article').first();
        await expect(firstCard).toBeVisible({ timeout: 15000 });
        // The first visit to the modal route can be slow on a cold server: retry the click until the dialog is there.
        await expect(async () => {
          if (!(await page.getByRole('dialog').isVisible())) await firstCard.click();
          await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
        }).toPass({ timeout: 40000 });
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^((?!dark).)*$/);
        await audit(page, `detail modal ${vpName} ${theme}`);
      });

      test('event detail (full page)', async ({ page }) => {
        await useTheme(page, theme);
        await page.goto('/en/events/ongoing-culture-fest-2026-2027-fixed');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^((?!dark).)*$/);
        await audit(page, `detail page ${vpName} ${theme}`);
      });
    });
  }
}

test.describe('popups (desktop, light)', () => {
  test.use({ viewport: VIEWPORTS.desktop });

  test('a filter dropdown, opened', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('article').first()).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Type', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Festival', exact: true })).toBeVisible();
    await audit(page, 'filter dropdown open desktop light');
  });

  test('the More actions menu on the event detail, opened', async ({ page }) => {
    await page.goto('/en/events/ongoing-culture-fest-2026-2027-fixed');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const more = page.getByRole('button', { name: 'More actions' });
    test.skip((await more.count()) === 0, 'no actions are offered to this viewer');
    await more.click();
    await expect(page.getByRole('menu')).toBeVisible();
    await audit(page, 'more actions menu open desktop light');
  });
});

test.describe('signed in (desktop, light)', () => {
  const storageState = process.env.E2E_AUTH_USER_STORAGE_STATE ?? process.env.E2E_AUTH_STORAGE_STATE;
  test.skip(!storageState, 'Set E2E_FAKE_AUTH=1 to run the signed-in scenarios.');
  test.use({ viewport: VIEWPORTS.desktop, storageState: storageState as string });

  test('navbar with the profile menu open', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator('article').first()).toBeVisible({ timeout: 15000 });
    // The profile trigger is the one button with a popup in the Main navigation (the mobile bar is hidden at this width).
    await page.locator('nav[aria-label="Main"] button[aria-haspopup="true"]:visible').first().click();
    await expect(page.getByTestId('user-menu').filter({ visible: true })).toBeVisible();
    await audit(page, 'profile menu open desktop light');
  });

  test('favorites page', async ({ page }) => {
    await page.goto('/en/favorites');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await audit(page, 'favorites desktop light');
  });
});
