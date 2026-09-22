/**
 * AD-26 manifest entry type + registry.
 *
 * A manifest entry declares what's checked for one component/variant/viewport triple
 * (AD-26 Rule 3) -- never inline per-story code. `registerManifestEntry` rejects a second
 * entry declaring the same triple (AC4).
 */

export interface Viewport {
  width: number;
  height: number;
}

/** AD-26 Rule 4: isolated-component-render is the default -- no live server, no DB, no auth. */
export interface IsolatedRender {
  kind: 'isolated-html';
  /** Static markup, or a function producing it from the manifest's fixture props. */
  html: string | ((fixtureProps: Record<string, unknown>) => string);
}

/**
 * AD-26 Rule 4 escape hatch: documented fallback for genuinely route/data-dependent checks
 * only. Not exercised by this story's own example manifests (AC5).
 */
export interface LiveRouteRender {
  kind: 'live-route';
  url: string;
}

/**
 * Mount-backed render (Review Follow-up, 2026-09-22 ruling): renders a real React component
 * tree -- e.g. `EventCard`/`EventCardDateBox` from `@festgrid/ui` -- server-side to static
 * markup via `react-dom/server`, then loads that markup the same isolated, server/DB/auth-free
 * way `isolated-html` does. This is what lets the engine audit the actual production component
 * (closing the "can't mount a real React component" gap AC5 originally left open) instead of
 * only ever re-typing its markup by hand into a fixture string.
 *
 * `render` receives the manifest entry's `fixtureProps` and must return a React element (build
 * it with `React.createElement(Component, props)` -- no JSX build step is required in this
 * package). `documentTemplate`, if provided, wraps the rendered markup in a full HTML document
 * (head/theme/script tags); when omitted, `render.ts`'s default Tailwind-CDN-shaped template is
 * used (see `wrapBodyHtml`), matching every other fixture in this package.
 */
export interface ReactComponentRender {
  kind: 'react-component';
  render: (fixtureProps: Record<string, unknown>) => import('react').ReactElement;
  documentTemplate?: (bodyHtml: string) => string;
}

export type RenderSpec = IsolatedRender | LiveRouteRender | ReactComponentRender;

/** AD-26 Rule 5, sibling-dimension consistency: default absolute tolerance <=2px. */
export interface SiblingDimensionRule {
  kind: 'sibling-dimension';
  /** Selector matching every element in the candidate sibling set to auto-cluster (Rule 5). */
  selector: string;
  dimension: 'width' | 'height';
  toleranceAbsolutePx?: number;
}

/** AD-26 Rule 5, intra-box ratio consistency: default relative tolerance +-8-10%. */
export interface IntraBoxRatioRule {
  kind: 'intra-box-ratio';
  selectorA: string;
  selectorB: string;
  dimension: 'width' | 'height' | 'fontSize';
  /** Explicit DESIGN.md/token-sourced ratio. Omit to derive once from the reference prototype's
   * own rendered ratio (reference-based manifests only). */
  expectedRatio?: number;
  toleranceRelative?: number;
  /**
   * Selectors to use against the *independently mounted reference render* when deriving
   * `expectedRatio` (Review Follow-up item 2). The real validated prototype HTML file is
   * design-artifact markup, not this manifest's own fixture -- it generally has no
   * `data-testid` attributes (or other selectors invented for the live-render fixture), so a
   * manifest author declares the selectors that actually address the same two elements inside
   * the real prototype file here. Defaults to `selectorA`/`selectorB` when omitted, for the rare
   * case where the live and reference markup genuinely share the same selector.
   */
  referenceSelectorA?: string;
  referenceSelectorB?: string;
}

/** AD-26 Rule 5, overflow/clipping via ts-morph branch enumeration of a formatting function. */
export interface OverflowRule {
  kind: 'overflow';
  /** Selector of the content slot whose overflow is checked for every enumerated variant. */
  selector: string;
  formattingFunction: {
    filePath: string;
    functionName: string;
  };
  /** Renders one enumerated variant's return value into full page markup for that render. */
  buildFixtureHtml: (variantLabel: string) => string;
}

/** AD-26 Rule 6: color fidelity, token-exact-match primary / pixel-diff fallback. */
export interface ColorRule {
  kind: 'color';
  selector: string;
  cssProperty: 'color' | 'backgroundColor';
  /** Primary signal: exact computed-value match against the resolved token. */
  expectedToken?: { name: string; resolvedValue: string };
}

export type Rule = SiblingDimensionRule | IntraBoxRatioRule | OverflowRule | ColorRule;

export interface ReferenceSource {
  /** Path to the validated prototype HTML, relative to the repo root. */
  prototypeHtmlPath: string;
  /** Path to the source PNG the prototype was validated against, relative to the repo root --
   * the real diff target for AD-26 Rule 2's secondary signal (Review Follow-up item 3). */
  prototypePngPath: string;
  /** Selector to screenshot for the `prototypePngPath` pixel-diff secondary signal; defaults to
   * the full viewport when omitted. */
  pixelDiffSelector?: string;
  pixelDiffOptions?: { maxDiffPixelRatio?: number; threshold?: number };
}

export interface ManifestEntry {
  component: string;
  variant: string;
  viewport: Viewport;
  /** AD-26 Rule 1a: render scope is per-entry, never fixed by the engine. */
  renderScope: 'single-instance' | 'multi-instance';
  /** AD-26 Rule 1: two audit modes, one check engine. */
  mode: 'reference' | 'rule';
  render: RenderSpec;
  /** Required when mode === 'reference'. */
  reference?: ReferenceSource;
  fixtureProps?: Record<string, unknown>;
  rules: Rule[];
}

function tripleKey(entry: Pick<ManifestEntry, 'component' | 'variant' | 'viewport'>): string {
  return `${entry.component}::${entry.variant}::${entry.viewport.width}x${entry.viewport.height}`;
}

export class DuplicateManifestEntryError extends Error {
  constructor(key: string) {
    super(`A manifest entry already exists for component/variant/viewport triple "${key}"`);
    this.name = 'DuplicateManifestEntryError';
  }
}

export class ManifestEntryNotFoundError extends Error {
  constructor(name: string) {
    super(`No manifest entry registered under name "${name}"`);
    this.name = 'ManifestEntryNotFoundError';
  }
}

/**
 * Registry keyed by an explicit `name` for lookup convenience, but uniqueness is enforced on
 * the component/variant/viewport triple (AC4) -- two differently-named entries for the same
 * triple are still rejected.
 */
export class ManifestRegistry {
  private byName = new Map<string, ManifestEntry>();
  private byTriple = new Map<string, string>();

  register(name: string, entry: ManifestEntry): void {
    const key = tripleKey(entry);
    const existingName = this.byTriple.get(key);
    if (existingName !== undefined) {
      throw new DuplicateManifestEntryError(key);
    }
    if (entry.mode === 'reference' && !entry.reference) {
      throw new Error(`Manifest entry "${name}" declares mode "reference" but has no reference source`);
    }
    this.byName.set(name, entry);
    this.byTriple.set(key, name);
  }

  get(name: string): ManifestEntry {
    const entry = this.byName.get(name);
    if (!entry) {
      throw new ManifestEntryNotFoundError(name);
    }
    return entry;
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  list(): Array<{ name: string; entry: ManifestEntry }> {
    return Array.from(this.byName.entries()).map(([name, entry]) => ({ name, entry }));
  }
}

/** The process-wide registry manifests register themselves into (mirrors a simple import-time
 * side-effect registration pattern, same as e.g. route-table registries elsewhere in the repo). */
export const defaultRegistry = new ManifestRegistry();

export function registerManifestEntry(name: string, entry: ManifestEntry): void {
  defaultRegistry.register(name, entry);
}
