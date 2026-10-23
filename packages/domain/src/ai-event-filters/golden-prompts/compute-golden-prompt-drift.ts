import { isFilterGroupNode, isFilterLeaf, isFilterNotNode, type FilterNode } from '../filter-node.js';
import { normalize } from '../normalize-filter-node.js';
import type { GeminiFilterExtractionResult } from '../transform-gemini-response-to-filter-expression.js';
import type { GoldenPromptFixture } from './golden-prompt-fixtures.js';

/** Sorted, de-duplicated list of every leaf `field` name present anywhere in the tree
 * (flattening AND/OR/NOT) -- a coarse, non-brittle shape signature deliberately insensitive to
 * exact free-text leaf values (`keyword`, `accountId`) or array ordering, since a live model's
 * wording legitimately varies run to run even when it extracted the same fields. */
export function computeFilterNodeFieldSignature(node: FilterNode): string[] {
  const fields = new Set<string>();
  function visit(current: FilterNode): void {
    if (isFilterLeaf(current)) {
      fields.add(current.field);
    } else if (isFilterGroupNode(current)) {
      current.children.forEach(visit);
    } else if (isFilterNotNode(current)) {
      visit(current.child);
    }
  }
  visit(node);
  return Array.from(fields).sort();
}

/** Canonical operator/polarity shape of the tree, e.g. `AND(NOT(type),OR(keyword,keyword))`.
 * The field-name set alone cannot see the feature's core risks -- a dropped NOT, an OR flipped to
 * AND, a NOT turned positive -- so this keeps the group operators and NOT wrappers too. Free-text
 * and array values stay out of it (a live model's wording legitimately varies), children of an
 * AND/OR are sorted (their order carries no meaning), and the tree is `normalize`d first so a
 * harmless restructuring (a single-child group collapsing, a nested same-operator group flattening)
 * is not reported as drift. */
export function computeFilterNodeShapeSignature(node: FilterNode): string {
  function shape(current: FilterNode): string {
    if (isFilterLeaf(current)) return current.field;
    if (isFilterNotNode(current)) return `NOT(${shape(current.child)})`;
    return `${current.op}(${current.children.map(shape).sort().join(',')})`;
  }
  return shape(normalize(node));
}

export interface GoldenPromptDriftResult {
  fixtureId: string;
  drifted: boolean;
  expectedFieldSignature: string[];
  actualFieldSignature: string[];
  expectedShape: string;
  actualShape: string;
  expectedHadCaveats: boolean;
  actualHadCaveats: boolean;
  details: string;
}

/** Best-effort drift check for the opt-in live-eval script (Story 9.7 AC2) -- deliberately NOT
 * an exact deepEqual against `fixture.expected` (a live model's free-text wording for
 * `keyword`/`accountId` leaves, or its exact caveat sentence, legitimately varies run to run
 * without being a real regression). Flags drift only on the two signals that *do* indicate a
 * real extraction-quality regression: the leaf fields or the operator/polarity shape around them
 * changed (see `computeFilterNodeShapeSignature`), or whether it produced any caveat at all
 * changed. */
export function summarizeGoldenPromptDrift(
  fixture: GoldenPromptFixture,
  liveResult: GeminiFilterExtractionResult
): GoldenPromptDriftResult {
  const expectedFieldSignature = computeFilterNodeFieldSignature(fixture.expected.expression);
  const actualFieldSignature = computeFilterNodeFieldSignature(liveResult.expression);
  const expectedShape = computeFilterNodeShapeSignature(fixture.expected.expression);
  const actualShape = computeFilterNodeShapeSignature(liveResult.expression);
  const expectedHadCaveats = fixture.expected.caveats.length > 0;
  const actualHadCaveats = liveResult.caveats.length > 0;
  const fieldsMatch = JSON.stringify(expectedFieldSignature) === JSON.stringify(actualFieldSignature);
  const shapeMatches = expectedShape === actualShape;
  const caveatPresenceMatches = expectedHadCaveats === actualHadCaveats;
  const drifted = !fieldsMatch || !shapeMatches || !caveatPresenceMatches;
  const details = drifted
    ? `fields expected=[${expectedFieldSignature.join(',')}] actual=[${actualFieldSignature.join(',')}]; shape expected=${expectedShape} actual=${actualShape}; caveatPresence expected=${expectedHadCaveats} actual=${actualHadCaveats}`
    : 'no drift';
  return {
    fixtureId: fixture.id,
    drifted,
    expectedFieldSignature,
    actualFieldSignature,
    expectedShape,
    actualShape,
    expectedHadCaveats,
    actualHadCaveats,
    details,
  };
}
