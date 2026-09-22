/**
 * @festgrid/visual-audit -- AD-26 visual-fidelity audit engine public API.
 *
 * Usable from a `vitest`/`tsx --test`/`@playwright/test` file in another package the same way
 * `@festgrid/graphql-select`'s utilities are imported today (AC12) -- import what you need
 * directly from `@festgrid/visual-audit`.
 */

export type {
  ManifestEntry,
  Viewport,
  RenderSpec,
  IsolatedRender,
  LiveRouteRender,
  Rule,
  SiblingDimensionRule,
  IntraBoxRatioRule,
  OverflowRule,
  ColorRule,
  ReferenceSource,
} from './manifest.js';

export { ManifestRegistry, defaultRegistry, registerManifestEntry, DuplicateManifestEntryError, ManifestEntryNotFoundError } from './manifest.js';

export { runManifestEntry, mountReferenceFor, type ManifestRunResult, type RuleRunResult, type RunManifestEntryOptions } from './engine.js';

export { mountManifestEntry, mountPrototypeFile, type MountedRender } from './render.js';

export { getElementSnapshot, getElementSnapshots, checkOverflow, type ElementSnapshot, type OverflowCheckResult } from './compare/computed-style.js';

export { DEFAULT_PIXEL_DIFF_OPTIONS, type PixelDiffOptions } from './compare/pixel-diff.js';

export {
  clusterByRowOverlap,
  clusterByColumnOverlap,
  checkSiblingDimension,
  DEFAULT_SIBLING_TOLERANCE_PX,
  type BoundingBox,
  type SiblingDimensionCheckResult,
} from './rules/sibling-dimension.js';

export { checkIntraBoxRatio, deriveRatioFromReference, DEFAULT_RATIO_TOLERANCE_RELATIVE, type IntraBoxRatioCheckResult } from './rules/intra-box-ratio.js';

export { checkColorToken, type ColorCheckResult } from './rules/color.js';

export { runOverflowRule, type OverflowRuleResult, type OverflowVariantResult } from './rules/overflow.js';

export { enumerateContentVariants, type ContentVariant } from './content-variants.js';
