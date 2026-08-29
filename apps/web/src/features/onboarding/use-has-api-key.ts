import { useAuthSession } from '@/components/providers/auth-session-provider';
import { useGetMyApiKeysQuery } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';

export function useApiKeyStatus(): { hasApiKey: boolean; isLoading: boolean } {
  const { session } = useAuthSession();
  const { data, isLoading } = useGetMyApiKeysQuery(graphqlClient, undefined, {
    enabled: !!session,
  });

  return {
    hasApiKey: (data?.myApiKeys?.length ?? 0) > 0,
    isLoading,
  };
}

export function useHasApiKey(): boolean {
  return useApiKeyStatus().hasApiKey;
}
