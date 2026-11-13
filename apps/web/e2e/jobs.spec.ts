import { test, expect, type Page } from '@playwright/test';
import { FIXTURE_JOB_IDS } from '../../../packages/database/seed';

/**
 * Story 10.4 Part C -- the Jobs page and a job's own page, against the rows the e2e seed creates (`packages/database/seed.ts`,
 * FIXTURE_JOBS). Signed-in specs need `E2E_FAKE_AUTH=1` on a local stack (or saved storage states) and skip without one.
 *
 * Nothing here starts a job, a scrape or a Lambda: the seeded open jobs are never advanced locally, and Retry is checked for what it shows,
 * never clicked (a click would start a real re-extract). The chip at the place an action started is not covered here: no start point mounts
 * the progress host until the adoption stories (Story 10.6a and the later ones); the hook and host are covered by component tests.
 */

const userState = process.env.E2E_AUTH_USER_STORAGE_STATE;
const moderatorState = process.env.E2E_AUTH_MODERATOR_STORAGE_STATE;
const JOB_ID = FIXTURE_JOB_IDS;

async function openJobs(page: Page): Promise<void> {
  await page.goto('/en/jobs');
  await expect(page.getByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
  // The skeleton is aria-hidden; wait for the sections' real rows.
  await expect(page.getByTestId('job-row').first()).toBeVisible({ timeout: 30_000 });
}

const row = (page: Page, id: string) => page.locator(`[data-testid="job-row"][data-job-id="${id}"]`);

test.describe('Jobs page, ordinary user', () => {
  test.skip(!userState, 'Set E2E_FAKE_AUTH=1 (or E2E_AUTH_USER_STORAGE_STATE) to run the signed-in Jobs flow.');
  if (userState) test.use({ storageState: userState });

  test('reaches Jobs from the profile menu and lists In progress above Finished', async ({ page }) => {
    await page.goto('/en');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('nav[aria-label="Main"] button[aria-expanded]').last().click();
    await page.getByRole('link', { name: 'Jobs', exact: true }).click();
    await expect(page).toHaveURL(/\/en\/jobs$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Jobs' })).toBeVisible();
    await expect(page).toHaveTitle('Jobs | FestDaily');

    const headings = await page.getByRole('heading', { level: 2 }).allInnerTexts();
    expect(headings.slice(0, 2)).toEqual(['In progress', 'Finished']);

    const active = page.getByTestId('jobs-active');
    await expect(row(page, JOB_ID.userRunning)).toBeVisible();
    await expect(active.locator(`[data-job-id="${JOB_ID.userRunning}"]`)).toContainText('In progress');
    await expect(active.locator(`[data-job-id="${JOB_ID.userRunning}"]`)).toContainText('Running for');
    await expect(active.locator(`[data-job-id="${JOB_ID.userQueued}"]`)).toContainText('Next in line');
    const finished = page.getByTestId('jobs-finished');
    await expect(finished.locator(`[data-job-id="${JOB_ID.userSucceeded}"]`)).toContainText('Took 1 min 20 sec');
    await expect(finished.locator(`[data-job-id="${JOB_ID.userFailed}"]`)).toContainText('Failed');

    // Another user's job, a system job and the moderator's own jobs are never listed for an ordinary user.
    await expect(row(page, JOB_ID.otherUserSucceeded)).toHaveCount(0);
    await expect(row(page, JOB_ID.systemSucceeded)).toHaveCount(0);
    await expect(row(page, JOB_ID.moderatorFailedTimedOut)).toHaveCount(0);
    // No moderator filters, no owner line, no vendor name anywhere.
    await expect(page.getByTestId('jobs-filters')).toHaveCount(0);
    await expect(page.getByText(/Started by|System job|Apify|Bright Data/)).toHaveCount(0);
  });

  test('the page has exactly one job announcer region, and the paging controls are the shared ones', async ({ page }) => {
    await openJobs(page);
    await expect(page.getByTestId('job-announcer')).toHaveCount(1);
    await expect(page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
    // Fewer rows than a page: Previous and Next are both disabled.
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  test('a row opens the job page: panel, timing, no technical details, no Retry, back link to Jobs', async ({ page }) => {
    await openJobs(page);
    await row(page, JOB_ID.userFailed).click();
    await expect(page).toHaveURL(new RegExp(`/en/jobs/${JOB_ID.userFailed}$`));
    await expect(page).toHaveTitle('Job details | FestDaily');
    const panel = page.getByTestId('job-progress-view');
    await expect(panel).toHaveAttribute('data-form', 'panel');
    await expect(panel).toContainText('We could not reach the platform right now.');
    await expect(page.getByTestId('job-timing')).toContainText('Started');
    await expect(page.getByTestId('job-technical-details')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Retry/ })).toHaveCount(0);
    await expect(page.getByTestId('job-announcer')).toHaveCount(1);

    await page.getByTestId('job-back-link').click();
    await expect(page).toHaveURL(/\/en\/jobs$/);
  });

  test('an open job shows its steps and the reassurance that leaving does not stop it', async ({ page }) => {
    await page.goto(`/en/jobs/${JOB_ID.userRunning}`);
    const panel = page.getByTestId('job-progress-view');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByRole('list', { name: 'Steps' }).getByRole('listitem')).toHaveCount(2);
    await expect(panel.locator('[aria-current="step"]')).toHaveCount(1);
    await expect(panel).toContainText('Leaving this page does not stop it.');
  });

  test('a job that is missing, or belongs to someone else, reads as not found with a link to Jobs', async ({ page }) => {
    for (const id of ['00000000-0000-4000-8000-000000000000', JOB_ID.moderatorFailedTimedOut, JOB_ID.systemSucceeded]) {
      await page.goto(`/en/jobs/${id}`);
      await expect(page.getByText('This job was not found.')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('job-not-found').getByRole('link', { name: 'Jobs' })).toHaveAttribute('href', '/en/jobs');
    }
  });
});

test.describe('Jobs page, moderator', () => {
  test.skip(!moderatorState, 'Set E2E_FAKE_AUTH=1 (or E2E_AUTH_MODERATOR_STORAGE_STATE) to run the moderator Jobs flow.');
  if (moderatorState) test.use({ storageState: moderatorState });

  test('filters apply at once: My jobs by default, All users adds others, system jobs are opt-in, Clear filters resets', async ({ page }) => {
    await openJobs(page);
    const filters = page.getByTestId('jobs-filters');
    await expect(filters.getByRole('radio', { name: 'My jobs' })).toBeChecked();
    await expect(filters.getByRole('checkbox', { name: 'Include system jobs' })).not.toBeChecked();
    await expect(row(page, JOB_ID.moderatorFailedTimedOut)).toBeVisible();
    await expect(row(page, JOB_ID.moderatorFailedTimedOut)).toContainText('Started by Shulha Yahya');
    await expect(row(page, JOB_ID.otherUserSucceeded)).toHaveCount(0);
    await expect(row(page, JOB_ID.systemSucceeded)).toHaveCount(0);

    await filters.getByRole('radio', { name: 'All users' }).click();
    await expect(row(page, JOB_ID.otherUserSucceeded)).toContainText('Started by Alice Reporter');
    await expect(row(page, JOB_ID.userFailed)).toBeVisible();
    await expect(row(page, JOB_ID.systemSucceeded)).toHaveCount(0);

    await filters.getByRole('checkbox', { name: 'Include system jobs' }).click();
    await expect(row(page, JOB_ID.systemSucceeded)).toContainText('System job');

    await page.getByTestId('jobs-clear-filters').click();
    await expect(filters.getByRole('radio', { name: 'My jobs' })).toBeChecked();
    await expect(row(page, JOB_ID.systemSucceeded)).toHaveCount(0);
    await expect(row(page, JOB_ID.otherUserSucceeded)).toHaveCount(0);
    await expect(row(page, JOB_ID.moderatorFailedTimedOut)).toBeVisible();
  });

  test('a failed job offers Retry (not clicked) and shows the technical details, collapsed until opened', async ({ page }) => {
    await page.goto(`/en/jobs/${JOB_ID.moderatorFailedTimedOut}`);
    const panel = page.getByTestId('job-progress-view');
    await expect(panel).toBeVisible({ timeout: 30_000 });
    await expect(panel.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();

    const details = page.getByTestId('job-technical-details');
    await expect(details).not.toHaveAttribute('open', '');
    await page.getByText('Technical details (moderators)').click();
    await expect(details).toHaveAttribute('open', '');
    await expect(details).toContainText('Provider attempts');
    await expect(details).toContainText('The job ran past its time limit.');
    await expect(details).toContainText('Apify');
    await expect(details).toContainText('Bright Data');
    await expect(details).toContainText('TIMED_OUT');
    await expect(details).toContainText(JOB_ID.moderatorFailedTimedOut);
  });

  test('a cooldown ending reads "Retry at {time}" and the button is disabled for assistive tech', async ({ page }) => {
    await page.goto(`/en/jobs/${JOB_ID.moderatorFailedCooldown}`);
    const button = page.getByRole('button', { name: /^Retry at / });
    await expect(button).toBeVisible({ timeout: 30_000 });
    await expect(button).toHaveAttribute('aria-disabled', 'true');
  });

  test('a moderator can open another user\'s job by its link', async ({ page }) => {
    await page.goto(`/en/jobs/${JOB_ID.userSucceeded}`);
    await expect(page.getByTestId('job-progress-view')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('job-technical-details')).toBeVisible();
  });
});
