'use client';

import { useQueryModeratorAccountProfilesQuery, useSetImageStorageOptInMutation as useGeneratedSetImageStorageOptInMutation, useClearAccountDefaultLocationMutation as useGeneratedClearAccountDefaultLocationMutation } from '@/generated/graphql';
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

export function useClearAccountDefaultLocationMutation() {
  const mutation = useGeneratedClearAccountDefaultLocationMutation(graphqlClient);

  return {
    mutateAsync: async ({ accountId }: { accountId: string }) => {
      const result = await mutation.mutateAsync({ accountId });
      return result.clearAccountDefaultLocation;
    },
    isPending: mutation.isPending,
  };
}