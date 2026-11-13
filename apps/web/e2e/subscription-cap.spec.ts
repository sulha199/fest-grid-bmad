import { test, expect, type Locator, type Page } from '@playwright/test';

/**
 * Story 10.3a (show the subscription cap refusal and the upgrade call to action) -- the Subscribe dialog in Account Settings.
 * Signed-in specs need `E2E_FAKE_AUTH=1` on a local stack (or a saved storage state) and skip without one.
 *
 * A real refusal needs a fifth real subscribe, which would start the classify-then-scrape cascade (a vendor call), and that is never done
 * here. So these specs answer the `SubscribeToAccount` GraphQL operation with the typed refusal through `page.route` and never let the request
 * reach the server. The server side of the refusal, including the moderator exemption, is Story 10.3's real-Postgres suite; what this proves
 * is the screen: the numbers, the Upgrade button, the focus and the wording in English and Indonesian.
 */

const userState = process.env.E2E_AUTH_USER_STORAGE_STATE;

/** Answers every SubscribeToAccount call with `body` and lets everything else through. Returns the number of intercepted calls. */
async function routeSubscribe(page: Page, body: Record<string, unknown>): Promise<{ calls: () => number }> {
  let calls = 0;
  await page.route('**/api/graphql', async (route) => {
    const post = route.request().postDataJSON() as { operationName?: string; query?: string } | null;
    const isSubscribe = post?.operationName === 'SubscribeToAccount' || /mutation\s+SubscribeToAccount\b/.test(post?.query ?? '');
    if (!isSubscribe) return route.fallback();
    calls += 1;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { calls: () => calls };
}

const CAP_REFUSAL = {
  errors: [{ message: 'Subscription limit reached', extensions: { code: 'SUBSCRIPTION_CAP_REACHED', activeCount: 4, reservedCount: 1, cap: 5 } }],
  data: null,
};

async function openSubscribeDialog(page: Page, locale: 'en' | 'id' = 'en') {
  await page.goto(`/${locale}/settings/account?tab=subscriptions`);
  const opener = page.getByRole('button', { name: locale === 'en' ? 'Subscribe to an Account' : 'Berlangganan Akun' }).first();
  await expect(opener).toBeVisible({ timeout: 30_000 });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
}

/** Types a handle and submits with Enter: the voted-account suggestion list that opens under the field sits over the Subscribe button. */
async function submitHandle(dialog: Locator, placeholder: string) {
  const field = dialog.getByPlaceholder(placeholder);
  await field.fill('some_festival_account');
  await field.press('Enter');
}

test.describe('Subscription cap refusal, Subscribe dialog', () => {
  test.skip(!userState, 'Set E2E_FAKE_AUTH=1 (or E2E_AUTH_USER_STORAGE_STATE) to run the signed-in cap flow.');
  if (userState) test.use({ storageState: userState });

  test('a refused subscribe shows the notice with the numbers and the Upgrade button, in place of Subscribe', async ({ page }) => {
    const route = await routeSubscribe(page, CAP_REFUSAL);
    const dialog = await openSubscribeDialog(page);
    await submitHandle(dialog, 'e.g., jkt_festivals');

    const notice = dialog.getByTestId('subscription-cap-notice');
    await expect(notice).toBeVisible();
    await expect(notice.getByText('You have reached your limit')).toBeVisible();
    await expect(notice.getByTestId('subscription-cap-body')).toHaveText('You have 4 accounts added and 1 more being added. The limit is 5.');
    await expect(notice.getByRole('button', { name: /Upgrade/ })).toBeVisible();
    await expect(notice.getByText('Coming soon')).toBeVisible();
    await expect(notice.getByText('Paid plans with a higher limit are not available yet.')).toBeVisible();
    // Focus moved to the title; the blocked action is gone while the field and Cancel stay.
    await expect(notice.getByTestId('subscription-cap-title')).toBeFocused();
    await expect(dialog.getByRole('button', { name: 'Subscribe', exact: true })).toHaveCount(0);
    await expect(dialog.getByPlaceholder('e.g., jkt_festivals')).toHaveValue('some_festival_account');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    // No generic error toast, and the request never reached the server.
    await expect(page.getByText('Failed to subscribe to the account. Please try again.')).toHaveCount(0);
    expect(route.calls()).toBe(1);
  });

  test('tapping Upgrade changes the note and the button stays enabled and focusable', async ({ page }) => {
    await routeSubscribe(page, CAP_REFUSAL);
    const dialog = await openSubscribeDialog(page);
    await submitHandle(dialog, 'e.g., jkt_festivals');

    const upgrade = dialog.getByRole('button', { name: /Upgrade/ });
    await upgrade.click();
    await expect(dialog.getByText('Thanks for your interest. Paid plans are not available yet.')).toBeVisible();
    await expect(dialog.getByText('Paid plans with a higher limit are not available yet.')).toHaveCount(0);
    await expect(upgrade).toBeEnabled();
    await expect(upgrade).not.toHaveAttribute('aria-disabled', /.*/);
    await upgrade.focus();
    await expect(upgrade).toBeFocused();
  });

  test('the same refusal reads in Indonesian', async ({ page }) => {
    await routeSubscribe(page, CAP_REFUSAL);
    const dialog = await openSubscribeDialog(page, 'id');
    await submitHandle(dialog, 'misal, jkt_festivals');

    const notice = dialog.getByTestId('subscription-cap-notice');
    await expect(notice.getByTestId('subscription-cap-body')).toHaveText('Anda memiliki 4 akun yang sudah ditambahkan dan 1 lagi sedang ditambahkan. Batasnya 5.');
    await expect(notice.getByRole('button', { name: /Tingkatkan/ })).toBeVisible();
    await expect(notice.getByText('Segera hadir')).toBeVisible();
  });

  test('closing and reopening the dialog clears the notice', async ({ page }) => {
    await routeSubscribe(page, CAP_REFUSAL);
    const dialog = await openSubscribeDialog(page);
    await submitHandle(dialog, 'e.g., jkt_festivals');
    await expect(dialog.getByTestId('subscription-cap-notice')).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Subscribe to an Account' }).first().click();
    const reopened = page.getByRole('dialog');
    await expect(reopened.getByTestId('subscription-cap-notice')).toHaveCount(0);
    await expect(reopened.getByRole('button', { name: 'Subscribe', exact: true })).toBeVisible();
  });

  test('a routed error that is not the cap still shows the generic toast and no notice', async ({ page }) => {
    await routeSubscribe(page, { errors: [{ message: 'Something broke', extensions: { code: 'INTERNAL_SERVER_ERROR' } }], data: null });
    const dialog = await openSubscribeDialog(page);
    await submitHandle(dialog, 'e.g., jkt_festivals');
    await expect(page.getByText('Failed to subscribe to the account. Please try again.')).toBeVisible();
    await expect(page.getByTestId('subscription-cap-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Upgrade/ })).toHaveCount(0);
  });

  test('votes are never blocked: the votes page has no cap notice or Upgrade button even with the refusal routed', async ({ page }) => {
    await routeSubscribe(page, CAP_REFUSAL);
    await page.goto('/en/votes');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('subscription-cap-notice')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Upgrade/ })).toHaveCount(0);
  });
});
