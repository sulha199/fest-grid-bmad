import { test, expect, type Locator, type Page } from '@playwright/test';
import { checkPopupContainment, measurePopup, settleLayout } from '@festgrid/visual-audit/page-overflow';

/**
 * Popups, dropdowns, dialogs and sheets must stay usable on small screens: the opened box fits the
 * viewport, and once scrolled to its end the last option is visible. (A popover taller than a phone
 * with no max-height used to hide its bottom categories.)
 *
 * Short viewports matter as much as narrow ones, so landscape phones are included.
 */

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 360, height: 640 },
  { width: 375, height: 667 },
  { width: 412, height: 915 },
  { width: 667, height: 375 },
];
/** Radix animates popups in (~150ms) and positions them after layout. */
const POPUP_SETTLE_MS = 500;

test.setTimeout(180_000);

interface PopupScenario {
  name: string;
  route: string;
  /** Opens the popup and returns its root element. */
  open: (page: Page) => Promise<Locator>;
  /** Session needed to reach the trigger. */
  session?: 'user' | 'moderator';
}

const POPOVER = '[data-radix-popper-content-wrapper] > [data-state="open"]';
const DIALOG = '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]';
const EVENT_ROUTE = '/en/events/ongoing-culture-fest-2026-2027-fixed';

const scenarios: PopupScenario[] = [
  {
    name: 'discovery: Type filter popover',
    route: '/en',
    open: async (page) => {
      await page.getByRole('button', { name: 'Type', exact: true }).click();
      return page.locator(POPOVER);
    },
  },
  {
    name: 'discovery: Category filter popover',
    route: '/en',
    open: async (page) => {
      await page.getByRole('button', { name: 'Category', exact: true }).click();
      return page.locator(POPOVER);
    },
  },
  {
    name: 'discovery: Filter with AI overlay',
    route: '/en',
    open: async (page) => {
      await page.getByRole('button', { name: 'Filter with AI' }).click();
      return page.locator(DIALOG).last();
    },
  },
  {
    name: 'calendar: week picker popover',
    route: '/en/my-calendar',
    session: 'user',
    open: async (page) => {
      await page.getByRole('button', { name: 'Select week' }).click();
      return page.locator(POPOVER);
    },
  },
  {
    name: 'account settings: Add API Key dialog',
    route: '/en/settings/account',
    session: 'user',
    open: async (page) => {
      await page.getByRole('button', { name: 'Add API Key' }).click();
      return page.locator(DIALOG).last();
    },
  },
  {
    name: 'widgets: Create Widget dialog',
    route: '/en/settings/widgets',
    session: 'user',
    open: async (page) => {
      await page.getByRole('button', { name: 'Create Widget' }).click();
      return page.locator(DIALOG).last();
    },
  },
  {
    name: 'event detail (moderator): Re-extract dialog',
    route: EVENT_ROUTE,
    session: 'moderator',
    open: async (page) => {
      await page.getByRole('button', { name: 'Re-extract' }).first().click();
      return page.locator(DIALOG).last();
    },
  },
  {
    name: 'moderator items: Delete Permanently confirmation',
    route: '/en/moderator/items',
    session: 'moderator',
    open: async (page) => {
      await page.getByRole('button', { name: 'Delete Permanently' }).first().click();
      return page.locator(DIALOG).last();
    },
  },
];

for (const scenario of scenarios) {
  test.describe(scenario.name, () => {
    const state = scenario.session === 'moderator' ? process.env.E2E_AUTH_MODERATOR_STORAGE_STATE : scenario.session === 'user' ? process.env.E2E_AUTH_USER_STORAGE_STATE : undefined;
    test.skip(scenario.session !== undefined && !state, 'Set E2E_FAKE_AUTH=1 (or a storage state) to run signed-in popups.');
    if (state) test.use({ storageState: state });

    test(`fits the viewport and every option is reachable on small screens`, async ({ page }) => {
      const failures: string[] = [];
      for (const viewport of VIEWPORTS) {
        await page.setViewportSize(viewport);
        await page.goto(scenario.route, { waitUntil: 'domcontentloaded' });
        await page.locator('main').waitFor();
        // Opening before hydration finishes would click a dead button.
        await settleLayout(page);
        const popup = await scenario.open(page);
        await expect(popup, `${scenario.name} should open`).toBeVisible();
        await page.waitForTimeout(POPUP_SETTLE_MS);
        const problems = checkPopupContainment(await measurePopup(page, popup));
        for (const problem of problems) failures.push(`${viewport.width}x${viewport.height}: ${problem}`);
        await page.keyboard.press('Escape');
      }
      expect(failures, 'popup containment problems').toEqual([]);
    });
  });
}
