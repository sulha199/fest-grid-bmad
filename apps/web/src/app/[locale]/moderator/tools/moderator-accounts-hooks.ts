'use client';

import { useQueryModeratorAccountProfilesQuery, useSetImageStorageOptInMutation as useGeneratedSetImageStorageOptInMutation } from '@/generated/graphql';
import { graphqlClient } from '@/lib/graphql-client';
import type { ModeratorAccountProfileFilters } from '@/gql/graphql';

export function useQueryModeratorAccountProfiles(
  filters: ModeratorAccountProfileFilters | undefined,
  cursor: string | undefined,
  pageSize: number,
  enabled: boolean
) {
  return useQueryModeratorAccountProfilesQuery(
    graphqlClient,
    { filters: filters || {}, first: pageSize, after: cursor },
    { enabled, staleTime: 0, gcTime: 1000 * 60 * 5 }
  );
}

export function useSetImageStorageOptInMutation() {
  const mutation = useGeneratedSetImageStorageOptInMutation(graphqlClient);

  return {
    mutateAsync: async ({ accountId, optedIn }: { accountId: string; optedIn: boolean }) => {
      const result = await mutation.mutateAsync({ accountId, optedIn });
      return result.setImageStorageOptIn;
    },
    isPending: mutation.isPending,
  };
}