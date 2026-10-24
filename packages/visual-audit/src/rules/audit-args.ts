/**
 * Argument parsing for the page-overflow sweep CLI. Pure, so it is unit-testable (the CLI itself runs
 * on import).
 */

export const DEFAULT_WIDTHS = [320, 360, 375, 390, 412, 768, 1024, 1280, 1440];

/** Every token must be a positive number: silently dropping a typo would run fewer widths than asked for. */
export function parseWidths(raw: string | undefined): number[] {
  if (raw === undefined) return [...DEFAULT_WIDTHS];
  const widths = raw.split(',').map((token) => Number(token.trim()));
  if (widths.length === 0 || widths.some((n) => !Number.isFinite(n) || n <= 0)) {
    throw new Error(`--widths must be a comma-separated list of positive numbers (got "${raw}")`);
  }
  return [...new Set(widths)];
}

/** `en/feed` -> `/en/feed`; a query string is dropped so it is not mistaken for a redirect. */
export function normalizeRoute(raw: string): string {
  const path = raw.trim().split('?')[0].split('#')[0];
  if (!path) throw new Error('--routes contains an empty route');
  return path.startsWith('/') ? path : `/${path}`;
}
