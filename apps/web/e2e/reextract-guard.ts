import type { Page } from '@playwright/test';

/**
 * Story 10.6a (show the Re-extract progress, the missing-images banner and Retry): e2e NEVER starts a re-extract, taps Retry or Apply (each would start a
 * vendor scrape or invoke a Lambda on the local stack). This is the safety net behind that rule: the three write operations never reach the server, and
 * the names that were attempted are returned so a spec can assert the list stays empty.
 */
const BLOCKED_OPERATIONS = ['PreviewPostReextraction', 'RetryJob', 'ApplyPostReextraction'] as const;

export async function blockReextractWrites(page: Page): Promise<string[]> {
  const attempted: string[] = [];
  await page.route('**/api/graphql', async (route) => {
    const post = route.request().postDataJSON() as { operationName?: string; query?: string } | null;
    const query = post?.query ?? '';
    const hit = BLOCKED_OPERATIONS.find((name) => post?.operationName === name || new RegExp(`mutation\\s+${name}\\b`).test(query));
    if (!hit) return route.fallback();
    attempted.push(hit);
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: null, errors: [{ message: 'blocked by the e2e guard', extensions: { code: 'E2E_BLOCKED' } }] }) });
  });
  return attempted;
}
