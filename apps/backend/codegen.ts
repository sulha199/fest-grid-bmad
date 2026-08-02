import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'src/schema/*.graphql',
  generates: {
    'src/generated/resolvers-types.ts': {
      plugins: [
        { add: { content: '/* eslint-disable */' } },
        'typescript',
        'typescript-resolvers',
      ],
      config: {
        useIndexSignature: true,
        contextType: '../lib/auth/context.js#GraphQLContext',
      },
    },
  },
};

export default config;
