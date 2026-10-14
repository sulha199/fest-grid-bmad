import type { EventType, EventCategory } from '@festgrid/shared-types';
import type { DayOfWeek, EventFilterInput, TemporalFilter } from '../events/buildEventsQueryCondition.js';
import { isFilterGroupNode, isFilterLeaf, type FilterLeaf, type FilterNode } from './filter-node.js';

/**
 * Converts the existing flat `EventFilterInput` shape (`buildEventsQueryCondition.ts`) into an
 * implicit top-level `AND` group of one leaf per populated field (Story 9.1a AC3). Always wraps
 * in an explicit `AND`, even for a single populated field or none at all -- collapsing a
 * single-child or empty group is `normalize()`'s job, not this function's, so an empty filter
 * produces `{ op: 'AND', children: [] }` here (see `flatFilterFromExpression`, which maps that
 * back to `{}`, not a spurious populated field).
 *
 * `location` is split into the two mutually-exclusive `locationProximity`/`locationAdminArea`
 * leaf variants (Dev Notes decision 5); when a flat filter's `location` carries both (the
 * combination `buildEventsQueryCondition` itself rejects), coordinates take priority, matching
 * the existing precedent in `transformGeminiResponseToEventFilter`.
 */
export function expressionFromFlatFilter(filter: EventFilterInput): FilterNode {
  const children: FilterLeaf[] = [];

  if (filter.accountId) {
    children.push({ field: 'accountId', value: filter.accountId });
  }
  if (filter.types && filter.types.length > 0) {
    children.push({ field: 'type', value: filter.types as EventType[] });
  }
  if (filter.categories && filter.categories.length > 0) {
    children.push({ field: 'category', value: filter.categories as EventCategory[] });
  }
  if (filter.keyword) {
    children.push({ field: 'keyword', value: filter.keyword });
  }
  if (filter.dateRange) {
    children.push({ field: 'dateRange', value: filter.dateRange });
  }
  if (filter.dayOfWeek) {
    // Decision 4: today's flat shape is singular; wrap into the leaf's array-valued shape.
    children.push({ field: 'dayOfWeek', value: [filter.dayOfWeek as DayOfWeek] });
  }
  if (filter.location) {
    const { coordinates, radiusMeters, adminArea } = filter.location;
    if (coordinates) {
      children.push({
        field: 'locationProximity',
        value: { coordinates, ...(radiusMeters != null ? { radiusMeters } : {}) },
      });
    } else if (adminArea) {
      children.push({ field: 'locationAdminArea', value: adminArea });
    }
  }
  if (filter.venueType) {
    children.push({ field: 'venueType', value: filter.venueType });
  }
  if (filter.isFree !== undefined && filter.isFree !== null) {
    children.push({ field: 'isFree', value: filter.isFree });
  }
  if (filter.temporalFilter) {
    children.push({ field: 'temporalFilter', value: filter.temporalFilter as TemporalFilter });
  }

  return { op: 'AND', children };
}

function collectFlatLeaves(node: FilterNode): FilterLeaf[] {
  if (isFilterLeaf(node)) {
    return [node];
  }
  if (isFilterGroupNode(node) && node.op === 'AND') {
    return node.children.map((child) => {
      if (!isFilterLeaf(child)) {
        throw new Error(
          'flatFilterFromExpression only supports a flat AND-of-leaves expression; OR/NOT/nested groups cannot be represented in the flat EventFilterInput shape (that is Story 9.2\'s compiler concern, not this conversion).'
        );
      }
      return child;
    });
  }
  throw new Error(
    'flatFilterFromExpression only supports a single leaf or a top-level AND-of-leaves expression.'
  );
}

/**
 * Reverses `expressionFromFlatFilter`: converts a single leaf, or a top-level `AND` group of
 * leaves, back into the flat `EventFilterInput` shape (Story 9.1a AC3). An `AND` with zero
 * children round-trips to `{}` (an empty/absent-fields object), not a spurious populated field.
 */
export function flatFilterFromExpression(node: FilterNode): EventFilterInput {
  const leaves = collectFlatLeaves(node);
  const filter: EventFilterInput = {};

  for (const leaf of leaves) {
    switch (leaf.field) {
      case 'accountId':
        filter.accountId = leaf.value;
        break;
      case 'type':
        filter.types = leaf.value;
        break;
      case 'category':
        filter.categories = leaf.value;
        break;
      case 'keyword':
        filter.keyword = leaf.value;
        break;
      case 'dateRange':
        filter.dateRange = leaf.value;
        break;
      case 'dayOfWeek':
        // Decision 4: this story only needs the single-element case to round-trip losslessly.
        filter.dayOfWeek = leaf.value[0];
        break;
      case 'locationAdminArea':
        filter.location = { ...filter.location, adminArea: leaf.value };
        break;
      case 'locationProximity':
        filter.location = {
          ...filter.location,
          coordinates: leaf.value.coordinates,
          ...(leaf.value.radiusMeters !== undefined ? { radiusMeters: leaf.value.radiusMeters } : {}),
        };
        break;
      case 'venueType':
        filter.venueType = leaf.value;
        break;
      case 'isFree':
        filter.isFree = leaf.value;
        break;
      case 'temporalFilter':
        filter.temporalFilter = leaf.value;
        break;
    }
  }

  return filter;
}
