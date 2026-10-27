import test from 'node:test';
import * as assert from 'node:assert';
import {
  buildPageOverflowResult,
  formatSelectorPath,
  isOverflowing,
  classifyPageHealth,
  describeOverflow,
  shortenPath,
  culpritKey,
  rankOffenders,
  type RawOverflowCandidate,
  type SelectorSegment,
} from './src/rules/page-overflow.js';
import { classifyResult, renderAuditReport, type AuditRow } from './src/rules/page-overflow-report.js';
import { normalizeRoute, parseWidths } from './src/rules/audit-args.js';
import { checkPopupContainment, type PopupMeasurement } from './src/rules/popup-containment.js';

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

test('describeOverflow', async (t) => {
  await t.test('empty string for a healthy page so it can be used directly as an assertion message', () => {
    assert.strictEqual(describeOverflow(buildPageOverflowResult({ scrollWidth: 375, clientWidth: 375, masked: false, candidates: [] })), '');
  });
  await t.test('names the overshoot and the root culprit, with the html > body scaffolding stripped', () => {
    const result = buildPageOverflowResult({ scrollWidth: 513, clientWidth: 375, masked: false, candidates: [candidate('html > body > main > div.banner', 513)] });
    const text = describeOverflow(result);
    assert.match(text, /page is 138px wider than the viewport/);
    assert.match(text, /culprit: main > div\.banner \(\+138px/);
  });
});

test('audit CLI arguments', async (t) => {
  await t.test('parseWidths defaults, dedupes, and rejects a typo instead of silently dropping it', () => {
    assert.strictEqual(parseWidths(undefined).length, 9);
    assert.deepStrictEqual(parseWidths('320, 375,320'), [320, 375]);
    assert.throws(() => parseWidths('320,abc'), /positive numbers/);
    assert.throws(() => parseWidths('320,'), /positive numbers/);
    assert.throws(() => parseWidths(''), /positive numbers/);
  });

  await t.test('normalizeRoute adds the leading slash and drops query/hash so it is not read as a redirect', () => {
    assert.strictEqual(normalizeRoute('en/feed'), '/en/feed');
    assert.strictEqual(normalizeRoute('/en/feed?x=1#top'), '/en/feed');
    assert.throws(() => normalizeRoute(' '), /empty route/);
  });
});

test('page health and describeOverflow edge branches', async (t) => {
  await t.test('a 404 page and a runtime error overlay are unhealthy', () => {
    assert.match(classifyPageHealth({ pageErrors: [], bodyText: '404 This page could not be found.' }) ?? '', /framework error/);
    assert.match(classifyPageHealth({ pageErrors: [], bodyText: 'Unhandled Runtime Error' }) ?? '', /framework error/);
  });

  await t.test('describeOverflow: masked head, no-culprit note, extra roots and truncation are all spelled out', () => {
    const masked = buildPageOverflowResult({ scrollWidth: 375, clientWidth: 375, masked: true, candidates: [candidate('html > body > a', 500)] });
    assert.match(describeOverflow(masked), /hidden by `overflow-x` on html\/body/);

    const none = { ...buildPageOverflowResult({ scrollWidth: 500, clientWidth: 375, masked: false, candidates: [] }), truncated: true };
    const noneText = describeOverflow(none);
    assert.match(noneText, /no culprit element identified/);
    assert.match(noneText, /scan hit its cap/);

    const many = buildPageOverflowResult({
      scrollWidth: 900,
      clientWidth: 375,
      masked: false,
      candidates: ['a', 'b', 'c', 'd', 'e'].map((x, i) => candidate(`html > body > ${x}`, 500 + i)),
    });
    assert.match(describeOverflow(many), /and 2 more root culprit/);
  });

  await t.test('report: masked and missing cells, no-culprit message, and table-safe error text', () => {
    const masked = buildPageOverflowResult({ scrollWidth: 375, clientWidth: 375, masked: true, candidates: [candidate('html > body > a', 500)] });
    const noCulprit = buildPageOverflowResult({ scrollWidth: 500, clientWidth: 375, masked: false, candidates: [] });
    const rows: AuditRow[] = [
      { route: '/a', viewportWidth: 375, status: classifyResult(masked), result: masked },
      { route: '/b', viewportWidth: 375, status: classifyResult(noCulprit), result: noCulprit },
      { route: '/b', viewportWidth: 1280, status: 'error', error: 'boom\n| pipe' },
    ];
    const md = renderAuditReport(rows, { generatedOn: 'd', baseUrl: 'u', skipped: [] });
    assert.match(md, /\| `\/a` \| masked \| – \|/);
    assert.match(md, /@ 1280px -- boom \| pipe/);

    const onlyNoCulprit = renderAuditReport([rows[1]], { generatedOn: 'd', baseUrl: 'u', skipped: [] });
    assert.match(onlyNoCulprit, /no culprit element could be identified/);
  });

  await t.test('report: more than three roots in one cell are capped and the rest are not silently lost from the count', () => {
    const result = buildPageOverflowResult({
      scrollWidth: 900,
      clientWidth: 375,
      masked: false,
      candidates: ['a', 'b', 'c', 'd'].map((x, i) => candidate(`html > body > ${x}`, 500 + i)),
    });
    const md = renderAuditReport([{ route: '/x', viewportWidth: 375, status: 'overflow', result }], { generatedOn: 'd', baseUrl: 'u', skipped: [] });
    assert.strictEqual((md.match(/^### C\d+/gm) ?? []).length, 3);
  });
});

test('checkPopupContainment', async (t) => {
  const base: PopupMeasurement = {
    viewport: { width: 375, height: 667 },
    box: { left: 20, top: 100, right: 308, bottom: 500 },
    scrollable: false,
    horizontalOverflowPx: 0,
    interactiveCount: 12,
    lastInteractiveAfterScroll: { left: 30, top: 440, right: 120, bottom: 480 },
  };

  await t.test('a popup that fits and shows its last option is fine', () => {
    assert.deepStrictEqual(checkPopupContainment(base), []);
  });

  await t.test('the reported bug: taller than the screen with no scroll -> off-screen AND last option unreachable', () => {
    const tall: PopupMeasurement = {
      ...base,
      box: { left: 20, top: 120, right: 308, bottom: 900 },
      lastInteractiveAfterScroll: { left: 30, top: 840, right: 120, bottom: 880 },
    };
    const problems = checkPopupContainment(tall);
    assert.strictEqual(problems.length, 2);
    assert.match(problems[0], /233px below the bottom edge.*does not scroll/);
    assert.match(problems[1], /last of 12 interactive element/);
  });

  await t.test('capped to the viewport and scrolled to its end: fine', () => {
    const capped: PopupMeasurement = {
      ...base,
      scrollable: true,
      box: { left: 20, top: 120, right: 308, bottom: 659 },
      lastInteractiveAfterScroll: { left: 30, top: 600, right: 120, bottom: 640 },
    };
    assert.deepStrictEqual(checkPopupContainment(capped), []);
  });

  await t.test('scrollable but still overhanging the bottom of the viewport is flagged (part of the scroll area is off-screen)', () => {
    const overhang: PopupMeasurement = { ...base, scrollable: true, box: { left: 20, top: 120, right: 308, bottom: 700 } };
    const problems = checkPopupContainment(overhang);
    assert.match(problems[0], /33px below the bottom edge\)$/);
  });

  await t.test('wider than the screen and off the left edge are both reported', () => {
    const wide: PopupMeasurement = { ...base, box: { left: -12, top: 100, right: 400, bottom: 500 } };
    assert.match(checkPopupContainment(wide)[0], /12px past the left edge, 25px past the right edge/);
  });

  await t.test('the moderator Re-extract bug: a 320px dialog whose content is 597px wide is flagged even though the box fits the screen', () => {
    const wideContent: PopupMeasurement = {
      ...base,
      viewport: { width: 320, height: 800 },
      box: { left: 0, top: 60, right: 320, bottom: 740 },
      horizontalOverflowPx: 277,
      lastInteractiveAfterScroll: { left: 508, top: 660, right: 605, bottom: 696 },
    };
    const problems = checkPopupContainment(wideContent);
    assert.strictEqual(problems.length, 2);
    assert.match(problems[0], /277px wider than the popup itself/);
    assert.match(problems[1], /last of 12 interactive element/);
  });

  await t.test('no interactive elements: only the box is checked', () => {
    assert.deepStrictEqual(checkPopupContainment({ ...base, interactiveCount: 0, lastInteractiveAfterScroll: null }), []);
  });

  await t.test('a sub-pixel overhang is within tolerance', () => {
    assert.deepStrictEqual(checkPopupContainment({ ...base, box: { ...base.box, bottom: 667.6 } }), []);
  });
});
