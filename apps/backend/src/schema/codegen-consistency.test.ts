import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { EventCategory } from '@festgrid/shared-types';

// Guards against stale *committed* codegen output: schema-consistency.test.ts already
// proves the GraphQL SDL matches @festgrid/shared-types' EventCategory, but neither the
// committed `apps/web/src/generated/graphql.ts` nor the committed
// `apps/backend/src/generated/resolvers-types.ts` were previously re-checked against the
// enum after `pnpm codegen` runs -- a forgotten regen (or a hand-edit of either generated
// file) would otherwise only surface as a runtime type mismatch, not a CI failure. This
// test reads both files as plain text (they're compiled .ts output, not SDL, so graphql's
// parse() doesn't apply the way schema-consistency.test.ts uses it) and asserts each
// file's EventCategory member *set* equals Object.values(EventCategory) exactly. (AD-44
// Rule 6; Story 0.53 AC5, closing feasibility-review gap D3/D4.)

const webGraphqlPath = resolve(process.cwd(), '../web/src/generated/graphql.ts');
const backendResolversTypesPath = resolve(process.cwd(), 'src/generated/resolvers-types.ts');

/** Extracts the quoted string-literal values inside a named TS enum/union-type block. */
function extractMembers(source: string, blockStartRegex: RegExp, terminator: '}' | ';'): string[] {
  const startMatch = blockStartRegex.exec(source);
  assert.ok(startMatch, `Expected to find a match for ${blockStartRegex} in the source`);
  const startIndex = startMatch.index + startMatch[0].length;
  const endIndex = source.indexOf(terminator, startIndex);
  assert.ok(endIndex !== -1, `Expected to find a terminating "${terminator}" after the match`);
  const block = source.slice(startIndex, endIndex);
  const values: string[] = [];
  const valueRegex = /'([A-Z_]+)'/g;
  let valueMatch: RegExpExecArray | null;
  while ((valueMatch = valueRegex.exec(block)) !== null) {
    values.push(valueMatch[1]);
  }
  return values;
}

function extractWebEventCategoryMembers(source: string): string[] {
  // export enum EventCategory {\n  Key = 'VALUE',\n  ...\n}
  return extractMembers(source, /export enum EventCategory \{/, '}');
}

function extractBackendEventCategoryMembers(source: string): string[] {
  // export type EventCategory =\n  | 'VALUE'\n  | ...\n;
  return extractMembers(source, /export type EventCategory =/, ';');
}

test('committed codegen outputs stay in sync with @festgrid/shared-types EventCategory', async (t) => {
  const expected = [...Object.values(EventCategory)].sort();

  await t.test('apps/web/src/generated/graphql.ts', () => {
    const source = readFileSync(webGraphqlPath, 'utf8');
    const members = extractWebEventCategoryMembers(source).sort();
    assert.deepStrictEqual(members, expected);
  });

  await t.test('apps/backend/src/generated/resolvers-types.ts', () => {
    const source = readFileSync(backendResolversTypesPath, 'utf8');
    const members = extractBackendEventCategoryMembers(source).sort();
    assert.deepStrictEqual(members, expected);
  });

  await t.test('negative control: a synthetic stale list missing one member fails the assertion', () => {
    const stale = expected.slice(1); // drop the first member
    assert.throws(() => assert.deepStrictEqual(stale, expected));
  });
});
