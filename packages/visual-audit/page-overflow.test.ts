import test from 'node:test';
import * as assert from 'node:assert';
import {
  buildPageOverflowResult,
  formatSelectorPath,
  isOverflowing,
  classifyPageHealth,
  shortenPath,
  culpritKey,
  rankOffenders,
  type RawOverflowCandidate,
  type SelectorSegment,
} from './src/rules/page-overflow.js';
import { classifyResult, renderAuditReport, type AuditRow } from './src/rules/page-overflow-report.js';

const seg = (tag: string, extra: Partial<SelectorSegment> = {}): SelectorSegment => ({
  tag,
  id: '',
  classes: [],
  nthOfType: 1,
  onlyOfType: true,
  ...extra,
});

const candidate = (path: string, right: number, depth = path.split(' > ').length): RawOverflowCandidate => ({
  path,
  tag: 'div',
  classes: '',
  depth,
  left: 0,
  right,
  width: right,
});

test('formatSelectorPath', async (t) => {
  await t.test('joins segments, prefers id over classes, adds nth-of-type only when ambiguous', () => {
    const path = formatSelectorPath([
      seg('MAIN', { id: 'root' }),
      seg('DIV', { classes: ['grid', 'gap-4'], nthOfType: 2, onlyOfType: false }),
      seg('UL'),
    ]);
    assert.strictEqual(path, 'main#root > div.grid.gap-4:nth-of-type(2) > ul');
  });

  await t.test('caps class count and drops overlong class names', () => {
    const path = formatSelectorPath([seg('DIV', { classes: ['a', 'b', 'c', 'd', 'x'.repeat(60)] })]);
    assert.strictEqual(path, 'div.a.b.c');
  });

  await t.test('drops unstable CSS-module / next-font hash classes', () => {
    assert.strictEqual(formatSelectorPath([seg('BODY', { classes: ['__variable_d8ebd1', 'font-sans'] })]), 'body.font-sans');
  });
});

test('shortenPath', async (t) => {
  await t.test('strips the shared html > body scaffolding', () => {
    assert.strictEqual(shortenPath('html.light > body.font-sans > div.min-h-screen > main'), 'div.min-h-screen > main');
  });
  await t.test('leaves paths without that prefix alone', () => {
    assert.strictEqual(shortenPath('div > span'), 'div > span');
  });
});

test('culpritKey', async (t) => {
  await t.test('treats the same element in different sibling slots as one culprit', () => {
    assert.strictEqual(
      culpritKey('html > body > main > div:nth-of-type(1) > div.gap-2'),
      culpritKey('html > body > main > div:nth-of-type(2) > div.gap-2')
    );
  });
});

test('rankOffenders', async (t) => {
  await t.test('marks only the outermost overflowing element as root and counts its descendants', () => {
    const ranked = rankOffenders(
      [candidate('body > main > div', 900), candidate('body > main > div > ul', 950), candidate('body > main > div > ul > li', 1000)],
      800
    );
    const roots = ranked.filter((o) => o.isRoot);
    assert.strictEqual(roots.length, 1);
    assert.strictEqual(roots[0].path, 'body > main > div');
    assert.strictEqual(roots[0].descendantCount, 2);
    assert.strictEqual(roots[0].overflowPx, 100);
    assert.strictEqual(ranked[0].isRoot, true);
  });

  await t.test('does not treat a sibling with a shared name prefix as an ancestor', () => {
    const ranked = rankOffenders([candidate('body > div', 900), candidate('body > div2', 900)], 800);
    assert.deepStrictEqual(ranked.map((o) => o.isRoot), [true, true]);
  });

  await t.test('orders roots by largest overshoot first', () => {
    const ranked = rankOffenders([candidate('body > a', 820), candidate('body > b', 1200)], 800);
    assert.deepStrictEqual(ranked.map((o) => o.path), ['body > b', 'body > a']);
  });
});

test('buildPageOverflowResult / isOverflowing', async (t) => {
  await t.test('no overflow -> zero px and no offenders even if candidates were scanned', () => {
    const result = buildPageOverflowResult({ scrollWidth: 375, clientWidth: 375, masked: false, candidates: [candidate('body > div', 400)] });
    assert.strictEqual(result.overflowPx, 0);
    assert.deepStrictEqual(result.offenders, []);
    assert.strictEqual(isOverflowing(result), false);
  });

  await t.test('stretched page -> overflow delta and ranked offenders', () => {
    const result = buildPageOverflowResult({ scrollWidth: 439, clientWidth: 375, masked: false, candidates: [candidate('body > div', 439)] });
    assert.strictEqual(result.overflowPx, 64);
    assert.strictEqual(result.offenders[0].overflowPx, 64);
    assert.strictEqual(isOverflowing(result), true);
  });

  await t.test('overflow-x hidden on html/body with a crossing element is still reported', () => {
    const result = buildPageOverflowResult({ scrollWidth: 375, clientWidth: 375, masked: true, candidates: [candidate('body > div', 500)] });
    assert.strictEqual(result.overflowPx, 0);
    assert.strictEqual(isOverflowing(result), true);
  });

  await t.test('masked with nothing crossing is fine', () => {
    const result = buildPageOverflowResult({ scrollWidth: 375, clientWidth: 375, masked: true, candidates: [] });
    assert.strictEqual(isOverflowing(result), false);
  });
});

test('renderAuditReport', async (t) => {
  const bad = buildPageOverflowResult({ scrollWidth: 439, clientWidth: 375, masked: false, candidates: [candidate('body > main > div.grid', 439)] });
  const good = buildPageOverflowResult({ scrollWidth: 375, clientWidth: 375, masked: false, candidates: [] });
  const rows: AuditRow[] = [
    { route: '/en', viewportWidth: 375, status: classifyResult(bad), result: bad },
    { route: '/en', viewportWidth: 1280, status: classifyResult(good), result: good },
    { route: '/en/feed', viewportWidth: 375, status: 'error', error: 'HTTP 500' },
    { route: '/en/feed', viewportWidth: 1280, status: 'error', error: 'HTTP 500' },
  ];
  const md = renderAuditReport(rows, { generatedOn: '2026-10-23', baseUrl: 'http://x', skipped: [{ route: '/en/votes', reason: 'redirected to /en/login' }] });

  await t.test('every route × viewport appears in the matrix, including errors', () => {
    assert.match(md, /\| `\/en` \| \+64px \| ok \|/);
    assert.match(md, /\| `\/en\/feed` \| ERR \| ERR \|/);
  });

  await t.test('culprits are grouped and referenced from per-route findings; errors and skipped routes are listed, not dropped', () => {
    assert.match(md, /### C1 -- `body > main > div\.grid`/);
    assert.match(md, /\*\*375px\*\* \+64px .* -> C1/);
    assert.match(md, /`\/en\/feed` @ 375px -- HTTP 500/);
    assert.match(md, /`\/en\/votes` -- redirected to \/en\/login/);
  });

  await t.test('caveats are rendered so a gated route is not mistaken for a fully audited page', () => {
    const withNotes = renderAuditReport(rows, { generatedOn: 'd', baseUrl: 'u', skipped: [], notes: ['`/en/votes` shows the login prompt when signed out'] });
    assert.match(withNotes, /## Caveats\n\n- `\/en\/votes` shows the login prompt/);
  });

  await t.test('clean sweep says so', () => {
    const clean = renderAuditReport([{ route: '/en', viewportWidth: 375, status: 'pass', result: good }], { generatedOn: 'd', baseUrl: 'u', skipped: [] });
    assert.match(clean, /No overflow detected\./);
  });
});

test('classifyPageHealth', async (t) => {
  await t.test('healthy page -> null', () => {
    assert.strictEqual(classifyPageHealth({ pageErrors: [], bodyText: 'Discover Events' }), null);
  });
  await t.test('uncaught page error wins, so a crashed page is never reported as "ok"', () => {
    assert.match(classifyPageHealth({ pageErrors: ['Supabase client environment variables must be defined'], bodyText: 'x' }) ?? '', /uncaught page error: Supabase/);
  });
  await t.test('Next error screen and blank body are both unhealthy', () => {
    assert.match(classifyPageHealth({ pageErrors: [], bodyText: 'Application error: a client-side exception has occurred' }) ?? '', /framework error/);
    assert.match(classifyPageHealth({ pageErrors: [], bodyText: '  \n ' }) ?? '', /no text content/);
  });
});
