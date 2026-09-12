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

// Story 3.7c AC1 — event list/grid surfaces must never request a profile image.
// The four list-view operations that feed EventListView/masonry + standard cards.
const LIST_VIEW_QUERY_NAMES = [
  'getEvents',
  'getEventsForCalendar',
  'getEventsForMyCalendar',
  'getArchivedEvents',
] as const;

const queriesSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'queries.graphql'),
  'utf-8'
);

// The only field paths `profileImageUrl` can be nested under in an event query is
// `sourceSocialMediaAccountProfile` (see `mapper.ts`'s getEventBySlug detail mapping).
// Guard both so a future editor can't sneak the profile image onto a card.
const FORBIDDEN_FIELD_NAMES = ['sourceSocialMediaAccountProfile', 'profileImageUrl'];

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
    // Fragment spreads are not used in queries.graphql; if one is introduced a
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

describe('Event list/grid queries never select a source account profile image (Story 3.7c AC1)', () => {
  const documentNode = parse(queriesSource);

  it.each(LIST_VIEW_QUERY_NAMES)(
    'includes the %s list-view operation in queries.graphql',
    (queryName) => {
      expect(findOperation(documentNode, queryName)).toBeDefined();
    }
  );

  it.each(LIST_VIEW_QUERY_NAMES)(
    '%s never selects sourceSocialMediaAccountProfile or profileImageUrl',
    (queryName) => {
      const operation = findOperation(documentNode, queryName);
      expect(operation).toBeDefined();

      const names = collectSelectedFieldNames(operation!.selectionSet);
      for (const forbidden of FORBIDDEN_FIELD_NAMES) {
        expect(names).not.toContain(forbidden);
      }
    }
  );

  // Deliberately excludes `getEventBySlug` — it is the event-detail query (Story 3.7d's
  // page), not a list/grid surface, and legitimately selects profileImageUrl for the
  // account-attribution avatar there. If it ever stops doing so, this guard is unaffected.
});
