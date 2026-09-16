import test from 'node:test';
import assert from 'node:assert';
import { readFileSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { parse, Kind, type EnumTypeDefinitionNode } from 'graphql';
import { createSchema } from 'graphql-yoga';
import { EventCategory, EventType } from '@festgrid/shared-types';
import { resolvers } from './resolvers.js';

// Guards against drift between this project's two hand-maintained
// EventCategory/EventType sources: the GraphQL SDL (this directory's
// events.graphql) and the TS enum (@festgrid/shared-types). A mismatch here
// (a member added/renamed/removed in only one place) would otherwise only
// surface as a runtime GraphQL coercion error or a silently-wrong client
// type -- this test fails CI immediately instead.

const schemaDir = resolve(process.cwd(), 'src/schema');

function readEnumMembers(sdl: string, enumName: string): string[] {
  const document = parse(sdl);
  const enumNode = document.definitions.find(
    (def): def is EnumTypeDefinitionNode =>
      def.kind === Kind.ENUM_TYPE_DEFINITION && def.name.value === enumName
  );
  assert.ok(enumNode, `Expected to find "enum ${enumName}" in the SDL`);
  return enumNode.values?.map((value) => value.name.value) ?? [];
}

test('EventCategory/EventType SDL stays in sync with @festgrid/shared-types', async (t) => {
  const eventsGraphqlPath = join(schemaDir, 'events.graphql');
  const sdl = readFileSync(eventsGraphqlPath, 'utf8');

  await t.test('EventType members match exactly', () => {
    const sdlMembers = readEnumMembers(sdl, 'EventType').sort();
    const sharedTypesMembers = Object.values(EventType).sort();
    assert.deepStrictEqual(sdlMembers, sharedTypesMembers);
  });

  await t.test('EventCategory members match exactly', () => {
    const sdlMembers = readEnumMembers(sdl, 'EventCategory').sort();
    const sharedTypesMembers = Object.values(EventCategory).sort();
    assert.deepStrictEqual(sdlMembers, sharedTypesMembers);
  });
});

test('the runtime-merged GraphQL schema builds without throwing', () => {
  // Mirrors buildServer()'s exact schema-assembly logic (apps/backend/src/server.ts)
  // -- reads every *.graphql file in this directory and merges them as one
  // typeDefs string -- without going through buildServer()'s full
  // createYoga()/context/armor wrapping, which this test doesn't need.
  const files = readdirSync(schemaDir).filter((f) => f.endsWith('.graphql'));
  const typeDefs = files.map((f) => readFileSync(join(schemaDir, f), 'utf8')).join('\n');

  assert.doesNotThrow(() => {
    createSchema({
      typeDefs,
      resolvers,
    });
  });
});
