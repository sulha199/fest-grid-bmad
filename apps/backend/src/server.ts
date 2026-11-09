import { createSchema, createYoga } from 'graphql-yoga';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { resolvers } from './schema/resolvers.js';
import { EnvelopArmor } from '@escape.tech/graphql-armor';
import { createContext, GraphQLContext } from './lib/auth/context.js';
// BUG-100: register-adapters.ts populates the registry resolvers.ts (extract-by-URL) and
// lookupAccountProfile read from. buildServer() is the one function shared by local dev
// (src/index.ts) and the API Lambda (lambdas/api.ts, which previously imported only
// buildServer and nothing else from the scraper package) -- importing it here, rather than
// adding a second import to lambdas/api.ts, guarantees every current and future buildServer()
// caller gets it instead of relying on each caller to remember to import it separately.
import './lib/scraper/register-adapters.js';

import { join } from 'path';
import { readdirSync } from 'fs';

export function buildServer() {
  // Read relative to cwd, assuming server is started from apps/backend
  const schemaDir = resolve(process.cwd(), 'src/schema');
  const files = readdirSync(schemaDir).filter(f => f.endsWith('.graphql'));
  const typeDefs = files.map(f => readFileSync(join(schemaDir, f), 'utf8')).join('\n');

  const schema = createSchema<GraphQLContext>({
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
    context: createContext,
    plugins: [
      ...armor.protect().plugins
    ],
  });
}
