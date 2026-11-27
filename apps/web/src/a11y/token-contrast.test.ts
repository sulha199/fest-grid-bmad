/**
 * Colour-contrast ratchet for the design tokens in `src/app/globals.css` (WCAG 2.2 1.4.3 text 4.5:1, 1.4.11 interface
 * components 3:1). jsdom has no layout, so axe cannot judge contrast there; the tokens are plain HSL values, so the
 * ratios are exact and need no browser. The Playwright axe suite (`e2e/a11y.spec.ts`) covers what is actually painted.
 *
 * It is a ratchet, not a promise of compliance: pairs that fail today are listed in KNOWN_BELOW_AA with the ratio
 * measured on 27 Nov 2026. A listed pair may not get worse, and it must be removed from the list the moment it passes
 * (the test fails on a stale entry). Every other pair must meet its threshold. Changing a token is a design decision
 * (DESIGN.md), so the list records the failures instead of silently changing colours.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contrastRatio, hslTripleToRgb, readTokens } from './contrast';

const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');
const THEMES = { light: readTokens(css, ':root'), dark: readTokens(css, '.dark') } as const;

type Theme = keyof typeof THEMES;
interface Pair {
  fg: string;
  bg: string;
  /** 4.5 for text, 3 for interface components and graphics. */
  min: number;
  what: string;
}

const TEXT = 4.5;
const UI = 3;
const PAIRS: Pair[] = [
  { fg: 'foreground', bg: 'background', min: TEXT, what: 'body text' },
  { fg: 'card-foreground', bg: 'card', min: TEXT, what: 'card text' },
  { fg: 'popover-foreground', bg: 'popover', min: TEXT, what: 'popover and menu text' },
  { fg: 'primary-foreground', bg: 'primary', min: TEXT, what: 'primary button text' },
  { fg: 'secondary-foreground', bg: 'secondary', min: TEXT, what: 'secondary button text' },
  { fg: 'accent-foreground', bg: 'accent', min: TEXT, what: 'accent text' },
  { fg: 'success-foreground', bg: 'success', min: TEXT, what: 'success text' },
  { fg: 'destructive-foreground', bg: 'destructive', min: TEXT, what: 'destructive button text' },
  { fg: 'muted-foreground', bg: 'muted', min: TEXT, what: 'muted text on a muted surface' },
  { fg: 'muted-foreground', bg: 'background', min: TEXT, what: 'muted text on the page' },
  { fg: 'wizard-secondary', bg: 'background', min: TEXT, what: 'wizard secondary text' },
  { fg: 'wizard-primary', bg: 'background', min: UI, what: 'wizard primary as a UI colour' },
  { fg: 'ring', bg: 'background', min: UI, what: 'focus ring' },
  { fg: 'nav-active-indicator', bg: 'background', min: UI, what: 'active navigation indicator' },
  { fg: 'border', bg: 'background', min: UI, what: 'component border' },
  { fg: 'input', bg: 'background', min: UI, what: 'input border' },
];

/** Measured 27 Nov 2026 (floor = the measured ratio, rounded down to 2 places). They may not get worse. */
const KNOWN_BELOW_AA: Record<string, number> = {
  'light secondary-foreground/secondary': 4.11,
  'light accent-foreground/accent': 2.89,
  'light success-foreground/success': 2.48,
  'light destructive-foreground/destructive': 3.61,
  'light muted-foreground/muted': 4.34,
  'light border/background': 1.18,
  'light input/background': 1.18,
  'dark success-foreground/success': 2.48,
  'dark wizard-secondary/background': 4.14,
  'dark border/background': 1.37,
  'dark input/background': 1.37,
};

const measured = (theme: Theme, p: Pair) => {
  const t = THEMES[theme];
  return contrastRatio(hslTripleToRgb(t[p.fg]), hslTripleToRgb(t[p.bg]));
};
const key = (theme: Theme, p: Pair) => `${theme} ${p.fg}/${p.bg}`;

describe('design token contrast', () => {
  for (const theme of Object.keys(THEMES) as Theme[]) {
    for (const p of PAIRS) {
      const k = key(theme, p);
      if (!(k in KNOWN_BELOW_AA)) {
        it(`${k} (${p.what}) is at least ${p.min}:1`, () => {
          expect(measured(theme, p)).toBeGreaterThanOrEqual(p.min);
        });
      } else {
        it(`${k} (${p.what}) is a known failure that may not get worse, and is removed from the list once it passes`, () => {
          const ratio = measured(theme, p);
          expect(ratio, 'worse than the recorded floor').toBeGreaterThanOrEqual(KNOWN_BELOW_AA[k] - 0.01);
          expect(ratio, 'now passes: delete this entry from KNOWN_BELOW_AA').toBeLessThan(p.min);
        });
      }
    }
  }

  it('every listed known failure names a real pair', () => {
    const real = new Set((Object.keys(THEMES) as Theme[]).flatMap((th) => PAIRS.map((p) => key(th, p))));
    for (const k of Object.keys(KNOWN_BELOW_AA)) expect(real.has(k), k).toBe(true);
  });
});
