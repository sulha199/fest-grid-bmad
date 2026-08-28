import { GraphQLClient, ClientError } from 'graphql-request';
import { getSupabaseBrowserClient } from './supabase/client';
import { toast } from 'sonner';

const isServer = typeof window === 'undefined';
const endpoint = isServer 
  ? (process.env.BACKEND_GRAPHQL_URL || 'http://localhost:4001/graphql') 
  : typeof window !== 'undefined' ? `${window.location.origin}/api/graphql` : '/api/graphql';

let isHandlingAuthLogout = false;

export const graphqlClient = new GraphQLClient(endpoint, {
  responseMiddleware: (response) => {
    if (
      response instanceof ClientError &&
      response.response.errors?.[0]?.extensions?.code === 'UNAUTHENTICATED'
    ) {
      if (!isServer && !isHandlingAuthLogout) {
        isHandlingAuthLogout = true;

        // Hardcoded English string used because this module has no React hook access (not a component), so it cannot use useTranslations() here.
        // Revisit if/when translation is needed, e.g. by refactoring to a component-level error handler or custom hook.
        toast.error('Session expired. Please log in again.');

        getSupabaseBrowserClient()
          .auth.signOut()
          .catch((err: unknown) => {
            console.error('Auto-logout failed:', err);
          })
          .finally(() => {
            isHandlingAuthLogout = false;
          });
      }
    }
  },
});
