import { useAuthSession } from '@/components/providers/auth-session-provider';
import { useGetMyApiKeysQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

export function useHasApiKey(): boolean {
  const { session } = useAuthSession();
  const { data } = useGetMyApiKeysQuery(graphqlClient, undefined, {
    enabled: !!session,
  });

  return (data?.myApiKeys.length ?? 0) > 0;
}
