import { test, expect, type Page } from '@playwright/test';
import { classifyPageHealth, describeOverflow, detectPageOverflow, isOverflowing, settleLayout } from '@festgrid/visual-audit/page-overflow';

/**
 * Responsive validation routine: no page may be wider than its viewport.
 *
 * `scrollWidth > clientWidth` on the document is the "something stretched the screen" signal; on a
 * hit the failure names the outermost element pushing it (see `describeOverflow`). Each route is
 * loaded once and resized through every width, so a failure lists every width it breaks at.
 *
 * Signed-in routes need a session: run with `E2E_FAKE_AUTH=1` (local stack only, see
 * `test-support/fake-auth`) or point `E2E_AUTH_USER_STORAGE_STATE` / `E2E_AUTH_MODERATOR_STORAGE_STATE`
 * at saved states. Without one those groups skip rather than silently measuring a login prompt.
 */

const WIDTHS = [320, 360, 375, 390, 412, 768, 1024, 1280, 1440];
const VIEWPORT_HEIGHT = 900;
/** Fixture event from `packages/database/seed.ts`. */
const EVENT_ROUTE = '/en/events/ongoing-culture-fest-2026-2027-fixed';

// Each test loads a route once and resizes through nine widths; each width can wait several seconds for
// layout to settle, and the moderator tools test repeats that for every tab.
test.setTimeout(300_000);

const userState = process.env.E2E_AUTH_USER_STORAGE_STATE;
const moderatorState = process.env.E2E_AUTH_MODERATOR_STORAGE_STATE;

/** Resizes through every width and returns one entry per width at which the page overflows. */
async function overflowAtEveryWidth(page: Page, label: string): Promise<string[]> {
  const failures: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
    // Never settling (an animating or polling page) is surfaced, not silently measured.
    if (!(await settleLayout(page))) {
      test.info().annotations.push({ type: 'unsettled-layout', description: `${label} @ ${width}px kept changing for the whole settle window` });
    }
    const result = await detectPageOverflow(page);
    if (isOverflowing(result)) failures.push(`${label} @ ${width}px: ${describeOverflow(result)}`);
  }
  return failures;
}

/** A crashed or blank page has nothing to overflow; fail it instead of reporting a false "ok". */
async function expectHealthyPage(page: Page, pageErrors: string[]): Promise<void> {
  const problem = classifyPageHealth({ pageErrors, bodyText: await page.locator('body').innerText() });
  expect(problem, 'page must render usable content before it is measured').toBeNull();
}

/**
 * A stale session, or a reused backend that does not trust the fake JWKS, renders the login prompt
 * inside the real shell, which would be measured as if it were the route. The profile menu only
 * exists for a signed-in viewer, so require it before measuring a signed-in group.
 */
async function expectSignedIn(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: VIEWPORT_HEIGHT });
  await expect(
    page.locator('nav[aria-label="Main"] button[aria-expanded]').last(),
    'session was not accepted: the profile menu is missing (stale storage state, or the backend does not trust the fake JWKS)'
  ).toBeVisible({ timeout: 15_000 });
}

function trackPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

async function gotoRoute(page: Page, route: string): Promise<void> {
  await page.setViewportSize({ width: WIDTHS[0], height: VIEWPORT_HEIGHT });
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response?.status() ?? 0, `${route} must respond successfully`).toBeLessThan(400);
  // A redirect (e.g. to login or onboarding) would mean we measured some other page.
  expect(new URL(page.url()).pathname, `${route} must not redirect`).toBe(route);
}

function describeRoutes(title: string, routes: string[], options: { signedIn: boolean } = { signedIn: false }) {
  for (const route of routes) {
    test(`${title}: ${route} has no page-level horizontal overflow`, async ({ page }) => {
      const pageErrors = trackPageErrors(page);
      await gotoRoute(page, route);
      await settleLayout(page);
      if (options.signedIn) await expectSignedIn(page);
      await expectHealthyPage(page, pageErrors);
      const failures = await overflowAtEveryWidth(page, route);
      // An error thrown while resizing (a breakpoint-specific render crash) must not read as "no overflow".
      await expectHealthyPage(page, pageErrors);
      expect(failures, 'overflowing widths').toEqual([]);
    });
  }
}

test.describe('signed out', () => {
  describeRoutes('signed out', ['/en', '/en/login', EVENT_ROUTE, '/en/test-swipe']);
});

test.describe('signed in', () => {
  test.skip(!userState, 'Set E2E_FAKE_AUTH=1 (or E2E_AUTH_USER_STORAGE_STATE) to run signed-in routes.');
  if (userState) test.use({ storageState: userState });

  describeRoutes('user', [
    '/en/feed',
    '/en/archive',
    '/en/my-calendar',
    '/en/favorites',
    '/en/reports',
    '/en/votes',
    '/en/posts/select',
    '/en/settings/account',
    '/en/settings/locations',
    '/en/settings/widgets',
    '/en/settings/ai-filters',
  ], { signedIn: true });
});

test.describe('moderator', () => {
  test.skip(!moderatorState, 'Set E2E_FAKE_AUTH=1 (or E2E_AUTH_MODERATOR_STORAGE_STATE) to run moderator routes.');
  if (moderatorState) test.use({ storageState: moderatorState });

  describeRoutes('moderator', ['/en/moderator/items', EVENT_ROUTE], { signedIn: true });

  test('moderator: every /en/moderator/tools tab has no page-level horizontal overflow', async ({ page }) => {
    const pageErrors = trackPageErrors(page);
    await gotoRoute(page, '/en/moderator/tools');
    await settleLayout(page);
    await expectSignedIn(page);
    await expectHealthyPage(page, pageErrors);

    // Scoped to the page's own tab bar: a nested tablist inside a panel would shift `nth(i)`.
    const tabs = page.getByRole('tablist').first().getByRole('tab');
    const tabCount = await tabs.count();
    expect(tabCount, 'moderator tools should expose tabs').toBeGreaterThan(0);

    const failures: string[] = [];
    for (let i = 0; i < tabCount; i += 1) {
      // Tabs may be scrolled out of a narrow tab bar; measure each at the widest width first so the click lands.
      await page.setViewportSize({ width: WIDTHS[WIDTHS.length - 1], height: VIEWPORT_HEIGHT });
      const tab = tabs.nth(i);
      const name = ((await tab.innerText()) || `#${i}`).trim();
      await tab.click();
      await settleLayout(page);
      failures.push(...(await overflowAtEveryWidth(page, `/en/moderator/tools [tab "${name}"]`)));
    }
    await expectHealthyPage(page, pageErrors);
    expect(failures, 'overflowing tab/width combinations').toEqual([]);
  });
});

test.describe('PWA install banner', () => {
  /** Location ask outranks the install ask in the shared banner slot, so silence it to reach the PWA one. */
  async function silenceLocationAsk(page: Page): Promise<void> {
    await page.addInitScript(() => {
      localStorage.setItem('festdaily_viewer_location_dismissed', 'true');
    });
  }

  test('install banner shown via a captured beforeinstallprompt has no page-level horizontal overflow', async ({ page }) => {
    await silenceLocationAsk(page);
    const pageErrors = trackPageErrors(page);
    await gotoRoute(page, '/en');
    await settleLayout(page);

    // Headless Chromium never fires the real event; hand the app a minimal stand-in.
    await page.evaluate(() => {
      const event = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
        prompt: async () => undefined,
        userChoice: Promise.resolve({ outcome: 'dismissed' as const, platform: 'web' }),
      });
      window.dispatchEvent(event);
    });
    await expect(page.getByRole('button', { name: 'Install', exact: true }), 'PWA install banner should mount').toBeVisible();

    await expectHealthyPage(page, pageErrors);
    const failures = await overflowAtEveryWidth(page, '/en [PWA install banner, beforeinstallprompt]');
    await expectHealthyPage(page, pageErrors);
    expect(failures, 'overflowing widths').toEqual([]);
  });

  test.describe('iOS Safari', () => {
    test.use({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });

    test('"How to install" banner has no page-level horizontal overflow', async ({ page }) => {
      await silenceLocationAsk(page);
      // iOS eligibility is an engagement heuristic: enough prior visits.
      await page.addInitScript(() => {
        localStorage.setItem('festdaily_pwa_visit_count', '99');
      });
      const pageErrors = trackPageErrors(page);
      await gotoRoute(page, '/en');
      await settleLayout(page);
      await expect(page.getByRole('button', { name: 'How to install' }), 'iOS install banner should mount').toBeVisible();

      await expectHealthyPage(page, pageErrors);
      const failures = await overflowAtEveryWidth(page, '/en [PWA install banner, ios]');
      await expectHealthyPage(page, pageErrors);
      expect(failures, 'overflowing widths').toEqual([]);
    });
  });
});
