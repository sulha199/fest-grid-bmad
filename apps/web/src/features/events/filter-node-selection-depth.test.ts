import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, visit, type FieldNode, type SelectionSetNode } from 'graphql';
import { FILTER_NODE_MAX_DEPTH } from '@festgrid/domain/ai-event-filters';

// Epic 9 review (P24) -- GraphQL has no recursive selection, so every `expression { ... }` selection
// is hand-unrolled to a fixed depth. If FILTER_NODE_MAX_DEPTH is ever raised, the API would
// silently return truncated trees (the last level selects no `children`/`child`); this pins the
// copies to the constant so that change fails here instead.
function selectionDepth(selectionSet: SelectionSetNode | undefined): number {
  if (!selectionSet) return 0;
  let deepestChild = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === 'Field' && (selection.name.value === 'children' || selection.name.value === 'child')) {
      deepestChild = Math.max(deepestChild, selectionDepth(selection.selectionSet));
    }
  }
  return 1 + deepestChild;
}

function expressionSelections(file: string): Array<{ operation: string; depth: number }> {
  const source = readFileSync(join(__dirname, file), 'utf8');
  const found: Array<{ operation: string; depth: number }> = [];
  visit(parse(source), {
    OperationDefinition(operation) {
      const operationName = operation.name?.value ?? '(anonymous)';
      visit(operation, {
        Field(field: FieldNode) {
          if (field.name.value === 'expression' && field.selectionSet) {
            found.push({ operation: operationName, depth: selectionDepth(field.selectionSet) });
          }
        },
      });
    },
  });
  return found;
}

describe('FilterNode GraphQL selections', () => {
  for (const file of ['mutations.graphql', 'queries.graphql']) {
    it(`${file}: every hand-unrolled expression selection is exactly FILTER_NODE_MAX_DEPTH (${FILTER_NODE_MAX_DEPTH}) levels deep`, () => {
      const selections = expressionSelections(file);
      expect(selections.length).toBeGreaterThan(0);
      for (const { operation, depth } of selections) {
        expect({ operation, depth }).toEqual({ operation, depth: FILTER_NODE_MAX_DEPTH });
      }
    });
  }
});
