/**
 * AD-26 Rule 4: isolated-component-render harness.
 *
 * Judgment call (documented, see story Dev Agent Record): AC5 names Playwright 1.62's native
 * stories/gallery `fixtures.mount()` model as the mechanism. That model mounts real framework
 * (React) component trees through a Vite-bundled gallery page, which requires the consuming
 * package to own a framework dependency and a component-under-test's source. This story's own
 * File Change Plan (Dev Notes) lists only `@playwright/test` + `ts-morph` as new dependencies --
 * no React/`packages/ui` dependency -- and its example manifests point at this repo's own
 * design-reference prototypes, which are already-isolated static HTML/CSS, not React source.
 *
 * This harness therefore implements "isolated-component-render" at the DOM level: `mountHtml`
 * loads a self-contained HTML string into a fresh page via `page.setContent()` -- no live
 * Next.js server, no database, no auth, exactly Rule 4's constraint -- and is the render backend
 * every non-live-route manifest entry uses. A future story that needs to audit an actual React
 * component (e.g. BUG-040's fix) can add a `fixtures.mount()`-backed `RenderSpec` variant beside
 * this one without changing the engine's public shape (`RenderSpec` is already a discriminated
 * union, see `manifest.ts`) -- this story does not need to build that variant to prove the engine
 * mechanism end-to-end (AC2/AC5 are satisfied by the isolated, server/DB/auth-free nature of the
 * render, not by the specific bundler used to produce the markup).
 */

import type { Page } from '@playwright/test';
import type { ManifestEntry } from './manifest.js';

export interface MountedRender {
  page: Page;
  viewportWidth: number;
  viewportHeight: number;
}

/** Renders a manifest entry's declared `render` spec into `page`, applying its viewport. */
export async function mountManifestEntry(page: Page, entry: ManifestEntry): Promise<MountedRender> {
  await page.setViewportSize({ width: entry.viewport.width, height: entry.viewport.height });

  if (entry.render.kind === 'live-route') {
    // Documented escape hatch (AD-26 Rule 4) -- not exercised by this story's own examples.
    await page.goto(entry.render.url);
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
  const path = await import('node:path');
  const url = 'file:///' + path.resolve(repoRoot, prototypeHtmlPath).replace(/\\/g, '/');
  await page.goto(url);
}
