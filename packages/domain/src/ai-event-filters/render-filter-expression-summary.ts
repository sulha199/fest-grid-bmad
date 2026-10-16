import { flatFilterFromExpression } from './flat-filter-conversion.js';
import {
  isFilterGroupNode,
  isFilterLeaf,
  isFilterNotNode,
  type FilterLeaf,
  type FilterNode,
} from './filter-node.js';
import { normalize } from './normalize-filter-node.js';
import { renderAIFilterSummary, type AIFilterSummaryLabels, type AIFilterSummaryResult } from './render-ai-filter-summary.js';
import {
  formatAccountIdClause,
  formatCategoriesClause,
  formatDateRangeClause,
  formatDayOfWeekClause,
  formatIsFreeClause,
  formatKeywordClause,
  formatLocationAdminAreaClause,
  formatLocationProximityClause,
  formatTemporalFilterClause,
  formatTypesClause,
  formatVenueTypeClause,
  joinCaveats,
} from './summary-clause-formatters.js';

export interface FilterExpressionSummaryLabels extends AIFilterSummaryLabels {
  and?: string;
  not?: string;
}

function renderLeafClause(leaf: FilterLeaf, labels: FilterExpressionSummaryLabels): string {
  switch (leaf.field) {
    case 'accountId':
      return formatAccountIdClause(leaf.value, labels);
    case 'type':
      return formatTypesClause(leaf.value, labels);
    case 'category':
      return formatCategoriesClause(leaf.value, labels);
    case 'keyword':
      return formatKeywordClause(leaf.value, labels);
    case 'dateRange':
      return formatDateRangeClause(leaf.value, labels);
    case 'dayOfWeek':
      return formatDayOfWeekClause(leaf.value, labels);
    case 'locationAdminArea':
      return formatLocationAdminAreaClause(leaf.value, labels);
    case 'locationProximity':
      return formatLocationProximityClause(leaf.value.radiusMeters, labels);
    case 'venueType':
      return formatVenueTypeClause(leaf.value, labels);
    case 'isFree':
      return formatIsFreeClause(leaf.value, labels) ?? '';
    case 'temporalFilter':
      return formatTemporalFilterClause(leaf.value, labels);
  }
}

function wrapInParens(text: string): string {
  return `(${text})`;
}

function renderNode(node: FilterNode, labels: FilterExpressionSummaryLabels): string {
  if (isFilterLeaf(node)) return renderLeafClause(node, labels);
  if (isFilterNotNode(node)) {
    const childText = renderNode(node.child, labels);
    const wrapped = isFilterGroupNode(node.child) ? wrapInParens(childText) : childText;
    return `${labels.not ?? 'not'} ${wrapped}`;
  }
  // AND/OR group.
  const joiner = node.op === 'AND' ? (labels.and ?? 'and') : (labels.or ?? 'or');
  const parts = node.children.map((child) => {
    const text = renderNode(child, labels);
    const needsParens = isFilterGroupNode(child) && child.op !== node.op;
    return needsParens ? wrapInParens(text) : text;
  });
  return parts.join(` ${joiner} `);
}

/**
 * Renders any valid `FilterNode` (flat or compound) deterministically, with explicit grouping and
 * locale-safe `and`/`or`/`not` words (Story 9.5 AC1). A whole-tree-flat expression (a single leaf,
 * or a top-level `AND`-of-leaves) always delegates to Story 7.3's exact `renderAIFilterSummary`
 * output -- byte-identical, never a re-derived tree-order rendering (Dev Notes decision 1).
 */
export function renderFilterExpressionSummary(
  node: FilterNode | null | undefined,
  caveats: string[] | null | undefined,
  labels: FilterExpressionSummaryLabels
): AIFilterSummaryResult {
  if (!node) return renderAIFilterSummary(null, caveats, labels);
  const normalized = normalize(node);
  // AC1's flat-parity requirement: delegate to the exact Story 7.3 renderer whenever the whole
  // tree is flat-representable (a single leaf, or a top-level AND-of-leaves) -- reuses
  // `flatFilterFromExpression`'s own existing "is this flat?" check (it throws on OR/NOT/nested
  // groups) rather than re-implementing a second flatness test that could drift from it.
  try {
    const flat = flatFilterFromExpression(normalized);
    return renderAIFilterSummary(flat, caveats, labels);
  } catch {
    // Not flat-representable -- fall through to the recursive renderer below.
  }
  const summary = renderNode(normalized, labels) || labels.noFilter;
  return { summary, caveatsText: joinCaveats(caveats, labels) };
}
