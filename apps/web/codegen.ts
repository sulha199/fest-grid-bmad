import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../backend/src/schema/**/*.graphql',
  documents: 'src/**/*.graphql',
  ignoreNoDocuments: true,
  generates: {
    'src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-query'
      ],
      config: {
        fetcher: 'graphql-request',
        documentMode: 'string',
        reactQueryVersion: 5
      }
    }
  }
};

export default config;
