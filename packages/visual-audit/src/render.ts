/**
 * AD-26 Rule 4: isolated-component-render harness.
 *
 * Judgment call, superseded in part by the 2026-09-22 code-review ruling (see below): AC5 names
 * Playwright 1.62's native stories/gallery `fixtures.mount()` model as the mechanism. That model
 * mounts real framework (React) component trees through a Vite-bundled gallery page, which would
 * require this package to take on a full bundler pipeline. Rather than build that pipeline, this
 * harness offers two render backends that both satisfy Rule 4's actual constraint (no live
 * server, no DB, no auth):
 *
 *  - `isolated-html` / `live-route`: `page.setContent()` / `page.goto()` against static or
 *    already-isolated markup -- unchanged from the original implementation.
 *  - `react-component` (Review Follow-up, decision-needed item 1, RULING: extend the harness
 *    now): mounts a *real* React component tree by rendering it to static markup server-side via
 *    `react-dom/server`'s `renderToStaticMarkup` and loading that markup the same isolated way.
 *    This closes the "cannot mount EventCard/EventCardDateBox" gap without introducing a second
 *    bundler/build pipeline into a devDependency-tier tooling package -- the DOM the browser
 *    ultimately inspects (bounding rects, computed styles, overflow) is byte-for-byte the same
 *    tree React would have produced client-side for this component, since none of this package's
 *    checks depend on client-side interactivity (event handlers, hooks re-rendering) -- only on
 *    the rendered DOM shape and its computed styles.
 *
 * `RenderSpec` remains a discriminated union (see `manifest.ts`), so a future story can still add
 * a true `fixtures.mount()`-backed variant beside these two without changing the engine's public
 * shape.
 */

import type { Page, Route } from '@playwright/test';
import type { ManifestEntry } from './manifest.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export interface MountedRender {
  page: Page;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Review Follow-up (patch item 9): fixture/prototype HTML loads Tailwind from
 * `cdn.tailwindcss.com` at render time, making every render network-dependent. Rather than edit
 * the (verbatim, validated) design-artifact prototype markup or this package's own fixture
 * strings -- both already shaped exactly like every other prototype in this repo -- this
 * intercepts the CDN request itself and fulfills it locally from a statically pre-compiled
 * Tailwind CSS bundle (`vendor/tailwind.generated.css`, built offline via this repo's own local
 * `tailwindcss` v3 install -- see `vendor/tailwind.config.cjs` for the content globs/safelist
 * that keep it in sync with the classes this package's fixtures and the prototypes actually use).
 *
 * The shim also stubs a `window.tailwind = { config() {} }` global so a page's own inline
 * `<script>tailwind.config = {...}</script>` block (present in every fixture/prototype) still
 * executes without throwing -- it just assigns onto a stub object instead of driving a live JIT
 * compile, since the classes it would have compiled are already baked into the vendored CSS.
 */
async function installOfflineTailwind(page: Page): Promise<void> {
  const css = getVendoredTailwindCss();
  const shim = `window.tailwind = window.tailwind || {};
window.tailwind.config = window.tailwind.config || function () {};
(function () {
  var style = document.createElement('style');
  style.setAttribute('data-visual-audit-offline-tailwind', '');
  style.textContent = ${JSON.stringify(css)};
  (document.head || document.documentElement).appendChild(style);
})();`;

  await page.route('**/cdn.tailwindcss.com**', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/javascript', body: shim })
  );
}

let cachedCss: string | undefined;

function getVendoredTailwindCss(): string {
  if (cachedCss === undefined) {
    // Resolved from the package's own working directory rather than `import.meta.url`/
    // `__dirname`: this module runs under three different transforms in this package alone
    // (`tsc`'s real NodeNext ESM build, `tsx`'s ESM runtime for the unit-test suite, and
    // Playwright's own CJS-targeting test transform, which does not support `import.meta` in a
    // file another CJS-compiled module `require()`s) -- `process.cwd()` is the one thing all
    // three agree on, since every script in `package.json` that can reach this code already runs
    // with this package's root as its working directory.
    const cssPath = path.resolve(process.cwd(), 'vendor', 'tailwind.generated.css');
    cachedCss = readFileSync(cssPath, 'utf-8');
  }
  return cachedCss;
}

/** Default full-document wrapper for a `react-component` render's server-rendered markup,
 * matching this package's other fixtures' head/theme shape (colors kept in sync with
 * `vendor/tailwind.config.cjs`). */
function wrapBodyHtml(bodyHtml: string): string {
  return `
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          background: 'hsl(210 20% 98%)',
          foreground: 'hsl(221 39% 11%)',
          card: 'hsl(0 0% 100%)',
          primary: 'hsl(217 33% 17%)',
          secondary: 'hsl(238 82% 67%)',
          'secondary-foreground': 'hsl(210 40% 98%)',
          muted: 'hsl(210 40% 96.1%)',
          'muted-foreground': 'hsl(215.4 16.3% 46.9%)',
        }
      }
    }
  }
</script>
<style>body{font-family:Inter,sans-serif; margin:0;}</style>
<div class="p-6 bg-slate-100">${bodyHtml}</div>
`;
}

/** Renders a `react-component` `RenderSpec` to static HTML via `react-dom/server`. Import is
 * done lazily so packages that never use this render kind don't pay for loading React eagerly. */
async function renderReactComponentToHtml(
  render: Extract<ManifestEntry['render'], { kind: 'react-component' }>,
  fixtureProps: Record<string, unknown>
): Promise<string> {
  const ReactDOMServer = (await import('react-dom/server')).default;
  const element = render.render(fixtureProps);
  const bodyHtml = ReactDOMServer.renderToStaticMarkup(element);
  const documentTemplate = render.documentTemplate ?? wrapBodyHtml;
  return documentTemplate(bodyHtml);
}

/** Renders a manifest entry's declared `render` spec into `page`, applying its viewport. */
export async function mountManifestEntry(page: Page, entry: ManifestEntry): Promise<MountedRender> {
  await page.setViewportSize({ width: entry.viewport.width, height: entry.viewport.height });
  await installOfflineTailwind(page);

  if (entry.render.kind === 'live-route') {
    // Documented escape hatch (AD-26 Rule 4) -- not exercised by this story's own examples.
    await page.goto(entry.render.url);
  } else if (entry.render.kind === 'react-component') {
    const html = await renderReactComponentToHtml(entry.render, entry.fixtureProps ?? {});
    await page.setContent(html, { waitUntil: 'load' });
  } else {
    const html = typeof entry.render.html === 'function' ? entry.render.html(entry.fixtureProps ?? {}) : entry.render.html;
    await page.setContent(html, { waitUntil: 'load' });
  }

  return { page, viewportWidth: entry.viewport.width, viewportHeight: entry.viewport.height };
}

/** Loads a validated prototype HTML file directly (reference-based mode's "reference render"),
 * from a repo-root-relative path, resolved against `repoRoot`. */
export async function mountPrototypeFile(page: Page, repoRoot: string, prototypeHtmlPath: string, viewport: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(viewport);
  await installOfflineTailwind(page);
  const url = 'file:///' + path.resolve(repoRoot, prototypeHtmlPath).replace(/\\/g, '/');
  await page.goto(url);
}
