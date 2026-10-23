/**
 * Route × viewport sweep for page-level horizontal overflow.
 *
 *   BASE_URL=http://localhost:3000 pnpm --filter @festgrid/visual-audit audit:page-overflow \
 *     [--routes=/en,/en/feed] [--widths=320,375,1440] [--out=path/to/report.md]
 *
 * Needs a running web app (and backend/DB for data-driven pages). Exits 0 even when overflow is
 * found -- this is an audit, the permanent assertion lives in the e2e matrix spec.
 */

import { chromium, type Browser } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { detectPageOverflow, settleLayout } from '../compare/page-overflow.js';
import { classifyPageHealth } from '../rules/page-overflow.js';
import { classifyResult, renderAuditReport, type AuditRow } from '../rules/page-overflow-report.js';

const DEFAULT_WIDTHS = [320, 360, 375, 390, 412, 768, 1024, 1280, 1440];
const VIEWPORT_HEIGHT = 900;
const NAV_TIMEOUT_MS = 30_000;
const SETTLE_TIMEOUT_MS = 8_000;

/** Static routes under `apps/web/src/app/[locale]`. Dynamic ones are resolved from live links. */
const STATIC_ROUTES = [
  '/en',
  '/en/login',
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
  '/en/moderator/items',
  '/en/moderator/tools',
  '/en/test-swipe',
];

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

/**
 * Resolves the dynamic routes from live data. Event cards are click targets (not anchors), so open
 * the first one and read the intercepted-modal URL; then look on that event for an account link.
 */
async function discoverDynamicRoutes(browser: Browser, baseUrl: string): Promise<string[]> {
  const page = await browser.newPage({ viewport: { width: 1280, height: VIEWPORT_HEIGHT } });
  const found: string[] = [];
  try {
    await page.goto(`${baseUrl}/en`, { timeout: NAV_TIMEOUT_MS });
    const card = page.locator('article').first();
    await card.waitFor({ timeout: SETTLE_TIMEOUT_MS });
    await card.locator('h3').first().click();
    await page.waitForURL(/\/en\/events\/[^/?#]+/, { timeout: SETTLE_TIMEOUT_MS });
    found.push(new URL(page.url()).pathname);
    const hrefs = await page.$$eval('a[href]', (anchors) => anchors.map((a) => a.getAttribute('href') ?? ''));
    const accountHref = hrefs.find((h) => /^\/en\/(instagram|facebook|tiktok|x)\/[^/?#]+$/.test(h));
    if (accountHref) found.push(accountHref);
  } catch {
    // Missing data is reported as a skipped route by the caller, never as a crash.
  } finally {
    await page.close();
  }
  return found;
}

async function main(): Promise<void> {
  // eslint-disable-next-line turbo/no-undeclared-env-vars -- CLI-only input pointing at a running dev server, not a repo build input.
  const baseUrl = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const widths = (arg('widths')?.split(',').map(Number) ?? DEFAULT_WIDTHS).filter((n) => Number.isFinite(n) && n > 0);
  if (widths.length === 0) throw new Error(`--widths must be a comma-separated list of positive numbers (got "${arg('widths')}")`);
  const outPath = resolve(
    arg('out') ?? resolve(__dirname, `../../../../_bmad-output/implementation-artifacts/page-overflow-audit-${new Date().toISOString().slice(0, 10)}.md`)
  );

  // eslint-disable-next-line turbo/no-undeclared-env-vars -- optional local override for sandboxes whose Chromium revision differs from the pinned Playwright's.
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
  const rows: AuditRow[] = [];
  const skipped: Array<{ route: string; reason: string }> = [];
  const notes: string[] = [];
  try {
    const explicitRoutes = arg('routes')?.split(',');
    const dynamic = explicitRoutes ? [] : await discoverDynamicRoutes(browser, baseUrl);
    if (!explicitRoutes && !dynamic.some((r) => r.includes('/events/'))) {
      skipped.push({ route: '/en/events/[slug]', reason: 'no event link found on /en (is the DB seeded?)' });
    }
    if (!explicitRoutes && !dynamic.some((r) => !r.includes('/events/'))) {
      skipped.push({ route: '/en/[platformSlug]/[username]', reason: 'no account link found on the first event' });
    }
    const routes = explicitRoutes ?? [...STATIC_ROUTES, ...dynamic];

    for (const route of routes) {
      const context = await browser.newContext({ viewport: { width: widths[0], height: VIEWPORT_HEIGHT } });
      const page = await context.newPage();
      const pageErrors: string[] = [];
      page.on('pageerror', (e) => pageErrors.push(e.message));
      try {
        const response = await page.goto(`${baseUrl}${route}`, { timeout: NAV_TIMEOUT_MS, waitUntil: 'domcontentloaded' });
        const finalPath = new URL(page.url()).pathname;
        if (!response || response.status() >= 400) {
          for (const width of widths) rows.push({ route, viewportWidth: width, status: 'error', error: `HTTP ${response?.status() ?? 'no response'}` });
          continue;
        }
        if (finalPath !== route && route !== '/en') {
          skipped.push({ route, reason: `redirected to ${finalPath} (likely needs login)` });
          continue;
        }
        for (const width of widths) {
          try {
            await page.setViewportSize({ width, height: VIEWPORT_HEIGHT });
            await settleLayout(page);
            const unhealthy = classifyPageHealth({ pageErrors, bodyText: await page.locator('body').innerText() });
            if (unhealthy) {
              rows.push({ route, viewportWidth: width, status: 'error', error: unhealthy });
              continue;
            }
            if (width === widths[0] && route !== '/en/login' && /Sign in to access/i.test(await page.locator('body').innerText())) {
              notes.push(`\`${route}\` shows the login prompt when signed out, so the audited UI is the login screen inside the real app shell, not the page itself.`);
            }
            const result = await detectPageOverflow(page);
            rows.push({ route, viewportWidth: width, status: classifyResult(result), result });
          } catch (error) {
            rows.push({ route, viewportWidth: width, status: 'error', error: error instanceof Error ? error.message : String(error) });
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        for (const width of widths) rows.push({ route, viewportWidth: width, status: 'error', error: message });
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const report = renderAuditReport(rows, { generatedOn: new Date().toISOString().slice(0, 10), baseUrl, skipped, notes });
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, report);
  const overflowing = rows.filter((r) => r.status === 'overflow').length;
  console.log(`Page-overflow audit: ${rows.length} checks, ${overflowing} overflowing, ${rows.filter((r) => r.status === 'error').length} errors. Report: ${outPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
