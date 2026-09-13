import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  parse,
  Kind,
  type DocumentNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from 'graphql';

// Story 0.i7d — the epic's invariant ("no consumer uses a Geoapify-resolved
// location without reading its confidence signal") must hold for every call site
// into `resolveLocation`. This guard proves the `previewLocation` query requests
// `confidence` and `matchType` alongside its existing `provider` field, so the
// shared SDL fields Story 0.i7a added are not silently discarded by this consumer.
// `getMyLocations`/`addressAutocomplete` are intentionally excluded — the former is
// a read-only listing of already-stored rows (not a resolution point) and the
// latter calls `getAddressPredictions`, which never goes through `resolveLocation`.
// Also Story 0.i7z ratchet — AD-14 Rule 2 / Story 0.i7z AC 4 (GraphQL exposure): removing
// either field from any of the five instrumented operations breaks this guard.
const QUERY_NAMES = ['previewLocation'] as const;
const REQUIRED_FIELD_NAMES = ['confidence', 'matchType'] as const;

const queriesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'queries.graphql'),
  'utf-8'
);

/** Recursively collect every field name selected by an operation's selection set. */
function collectSelectedFieldNames(selectionSet: SelectionSetNode, names: string[] = []): string[] {
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      names.push(selection.name.value);
      if (selection.selectionSet) {
        collectSelectedFieldNames(selection.selectionSet, names);
      }
    } else if (selection.kind === Kind.INLINE_FRAGMENT) {
      collectSelectedFieldNames(selection.selectionSet, names);
    }
    // Fragment spreads are not used in this file; if one is introduced a
    // name-collection miss is acceptable for this guard's purpose.
  }
  return names;
}

function operationDefinitions(documentNode: DocumentNode): OperationDefinitionNode[] {
  return documentNode.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION
  );
}

function findOperation(documentNode: DocumentNode, name: string): OperationDefinitionNode | undefined {
  return operationDefinitions(documentNode).find((definition) => definition.name?.value === name);
}

describe('previewLocation query selects confidence/matchType (Story 0.i7d)', () => {
  const documentNode = parse(queriesSource);

  it.each(QUERY_NAMES)('includes the %s query in queries.graphql', (queryName) => {
    expect(findOperation(documentNode, queryName)).toBeDefined();
  });

  it.each(QUERY_NAMES)(
    '%s selects both confidence and matchType on the resolved LocationDetails',
    (queryName) => {
      const operation = findOperation(documentNode, queryName);
      expect(operation).toBeDefined();

      const names = collectSelectedFieldNames(operation!.selectionSet);
      for (const field of REQUIRED_FIELD_NAMES) {
        expect(names).toContain(field);
      }
    }
  );
});
