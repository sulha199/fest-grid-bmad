/**
 * Builds the before/after swatch page and screenshots for `_bmad-output/planning-artifacts/a11y-contrast-proposal-2026-11-27.md`.
 * Run from the repo root:  node design-artifacts/a11y-contrast-proposal/build.mjs
 * Every ratio is computed here (WCAG 2.x relative luminance, floored to 2 decimals, as axe and token-contrast.test.ts do),
 * nothing is typed in. It changes no app code. Output: swatches.html, the PNGs next to it, and ratios.md (the doc's table).
 */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const requireFromWeb = createRequire(resolve(here, '../../apps/web/package.json'));

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hsl = (h, s, l) => {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255));
};
const toHex = (r) => '#' + r.map((v) => v.toString(16).padStart(2, '0')).join('');
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (r) => 0.2126 * lin(r[0]) + 0.7152 * lin(r[1]) + 0.0722 * lin(r[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const fl = (a, b) => Math.floor(ratio(a, b) * 100) / 100;
const blend = (c, bg, a) => c.map((v, i) => Math.round(v * a + bg[i] * (1 - a)));

// Light and dark page colours from apps/web/src/app/globals.css.
const WHITE = hex('#ffffff'), BG_L = hsl(210, 20, 98), MUTED = hsl(210, 40, 96.1), FG98 = hsl(210, 40, 98);
const BG_D = hsl(222.2, 84, 4.9), DARK_TEXT = hsl(222.2, 47.4, 11.2);

/**
 * kind: 'text' (4.5:1) or 'ui' (3:1). Each pair is [foreground, background]. `sample` is the visible text of the swatch.
 * where: the concrete class or token that changes.
 */
const ROWS = [
  { id: 'now', theme: 'light', name: 'Status badge "Now"', kind: 'text', sample: 'Now', px: 12,
    before: [WHITE, hex('#059669')], after: [WHITE, hex('#047857')], change: '`bg-emerald-600` → `bg-emerald-700` (white text stays)' },
  { id: 'upcoming', theme: 'light', name: 'Status badge "Upcoming" (default badge, muted pair)', kind: 'text', sample: 'Upcoming', px: 12,
    before: [hsl(215.4, 16.3, 46.9), MUTED], after: [hsl(215.4, 16.3, 45.5), MUTED], change: 'token `--muted-foreground` (light): lightness 46.9% → 45.5%' },
  { id: 'gone', theme: 'light', name: '"This content is no longer available"', kind: 'text', sample: 'This content is no longer available', px: 14,
    before: [hex('#9ca3af'), hex('#f3f4f6')], after: [hex('#4b5563'), hex('#f3f4f6')], change: '`text-gray-400` → `text-gray-600 dark:text-gray-400`' },
  { id: 'logout', theme: 'light', name: '"Log Out" (`text-destructive` on the popover)', kind: 'text', sample: 'Log Out', px: 14,
    before: [hsl(0, 84, 60), WHITE], after: [hsl(0, 84, 46), WHITE], change: 'token `--destructive` (light): lightness 60% → 46%' },
  { id: 'logout-hover', theme: 'light', name: '"Log Out" in its hover state (`hover:bg-muted`)', kind: 'text', sample: 'Log Out', px: 14,
    before: [hsl(0, 84, 60), MUTED], after: [hsl(0, 84, 46), MUTED], change: 'same token change as above' },
  { id: 'secondary', theme: 'light', name: 'Token pair secondary-foreground / secondary', kind: 'text', sample: 'Instagram', px: 12,
    before: [FG98, hsl(238, 82, 67)], after: [FG98, hsl(238, 82, 65)], change: 'token `--secondary` (light): lightness 67% → 65%' },
  { id: 'accent', theme: 'light', name: 'Token pair accent-foreground / accent (recommended: darker text)', kind: 'text', sample: 'Accent', px: 14,
    before: [FG98, hsl(358, 100, 68)], after: [DARK_TEXT, hsl(358, 100, 68)], change: 'token `--accent-foreground` (light): `210 40% 98%` → `222.2 47.4% 11.2%` (accent coral unchanged)' },
  { id: 'accent-alt', theme: 'light', name: 'Token pair accent-foreground / accent (alternative: darker coral)', kind: 'text', sample: 'Accent', px: 14,
    before: [FG98, hsl(358, 100, 68)], after: [FG98, hsl(358, 100, 45)], change: 'token `--accent` (light): lightness 68% → 45% (coral becomes red)' },
  { id: 'success', theme: 'light', name: 'Token pair success-foreground / success (both themes)', kind: 'text', sample: 'Success', px: 14,
    before: [FG98, hsl(160, 84, 39)], after: [FG98, hsl(160, 84, 28)], change: 'token `--success` (light and dark): lightness 39% → 28%' },
  { id: 'destructive-btn', theme: 'light', name: 'Token pair destructive-foreground / destructive (button)', kind: 'text', sample: 'Delete', px: 14,
    before: [FG98, hsl(0, 84, 60)], after: [FG98, hsl(0, 84, 46)], change: 'same `--destructive` change as "Log Out"' },
  { id: 'sky', theme: 'light', name: 'Not measured yet: "Starting soon" badge', kind: 'text', sample: 'In 2 hours', px: 12,
    before: [WHITE, hex('#0284c7')], after: [WHITE, hex('#0369a1')], change: '`bg-sky-600` → `bg-sky-700`' },
  { id: 'time', theme: 'dark', name: 'Inactive time filter (Today / Upcoming)', kind: 'text', sample: 'Upcoming', px: 14,
    before: [hex('#4b5563'), BG_D], after: [hex('#9ca3af'), BG_D], change: '`text-gray-600` → `text-gray-600 dark:text-gray-400`' },
  { id: 'time-hover', theme: 'dark', name: 'Inactive time filter, hover state', kind: 'text', sample: 'Upcoming', px: 14,
    before: [hex('#9ca3af'), hex('#f3f4f6')], after: [hex('#9ca3af'), hex('#1f2937')], change: 'add `dark:hover:bg-gray-800` (the light `hover:bg-gray-100` is also light in the dark theme today)' },
  { id: 'gray500', theme: 'dark', name: 'Secondary grey text (account handle, Published date)', kind: 'text', sample: '@jktcity.events', px: 14,
    before: [hex('#6b7280'), BG_D], after: [hex('#9ca3af'), BG_D], change: '`text-gray-500` → `text-gray-500 dark:text-gray-400`' },
  { id: 'wizard', theme: 'dark', name: 'Token wizard-secondary on the page', kind: 'text', sample: 'Step 2 of 4', px: 14,
    before: [hsl(220, 9, 46), BG_D], after: [hsl(220, 9, 49), BG_D], change: 'token `--wizard-secondary` (dark): lightness 46% → 49%' },
  { id: 'destr-text-dark', theme: 'dark', name: 'Not measured yet: `text-destructive` on the dark page', kind: 'text', sample: 'Log Out', px: 14,
    before: [hsl(0, 62.8, 30.6), BG_D], after: [hex('#f87171'), BG_D], change: 'a text-only destructive colour for the dark theme (see "Findings outside the list")' },
  { id: 'input-l', theme: 'light', name: 'Input border vs the page (1.4.11, option 1: darker `--input`)', kind: 'ui', sample: '', px: 0,
    before: [hsl(214.3, 31.8, 91.4), BG_L], after: [hsl(214.3, 31.8, 58), BG_L], change: 'token `--input` (light): lightness 91.4% → 58%' },
  { id: 'input-d', theme: 'dark', name: 'Input border vs the page (1.4.11, option 1: darker `--input`)', kind: 'ui', sample: '', px: 0,
    before: [hsl(217.2, 32.6, 17.5), BG_D], after: [hsl(217.2, 32.6, 41), BG_D], change: 'token `--input` (dark): lightness 17.5% → 41%' },
];

const min = (r) => (r.kind === 'text' ? 4.5 : 3);
for (const r of ROWS) {
  r.rb = fl(...r.before); r.ra = fl(...r.after);
  if (r.ra < min(r)) throw new Error(`${r.id} does not pass after the change: ${r.ra}`);
}
// Extra checks quoted in the doc.
const EXTRA = [
  ['muted-foreground (before) on the page background', fl(hsl(215.4, 16.3, 46.9), BG_L)],
  ['muted-foreground (after) on the page background', fl(hsl(215.4, 16.3, 45.5), BG_L)],
  ['muted-foreground (after) on white', fl(hsl(215.4, 16.3, 45.5), WHITE)],
  ['gray-500 on gray-100 (why gray-600 is needed for "no longer available")', fl(hex('#6b7280'), hex('#f3f4f6'))],
  ['destructive (after) text on the page background', fl(hsl(0, 84, 46), BG_L)],
  ['destructive-foreground on destructive/90 hover over white, before', fl(FG98, blend(hsl(0, 84, 60), WHITE, 0.9))],
  ['destructive-foreground on destructive/90 hover over white, after', fl(FG98, blend(hsl(0, 84, 46), WHITE, 0.9))],
  ['secondary-foreground on secondary/80 hover over white, before', fl(FG98, blend(hsl(238, 82, 67), WHITE, 0.8))],
  ['secondary-foreground on secondary/80 hover over white, after', fl(FG98, blend(hsl(238, 82, 65), WHITE, 0.8))],
  ['dark text on coral accent (recommended option)', fl(DARK_TEXT, hsl(358, 100, 68))],
  ['input border (after) vs white card, light', fl(hsl(214.3, 31.8, 58), WHITE)],
  ['dark destructive token as text on the dark page, before', fl(hsl(0, 62.8, 30.6), BG_D)],
  ['dark destructive-foreground on the dark destructive button (passes today)', fl(FG98, hsl(0, 62.8, 30.6))],
];

const hx = toHex;
const swatch = (r, which) => {
  const [fg, bg] = r[which];
  const ratioVal = which === 'before' ? r.rb : r.ra;
  const ok = ratioVal >= min(r);
  const body = r.kind === 'text'
    ? `<span class="s" style="color:${hx(fg)};background:${hx(bg)};font-size:${r.px}px">${r.sample}</span>`
    : `<span class="s box" style="background:${hx(bg)}"><input readonly value="Search events" style="border:1px solid ${hx(fg)};background:${hx(bg)};color:${r.theme === 'dark' ? '#f8fafc' : '#111827'}"></span>`;
  return `<div class="cell"><div class="pane" style="background:${hx(bg)}">${body}</div><div class="meta"><code>${hx(fg)}</code> on <code>${hx(bg)}</code><br><b class="${ok ? 'ok' : 'bad'}">${ratioVal.toFixed(2)}:1 ${ok ? 'pass' : 'fail'}</b> <small>(need ${min(r)}:1)</small></div></div>`;
};
const section = (theme, title) => `<h2>${title}</h2>` + ROWS.filter((r) => r.theme === theme).map((r) =>
  `<div class="row ${theme}"><div class="lab"><b>${r.name.replace(/`/g, '')}</b><br><small>${r.change.replace(/`([^`]+)`/g, '<code>$1</code>')}</small></div><div class="ba"><div><div class="tag">before</div>${swatch(r, 'before')}</div><div><div class="tag">after</div>${swatch(r, 'after')}</div></div></div>`).join('');

const html = (theme, title) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>
body{font:14px/1.4 system-ui,sans-serif;margin:24px;background:${theme === 'dark' ? '#020817' : '#f9fafb'};color:${theme === 'dark' ? '#f8fafc' : '#111827'};width:1100px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:20px 0 8px}small{opacity:.75}code{font-size:12px}
.row{display:grid;grid-template-columns:340px 1fr;gap:16px;align-items:center;padding:10px 0;border-top:1px solid ${theme === 'dark' ? '#334155' : '#cbd5e1'}}
.ba{display:grid;grid-template-columns:1fr 1fr;gap:16px}.tag{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.7;margin-bottom:4px}
.pane{padding:14px 16px;border-radius:8px;border:1px dashed ${theme === 'dark' ? '#334155' : '#cbd5e1'};min-height:44px;display:flex;align-items:center}
.s{display:inline-block;padding:2px 8px;border-radius:4px;font-weight:500}.s.box{padding:0}.box input{padding:8px 12px;border-radius:6px;font-size:14px;width:230px}
.meta{margin-top:6px;font-size:12px}.ok{color:${theme === 'dark' ? '#4ade80' : '#047857'}}.bad{color:${theme === 'dark' ? '#f87171' : '#b91c1c'}}
.pane .s{padding:2px 8px}</style></head><body>
<h1>${title}</h1><small>Measured with the WCAG 2.x formula, floored to 2 decimals. Swatches are the exact colours (before / after).</small>
${section(theme, theme === 'light' ? 'Light theme' : 'Dark theme')}</body></html>`;

writeFileSync(resolve(here, 'light.html'), html('light', 'Contrast proposal, light theme: before and after'));
writeFileSync(resolve(here, 'dark.html'), html('dark', 'Contrast proposal, dark theme: before and after'));

const md = [
  '| Pair | Theme | Before | After | Change |', '|---|---|---|---|---|',
  ...ROWS.map((r) => `| ${r.name} | ${r.theme} | ${r.rb.toFixed(2)} (\`${hx(r.before[0])}\` on \`${hx(r.before[1])}\`) | ${r.ra.toFixed(2)} (\`${hx(r.after[0])}\` on \`${hx(r.after[1])}\`) | ${r.change} |`),
  '', '| Extra check | Ratio |', '|---|---|', ...EXTRA.map(([n, v]) => `| ${n} | ${v.toFixed(2)} |`),
].join('\n');
writeFileSync(resolve(here, 'ratios.md'), md + '\n');

const { chromium } = requireFromWeb('playwright');
const browser = await chromium.launch();
for (const t of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1160, height: 800 }, deviceScaleFactor: 2 });
  await page.goto('file://' + resolve(here, `${t}.html`));
  await page.screenshot({ path: resolve(here, `contrast-${t}-before-after.png`), fullPage: true });
  await page.close();
}
await browser.close();
console.log(md);
