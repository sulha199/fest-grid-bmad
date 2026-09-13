# Validation script

Renders a local HTML prototype headlessly and saves a screenshot for direct
visual comparison against the source PNG. No dev server needed -- the file
opens directly via a `file://` URL.

Requires Playwright to already be installed somewhere in the monorepo (check
`apps/web/package.json` or similar for `@playwright/test` before writing this
script -- run it from a directory where that dependency resolves, e.g.
`apps/web/`, rather than a bare scratch directory).

## Script

Write this to a temp `.mjs` file inside a package that has `@playwright/test`
resolvable (delete it when done -- it's scratch, not a repo artifact):

```javascript
import { chromium } from '@playwright/test';
import path from 'node:path';

const htmlPath = process.argv[2]; // absolute path to the prototype .html
const outPath = process.argv[3]; // where to save the screenshot .png

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1000 } });
await page.goto('file://' + path.resolve(htmlPath));
await page.waitForTimeout(300); // let webfonts/layout settle
await page.screenshot({ path: outPath, fullPage: true });
await browser.close();
console.log('saved', outPath);
```

Run it with the prototype path and desired screenshot output path as
arguments. Then Read the resulting PNG alongside the source reference PNG and
compare them directly -- both are just images at that point, so a plain
side-by-side visual read is the comparison, not a pixel-diff tool.

## What counts as a finding

Name concrete, specific discrepancies -- not a vague "looks similar" verdict:

- Wrong element present/absent (a badge, an icon, a piece of text)
- Wrong relative sizing (a date box that's a single small line vs. the PNG's
  large stacked treatment -- exactly the kind of gap this whole skill exists
  to catch)
- Wrong spacing/alignment/order of elements
- Wrong color, weight, or type scale
- Wrong aspect ratio or cropping behavior

## Iterating

Fix the HTML, re-run the script, re-compare. Repeat until clean or until a
remaining gap is a deliberate, explicitly-noted deviation (record it in the
prototype's top comment and in `validation-log.md` -- never leave an
unexplained mismatch as if it were a match).

## Cleanup

Delete the scratch driver script once validation is done. Only the `.html`
prototype and the `validation-log.md` entry are meant to persist in the repo.
