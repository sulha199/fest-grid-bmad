import type { EventInfo } from '@festgrid/shared-types';

/**
 * Unified Query DSL (see architecture spine AD-1).
 *
 * A node is either a logical group (`operator` + nested `conditions`) or a
 * terminal condition (`field` + comparison `operator` + `value`).
 */
export type EventLogicalOperator = 'and' | 'or';
export type EventComparisonOperator = 'contains' | 'equals' | 'notEquals' | 'in' | 'notIn';

export interface EventQueryGroup {
  operator: EventLogicalOperator;
  conditions: EventQueryNode[];
}

export interface EventQueryTerminal {
  field: string;
  operator: EventComparisonOperator;
  value?: unknown;
}

export type EventQueryNode = EventQueryGroup | EventQueryTerminal;

/** The root of a query must always be a logical group. */
export type EventQueryDsl = EventQueryGroup;

function isEventQueryGroup(node: EventQueryNode): node is EventQueryGroup {
  return Array.isArray((node as EventQueryGroup).conditions);
}

function compareValues(left: unknown, operator: EventComparisonOperator, right: unknown): boolean {
  switch (operator) {
    case 'contains':
      return typeof left === 'string' && typeof right === 'string' && left.toLowerCase().includes(right.toLowerCase());
    case 'equals':
      return left === right;
    case 'notEquals':
      return left !== right;
    case 'in':
    case 'notIn': {
      if (!Array.isArray(right)) {
        return false;
      }
      const matches = Array.isArray(left) ? left.some((item) => right.includes(item)) : right.includes(left);
      return operator === 'in' ? matches : !matches;
    }
    default:
      return false;
  }
}

function evaluateNode(event: EventInfo, node: EventQueryNode): boolean {
  if (isEventQueryGroup(node)) {
    const results = node.conditions.map((condition) => evaluateNode(event, condition));
    return node.operator === 'or' ? results.some(Boolean) : results.every(Boolean);
  }

  const value = (event as unknown as Record<string, unknown>)[node.field];
  return compareValues(value, node.operator, node.value);
}

export function applyEventQueryDsl(eventsToQuery: EventInfo[], query?: EventQueryDsl): EventInfo[] {
  if (!query) {
    return eventsToQuery;
  }

  return eventsToQuery.filter((event) => evaluateNode(event, query));
}
