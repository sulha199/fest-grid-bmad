import { test, expect, type Locator, type Page } from '@playwright/test';
import { checkPopupContainment, measurePopup, settleLayout } from '@festgrid/visual-audit/page-overflow';
import { FIXTURE_JOB_IDS } from '../../../packages/database/seed';
import { blockReextractWrites } from './reextract-guard';

/**
 * Popups, dropdowns, dialogs and sheets must stay usable on small screens: the opened box fits the
 * viewport, and once scrolled to its end the last option is visible. (A popover taller than a phone
 * with no max-height used to hide its bottom categories.)
 *
 * Short viewports matter as much as narrow ones, so landscape phones are included.
 *
 * The seeded finished previews are young (finished 2 to 3 minutes before the seed) and the chip and Apply windows are 30 minutes: global setup re-seeds before every
 * run, but a spec started more than about 25 minutes after that seed will find chips and previews gone. Re-seed (start the run again) before each run.
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
// Radix dialogs carry data-state; the AI filter overlay is hand-rolled (role only). Closed Radix dialogs unmount.
const DIALOG = '[role="dialog"], [role="alertdialog"]';
/** Every blocked Re-extract write of a scenario lands here; the test asserts it stays empty (a blocked write would otherwise pass silently). */
const attemptedWrites: string[] = [];
const EVENT_ROUTE = '/en/events/ongoing-culture-fest-2026-2027-fixed';

/**
 * Story 10.3a (show the subscription cap refusal and the upgrade call to action): answers the SubscribeToAccount operation with the typed
 * cap refusal and never lets it reach the server (a real fifth subscribe would start the classify-then-scrape cascade, a vendor call).
 */
async function routeCapRefusal(page: Page): Promise<void> {
  await page.route('**/api/graphql', async (route) => {
    const post = route.request().postDataJSON() as { operationName?: string; query?: string } | null;
    if (post?.operationName !== 'SubscribeToAccount' && !/mutation\s+SubscribeToAccount\b/.test(post?.query ?? '')) return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: null, errors: [{ message: 'Subscription limit reached', extensions: { code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 4, reservedCount: 1, cap: 5 } }] }),
    });
  });
}

/** Presses the source account's toggle of the event page (never when it would unsubscribe a real subscription) and returns the cap dialog. */
async function openEventCapDialog(page: Page): Promise<Locator> {
  await routeCapRefusal(page);
  const toggle = page.getByTestId('subscribe-toggle').first();
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  await expect(toggle, 'the seeded user must not hold this account (a click would unsubscribe)').toHaveAttribute('aria-pressed', 'false');
  await toggle.click();
  const dialog = page.getByTestId('subscription-cap-dialog');
  await expect(dialog.getByTestId('subscription-cap-notice')).toBeVisible();
  return dialog;
}

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
    session: 'user', // the AI filter is only offered to signed-in viewers
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
    // The modal a card click opens (an intercepted route), not the direct page: its content sits in a
    // single-column grid, where one wide child used to stretch the whole column past the screen.
    name: 'event detail modal (moderator): content and Re-extract control',
    route: '/en',
    session: 'moderator',
    open: async (page) => {
      await page.locator('article h3').first().click();
      await page.waitForURL(/\/en\/events\//);
      // Story 10.6a: a source post with a recent job of the moderator shows its chip instead of the button (the seed has such rows).
      await expect(page.getByRole('button', { name: 'Re-extract' }).or(page.getByTestId('job-chip')).first()).toBeVisible({ timeout: 30_000 });
      return page.locator(DIALOG).last();
    },
  },
  {
    // Story 10.4: the shared job progress dialog, on the e2e-only fixture page (no start point mounts it until the adoption stories): an open
    // job (Minimize) and the tallest ended state (a failed job with Retry, a result link and a refusal notice) with a very long handle.
    name: 'job progress dialog: open job (fixture page)',
    route: '/en/test-job-progress',
    session: 'user',
    open: async (page) => {
      await page.getByRole('button', { name: 'Open running job' }).click();
      return page.getByTestId('job-progress-dialog');
    },
  },
  {
    name: 'job progress dialog: failed job with Retry, result link and notice (fixture page)',
    route: '/en/test-job-progress',
    session: 'user',
    open: async (page) => {
      await page.getByRole('button', { name: 'Open failed job' }).click();
      const dialog = page.getByTestId('job-progress-dialog');
      await expect(dialog.getByRole('button', { name: 'Retry' })).toBeVisible();
      return dialog;
    },
  },
  {
    // Story 10.3a: the Subscribe dialog with the cap notice inline, in Indonesian (the longest sentence), at every popup viewport.
    name: 'account settings: Subscribe dialog with the cap notice (Indonesian)',
    route: '/id/settings/account?tab=subscriptions',
    session: 'user',
    open: async (page) => {
      await routeCapRefusal(page);
      await page.getByRole('button', { name: 'Berlangganan Akun' }).first().click();
      const dialog = page.getByRole('dialog');
      const field = dialog.getByPlaceholder('misal, jkt_festivals');
      await field.fill('an_account_with_a_really_long_handle_name_for_wrapping_checks');
      // Enter, not a click: the voted-account suggestion list under the field sits over the Subscribe button.
      await field.press('Enter');
      await expect(dialog.getByTestId('subscription-cap-notice')).toBeVisible();
      return dialog;
    },
  },
  {
    // Story 10.3a: the small cap dialog of the event page toggle, on the direct page and in the modal a card click opens.
    name: 'event detail page: cap dialog from the subscribe toggle (direct page)',
    route: EVENT_ROUTE,
    session: 'user',
    open: openEventCapDialog,
  },
  {
    name: 'event detail modal: cap dialog from the subscribe toggle',
    route: '/en',
    session: 'user',
    open: async (page) => {
      await page.locator('article h3').first().click();
      await page.waitForURL(/\/en\/events\//);
      return openEventCapDialog(page);
    },
  },
  {
    // Story 10.6a (show the Re-extract progress, the missing-images banner and Retry): the Re-extract dialog is opened from the chip of a SEEDED job
    // (the tallest content: the banner with the missing images, the cause, Retry and the preview). The old scenario clicked Re-extract, which would start a
    // real job: e2e never clicks Re-extract, Retry or Apply, and the writes are blocked behind that rule.
    name: 'event detail (moderator): Re-extract dialog from a seeded job chip',
    route: EVENT_ROUTE,
    session: 'moderator',
    open: async (page) => {
      await blockReextractWrites(page, attemptedWrites);
      const chip = page.getByTestId('job-chip').first();
      await expect(chip).toBeVisible({ timeout: 30_000 });
      await chip.click();
      const dialog = page.getByTestId('job-progress-dialog');
      await expect(dialog.getByTestId('reextract-images-warning')).toBeVisible({ timeout: 30_000 });
      return dialog;
    },
  },
  {
    // An open job: the stepper view of the same dialog.
    name: 'event detail (moderator): Re-extract dialog of a running job (seeded chip)',
    route: '/en/events/past-jazz-night-2025-fixed',
    session: 'moderator',
    open: async (page) => {
      await blockReextractWrites(page, attemptedWrites);
      const chip = page.getByTestId('job-chip').first();
      await expect(chip).toBeVisible({ timeout: 30_000 });
      await chip.click();
      const dialog = page.getByTestId('job-progress-dialog');
      await expect(dialog.getByRole('list', { name: 'Steps' })).toBeVisible();
      return dialog;
    },
  },
  {
    // The same dialog opened from "Open the preview" on a job's own page.
    name: 'job page (moderator): Open the preview dialog',
    route: `/en/jobs/${FIXTURE_JOB_IDS.moderatorPreviewLimits}`,
    session: 'moderator',
    open: async (page) => {
      await blockReextractWrites(page, attemptedWrites);
      await page.getByTestId('job-open-preview').click();
      const dialog = page.getByTestId('job-progress-dialog');
      await expect(dialog.getByTestId('reextract-images-warning')).toBeVisible({ timeout: 30_000 });
      return dialog;
    },
  },
  {
    // Story 10.13 (notify when a job finishes): the profile menu with the Jobs badge. The count is routed (99 ended jobs, the largest the server
    // returns) so the "9+" bubble and the longest sentence are measured whatever the seed's watermark is; nothing reaches the server for it.
    name: 'profile menu (user): the Jobs entry with a badge',
    route: '/en/feed',
    session: 'user',
    open: async (page) => {
      await page.route('**/api/graphql', async (route) => {
        const post = route.request().postDataJSON() as { operationName?: string; query?: string } | null;
        if (post?.operationName !== 'jobsFinishedSinceLastOpened' && !/query\s+jobsFinishedSinceLastOpened\b/.test(post?.query ?? '')) return route.fallback();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { jobsFinishedSinceLastOpened: 99 } }) });
      });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('nav[aria-label="Main"] button[aria-expanded]:visible').last().click();
      const menu = page.getByTestId('user-menu').filter({ visible: true });
      await expect(menu.getByRole('link', { name: /^Jobs/ })).toHaveAccessibleName('Jobs 99 jobs finished since you last looked', { timeout: 30_000 });
      // The menu's list is its scroll container (the header stays put); it is the box that must fit and reach Log Out.
      return menu.locator('ul');
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
      expect(attemptedWrites, 'e2e must never start a re-extract, tap Retry or tap Apply').toEqual([]);
      expect(failures, 'popup containment problems').toEqual([]);
    });
  });
}
