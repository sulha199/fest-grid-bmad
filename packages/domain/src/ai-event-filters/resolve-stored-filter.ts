import type { EventFilterInput } from '../events/buildEventsQueryCondition.js';
import { expressionFromFlatFilter, flatFilterFromExpression } from './flat-filter-conversion.js';
import { validateFilterNode } from './filter-node-schema.js';
import type { FilterNode } from './filter-node.js';

export interface ResolvedStoredFilter {
  expression: FilterNode;
  flatFilter: EventFilterInput | null;
}

/**
 * Story 9.3 (AC2) -- normalizes a persisted `ai_event_filters.resolved_filter`/`widgets.filters`
 * jsonb value (either the legacy flat `EventFilterInput` shape, or the new versioned
 * `{version: 2, expression: FilterNode}` shape) into a validated `FilterNode` plus a best-effort
 * flat projection. This is the single shared read path both `AIEventFilter`/`Widget`'s
 * `resolvedFilter`/`filters`/`expression` field resolvers route through, replacing the previous
 * `parent.filters as any` cast with real, enforced validation (Dev Notes decision 4/5/6).
 *
 * Throws (does not degrade) on a validation failure -- the stored value is already-persisted,
 * previously-accepted application data, so a failure here is a data-integrity concern, not an
 * untrusted-input one. The resolver's own generic try/catch surfaces this as
 * `INTERNAL_SERVER_ERROR`, never `BAD_USER_INPUT`.
 */
export function resolveStoredFilter(stored: unknown): ResolvedStoredFilter {
  const isV2 =
    typeof stored === 'object' && stored !== null && (stored as { version?: unknown }).version === 2;

  const candidate = isV2
    ? (stored as { expression: unknown }).expression
    : expressionFromFlatFilter((stored as EventFilterInput) ?? {});

  const validation = validateFilterNode(candidate);
  if (!validation.valid) {
    const issueText = validation.issues.map((i) => `${i.path.join('.')}: ${i.reason}`).join('; ');
    throw new Error(`Stored filter failed FilterNode validation: ${issueText}`);
  }

  let flatFilter: EventFilterInput | null;
  try {
    flatFilter = flatFilterFromExpression(validation.node);
  } catch {
    flatFilter = null;
  }

  return { expression: validation.node, flatFilter };
}
