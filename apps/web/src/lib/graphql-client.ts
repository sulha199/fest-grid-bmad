import { GraphQLClient } from 'graphql-request';

const isServer = typeof window === 'undefined';
const endpoint = isServer 
  ? (process.env.BACKEND_GRAPHQL_URL || 'http://localhost:4001/graphql') 
  : typeof window !== 'undefined' ? `${window.location.origin}/api/graphql` : '/api/graphql';

export const graphqlClient = new GraphQLClient(endpoint);
