import { test, expect, type Page } from '@playwright/test';
import { FIXTURE_JOB_IDS } from '../../../packages/database/seed';
import { blockReextractWrites } from './reextract-guard';

/**
 * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry) -- the Re-extract screens against the Re-extract jobs the e2e seed
 * creates for the moderator fixture user (`packages/database/seed.ts`, FIXTURE_JOBS). Signed-in specs need `E2E_FAKE_AUTH=1` on a local stack (or saved
 * storage states) and skip without one.
 *
 * Nothing here starts a re-extract, taps Retry or taps Apply: each would start a vendor scrape or invoke a Lambda. The scenarios open the chips and
 * the dialogs of the seeded jobs and read what they show; `blockReextractWrites` is the net behind that rule and every test asserts it caught nothing.
 */

const moderatorState = process.env.E2E_AUTH_MODERATOR_STORAGE_STATE;
const JOB_ID = FIXTURE_JOB_IDS;

const EVENT_WITH_LIMITS = '/en/events/ongoing-culture-fest-2026-2027-fixed';
const EVENT_OVER_CAP = '/en/events/cancellation-threshold-test-fixed';
const EVENT_COOLDOWN = '/en/events/upcoming-family-workshop-2027-fixed';
const EVENT_RUNNING = '/en/events/past-jazz-night-2025-fixed';

test.describe('Re-extract progress and the missing-images banner, moderator', () => {
  test.skip(!moderatorState, 'Set E2E_FAKE_AUTH=1 (or E2E_AUTH_MODERATOR_STORAGE_STATE) to run the moderator Re-extract flow.');
  if (moderatorState) test.use({ storageState: moderatorState });
  test.setTimeout(120_000);

  let attempted: string[];
  test.beforeEach(async ({ page }) => {
    attempted = await blockReextractWrites(page);
  });
  test.afterEach(() => {
    expect(attempted, 'e2e must never start a re-extract, tap Retry or tap Apply').toEqual([]);
  });

  async function openEvent(page: Page, route: string) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const panel = page.getByRole('region', { name: 'Source posts (moderator)' });
    await expect(panel).toBeVisible({ timeout: 30_000 });
    return panel;
  }

  test('a post with a seeded preview shows its chip, not the Re-extract button, and the dialog names the missing images', async ({ page }) => {
    const panel = await openEvent(page, EVENT_WITH_LIMITS);
    await expect(panel.getByRole('button', { name: 'Re-extract', exact: true })).toHaveCount(0);
    const chip = panel.getByTestId('job-chip');
    await expect(chip).toHaveText('Preview ready (some images missing)');

    await chip.click();
    const dialog = page.getByTestId('job-progress-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('reextract-preview-result')).toBeVisible({ timeout: 30_000 });
    const banner = dialog.getByTestId('reextract-images-warning');
    await expect(banner).toHaveAttribute('role', 'status');
    await expect(banner.getByTestId('reextract-banner-title')).toHaveText('2 of 6 images were read');
    await expect(banner.getByTestId('reextract-banner-missing')).toHaveText('Not read: the cover and slides 3 to 5.');
    await expect(banner).toContainText('No provider could be reached to refresh the images.');
    await expect(banner).toContainText('The image links have expired and refreshing them failed.');
    await expect(banner).toContainText('You can still apply this preview. Events shown only on unread images will be missing.');
    // Retry is shown (the server says it can help) and is never tapped here.
    await expect(banner.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
    // The focus moved to the banner title so a screen reader hears the shortfall before the events.
    await expect(banner.getByTestId('reextract-banner-title')).toBeFocused();
    await expect(dialog).toContainText('Seeded preview: Culture Fest');
  });

  test('a carousel longer than the preview cap shows only its own line, with no Retry', async ({ page }) => {
    const panel = await openEvent(page, EVENT_OVER_CAP);
    const chip = panel.getByTestId('job-chip');
    await expect(chip).toHaveText('Preview ready');
    await chip.click();
    const banner = page.getByTestId('job-progress-dialog').getByTestId('reextract-images-warning');
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner.getByTestId('reextract-banner-over-cap')).toHaveText('Only the first 10 slides are read in a preview.');
    await expect(banner.getByTestId('reextract-banner-title')).toHaveCount(0);
    await expect(banner.getByTestId('reextract-banner-cause')).toHaveCount(0);
    await expect(banner.getByRole('button', { name: /Retry/ })).toHaveCount(0);
  });

  test('during the 10-minute cooldown Retry reads "Retry at {time}" and is aria-disabled, with the cause and the time', async ({ page }) => {
    const panel = await openEvent(page, EVENT_COOLDOWN);
    await panel.getByTestId('job-chip').click();
    const banner = page.getByTestId('job-progress-dialog').getByTestId('reextract-images-warning');
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner.getByTestId('reextract-banner-missing')).toHaveText('Not read: slides 1 to 2.');
    await expect(banner.getByTestId('reextract-banner-cause')).toContainText('less than 10 minutes ago');
    const retry = banner.getByTestId('job-retry');
    await expect(retry).toHaveText(/^Retry at /);
    await expect(retry).toHaveAttribute('aria-disabled', 'true');
    await expect(retry).toHaveAccessibleDescription(/Retrying fetches the images again, then reads the post again\./);
  });

  test('an open Re-extract is a chip that keeps running: open it, minimize it, and a reload brings it back from the server', async ({ page }) => {
    const panel = await openEvent(page, EVENT_RUNNING);
    const chip = panel.getByTestId('job-chip');
    await expect(chip).toHaveText('In progress: step 2 of 2', { timeout: 30_000 });
    await chip.click();
    const dialog = page.getByTestId('job-progress-dialog');
    await expect(dialog.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveCount(2);
    await expect(dialog.locator('[aria-current="step"]')).toContainText('Reading the post and finding events');
    await expect(dialog.getByText('Extracting. This can take up to a minute.')).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Minimize' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(panel.getByTestId('job-chip')).toBeFocused();

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('region', { name: 'Source posts (moderator)' }).getByTestId('job-chip')).toHaveText('In progress: step 2 of 2', { timeout: 30_000 });
  });

  test('the job page offers "Open the preview", which opens the same dialog at the result with no new job', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`/en/jobs/${JOB_ID.moderatorPreviewLimits}`, { waitUntil: 'domcontentloaded' });
    const open = page.getByTestId('job-open-preview');
    await expect(open).toBeVisible({ timeout: 30_000 });
    await expect(open).toHaveText('Open the preview');
    await open.click();
    const dialog = page.getByTestId('job-progress-dialog');
    await expect(dialog.getByTestId('reextract-images-warning')).toBeVisible({ timeout: 30_000 });
    await expect(dialog.getByTestId('reextract-banner-missing')).toHaveText('Not read: the cover and slides 3 to 5.');
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();
    // A job that has no preview (the moderator's failed one) offers no such button.
    await page.goto(`/en/jobs/${JOB_ID.moderatorFailedTimedOut}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('job-progress-view')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('job-open-preview')).toHaveCount(0);
  });

  test('another user\'s job (seen with All users): "Open the preview" says the preview is not available to you, and shows no error', async ({ page }) => {
    // The preview read is owner-scoped, so the seeded job of another user answers "not found" for this moderator.
    await page.goto(`/en/jobs/${JOB_ID.otherUserSucceeded}`, { waitUntil: 'domcontentloaded' });
    const open = page.getByTestId('job-open-preview');
    await expect(open).toBeVisible({ timeout: 30_000 });
    await open.click();
    const dialog = page.getByTestId('job-progress-dialog');
    await expect(dialog.getByTestId('reextract-preview-unavailable')).toHaveText('This preview is not available to you.', { timeout: 30_000 });
    await expect(dialog.getByRole('alert')).toHaveCount(0);
  });

  test('Moderator Tools, Re-extract renders the Post URL form on the shared host (nothing is started)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/en/moderator/tools?tab=reextract', { waitUntil: 'domcontentloaded' });
    await expect(page.getByLabel('Post URL')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('button', { name: 'Preview', exact: true })).toBeDisabled();
    await expect(page.getByTestId('job-chip')).toHaveCount(0);
  });
});
