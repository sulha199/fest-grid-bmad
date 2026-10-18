import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Architecture Spine AD-35 ratchet: `account_id` (the platform's numeric ID) never appears in a
// URL. Account links are built only by `buildAccountHref(platform, username)` in
// `@festgrid/domain/scraper`. A path-shaped template literal that interpolates an `accountId`
// (e.g. `/${slug}/${profile.accountId}`) is the exact regression this guards against.

const SRC_ROOT = join(__dirname, '..');
const SKIPPED_DIRS = new Set(['generated', 'node_modules']);
const PATH_WITH_ACCOUNT_ID = /\/\$\{[^}]*account_?id[^}]*\}/i;

function collectSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (!SKIPPED_DIRS.has(entry)) collectSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('account URL ratchet (AD-35)', () => {
  it('no template literal under apps/web/src interpolates an accountId into a path', () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .forEach((line, index) => {
          if (PATH_WITH_ACCOUNT_ID.test(line)) {
            offenders.push(`${relative(SRC_ROOT, file)}:${index + 1}: ${line.trim()}`);
          }
        });
    }
    expect(offenders, `build account links with buildAccountHref(platform, username):\n${offenders.join('\n')}`).toEqual([]);
  });

  it('the pattern catches the regression it guards against', () => {
    expect(PATH_WITH_ACCOUNT_ID.test('router.push(`/${slug}/${sub.account.accountId}`)')).toBe(true);
    expect(PATH_WITH_ACCOUNT_ID.test('`/${getPlatformSlug(p)}/${coauthor.accountId}`')).toBe(true);
    expect(PATH_WITH_ACCOUNT_ID.test('`/${slug}/${profile.username}`')).toBe(false);
  });
});
