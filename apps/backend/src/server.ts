import { createSchema, createYoga } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { resolvers } from './schema/resolvers.js';
import { EnvelopArmor } from '@escape.tech/graphql-armor';

export function buildServer() {
  // Read relative to cwd, assuming server is started from apps/backend
  const typeDefs = readFileSync(resolve(process.cwd(), 'src/schema/typeDefs.graphql'), 'utf8');

  const schema = createSchema({
    typeDefs,
    resolvers,
  });

  const armor = new EnvelopArmor({
    maxDepth: { n: 10 },
    maxAliases: { n: 15 },
    maxDirectives: { n: 50 },
    costLimit: { maxCost: 5000 },
    blockFieldSuggestion: { enabled: true }
  });

  return createYoga({
    schema,
    plugins: [
      ...armor.protect().plugins
    ],
  });
}
