import { QueryCondition, isGroupCondition } from '../query/queryDsl.js';

/**
 * Epic 9 review (P1) -- combines a surface's own scoping conditions (a feed's subscriptions, an
 * account page's profile) with an already-built filter condition.
 *
 * The flat filter path always yields an `and` group, so its conditions are spliced in beside the
 * scoping (unchanged shape). A compiled filter expression can also yield a root `or` or `not`
 * group; splicing scoping *into* those would OR the scoping with the filter (every matching event
 * leaks in) or negate the scoping, so those are nested under the `and` instead.
 */
export function scopeFilterCondition(
  baseConditions: QueryCondition[],
  filterCondition: QueryCondition | undefined
): QueryCondition {
  if (!filterCondition) {
    return { operator: 'and', conditions: baseConditions };
  }
  if (isGroupCondition(filterCondition) && filterCondition.operator === 'and') {
    return { ...filterCondition, conditions: [...baseConditions, ...filterCondition.conditions] };
  }
  return { operator: 'and', conditions: [...baseConditions, filterCondition] };
}
